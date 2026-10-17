/** `@/lib/auth/actions` for Storybook: the Server Actions answer without a server. */
const ok = async () => ({ ok: true as const, data: null });

export const signOut = ok;
export const selectTenant = ok;
export const requestOperatorOtp = async () => ({
  ok: true as const,
  data: {
    challengeId: "00000000-0000-4000-8000-000000000000",
    expiresAt: "2026-11-01T00:20:00+07:00",
    resendAvailableAt: "2026-11-01T00:16:00+07:00",
  },
});
export const verifyOperatorOtp = async () => ({ ok: true as const, data: { next: "console" as const } });
export const operatorPasswordLogin = verifyOperatorOtp;
export const platformLogin = ok;
export const platformEnrollTotp = ok;
export const platformActivateTotp = ok;
export type ActionProblem = {
  code: string;
  status: number;
  title: string;
  detail: string;
  requestId?: string;
  attemptsRemaining?: number;
};
