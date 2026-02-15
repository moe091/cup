import { createContext } from "react";
import type { SessionUser } from "@cup/shared-types";

export type AuthContextValue = {
  user: SessionUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

// Re-export useAuth for convenience
export { useAuth } from "./useAuth";
