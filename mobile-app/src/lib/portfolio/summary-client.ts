import { apiClient } from '../api/client';
import { PortfolioSummaryResponse } from '../api/types';

export function getPortfolioSummary(): Promise<PortfolioSummaryResponse> {
  return apiClient.get<PortfolioSummaryResponse>('/api/portfolio/summary');
}
