// Inventory back-office API client. Shares the checkout session token and the
// same origin as the storefront — every call is proxied to /api/inventory on
// the single Spring Boot backend.
import { getToken } from '../../api.js';

const BASE = '/api/inventory';

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Session missing/expired/insufficient — bounce to the storefront sign-in.
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login';
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

// Normalize thrown errors into a readable message for the toast UI.
export function errorMessage(err) {
  return err?.message || 'Request failed';
}

// --- Products ---
export const ProductsApi = {
  list: () => request('GET', '/products'),
  get: (id) => request('GET', `/products/${id}`),
  lowStock: () => request('GET', '/products/low-stock'),
  create: (body) => request('POST', '/products', body),
  update: (id, body) => request('PUT', `/products/${id}`, body),
  remove: (id) => request('DELETE', `/products/${id}`),
};

// --- Suppliers ---
export const SuppliersApi = {
  list: () => request('GET', '/suppliers'),
  create: (body) => request('POST', '/suppliers', body),
};

// --- Stock Movements ---
export const MovementsApi = {
  record: (body) => request('POST', '/stock-movements', body),
  history: (productId) => request('GET', `/stock-movements/product/${productId}`),
};
