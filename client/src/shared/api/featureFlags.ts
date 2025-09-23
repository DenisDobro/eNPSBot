import type { HttpClient } from './httpClient';

export interface FeatureFlagsResponse {
  featureFlags: Record<string, boolean>;
}

export function fetchFeatureFlags(client: HttpClient) {
  return client.get<FeatureFlagsResponse>('/feature-flags');
}
