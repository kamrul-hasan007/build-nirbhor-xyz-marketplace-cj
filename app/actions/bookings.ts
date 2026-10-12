'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  addresses,
  areas,
  bookingItems,
  bookingStatusLogs,
  bookings,
  commissionSettings,
  createId,
  defaultAdvancePolicy,
  packages,
  serviceCategories,
  services,
} from '@/lib/db/schema'

const bookingInputSchema = z.object({
  items: z.array(z.object({ packageId: z.string().min(1), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
  cityId: z.string().min(1),
  areaId: z.string().min(1),
  addressLine: z.string().trim().min(8).max(500),
  label: z.enum(['Home', 'Work', 'Other']),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduledTime: z.enum(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']),
})

type BookingResult =
  | { success: true; bookingId: string; message: string }
  | { success: false; message: string }

export async function createBooking(input: unknown): Promise<BookingResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { success: false, message: 'Sign in to confirm your booking.' }

  const parsed = bookingInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, message: 'Please check the booking details and try again.' }

  const quantities = new Map<string, number>()
  for (const item of parsed.data.items) {
    quantities.set(item.packageId, (quantities.get(item.packageId) ?? 0) + item.quantity)
  }
  const totalQuantity = [...quantities.values()].reduce((sum, count) => sum + count, 0)
  if ([...quantities.values()].some((quantity) => quantity > 10) || totalQuantity > 20) {
    return { success: false, message: 'Please keep each service to 10 or fewer and your booking to 20 items or fewer.' }
  }

  const [year, month, day] = parsed.data.scheduledDate.split('-').map(Number)
  const validDate = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === parsed.data.scheduledDate
  const scheduledAt = new Date(`${parsed.data.scheduledDate}T${parsed.data.scheduledTime}:00+06:00`)
  if (!validDate || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    return { success: false, message: 'Choose a valid service time in the future.' }
  }

  const packageIds = [...quantities.keys()]
  const outcome = await db.transaction(async (tx): Promise<BookingResult> => {
    const [area] = await tx
      .select({ id: areas.id, cityId: areas.cityId, codEnabled: areas.codEnabled })
      .from(areas)
      .where(and(eq(areas.id, parsed.data.areaId), eq(areas.cityId, parsed.data.cityId), eq(areas.isActive, true)))
      .limit(1)
    if (!area) return { success: false, message: 'That area is not currently available. Please choose another.' }

    const selectedPackages = await tx
      .select({ packageId: packages.id, serviceId: services.id, priceBdt: packages.priceBdt, cityIds: services.cityIds })
      .from(packages)
      .innerJoin(services, eq(packages.serviceId, services.id))
      .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
      .where(and(inArray(packages.id, packageIds), eq(packages.isActive, true), eq(services.isActive, true), eq(serviceCategories.isActive, true)))

    if (selectedPackages.length !== packageIds.length) {
      return { success: false, message: 'One of these services is no longer available. Please refresh your cart.' }
    }
    if (selectedPackages.some((item) => !Array.isArray(item.cityIds) || !item.cityIds.includes(parsed.data.cityId))) {
      return { success: false, message: 'One of these services is not available in the selected city.' }
    }

    const subtotal = selectedPackages.reduce((total, item) => total + item.priceBdt * (quantities.get(item.packageId) ?? 0), 0)
    const [policy] = await tx.select().from(commissionSettings).limit(1)
    const threshold = policy?.advanceThresholdBdt ?? defaultAdvancePolicy.thresholdBdt
    const advancePercent = policy?.advancePercent ?? defaultAdvancePolicy.percent

    if (subtotal >= threshold) {
      const advanceDue = Math.ceil((subtotal * advancePercent) / 100)
      return {
        success: false,
        message: `This booking requires a ${advancePercent}% advance payment (${new Intl.NumberFormat('en-BD').format(advanceDue)} BDT). Secure online payments are not configured yet, so it cannot be confirmed today.`,
      }
    }
    if (!area.codEnabled) {
      return { success: false, message: 'Cash on delivery is not available in this area, and online payments are not configured yet.' }
    }

    const bookingId = createId('booking')
    const addressId = createId('address')
    await tx.insert(addresses).values({
      id: addressId,
      userId: session.user.id,
      label: parsed.data.label,
      addressLine: parsed.data.addressLine,
      areaId: area.id,
      cityId: area.cityId,
    })
    await tx.insert(bookings).values({
      id: bookingId,
      userId: session.user.id,
      addressId,
      scheduledAt,
      status: 'REQUESTED',
      paymentMethod: 'COD',
      subtotalBdt: subtotal,
      discountBdt: 0,
      totalBdt: subtotal,
      advanceDueBdt: 0,
      cancellationFeeBdt: 0,
    })
    await tx.insert(bookingItems).values(
      selectedPackages.map((item) => {
        const quantity = quantities.get(item.packageId) ?? 0
        return {
          id: createId('booking_item'),
          bookingId,
          packageId: item.packageId,
          serviceId: item.serviceId,
          quantity,
          unitPriceBdt: item.priceBdt,
          lineTotalBdt: item.priceBdt * quantity,
        }
      }),
    )
    await tx.insert(bookingStatusLogs).values({
      id: createId('booking_log'),
      bookingId,
      actorUserId: session.user.id,
      fromStatus: null,
      toStatus: 'REQUESTED',
      note: 'Customer booking submitted.',
    })
    return { success: true, bookingId, message: 'Your booking request is confirmed.' }
  })

  if (outcome.success) revalidatePath('/orders')
  return outcome
}

export const bookingInputLimits = { quantityPerPackage: 10, totalQuantity: 20 } as const
