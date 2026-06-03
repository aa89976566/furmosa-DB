export {
  listPartnerStoresFromDb as listPartnerStores,
  resolvePartnerStoreBySlug,
  type PartnerStoreView as ResolvedPartnerStore,
} from '@/lib/stores/partner-stores';

export function storeIdFromPartnerStore(store: { slug: string }) {
  return store.slug;
}
