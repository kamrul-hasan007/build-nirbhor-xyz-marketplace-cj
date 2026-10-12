'use server'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLogs, bookingItems, bookingStatusLogs, bookings, canTransitionBooking, commissionSettings, commissions, createId, defaultCommissionRateBps, payments, providerDuesLedger, providerProfiles, providerServices, services, user } from '@/lib/db/schema'
import { encryptProviderPayout } from '@/lib/marketplace/encryption'

const providerApplicationSchema = z.object({
  services: z.array(z.object({ serviceId: z.string().min(1).max(200), proposedChargeBdt: z.number().int().min(100).max(1_000_000) })).min(1).max(20),
  nidDocumentPath: z.string().min(1).max(500),
  documentPaths: z.array(z.string().min(1).max(500)).max(5),
  payout: z.object({ method: z.enum(['BANK', 'BKASH', 'NAGAD', 'ROCKET']), accountName: z.string().trim().min(2).max(100), accountNumber: z.string().trim().min(6).max(40) }),
})

async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() })
}

async function getAdminSession() {
  const session = await getCurrentSession()
  if (!session?.user || !['super_admin', 'operations'].includes(session.user.role)) return null
  return session
}

async function getFinanceSession() {
  const session = await getCurrentSession()
  if (!session?.user || !['super_admin', 'finance'].includes(session.user.role)) return null
  return session
}

function belongsToProvider(path: string, userId: string) {
  return path.startsWith(`providers/${userId}/`) && path.length <= 500
}

export async function applyProviderApplication(input: unknown) {
  const session = await getCurrentSession()
  if (!session?.user) return { success: false, message: 'Sign in before applying.' }
  const parsed = providerApplicationSchema.safeParse(input)
  if (!parsed.success) return { success: false, message: 'Check the application details and uploaded documents.' }

  const uniqueServices = new Set(parsed.data.services.map((item) => item.serviceId))
  const allPaths = [parsed.data.nidDocumentPath, ...parsed.data.documentPaths]
  if (uniqueServices.size !== parsed.data.services.length || allPaths.some((path) => !belongsToProvider(path, session.user.id))) {
    return { success: false, message: 'One of the submitted documents or services is not valid.' }
  }

  const encryptedPayout = encryptProviderPayout(parsed.data.payout)
  const result = await db.transaction(async (tx) => {
    const existingServices = await tx.select({ id: services.id }).from(services).where(and(inArray(services.id, [...uniqueServices]), eq(services.isActive, true)))
    if (existingServices.length !== uniqueServices.size) return { success: false as const, message: 'A selected service is no longer available.' }

    const [existing] = await tx.select().from(providerProfiles).where(eq(providerProfiles.userId, session.user.id)).limit(1)
    if (existing && existing.status !== 'REJECTED') {
      return { success: false as const, message: existing.status === 'APPROVED' ? 'Your provider profile is already approved.' : 'Your provider application is already under review.' }
    }

    const providerId = existing?.id ?? createId('provider')
    if (existing) {
      await tx.update(providerProfiles).set({ status: 'PENDING', availability: 'unavailable', nidDocumentUrl: parsed.data.nidDocumentPath, documentUrls: parsed.data.documentPaths, payoutDetails: encryptedPayout, approvedAt: null, updatedAt: new Date() }).where(eq(providerProfiles.id, providerId))
      await tx.delete(providerServices).where(eq(providerServices.providerId, providerId))
    } else {
      await tx.insert(providerProfiles).values({ id: providerId, userId: session.user.id, status: 'PENDING', availability: 'unavailable', nidDocumentUrl: parsed.data.nidDocumentPath, documentUrls: parsed.data.documentPaths, payoutDetails: encryptedPayout })
    }
    await tx.insert(providerServices).values(parsed.data.services.map((service) => ({ id: createId('provider_service'), providerId, serviceId: service.serviceId, proposedChargeBdt: service.proposedChargeBdt, isApproved: false })))
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: 'provider.application_submitted', entityType: 'provider_profile', entityId: providerId, afterState: { status: 'PENDING', serviceCount: parsed.data.services.length } })
    return { success: true as const, message: 'Application submitted for admin review.' }
  })

  if (result.success) revalidatePath('/provider')
  return result
}

