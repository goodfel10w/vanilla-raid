// ── API Layer ──

import { getState, update } from './state.js';
import { toast } from './components/toast.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function authHeaders() {
  const user = getState('auth.user');
  const headers = { 'Content-Type': 'application/json' };
  if (user?.token) headers['Authorization'] = 'Bearer ' + user.token;
  return headers;
}

function handleSessionExpiry() {
  update('auth.user', null);
  update('auth.bnetCharacters', []);
  localStorage.removeItem('raid-auth');
  toast('Sitzung abgelaufen — bitte erneut anmelden');
}

async function request(url, options = {}) {
  const headers = { ...authHeaders(), ...options.headers };
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'Nicht angemeldet' || data.error === 'Sitzung ungültig') {
        handleSessionExpiry();
      }
      throw new ApiError(data.error || 'Keine Berechtigung', res.status);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.error || 'Anfrage fehlgeschlagen', res.status);
    }
    return res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('Netzwerkfehler', 0);
  }
}

export const api = {
  get(url) {
    return request(url, { method: 'GET', headers: authHeaders() });
  },

  post(url, body) {
    return request(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  },

  del(url) {
    return request(url, { method: 'DELETE', headers: authHeaders() });
  },
};

/** Auth-specific API call */
export async function authApi(action, data) {
  return api.post('/api/auth', { action, ...data });
}

// API endpoints
export const ENTRIES_API = '/api/entries';
export const RAIDS_API = '/api/raids';
export const DKP_API = '/api/dkp';
export const ADMIN_API = '/api/admin';
export const BNET_CHARS_API = '/api/bnet-characters';
