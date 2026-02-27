export const CSRF_HEADER_NAME = 'x-csrf-token';
export const CSRF_SESSION_KEY = 'csrfToken';

export const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

export const RATE_LIMIT_RULES: Record<string, number> = {
  'POST:/api/auth/local/login': 10,
  'POST:/api/auth/local/signup': 10,
  'POST:/api/auth/logout': 30,
  'PATCH:/api/users/me': 30,
};
