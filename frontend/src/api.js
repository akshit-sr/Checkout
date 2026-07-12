// Thin fetch wrapper. All calls go to /api and are proxied to the backend.
const TOKEN_KEY = 'checkout_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(method, path, body) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export const api = {
  register: (email, password) => request('POST', '/auth/register', { email, password }),
  login: (email, password) => request('POST', '/auth/login', { email, password }),

  getProducts: () => request('GET', '/products'),
  getProduct: (id) => request('GET', `/products/${id}`),
  createProduct: (p) => request('POST', '/products', p),
  updateProduct: (id, p) => request('PUT', `/products/${id}`, p),
  deleteProduct: (id) => request('DELETE', `/products/${id}`),

  getCart: () => request('GET', '/cart'),
  addToCart: (productId, quantity) => request('POST', '/cart/items', { productId, quantity }),
  setCartQuantity: (productId, quantity) => request('PUT', `/cart/items/${productId}`, { quantity }),
  removeFromCart: (productId) => request('DELETE', `/cart/items/${productId}`),

  checkout: () => request('POST', '/orders/checkout'),
  getOrders: () => request('GET', '/orders'),
  getAllOrders: () => request('GET', '/orders/all'),
  updateOrderStatus: (id, status) => request('PUT', `/orders/${id}/status`, { status }),
}
