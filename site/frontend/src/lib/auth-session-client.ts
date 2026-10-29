import {
  clearAuthSession,
  storeAuthSession,
  validateAuthSessionContext,
  type AuthSessionContext,
  type AuthSessionCredential,
} from "./auth-session";
import {
  requestAuthLogout,
  requestAuthSessionContext,
} from "../services/authSession.service";

export type SessionIssuingResult = {
  session: AuthSessionCredential;
};

export function acceptIssuedAuthSession(
  result: SessionIssuingResult,
): void {
  storeAuthSession(result.session);
}

export async function fetchAuthSessionContext():
  Promise<AuthSessionContext> {
  const result = await requestAuthSessionContext();
  return validateAuthSessionContext(result);
}

export async function revokeAuthSession(): Promise<void> {
  try {
    await requestAuthLogout();
  } finally {
    clearAuthSession();
  }
}
