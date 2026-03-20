import { randomUUID } from "crypto";
import { ConfidentialClientApplication, Configuration } from "@azure/msal-node";

let _msalClient: ConfidentialClientApplication | null = null;

// In-memory store for OAuth state values (CSRF protection).
// State is created on /initiate and consumed once on /callback.
const _pendingStates = new Map<string, number>(); // state → expiry epoch ms
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function generateState(): string {
  // Purge expired states to avoid unbounded growth
  const now = Date.now();
  for (const [key, exp] of _pendingStates) {
    if (exp < now) _pendingStates.delete(key);
  }
  const state = randomUUID();
  _pendingStates.set(state, now + STATE_TTL_MS);
  return state;
}

export function consumeState(state: string): boolean {
  const exp = _pendingStates.get(state);
  if (!exp || Date.now() > exp) return false;
  _pendingStates.delete(state);
  return true;
}

/** For test isolation only */
export function _clearStatesForTests(): void {
  _pendingStates.clear();
}

export function getMsalClient(): ConfidentialClientApplication {
  if (!_msalClient) {
    const config: Configuration = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
      },
    };
    _msalClient = new ConfidentialClientApplication(config);
  }
  return _msalClient;
}

export function isAzureConfigured(): boolean {
  return !!(
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_SECRET &&
    process.env.AZURE_REDIRECT_URI
  );
}

export function getAuthCodeUrl(state: string): Promise<string> {
  return getMsalClient().getAuthCodeUrl({
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri: process.env.AZURE_REDIRECT_URI!,
    state,
  });
}

export async function acquireTokenByCode(code: string): Promise<{
  oid: string;
  name: string;
  email: string;
}> {
  const result = await getMsalClient().acquireTokenByCode({
    code,
    scopes: ["openid", "profile", "email", "User.Read"],
    redirectUri: process.env.AZURE_REDIRECT_URI!,
  });

  if (!result?.account?.homeAccountId || !result.idTokenClaims) {
    throw new Error("Failed to acquire token");
  }

  const claims = result.idTokenClaims as Record<string, unknown>;
  const oid = claims["oid"] as string;
  const name = (claims["name"] as string) || "Unknown";
  const email = (claims["preferred_username"] as string) || (claims["email"] as string);

  if (!oid || !email) {
    throw new Error("Missing required claims in token");
  }

  return { oid, name, email };
}
