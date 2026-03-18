/**
 * MSAL Stub Provider
 *
 * This is a stub for future integration with Microsoft Authentication Library (MSAL).
 * In Phase 7, this will be replaced with a real MSAL implementation that:
 * - Validates tokens against Microsoft Entra ID
 * - Extracts OID (Object ID) and claims
 *
 * Currently, this stub throws NotImplementedError to prevent accidental usage
 * before proper Azure AD configuration is complete.
 *
 * The IAuthProvider interface is designed to allow swapping implementations
 * without changing any other code paths.
 */

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export interface IAuthProvider {
  validateToken(rawToken: string): Promise<{
    oid: string;
    email: string;
    name: string;
  }>;
}

export class MsalStubProvider implements IAuthProvider {
  async validateToken(
    _rawToken: string
  ): Promise<{
    oid: string;
    email: string;
    name: string;
  }> {
    throw new NotImplementedError(
      "MSAL validation is not yet implemented. Set SSO_ENABLED=false or wait for Phase 7 implementation."
    );
  }
}

/**
 * Factory function to get the appropriate auth provider based on configuration.
 * Currently always returns the stub since SSO_ENABLED is used only as a feature flag.
 */
export function createAuthProvider(): IAuthProvider {
  const ssoEnabled = process.env.SSO_ENABLED === "true";
  if (ssoEnabled) {
    // SSO_ENABLED=true requires a real MSAL implementation (Phase 7).
    // Fail fast with a clear config error rather than silently returning the stub.
    throw new Error(
      "SSO_ENABLED=true but MSAL provider is not yet implemented. " +
        "Set SSO_ENABLED=false or wait for Phase 7 implementation."
    );
  }
  return new MsalStubProvider();
}
