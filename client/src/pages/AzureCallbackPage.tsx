import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "../lib/api";

export function AzureCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");

    if (accessToken && refreshToken) {
      setAccessToken(accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      // Remove tokens from browser history before navigating away
      window.history.replaceState({}, "", "/auth/callback");
      window.location.href = "/dashboard";
    } else {
      navigate("/login?error=azure_failed");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Completing sign-in…</p>
    </div>
  );
}
