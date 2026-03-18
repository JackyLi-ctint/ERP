import {
  MsalStubProvider,
  NotImplementedError,
  IAuthProvider,
} from "../auth/msal.stub";

describe("MsalStubProvider", () => {
  let provider: IAuthProvider;

  beforeEach(() => {
    provider = new MsalStubProvider();
  });

  test("should implement IAuthProvider interface", () => {
    expect(provider).toHaveProperty("validateToken");
    expect(typeof provider.validateToken).toBe("function");
  });

  test("should throw NotImplementedError when validateToken is called", async () => {
    await expect(provider.validateToken("any-token")).rejects.toThrow(
      NotImplementedError
    );
  });

  test("should throw NotImplementedError with appropriate message", async () => {
    try {
      await provider.validateToken("test-token");
      fail("Should have thrown NotImplementedError");
    } catch (error) {
      expect(error).toBeInstanceOf(NotImplementedError);
      expect((error as Error).message).toContain("not yet implemented");
    }
  });

  test("NotImplementedError should have proper name", () => {
    const error = new NotImplementedError("Test error");
    expect(error.name).toBe("NotImplementedError");
    expect(error instanceof Error).toBe(true);
  });
});
