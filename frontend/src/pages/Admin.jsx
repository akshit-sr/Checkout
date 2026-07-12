import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { money } from '../format'

const EMPTY = { name: '', description: '', price: '', stockQuantity: '' }
const LOW_STOCK = 10 // at or below this (and >0) counts as "low"

export default function Admin() {
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [restock, setRestock] = useState({}) // productId -> amount to add

  function load() {
    Promise.all([api.getProducts(), api.getAllOrders()])
      .then(([p, o]) => { setProducts(p); setOrders(o) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const stats = useMemo(() => {
    // Revenue counts orders that were actually sold (not cancelled).
    const sold = orders.filter(o => o.status !== 'CANCELLED')
    const revenue = sold.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
    const unitsSold = sold.reduce((s, o) => s + o.items.reduce((n, it) => n + it.quantity, 0), 0)
    const toShip = orders.filter(o => o.status === 'PAID').length
    const outOfStock = products.filter(p => p.stockQuantity <= 0)
    const lowStock = products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= LOW_STOCK)
    return { revenue, unitsSold, orderCount: sold.length, toShip, outOfStock, lowStock }
  }, [orders, products])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function addProduct(e) {
    e.preventDefault()
    setError(null); setMsg(null); setSaving(true)
    try {
      const created = await api.createProduct({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        stockQuantity: parseInt(form.stockQuantity, 10),
      })
      setProducts(p => [...p, created])
      setForm(EMPTY)
      setMsg(`Added "${created.name}".`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveStock(p, newStock) {
    setError(null); setMsg(null)
    try {
      const updated = await api.updateProduct(p.id, {
        name: p.name,
        description: p.description,
        price: p.price,
        stockQuantity: newStock,
      })
      setProducts(list => list.map(x => x.id === p.id ? updated : x))
      setRestock(r => ({ ...r, [p.id]: '' }))
      setMsg(`Updated stock for "${p.name}" to ${newStock}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeProduct(p) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return
    setError(null); setMsg(null)
    try {
      await api.deleteProduct(p.id)
      setProducts(list => list.filter(x => x.id !== p.id))
      setMsg(`Deleted "${p.name}".`)
    } catch (err) {
      setError(err.message)
    }
  }

  const restockList = [...stats.outOfStock, ...stats.lowStock]

  return (
    <>
      <h1>Admin · Sales &amp; Stock</h1>
      {error && <p className="error">{error}</p>}
      {msg && <div className="banner">{msg}</div>}

      <div className="stat-row">
        <div className="stat-tile">
          <span className="stat-label">Total sales</span>
          <span className="stat-value">{money(stats.revenue)}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Orders</span>
          <span className="stat-value">{stats.orderCount}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Units sold</span>
          <span className="stat-value">{stats.unitsSold}</span>
        </div>
        <div className={'stat-tile' + (stats.toShip > 0 ? ' stat-alert' : '')}>
          <span className="stat-label">Awaiting shipment</span>
          <span className="stat-value">{stats.toShip}</span>
        </div>
      </div>

      {restockList.length > 0 && (
        <div className="card restock-alert">
          <h2>Needs restocking</h2>
          <ul className="restock-list">
            {restockList.map(p => (
              <li key={p.id}>
                <strong>{p.name}</strong> —{' '}
                {p.stockQuantity <= 0
                  ? <span className="tag-out">out of stock</span>
                  : <span className="tag-low">only {p.stockQuantity} left</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card admin-form">
        <h2>Add a product</h2>
        <form onSubmit={addProduct} className="admin-grid">
          <label>Name
            <input value={form.name} onChange={e => set('name', e.target.value)} required />
          </label>
          <label>Price (USD)
            <input type="number" min="0.01" step="0.01" value={form.price}
                   onChange={e => set('price', e.target.value)} required />
          </label>
          <label className="full">Description
            <input value={form.description} onChange={e => set('description', e.target.value)} />
          </label>
          <label>Initial stock
            <input type="number" min="0" step="1" value={form.stockQuantity}
                   onChange={e => set('stockQuantity', e.target.value)} required />
          </label>
          <div className="admin-submit">
            <button className="buy-btn" type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Inventory</h2>
        {loading ? <p className="muted">Loading…</p> : (
          <table className="admin-table">
            <thead>
              <tr><th>Name</th><th>Price</th><th>Stock</th><th>Restock</th><th></th></tr>
            </thead>
            <tbody>
              {products.map(p => {
                const out = p.stockQuantity <= 0
                const low = !out && p.stockQuantity <= LOW_STOCK
                const add = restock[p.id] ?? ''
                return (
                  <tr key={p.id} className={out ? 'row-out' : ''}>
                    <td>{p.name}</td>
                    <td>{money(p.price)}</td>
                    <td>
                      {p.stockQuantity}
                      {out && <span className="tag-out"> unavailable</span>}
                      {low && <span className="tag-low"> low</span>}
                    </td>
                    <td className="restock-cell">
                      <input type="number" min="1" step="1" placeholder="+ qty"
                             value={add}
                             onChange={e => setRestock(r => ({ ...r, [p.id]: e.target.value }))} />
                      <button className="link"
                              disabled={!add || parseInt(add, 10) <= 0}
                              onClick={() => saveStock(p, p.stockQuantity + parseInt(add, 10))}>
                        Restock
                      </button>
                    </td>
                    <td>
                      <button className="link danger" onClick={() => removeProduct(p)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
