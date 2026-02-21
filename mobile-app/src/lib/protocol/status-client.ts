import { apiClient } from '../api/client';
import { ProtocolStatusHistoryResponse, ProtocolStatusResponse, VaultSummaryResponse } from '../api/types';

export function getProtocolStatus(includeHistory = false): Promise<ProtocolStatusResponse> {
  const suffix = includeHistory ? '?history=true' : '';
  return apiClient.get<ProtocolStatusResponse>(`/api/protocol-status${suffix}`);
}

export function getProtocolStatusHistory(): Promise<ProtocolStatusHistoryResponse> {
  return getProtocolStatus(true);
}

export async function getVaultSummary(): Promise<VaultSummaryResponse> {
  const response = await getProtocolStatus(false);
  const data = response.data;

  if (!response.success || !data) {
    return {
      success: false,
      solvencyStatus: 'UNKNOWN',
      ratio: null,
      totalSupply: 0,
      provenReserves: 0,
      totalBatches: 0,
      currentMerkleRoot: '',
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    success: true,
    solvencyStatus: data.solvency.status,
    ratio: data.solvency.ratio,
    totalSupply: data.onChain.totalSupply,
    provenReserves: data.onChain.provenReserves,
    totalBatches: data.offChain.totalBatches,
    currentMerkleRoot: data.onChain.currentMerkleRoot,
    fetchedAt: data.fetchedAt,
  };
}