export async function setProviderAvailability(input: unknown) {
  const parsed = z.boolean().safeParse(input)
  if (!parsed.success) return { success: false, message: 'Choose a valid availability setting.' }
  const session = await getCurrentSession()
  if (!session?.user) return { success: false, message: 'Sign in to update availability.' }
  const isAvailable = parsed.data
  const [profile] = await db.select().from(providerProfiles).where(and(eq(providerProfiles.userId, session.user.id), eq(providerProfiles.status, 'APPROVED'))).limit(1)
  if (!profile) return { success: false, message: 'An approved provider profile is required.' }
  const availability = isAvailable ? 'available' : 'unavailable'
  await db.update(providerProfiles).set({ availability, updatedAt: new Date() }).where(eq(providerProfiles.id, profile.id))
  revalidatePath('/provider')
  return { success: true, message: `You are now ${availability}.` }
}

export async function transitionProviderBooking(bookingIdInput: unknown, nextStatusInput: unknown) {
  const parsed = z.object({ bookingId: z.string().min(1).max(200), nextStatus: z.enum(['ACCEPTED', 'REJECTED', 'ON_THE_WAY', 'STARTED', 'COMPLETED']) }).safeParse({ bookingId: bookingIdInput, nextStatus: nextStatusInput })
  if (!parsed.success) return { success: false, message: 'Choose a valid booking update.' }
  const { bookingId, nextStatus } = parsed.data
  const session = await getCurrentSession()
  if (!session?.user) return { success: false, message: 'Sign in to update a booking.' }
  return db.transaction(async (tx) => {
    const [profile] = await tx.select().from(providerProfiles).where(and(eq(providerProfiles.userId, session.user.id), eq(providerProfiles.status, 'APPROVED'))).for('update').limit(1)
    if (!profile) return { success: false, message: 'An approved provider profile is required.' }
    const [booking] = await tx.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.providerId, profile.id))).limit(1)
    if (!booking || !canTransitionBooking(booking.status, nextStatus)) return { success: false, message: 'This booking cannot be updated from its current status.' }
    const [updated] = await tx.update(bookings).set({ status: nextStatus, updatedAt: new Date() }).where(and(eq(bookings.id, booking.id), eq(bookings.status, booking.status), eq(bookings.providerId, profile.id))).returning({ id: bookings.id })
    if (!updated) return { success: false, message: 'This booking was updated by someone else. Refresh and try again.' }

    let commissionBdt = 0
    if (nextStatus === 'COMPLETED') {
      const [policy] = await tx.select().from(commissionSettings).limit(1)
      const rateBasisPoints = policy?.rateBasisPoints ?? defaultCommissionRateBps
      commissionBdt = Math.round((booking.totalBdt * rateBasisPoints) / 10_000)
      await tx.insert(commissions).values({ id: createId('commission'), bookingId, providerId: profile.id, rateBasisPoints, amountBdt: commissionBdt })
      if (booking.paymentMethod === 'COD' && commissionBdt > 0) {
        const [ledger] = await tx.select({ balance: sql<number>`coalesce(sum(${providerDuesLedger.amountBdt}), 0)` }).from(providerDuesLedger).where(eq(providerDuesLedger.providerId, profile.id))
        const balanceAfterBdt = Number(ledger?.balance ?? 0) + commissionBdt
        await tx.insert(providerDuesLedger).values({ id: createId('provider_due'), providerId: profile.id, bookingId, entryType: 'COD_COMMISSION_DUE', amountBdt: commissionBdt, balanceAfterBdt, memo: `COD commission at ${rateBasisPoints} basis points.` })
      }
    }

    await tx.insert(bookingStatusLogs).values({ id: createId('booking_log'), bookingId, actorUserId: session.user.id, fromStatus: booking.status, toStatus: nextStatus, note: 'Provider updated the booking.' })
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: 'booking.status_changed', entityType: 'booking', entityId: bookingId, beforeState: { status: booking.status }, afterState: { status: nextStatus, commissionBdt } })
    return { success: true, message: `Booking updated to ${nextStatus.replaceAll('_', ' ').toLowerCase()}.` }
  }).then((result) => {
    if (result.success) revalidatePath('/provider')
    return result
  })
}

