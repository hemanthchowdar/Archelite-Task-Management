import { QueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** Base URL for the Fastify API */
const getApiBase = () => {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (__DEV__ && hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:3001`;
  }
  return 'http://localhost:3001';
};

const API_BASE = getApiBase();

/**
 * Thin wrapper around fetch that prepends the base URL
 * and attaches the auth token when available from SecureStore.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  // Retrieve token securely from local device store
  const token = await SecureStore.getItemAsync('accessToken').catch(() => null);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers || {}) as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    let parsedMessage = `API Error ${res.status}`;
    try {
      const parsedJson = JSON.parse(body);
      parsedMessage = parsedJson.message || parsedJson.error || parsedMessage;
    } catch (e) {
      parsedMessage = body || parsedMessage;
    }
    throw new Error(parsedMessage);
  }

  return res.json() as Promise<T>;
}
