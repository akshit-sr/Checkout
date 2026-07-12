import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { money } from '../format'

export default function Cart() {
  const navigate = useNavigate()
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  function load() {
    setLoading(true)
    api.getCart()
      .then(setCart)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function remove(productId) {
    setError(null)
    try { setCart(await api.removeFromCart(productId)) }
    catch (e) { setError(e.message) }
  }

  async function setQty(productId, quantity) {
    setError(null); setBusy(true)
    try { setCart(await api.setCartQuantity(productId, quantity)) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function checkout() {
    setError(null); setBusy(true)
    try { await api.checkout(); navigate('/orders') }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  if (loading) return <p className="pad">Loading cart…</p>

  const items = cart?.items ?? []
  const count = items.reduce((s, it) => s + it.quantity, 0)

  if (items.length === 0) {
    return (
      <div className="cart-empty card">
        <h2>Your cart is empty</h2>
        <button className="buy-btn wide" onClick={() => navigate('/')}>Continue shopping</button>
      </div>
    )
  }

  return (
    <div className="cart-layout">
      <div className="card cart-main">
        <h1>Shopping Cart</h1>
        {error && <p className="error">{error}</p>}
        <div className="cart-head-row muted">Price</div>
        {items.map(it => (
          <div key={it.productId} className="cart-item">
            <div className="cart-thumb">📦</div>
            <div className="cart-info">
              <div className="cart-name">{it.productName}</div>
              <div className="cart-actions">
                <div className="qty-stepper">
                  <button
                    aria-label="Decrease quantity"
                    disabled={busy}
                    onClick={() => setQty(it.productId, it.quantity - 1)}
                  >−</button>
                  <span className="qty-count">{it.quantity}</span>
                  <button
                    aria-label="Increase quantity"
                    disabled={busy}
                    onClick={() => setQty(it.productId, it.quantity + 1)}
                  >+</button>
                </div>
                <span className="divider">|</span>
                <button className="link danger" disabled={busy} onClick={() => remove(it.productId)}>Delete</button>
              </div>
            </div>
            <div className="cart-line">{money(it.lineTotal)}</div>
          </div>
        ))}
        <div className="cart-subtotal-row">
          Subtotal ({count} item{count === 1 ? '' : 's'}):&nbsp;<strong>{money(cart.total)}</strong>
        </div>
      </div>

      <aside className="card cart-summary">
        <div className="summary-total">
          Subtotal ({count} item{count === 1 ? '' : 's'}): <strong>{money(cart.total)}</strong>
        </div>
        <button className="buy-btn wide" onClick={checkout} disabled={busy}>
          {busy ? 'Placing order…' : 'Proceed to checkout'}
        </button>
      </aside>
    </div>
  )
}