export async function reviewProviderApplication(providerIdInput: unknown, decisionInput: unknown) {
  const parsed = z.object({ providerId: z.string().min(1).max(200), decision: z.enum(['APPROVED', 'REJECTED']) }).safeParse({ providerId: providerIdInput, decision: decisionInput })
  if (!parsed.success) return { success: false, message: 'Choose a valid application decision.' }
  const { providerId, decision } = parsed.data
  const session = await getAdminSession()
  if (!session) return { success: false, message: 'You are not authorized to review applications.' }
  const result = await db.transaction(async (tx) => {
    const [profile] = await tx.select().from(providerProfiles).where(eq(providerProfiles.id, providerId)).limit(1)
    if (!profile || profile.status !== 'PENDING') return { success: false as const, message: 'This application is no longer pending.' }
    const proposedServices = await tx.select().from(providerServices).where(eq(providerServices.providerId, providerId))
    if (decision === 'APPROVED' && proposedServices.length === 0) return { success: false as const, message: 'This application has no proposed services.' }
    await tx.update(providerProfiles).set({ status: decision, availability: 'unavailable', approvedAt: decision === 'APPROVED' ? new Date() : null, updatedAt: new Date() }).where(eq(providerProfiles.id, providerId))
    if (decision === 'APPROVED') {
      await tx.update(providerServices).set({ isApproved: true, approvedChargeBdt: sql`${providerServices.proposedChargeBdt}` }).where(eq(providerServices.providerId, providerId))
      await tx.update(user).set({ role: 'provider', updatedAt: new Date() }).where(eq(user.id, profile.userId))
    }
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: decision === 'APPROVED' ? 'provider.approved' : 'provider.rejected', entityType: 'provider_profile', entityId: providerId, beforeState: { status: profile.status }, afterState: { status: decision, approvedServices: decision === 'APPROVED' ? proposedServices.length : 0 } })
    return { success: true as const, message: `Provider application ${decision.toLowerCase()}.` }
  })
  if (result.success) revalidatePath('/admin')
  return result
}

export async function assignBookingToProvider(bookingIdInput: unknown, providerIdInput: unknown) {
  const parsed = z.object({ bookingId: z.string().min(1).max(200), providerId: z.string().min(1).max(200) }).safeParse({ bookingId: bookingIdInput, providerId: providerIdInput })
  if (!parsed.success) return { success: false, message: 'Choose a valid booking and provider.' }
  const { bookingId, providerId } = parsed.data
  const session = await getAdminSession()
  if (!session) return { success: false, message: 'You are not authorized to assign bookings.' }
  const result = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
    if (!booking || !['REQUESTED', 'REJECTED', 'NOT_RESPONDED'].includes(booking.status)) return { success: false as const, message: 'This booking is not available for assignment.' }
    const [profile] = await tx.select().from(providerProfiles).where(and(eq(providerProfiles.id, providerId), eq(providerProfiles.status, 'APPROVED'), eq(providerProfiles.availability, 'available'))).limit(1)
    if (!profile) return { success: false as const, message: 'Choose an approved provider who is currently available.' }
    const serviceRows = await tx.select({ serviceId: bookingItems.serviceId }).from(bookingItems).where(eq(bookingItems.bookingId, bookingId))
    const requiredServices = [...new Set(serviceRows.map((item) => item.serviceId))]
    if (!requiredServices.length) return { success: false as const, message: 'The booking has no service items.' }
    const providerRows = await tx.select({ serviceId: providerServices.serviceId }).from(providerServices).where(and(eq(providerServices.providerId, providerId), eq(providerServices.isApproved, true), inArray(providerServices.serviceId, requiredServices)))
    if (new Set(providerRows.map((item) => item.serviceId)).size !== requiredServices.length) return { success: false as const, message: 'This provider is not approved for every service in the booking.' }
    if (!canTransitionBooking(booking.status, 'ASSIGNED')) return { success: false as const, message: 'This booking cannot be assigned from its current status.' }
    const [updated] = await tx.update(bookings).set({ providerId, status: 'ASSIGNED', updatedAt: new Date() }).where(and(eq(bookings.id, bookingId), eq(bookings.status, booking.status))).returning({ id: bookings.id })
    if (!updated) return { success: false as const, message: 'This booking was updated by someone else. Refresh and try again.' }
    await tx.insert(bookingStatusLogs).values({ id: createId('booking_log'), bookingId, actorUserId: session.user.id, fromStatus: booking.status, toStatus: 'ASSIGNED', note: 'Admin assigned an approved provider.' })
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: 'booking.provider_assigned', entityType: 'booking', entityId: bookingId, beforeState: { status: booking.status, providerId: booking.providerId }, afterState: { status: 'ASSIGNED', providerId } })
    return { success: true as const, message: 'Provider assigned.' }
  })
  if (result.success) revalidatePath('/admin')
  return result
}

