import { apiClient } from '../api/client';
import { ShopCatalogResponse } from '../api/types';

export function getShopCatalog(): Promise<ShopCatalogResponse> {
  return apiClient.get<ShopCatalogResponse>('/api/shop/catalog');
}
