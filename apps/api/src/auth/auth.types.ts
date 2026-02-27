import type { Request } from 'express';
import type { SessionUser } from '@cup/shared-types';

export type SessionRequest = Request & {
  session?: Record<string, unknown>;
};

export type AuthedRequest = Request & {
  user?: SessionUser;
};

export type LoginRequest = Request & {
  body: unknown;
  logIn: (user: SessionUser, callback: (err?: Error | null) => void) => void;
  session?: Record<string, unknown>;
};

export type LogoutRequest = AuthedRequest & {
  logOut: (callback: (err?: Error | null) => void) => void;
  session?: {
    destroy: (callback: (err?: Error | null) => void) => void;
  };
};
