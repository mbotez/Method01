export enum AppState {
  LANDING,
  AUTH,
  ONBOARDING_DETAILS,
  DASHBOARD,
  RANK,
  TRACKER,
  SOCIAL,
  PROFILE,
  PROGRESS,
  PRODUCT_PAGE,
  ROUTINES,
  PRIVACY_POLICY,
  DELETE_ACCOUNT,
  FEEDBACK,
  BRANDS,
  COMPARISON,
  COMMUNITY
}

export interface AvoidedIngredient {
  id: number | null;
  name: string;
}
