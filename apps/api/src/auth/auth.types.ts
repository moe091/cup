import type { Request } from 'express';
import type { SessionUser } from '@cup/shared-types';

export type AuthedRequest = Request & {
  user?: SessionUser;
};