export async function recordCODPaymentReceived(bookingIdInput: unknown) {
  const parsed = z.string().min(1).max(200).safeParse(bookingIdInput)
  if (!parsed.success) return { success: false, message: 'Choose a valid booking.' }
  const session = await getFinanceSession()
  if (!session) return { success: false, message: 'Finance permissions are required to record cash collection.' }
  const result = await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, parsed.data)).for('update').limit(1)
    if (!booking) return { success: false as const, message: 'Booking not found.' }
    if (booking.status === 'PAID') return { success: true as const, message: 'Cash collection is already recorded.' }
    if (booking.paymentMethod !== 'COD' || !canTransitionBooking(booking.status, 'PAID')) {
      return { success: false as const, message: 'Only a completed cash-on-delivery booking can be recorded as paid.' }
    }
    const [updated] = await tx.update(bookings).set({ status: 'PAID', updatedAt: new Date() }).where(and(eq(bookings.id, booking.id), eq(bookings.status, 'COMPLETED'))).returning({ id: bookings.id })
    if (!updated) return { success: false as const, message: 'This booking changed. Refresh and try again.' }
    await tx.insert(payments).values({ id: createId('payment'), bookingId: booking.id, userId: booking.userId, amountBdt: booking.totalBdt, method: 'COD', status: 'PAID', idempotencyKey: `cod-cash:${booking.id}` })
    await tx.insert(bookingStatusLogs).values({ id: createId('booking_log'), bookingId: booking.id, actorUserId: session.user.id, fromStatus: booking.status, toStatus: 'PAID', note: 'Finance recorded provider cash collection.' })
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: 'booking.cod_payment_recorded', entityType: 'booking', entityId: booking.id, beforeState: { status: booking.status }, afterState: { status: 'PAID', amountBdt: booking.totalBdt } })
    return { success: true as const, message: 'Cash collection recorded.' }
  })
  if (result.success) {
    revalidatePath('/admin')
    revalidatePath('/orders')
  }
  return result
}

export async function recordProviderDuesSettlement(input: unknown) {
  const parsed = z.object({ providerId: z.string().min(1).max(200), amountBdt: z.number().int().min(1).max(10_000_000), memo: z.string().trim().min(3).max(250) }).safeParse(input)
  if (!parsed.success) return { success: false, message: 'Enter a valid settlement amount and reference.' }
  const session = await getFinanceSession()
  if (!session) return { success: false, message: 'Finance permissions are required to record settlements.' }

  const result = await db.transaction(async (tx) => {
    const [profile] = await tx.select().from(providerProfiles).where(and(eq(providerProfiles.id, parsed.data.providerId), eq(providerProfiles.status, 'APPROVED'))).for('update').limit(1)
    if (!profile) return { success: false as const, message: 'Approved provider not found.' }
    const [ledger] = await tx.select({ balance: sql<number>`coalesce(sum(${providerDuesLedger.amountBdt}), 0)` }).from(providerDuesLedger).where(eq(providerDuesLedger.providerId, profile.id))
    const previousBalance = Number(ledger?.balance ?? 0)
    if (parsed.data.amountBdt > previousBalance) return { success: false as const, message: 'Settlement cannot exceed the current COD commission due.' }
    const balanceAfterBdt = previousBalance - parsed.data.amountBdt
    await tx.insert(providerDuesLedger).values({ id: createId('provider_due'), providerId: profile.id, entryType: 'ADMIN_SETTLEMENT', amountBdt: -parsed.data.amountBdt, balanceAfterBdt, memo: parsed.data.memo })
    await tx.insert(auditLogs).values({ id: createId('audit'), actorUserId: session.user.id, action: 'provider.cod_dues_settled', entityType: 'provider_profile', entityId: profile.id, beforeState: { balanceBdt: previousBalance }, afterState: { balanceBdt: balanceAfterBdt, settlementBdt: parsed.data.amountBdt, memo: parsed.data.memo } })
    return { success: true as const, message: 'Provider dues settlement recorded.' }
  })
  if (result.success) {
    revalidatePath('/admin')
    revalidatePath('/provider')
  }
  return result
}

