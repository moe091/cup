import type { Request } from 'express';
import type { Session, SessionData } from 'express-session';
import type { SessionUser } from '@cup/shared-types';

type SessionShape = Session & Partial<SessionData>;

export type SessionRequest = Request & {
  session?: SessionShape;
};

export type AuthedRequest = Request & {
  user?: SessionUser;
};

export type LoginRequest = Request & {
  body: unknown;
  logIn: (user: SessionUser, callback: (err?: Error | null) => void) => void;
  session?: SessionShape;
};

export type LogoutRequest = AuthedRequest & {
  logOut: (callback: (err?: Error | null) => void) => void;
  session?: {
    destroy: (callback: (err?: Error | null) => void) => void;
  };
};
