import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import { money } from '../format'

// A stable-ish emoji thumbnail so cards aren't blank (backend has no images).
function thumbFor(name = '') {
  const n = name.toLowerCase()
  if (n.includes('mouse')) return '🖱️'
  if (n.includes('keyboard')) return '⌨️'
  if (n.includes('monitor') || n.includes('screen')) return '🖥️'
  if (n.includes('hub') || n.includes('usb')) return '🔌'
  if (n.includes('stand') || n.includes('laptop')) return '💻'
  if (n.includes('phone')) return '📱'
  if (n.includes('head') || n.includes('audio') || n.includes('speaker')) return '🎧'
  if (n.includes('camera')) return '📷'
  return '📦'
}

export default function Products() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = (params.get('q') || '').toLowerCase()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(null)
  const [msg, setMsg] = useState(null)
  const [addError, setAddError] = useState(null)

  // Initial load shows a spinner. After that, a Server-Sent Events stream pushes
  // catalog changes instantly (new products, price/stock updates, sell-outs), and
  // we refetch the list on each event. A slow interval is kept purely as a
  // fallback in case the SSE connection can't be established.
  useEffect(() => {
    let active = true

    const refetch = () => api.getProducts()
      .then(p => { if (active) setProducts(p) })
      .catch(() => {})

    api.getProducts()
      .then(p => { if (active) setProducts(p) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })

    const es = new EventSource('/api/products/stream')
    es.addEventListener('products-changed', refetch)

    const fallback = setInterval(() => {
      if (es.readyState !== EventSource.OPEN) refetch()
    }, 30000)

    return () => { active = false; es.close(); clearInterval(fallback) }
  }, [])

  const visible = useMemo(() => {
    if (!q) return products
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q))
  }, [products, q])

  async function add(p) {
    if (!user) { navigate('/login'); return }
    setMsg(null); setAddError(null); setAdding(p.id)
    try {
      await api.addToCart(p.id, 1)
      setMsg(`Added "${p.name}" to your cart.`)
    } catch (e) {
      setAddError(e.message)
    } finally {
      setAdding(null)
    }
  }

  // Auto-dismiss the "added to cart" toast after a few seconds.
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])

  if (loading) return <p className="pad">Loading products…</p>
  if (error) return <p className="error pad">{error}</p>

  return (
    <>
      <div className="results-head">
        <h1>{q ? `Results for “${q}”` : 'Featured products'}</h1>
        <span className="muted">{visible.length} item{visible.length === 1 ? '' : 's'}</span>
      </div>

      {addError && <div className="banner banner-error">{addError}</div>}
      {visible.length === 0 && <p className="muted pad">No products found.</p>}

      {msg && (
        <div className="toast" role="status">
          <span className="toast-check">✓</span>
          <span className="toast-text">{msg}</span>
          <button className="toast-cta" onClick={() => navigate('/cart')}>View cart</button>
        </div>
      )}

      <div className="grid">
        {visible.map(p => {
          const out = p.stockQuantity <= 0
          return (
            <div key={p.id} className="pcard">
              <div className="pthumb">{thumbFor(p.name)}</div>
              <h3 className="ptitle">{p.name}</h3>
              <p className="pdesc">{p.description}</p>
              <div className="pprice">
                <span className="cur">$</span>
                <span className="whole">{Math.floor(Number(p.price))}</span>
                <span className="frac">{(Number(p.price) % 1).toFixed(2).slice(2)}</span>
              </div>
              <div className={'pstock ' + (out ? 'out' : 'in')}>
                {out ? 'Currently unavailable' : (p.stockQuantity < 10 ? `Only ${p.stockQuantity} left in stock` : 'In stock')}
              </div>
              {user?.role === 'ADMIN' ? (
                <button className="buy-btn" onClick={() => navigate('/admin')}>
                  Manage in dashboard
                </button>
              ) : (
                <button
                  className="buy-btn"
                  disabled={out || adding === p.id}
                  onClick={() => add(p)}
                >
                  {adding === p.id ? 'Adding…' : 'Add to Cart'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
