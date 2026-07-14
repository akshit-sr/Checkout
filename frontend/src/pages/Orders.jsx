import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { money, dateTime } from '../format'

// The next step in the order lifecycle, plus the label for the admin button.
// "Send stock to customer" is the PAID -> SHIPPED transition.
function nextAction(status) {
  switch (status) {
    case 'PENDING': return { status: 'PAID', label: 'Confirm payment' }
    case 'PAID': return { status: 'SHIPPED', label: '🚚 Send stock to customer' }
    case 'SHIPPED': return { status: 'DELIVERED', label: 'Mark as delivered' }
    default: return null
  }
}

export default function Orders() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'ADMIN'

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // order id currently updating

  function load() {
    const fetch = isAdmin ? api.getAllOrders() : api.getOrders()
    fetch
      // Newest order first.
      .then(data => setOrders([...data].sort((a, b) => b.id - a.id)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function advance(o) {
    const action = nextAction(o.status)
    if (!action) return
    setError(null); setBusy(o.id)
    try {
      const updated = await api.updateOrderStatus(o.id, action.status)
      setOrders(list => list.map(x => x.id === o.id ? updated : x))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="pad">Loading orders…</p>
  if (error) return <p className="error pad">{error}</p>

  return (
    <>
      <h1>{isAdmin ? 'All Orders' : 'Your Orders'}</h1>
      {!isAdmin && orders.length === 0 && (
        <div className="card cart-empty">
          <h2>No orders yet</h2>
          <button className="buy-btn wide" onClick={() => navigate('/')}>Start shopping</button>
        </div>
      )}
      {isAdmin && orders.length === 0 && <p className="muted pad">No orders have been placed yet.</p>}

      {orders.map(o => {
        const action = isAdmin ? nextAction(o.status) : null
        return (
          <div key={o.id} className="order-card">
            <div className="order-bar">
              <div className="ob-col">
                <span className="ob-label">Order placed</span>
                <span className="ob-value">{dateTime(o.createdAt)}</span>
              </div>
              {isAdmin && (
                <div className="ob-col">
                  <span className="ob-label">Customer</span>
                  <span className="ob-value">{o.customerEmail}</span>
                </div>
              )}
              <div className="ob-col">
                <span className="ob-label">Total</span>
                <span className="ob-value">{money(o.totalAmount)}</span>
              </div>
              <div className="ob-col right">
                <span className="ob-label">Order # {o.id}</span>
                <span className={'badge ' + o.status?.toLowerCase()}>{o.status}</span>
              </div>
            </div>
            <div className="order-body">
              {o.items.map((it, i) => (
                <div key={i} className="order-line">
                  <div className="cart-thumb small">📦</div>
                  <div>
                    <div className="cart-name">{it.productName}</div>
                    <div className="muted">Qty: {it.quantity} · {money(it.unitPriceAtPurchase)} each</div>
                  </div>
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="order-admin-bar">
                {action ? (
                  <button className="buy-btn" disabled={busy === o.id} onClick={() => advance(o)}>
                    {busy === o.id ? 'Updating…' : action.label}
                  </button>
                ) : (
                  <span className="muted">No further action ({o.status.toLowerCase()}).</span>
                )}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
