import { tokenStorage } from '../utils/storage';

export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) };
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new ApiError(errorBody?.code ?? 'REQUEST_FAILED', errorBody?.message ?? `请求失败 ${response.status}`, response.status);
  }
  return body as T;
}
