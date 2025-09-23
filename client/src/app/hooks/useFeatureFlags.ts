import { useEffect, useState } from 'react';
import type { HttpClient } from '../../shared/api/httpClient';
import { fetchFeatureFlags } from '../../shared/api/featureFlags';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../../shared/config/featureFlags';

interface FeatureFlagsState {
  flags: FeatureFlags;
  loading: boolean;
  error: string | null;
}

export function useFeatureFlags(client: HttpClient | null, enabled: boolean): FeatureFlagsState {
  const [state, setState] = useState<FeatureFlagsState>({
    flags: DEFAULT_FEATURE_FLAGS,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !client) {
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchFeatureFlags(client)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setState({ flags: { ...DEFAULT_FEATURE_FLAGS, ...response.featureFlags }, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({ flags: DEFAULT_FEATURE_FLAGS, loading: false, error: (error as Error).message });
      });

    return () => {
      cancelled = true;
    };
  }, [client, enabled]);

  return state;
}
