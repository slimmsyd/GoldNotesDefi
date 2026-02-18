import { apiClient } from '../api/client';
import { ShippingOptionsResponse } from '../api/types';

export function getShippingOptions(input: {
  subtotalUsd: number;
  isInternational: boolean;
}): Promise<ShippingOptionsResponse> {
  const params = new URLSearchParams({
    subtotalUsd: input.subtotalUsd.toString(),
    isInternational: String(input.isInternational),
  });

  return apiClient.get<ShippingOptionsResponse>(`/api/checkout/shipping-options?${params.toString()}`);
}
