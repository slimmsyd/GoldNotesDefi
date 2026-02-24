import { apiClient } from '../api/client';
import {
  RedemptionCreateRequest,
  RedemptionCreateResponse,
  RedemptionStatusResponse,
} from '../api/types';

export function createRedemption(payload: RedemptionCreateRequest): Promise<RedemptionCreateResponse> {
  return apiClient.post<RedemptionCreateResponse>('/api/redemption/create', payload);
}

export function getRedemptionStatus(wallet: string): Promise<RedemptionStatusResponse> {
  return apiClient.get<RedemptionStatusResponse>(`/api/redemption/status?wallet=${encodeURIComponent(wallet)}`);
}
