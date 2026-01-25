import type { SessionUser } from "@cup/shared-types";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext.types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = res.ok ? await res.json() : null;
      setUser(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ user, refresh, isLoading }),
    [user, refresh, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
