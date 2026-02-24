import type { Request } from 'express';
import type { SessionUser } from '@cup/shared-types';

export type AuthedRequest = Request & {
  user?: SessionUser;
};

export type LogoutRequest = AuthedRequest & {
  logOut: (callback: (err?: Error | null) => void) => void;
  session?: {
    destroy: (callback: (err?: Error | null) => void) => void;
  };
};
