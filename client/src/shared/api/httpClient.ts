import type { ApiError, TelegramUser } from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiAuthContext {
  initDataRaw: string | null;
  debugUser: TelegramUser | null;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function executeRequest<T>(
  path: string,
  method: HttpMethod,
  auth: ApiAuthContext,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  if (auth.initDataRaw) {
    headers.set('x-telegram-init-data', auth.initDataRaw);
  } else if (auth.debugUser) {
    headers.set('x-debug-user', JSON.stringify(auth.debugUser));
  }

  const { body, ...rest } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    method,
    headers,
    body: body !== undefined && method !== 'GET' ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorPayload: ApiError | undefined;
    try {
      errorPayload = (await response.json()) as ApiError;
    } catch {
      // ignore body parsing errors
    }

    const errorMessage = errorPayload?.error ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function createHttpClient(auth: ApiAuthContext) {
  return {
    get<T>(path: string, options?: RequestOptions) {
      return executeRequest<T>(path, 'GET', auth, options);
    },
    post<T>(path: string, options?: RequestOptions) {
      return executeRequest<T>(path, 'POST', auth, options);
    },
    patch<T>(path: string, options?: RequestOptions) {
      return executeRequest<T>(path, 'PATCH', auth, options);
    },
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
