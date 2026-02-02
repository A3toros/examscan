const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
}

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export const apiClient = {
  async get<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      method: 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        ...init?.headers,
      },
    })
    return handleResponse<T>(response)
  },

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      method: 'POST',
      headers: {
        ...DEFAULT_HEADERS,
        ...init?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return handleResponse<T>(response)
  },
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((data as { message?: string })?.message ?? 'API error')
  }
  return data as T
}

