import type { SessionUser } from "@cup/shared-types";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
    user: SessionUser | null;
    isLoading: boolean;
    refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = res.ok ? await res.json() : null;
            setUser(data);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const value = useMemo(() => ({user, refresh, isLoading}), [user, refresh, isLoading]);
    
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

