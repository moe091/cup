import type { SessionUser } from "@cup/shared-types";
import { createContext, useContext } from "react";

type AuthContextValue = {
    user: SessionUser | null;
    refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

export function AuthProvider({ children }) {

}