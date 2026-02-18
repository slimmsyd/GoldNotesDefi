import { apiClient } from '../api/client';
import {
  DirectCheckoutConfirmRequest,
  DirectCheckoutConfirmResponse,
  DirectCheckoutCreateRequest,
  DirectCheckoutCreateResponse,
} from '../api/types';

export function createDirectCheckout(payload: DirectCheckoutCreateRequest): Promise<DirectCheckoutCreateResponse> {
  return apiClient.post<DirectCheckoutCreateResponse>('/api/checkout/direct/create', payload);
}

export function confirmDirectCheckout(payload: DirectCheckoutConfirmRequest): Promise<DirectCheckoutConfirmResponse> {
  return apiClient.post<DirectCheckoutConfirmResponse>('/api/checkout/direct/confirm', payload);
}
