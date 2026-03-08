import { apiClient } from '../api/client';
import { PortfolioSummaryResponse } from '../api/types';

type PortfolioSummaryWireResponse = PortfolioSummaryResponse & {
  w3bBalance?: number;
  dataHealth?: PortfolioSummaryResponse['dataHealth'] & {
    w3bSource?: PortfolioSummaryResponse['dataHealth']['wgbSource'];
  };
};

export async function getPortfolioSummary(): Promise<PortfolioSummaryResponse> {
  const response = await apiClient.get<PortfolioSummaryWireResponse>('/api/portfolio/summary');
  return {
    ...response,
    wgbBalance: response.wgbBalance ?? response.w3bBalance ?? 0,
    dataHealth: {
      ...response.dataHealth,
      wgbSource: response.dataHealth?.wgbSource ?? response.dataHealth?.w3bSource ?? 'fallback',
      loyaltySource: response.dataHealth?.loyaltySource ?? 'fallback',
    },
  };
}
