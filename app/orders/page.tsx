import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { OrdersList, type CustomerOrder } from '@/components/orders-list'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { addresses, areas, bookingItems, bookingStatusLogs, bookings, cities, packages, services } from '@/lib/db/schema'

export default async function OrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/')

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      scheduledAt: bookings.scheduledAt,
      createdAt: bookings.createdAt,
      paymentMethod: bookings.paymentMethod,
      totalBdt: bookings.totalBdt,
      addressLabel: addresses.label,
      addressLine: addresses.addressLine,
      areaName: areas.name,
      cityName: cities.name,
      serviceName: services.name,
      packageName: packages.name,
      quantity: bookingItems.quantity,
      lineTotalBdt: bookingItems.lineTotalBdt,
    })
    .from(bookings)
    .innerJoin(addresses, eq(bookings.addressId, addresses.id))
    .innerJoin(areas, eq(addresses.areaId, areas.id))
    .innerJoin(cities, eq(addresses.cityId, cities.id))
    .innerJoin(bookingItems, eq(bookingItems.bookingId, bookings.id))
    .innerJoin(services, eq(bookingItems.serviceId, services.id))
    .innerJoin(packages, eq(bookingItems.packageId, packages.id))
    .where(eq(bookings.userId, session.user.id))
    .orderBy(desc(bookings.createdAt), asc(services.name))

  const grouped = new Map<string, CustomerOrder>()
  for (const row of rows) {
    const order = grouped.get(row.id) ?? {
      id: row.id,
      status: row.status,
      scheduledAt: row.scheduledAt.toISOString(),
      createdAt: row.createdAt?.toISOString() ?? null,
      paymentMethod: row.paymentMethod,
      totalBdt: row.totalBdt,
      addressLabel: row.addressLabel,
      addressLine: row.addressLine,
      areaName: row.areaName,
      cityName: row.cityName,
      items: [],
      timeline: [],
    }
    order.items.push({ name: row.serviceName, packageName: row.packageName, quantity: row.quantity, lineTotalBdt: row.lineTotalBdt })
    grouped.set(row.id, order)
  }

  const orders = [...grouped.values()]
  if (orders.length) {
    const logs = await db
      .select({ bookingId: bookingStatusLogs.bookingId, status: bookingStatusLogs.toStatus, createdAt: bookingStatusLogs.createdAt })
      .from(bookingStatusLogs)
      .where(inArray(bookingStatusLogs.bookingId, orders.map((order) => order.id)))
      .orderBy(asc(bookingStatusLogs.createdAt))
    for (const log of logs) {
      grouped.get(log.bookingId)?.timeline.push({ status: log.status, createdAt: log.createdAt?.toISOString() ?? null })
    }
  }

  return <OrdersList orders={orders} customerName={session.user.name} />
}
