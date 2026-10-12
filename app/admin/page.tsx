import { and, asc, count, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AdminWorkspace, WorkspaceHeader } from '@/components/workspaces'
import { auth, isMarketplaceAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { addresses, areas, bookingItems, bookings, cities, providerDuesLedger, providerProfiles, providerServices, services, user } from '@/lib/db/schema'

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isMarketplaceAdmin(session.user.role)) redirect('/')

  const [bookingCounts, pendingProviders, bookingRows, activeProviders] = await Promise.all([
    db.select({ status: bookings.status, total: count() }).from(bookings).groupBy(bookings.status),
    db.select({ id: providerProfiles.id, name: user.name, email: user.email, createdAt: providerProfiles.createdAt, nidPath: providerProfiles.nidDocumentUrl, documentUrls: providerProfiles.documentUrls }).from(providerProfiles).innerJoin(user, eq(providerProfiles.userId, user.id)).where(eq(providerProfiles.status, 'PENDING')).orderBy(desc(providerProfiles.createdAt)).limit(50),
    db.select({ id: bookings.id, status: bookings.status, scheduledAt: bookings.scheduledAt, totalBdt: bookings.totalBdt, areaName: areas.name, cityName: cities.name, serviceName: services.name }).from(bookings).innerJoin(addresses, eq(bookings.addressId, addresses.id)).innerJoin(areas, eq(addresses.areaId, areas.id)).innerJoin(cities, eq(addresses.cityId, cities.id)).innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id)).innerJoin(services, eq(bookingItems.serviceId, services.id)).where(inArray(bookings.status, ['REQUESTED', 'REJECTED', 'NOT_RESPONDED'])).orderBy(asc(bookings.scheduledAt)).limit(100),
    db.select({ id: providerProfiles.id, name: user.name }).from(providerProfiles).innerJoin(user, eq(providerProfiles.userId, user.id)).where(and(eq(providerProfiles.status, 'APPROVED'), eq(providerProfiles.availability, 'available'))),
  ])

  const isOperations = ['super_admin', 'operations'].includes(session.user.role)
  const isFinance = ['super_admin', 'finance'].includes(session.user.role)
  const cashRows = isFinance
    ? await db.select({ id: bookings.id, status: bookings.status, scheduledAt: bookings.scheduledAt, totalBdt: bookings.totalBdt, areaName: areas.name, cityName: cities.name, serviceName: services.name }).from(bookings).innerJoin(addresses, eq(bookings.addressId, addresses.id)).innerJoin(areas, eq(addresses.areaId, areas.id)).innerJoin(cities, eq(addresses.cityId, cities.id)).innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id)).innerJoin(services, eq(bookingItems.serviceId, services.id)).where(and(eq(bookings.status, 'COMPLETED'), eq(bookings.paymentMethod, 'COD'))).orderBy(asc(bookings.scheduledAt)).limit(100)
    : []
  const financeProviders = isFinance
    ? await db.select({ id: providerProfiles.id, name: user.name }).from(providerProfiles).innerJoin(user, eq(providerProfiles.userId, user.id)).where(eq(providerProfiles.status, 'APPROVED'))
    : []
  const ledgerRows = financeProviders.length
    ? await db.select({ providerId: providerDuesLedger.providerId, amountBdt: providerDuesLedger.amountBdt }).from(providerDuesLedger).where(inArray(providerDuesLedger.providerId, financeProviders.map((provider) => provider.id)))
    : []
  const dueBalances = new Map<string, number>()
  for (const entry of ledgerRows) dueBalances.set(entry.providerId, (dueBalances.get(entry.providerId) ?? 0) + entry.amountBdt)
  const providerDues = financeProviders.map((provider) => ({ id: provider.id, name: provider.name, balanceBdt: dueBalances.get(provider.id) ?? 0 })).filter((provider) => provider.balanceBdt > 0)
  const cashBookingsMap = new Map<string, { id: string; status: string; scheduledAt: string; totalBdt: number; cityName: string; areaName: string; services: string[] }>()
  for (const row of cashRows) {
    const booking = cashBookingsMap.get(row.id) ?? { id: row.id, status: row.status, scheduledAt: row.scheduledAt.toISOString(), totalBdt: row.totalBdt, cityName: row.cityName, areaName: row.areaName, services: [] }
    if (!booking.services.includes(row.serviceName)) booking.services.push(row.serviceName)
    cashBookingsMap.set(row.id, booking)
  }

  const proposals = pendingProviders.length ? await db.select({ providerId: providerServices.providerId, serviceName: services.name, proposedChargeBdt: providerServices.proposedChargeBdt }).from(providerServices).innerJoin(services, eq(providerServices.serviceId, services.id)).where(inArray(providerServices.providerId, pendingProviders.map((provider) => provider.id))) : []
  const providers = pendingProviders.map((provider) => ({
    id: provider.id,
    name: provider.name,
    email: provider.email,
    createdAt: provider.createdAt?.toISOString() ?? null,
    nidPath: provider.nidPath,
    documentPaths: Array.isArray(provider.documentUrls) ? provider.documentUrls.filter((path): path is string => typeof path === 'string') : [],
    proposals: proposals.filter((item) => item.providerId === provider.id).map(({ serviceName, proposedChargeBdt }) => ({ serviceName, proposedChargeBdt })),
  }))

  const groupedBookings = new Map<string, { id: string; status: string; scheduledAt: string; totalBdt: number; cityName: string; areaName: string; services: string[] }>()
  for (const row of bookingRows) {
    const booking = groupedBookings.get(row.id) ?? { id: row.id, status: row.status, scheduledAt: row.scheduledAt.toISOString(), totalBdt: row.totalBdt, cityName: row.cityName, areaName: row.areaName, services: [] }
    if (!booking.services.includes(row.serviceName)) booking.services.push(row.serviceName)
    groupedBookings.set(row.id, booking)
  }
  const byStatus = new Map(bookingCounts.map((item) => [item.status, item.total]))
  const metrics = {
    requested: byStatus.get('REQUESTED') ?? 0,
    notResponded: byStatus.get('NOT_RESPONDED') ?? 0,
    pendingProviders: pendingProviders.length,
    totalBookings: bookingCounts.reduce((sum, item) => sum + item.total, 0),
  }

  return <><WorkspaceHeader title="Admin workspace" eyebrow="Marketplace operations" name={session.user.name} /><main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Nirbhor operations · {session.user.role.replaceAll('_', ' ')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Marketplace overview</h1><p className="mt-2 text-sm text-muted-foreground">Provider approval and booking assignment, backed by live marketplace records.</p></div><AdminWorkspace role={session.user.role} metrics={metrics} providers={isOperations ? providers : []} bookings={isOperations ? [...groupedBookings.values()] : []} availableProviders={isOperations ? activeProviders : []} cashBookings={[...cashBookingsMap.values()]} providerDues={providerDues} /></main></>
}

