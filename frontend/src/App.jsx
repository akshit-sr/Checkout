import { useState, useEffect } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import { api } from './api'
import Login from './pages/Login.jsx'
import Products from './pages/Products.jsx'
import Cart from './pages/Cart.jsx'
import Orders from './pages/Orders.jsx'
import Admin from './pages/Admin.jsx'

function Protected({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function AdminOnly({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'ADMIN' ? children : <Navigate to="/" replace />
}

function Nav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')
  const isAdmin = user?.role === 'ADMIN'
  const [pending, setPending] = useState(0) // orders awaiting shipment (admin)

  // Poll for orders that still need shipping so the admin sees a live badge.
  useEffect(() => {
    if (!isAdmin) { setPending(0); return }
    let active = true
    const refresh = () => api.getAllOrders()
      .then(orders => { if (active) setPending(orders.filter(o => o.status === 'PAID').length) })
      .catch(() => {})
    refresh()
    const id = setInterval(refresh, 15000)
    return () => { active = false; clearInterval(id) }
  }, [isAdmin, location.pathname])

  function search(e) {
    e.preventDefault()
    navigate(term.trim() ? `/?q=${encodeURIComponent(term.trim())}` : '/')
  }

  return (
    <header className="nav">
      <Link to="/" className="brand">
        <span className="brand-name">Checkout</span>
      </Link>

      <form className="search" onSubmit={search}>
        <input
          placeholder="Search products"
          value={term}
          onChange={e => setTerm(e.target.value)}
        />
        <button type="submit" aria-label="Search">🔍</button>
      </form>

      <div className="nav-right">
        {user ? (
          <>
            {isAdmin && (
              <Link to="/admin" className="nav-block">
                <span className="nav-line1">Sales &amp; stock</span>
                <span className="nav-line2">Dashboard</span>
              </Link>
            )}
            <Link to="/orders" className="nav-block nav-orders">
              <span className="nav-line1">Hello, {user.email.split('@')[0]}</span>
              <span className="nav-line2">Orders</span>
              {isAdmin && pending > 0 && (
                <span className="order-badge" title={`${pending} order(s) to ship`}>{pending}</span>
              )}
            </Link>
            {!isAdmin && (
              <Link to="/cart" className="nav-cart">
                <span className="cart-icon">🛒</span>
                <span className="nav-line2">Cart</span>
              </Link>
            )}
            <button className="nav-block as-btn" onClick={() => { logout(); navigate('/login') }}>
              <span className="nav-line1">{user.role === 'ADMIN' ? 'Admin' : 'Account'}</span>
              <span className="nav-line2">Sign out</span>
            </button>
          </>
        ) : (
          <Link to="/login" className="nav-block">
            <span className="nav-line1">Hello, sign in</span>
            <span className="nav-line2">Account &amp; Lists</span>
          </Link>
        )}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cart" element={<Protected><Cart /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/admin" element={<AdminOnly><Admin /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
