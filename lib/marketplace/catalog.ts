import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { areas, cities, packages, serviceCategories, services } from '@/lib/db/schema'

export async function getMarketplaceCatalog() {
  const [cityRows, areaRows, categoryRows, serviceRows] = await Promise.all([
    db.select({ id: cities.id, name: cities.name }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.name)),
    db.select({ id: areas.id, cityId: areas.cityId, name: areas.name, codEnabled: areas.codEnabled }).from(areas).where(eq(areas.isActive, true)).orderBy(asc(areas.name)),
    db
      .select({ id: serviceCategories.id, name: serviceCategories.name, slug: serviceCategories.slug, description: serviceCategories.description })
      .from(serviceCategories)
      .where(eq(serviceCategories.isActive, true))
      .orderBy(asc(serviceCategories.sortOrder)),
    db
      .select({
        id: services.id,
        name: services.name,
        slug: services.slug,
        description: services.description,
        cityIds: services.cityIds,
        categoryId: serviceCategories.id,
        categoryName: serviceCategories.name,
        categorySlug: serviceCategories.slug,
        packageId: packages.id,
        packageName: packages.name,
        packageDescription: packages.description,
        priceBdt: packages.priceBdt,
        durationMinutes: packages.durationMinutes,
        inclusions: packages.inclusions,
      })
      .from(services)
      .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
      .innerJoin(packages, eq(packages.serviceId, services.id))
      .where(and(eq(services.isActive, true), eq(serviceCategories.isActive, true), eq(packages.isActive, true)))
      .orderBy(asc(serviceCategories.sortOrder), asc(services.name), asc(packages.priceBdt)),
  ])

  const serviceMap = new Map<string, {
    id: string
    name: string
    slug: string
    description: string | null
    cityIds: string[]
    categoryId: string
    categoryName: string
    categorySlug: string
    packages: { id: string; name: string; description: string; priceBdt: number; durationMinutes: number; inclusions: string[] }[]
  }>()

  for (const row of serviceRows) {
    const service = serviceMap.get(row.id) ?? {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      cityIds: Array.isArray(row.cityIds) ? row.cityIds.filter((id): id is string => typeof id === 'string') : [],
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      packages: [],
    }

    service.packages.push({
      id: row.packageId,
      name: row.packageName,
      description: row.packageDescription,
      priceBdt: row.priceBdt,
      durationMinutes: row.durationMinutes,
      inclusions: Array.isArray(row.inclusions) ? row.inclusions.filter((item): item is string => typeof item === 'string') : [],
    })
    serviceMap.set(row.id, service)
  }

  return {
    cities: cityRows,
    areas: areaRows,
    categories: categoryRows,
    services: Array.from(serviceMap.values()),
  }
}

export type MarketplaceCatalog = Awaited<ReturnType<typeof getMarketplaceCatalog>>
export type MarketplaceService = MarketplaceCatalog['services'][number]
export type MarketplaceCategory = MarketplaceCatalog['categories'][number]
export type MarketplaceCity = MarketplaceCatalog['cities'][number]
export type MarketplaceArea = MarketplaceCatalog['areas'][number]
