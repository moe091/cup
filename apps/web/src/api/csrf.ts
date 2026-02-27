let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch('/api/auth/csrf', {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to initialize security token.');
  }

  const payload = (await response.json()) as { csrfToken?: string };
  if (!payload.csrfToken) {
    throw new Error('Failed to initialize security token.');
  }

  csrfToken = payload.csrfToken;
  return csrfToken;
}

export async function buildCsrfHeaders(): Promise<Record<string, string>> {
  const token = await getCsrfToken();
  return {
    'x-csrf-token': token,
  };
}
