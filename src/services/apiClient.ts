const API_URL = import.meta.env.VITE_API_URL || ''

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export async function requestApi<T>(
  action: string,
  options: {
    method?: 'GET' | 'POST'
    body?: unknown
    params?: Record<string, string>
  } = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error('API URL is not configured. Check VITE_API_URL environment variable.')
  }

  const method = options.method || 'GET'
  const url = new URL(API_URL)
  url.searchParams.set('action', action)
  
  if (options.params) {
    Object.keys(options.params).forEach(key => {
      url.searchParams.set(key, options.params![key])
    })
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', // Prevents preflight OPTIONS requests in standard Apps Script deploys
    },
  }

  if (method === 'POST' && options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  try {
    const res = await fetch(url.toString(), fetchOptions)
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status} ${res.statusText}`)
    }

    const envelope = (await res.json()) as ApiResponse<T>
    if (!envelope.success) {
      const errCode = envelope.error?.code || 'SERVER_ERROR'
      const errMsg = envelope.error?.message || 'Unknown backend error'
      throw new Error(`[${errCode}] ${errMsg}`)
    }

    return envelope.data as T
  } catch (err) {
    console.error(`API Error on action "${action}":`, err)
    throw err
  }
}
