import { and, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { ProviderApplication, ProviderDashboard, WorkspaceHeader } from '@/components/workspaces'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { addresses, areas, bookingItems, bookings, cities, commissions, payouts, providerDuesLedger, providerProfiles, serviceCategories, services } from '@/lib/db/schema'
import { decryptProviderPayout } from '@/lib/marketplace/encryption'

export default async function ProviderPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/')

  const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, session.user.id)).limit(1)
  const name = session.user.name
  if (!profile || profile.status === 'REJECTED') {
    const rows = await db.select({ id: services.id, name: services.name, categoryName: serviceCategories.name }).from(services).innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id)).where(and(eq(services.isActive, true), eq(serviceCategories.isActive, true)))
    return <><WorkspaceHeader title="Provider application" eyebrow="Join Nirbhor" name={name} /><main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Work with Nirbhor</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">A better day, for every home.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Tell us what you do, share your credentials, and propose your service charges. Our operations team reviews every application.</p><ProviderApplication services={rows} /></main></>
  }

  if (profile.status !== 'APPROVED') return <><WorkspaceHeader title="Provider application" eyebrow="Application review" name={name} /><main className="mx-auto max-w-[1100px] px-5 py-14 sm:px-8"><div className="rounded-[24px] border border-border bg-white p-7 sm:p-10"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Application in review</p><h1 className="mt-2 text-3xl font-semibold">Thanks for applying, {name.split(' ')[0]}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Your identity documents, payout details and proposed charges are private. The operations team will review your application before you receive any jobs.</p><p className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-semibold"><span className="size-1.5 rounded-full bg-primary" />Status: {profile.status}</p></div></main></>

  const jobRows = await db.select({ id: bookings.id, status: bookings.status, scheduledAt: bookings.scheduledAt, totalBdt: bookings.totalBdt, addressLine: addresses.addressLine, areaName: areas.name, cityName: cities.name, serviceName: services.name, quantity: bookingItems.quantity }).from(bookings).innerJoin(addresses, eq(bookings.addressId, addresses.id)).innerJoin(areas, eq(addresses.areaId, areas.id)).innerJoin(cities, eq(addresses.cityId, cities.id)).innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id)).innerJoin(services, eq(bookingItems.serviceId, services.id)).where(and(eq(bookings.providerId, profile.id), inArray(bookings.status, ['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'STARTED'])))
  const jobMap = new Map<string, { id: string; status: string; scheduledAt: string; totalBdt: number; addressLine: string; areaName: string; cityName: string; items: { name: string; quantity: number }[] }>()
  for (const row of jobRows) {
    const job = jobMap.get(row.id) ?? { id: row.id, status: row.status, scheduledAt: row.scheduledAt.toISOString(), totalBdt: row.totalBdt, addressLine: row.addressLine, areaName: row.areaName, cityName: row.cityName, items: [] }
    job.items.push({ name: row.serviceName, quantity: row.quantity })
    jobMap.set(row.id, job)
  }
  const [commissionRows, ledgerRows, payoutRows] = await Promise.all([
    db.select({ amountBdt: commissions.amountBdt }).from(commissions).where(eq(commissions.providerId, profile.id)),
    db.select({ balanceAfterBdt: providerDuesLedger.balanceAfterBdt }).from(providerDuesLedger).where(eq(providerDuesLedger.providerId, profile.id)).orderBy(desc(providerDuesLedger.createdAt)).limit(1),
    db.select().from(payouts).where(eq(payouts.providerId, profile.id)).orderBy(desc(payouts.requestedAt)).limit(10),
  ])
  const payout = decryptProviderPayout<{ method: string; accountNumber: string }>(profile.payoutDetails)
  const payoutSummary = payout ? `${payout.method} · •••• ${payout.accountNumber.slice(-4)}` : null
  const stats = {
    earnedBdt: commissionRows.reduce((total, item) => total + item.amountBdt, 0),
    duesBdt: ledgerRows[0]?.balanceAfterBdt ?? 0,
    payoutHistory: payoutRows.map((item) => ({ id: item.id, amountBdt: item.amountBdt, status: item.status, requestedAt: item.requestedAt?.toISOString() ?? null })),
    payoutSummary,
  }

  return <><WorkspaceHeader title="Provider workspace" eyebrow="Your work" name={name} /><main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-8 sm:py-14"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Approved provider</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Good to see you, {name.split(' ')[0]}.</h1><p className="mt-2 text-sm text-muted-foreground">Manage your availability, assigned jobs and earnings.</p></div><a href="/orders" className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-xs font-semibold"><BriefcaseIcon />Customer orders</a></div><ProviderDashboard availability={profile.availability} jobs={[...jobMap.values()]} stats={stats} /></main></>
}

function BriefcaseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></svg>
}

