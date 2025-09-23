export type FeatureFlagName = 'analyticsDashboard' | 'projectCreation' | 'responseEditing';

export type FeatureFlags = Record<FeatureFlagName, boolean>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  analyticsDashboard: true,
  projectCreation: true,
  responseEditing: true,
};
