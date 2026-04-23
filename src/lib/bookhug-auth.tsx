import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { bookhugApi, type OnboardingPayload, type SessionUser } from "@/lib/bookhug-api";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  backendUrl: string;
  refreshSession: () => Promise<void>;
  startGoogleLogin: (redirectTo?: string) => Promise<void>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<void>;
  logout: () => Promise<void>;
};

const BookHugAuthContext = createContext<AuthContextValue | null>(null);

export function BookHugAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await bookhugApi.getMe();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const startGoogleLogin = useCallback(async (redirectTo = "/onboarding") => {
    try {
      const response = await bookhugApi.startGoogleLogin(redirectTo);
      window.location.href = response.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start Google sign-in.");
      throw error;
    }
  }, []);

  const completeOnboarding = useCallback(async (payload: OnboardingPayload) => {
    const response = await bookhugApi.completeOnboarding(payload);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await bookhugApi.logout();
    setUser(null);
    toast.success("Signed out from BookHug.");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      hasCompletedOnboarding: Boolean(user?.role),
      backendUrl: bookhugApi.backendUrl,
      refreshSession,
      startGoogleLogin,
      completeOnboarding,
      logout,
    }),
    [user, loading, refreshSession, startGoogleLogin, completeOnboarding, logout],
  );

  return <BookHugAuthContext.Provider value={value}>{children}</BookHugAuthContext.Provider>;
}

export function useBookHugAuth() {
  const context = useContext(BookHugAuthContext);
  if (!context) {
    throw new Error("useBookHugAuth must be used within BookHugAuthProvider");
  }
  return context;
}
