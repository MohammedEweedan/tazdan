const STEP_UP_RE =
  /security|verification|challenge|authenticator|step[- ]?up|high-value|new device|security code|6-digit/i;

export function stepUpErrorMessage(error: any): string {
  const data = error?.response?.data ?? error?.data ?? {};
  return String(data?.error ?? data?.message ?? '');
}

export function isStepUpChallengeError(error: any): boolean {
  const status = error?.response?.status ?? error?.status;
  if (status !== 401) return false;

  const data = error?.response?.data ?? error?.data ?? {};
  if (data?.requiresStepUp === true || data?.stepUp === true) return true;

  return STEP_UP_RE.test(stepUpErrorMessage(error));
}
