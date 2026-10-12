import { MarketplaceHome } from '@/components/marketplace-home'
import { getMarketplaceCatalog } from '@/lib/marketplace/catalog'

export default async function Page() {
  const catalog = await getMarketplaceCatalog()
  return <MarketplaceHome catalog={catalog} />
}

