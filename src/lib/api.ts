import { useAuthStore } from '@/stores/auth'

class ApiClient {
  private getAuthHeader(): Record<string, string> {
    const auth = useAuthStore()
    if (auth.user?.token) {
      return { Authorization: `Bearer ${auth.user.token}` }
    }
    return {}
  }

  async get<T = any>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: this.getAuthHeader(),
    })
    if (res.status === 401) {
      const auth = useAuthStore()
      auth.clearSession()
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `GET ${url} failed`)
    }
    return res.json()
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: data ? JSON.stringify(data) : undefined,
    })
    if (res.status === 401) {
      const auth = useAuthStore()
      auth.clearSession()
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `POST ${url} failed`)
    }
    return res.json()
  }

  async del<T = any>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    })
    if (res.status === 401) {
      const auth = useAuthStore()
      auth.clearSession()
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `DELETE ${url} failed`)
    }
    return res.json()
  }
}

export const api = new ApiClient()
