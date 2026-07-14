import { useEffect, useState } from 'react';
import {
  MovementsApi,
  ProductsApi,
  errorMessage,
} from '../api/client.js';
import {
  Badge,
  EmptyState,
  Field,
  Spinner,
  formatDate,
  useToast,
} from '../components/ui.jsx';

const TYPES = [
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
];

function typeTone(type) {
  if (type === 'STOCK_IN') return 'success';
  if (type === 'STOCK_OUT') return 'danger';
  return 'neutral';
}

export default function Movements() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [form, setForm] = useState({
    type: 'STOCK_IN',
    quantity: 1,
    performedBy: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    ProductsApi.list()
      .then((p) => {
        setProducts(p);
        if (p.length) setSelectedId(String(p[0].id));
      })
      .catch((err) => toast(errorMessage(err), 'error'))
      .finally(() => setLoadingProducts(false));
  }, [toast]);

  async function loadHistory(productId) {
    if (!productId) return;
    setLoadingHistory(true);
    try {
      setHistory(await MovementsApi.history(productId));
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (selectedId) loadHistory(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!selectedId) {
      toast('Select a product first', 'error');
      return;
    }
    if (Number(form.quantity) <= 0) {
      toast('Quantity must be greater than 0', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await MovementsApi.record({
        productId: Number(selectedId),
        type: form.type,
        quantity: Number(form.quantity),
        performedBy: form.performedBy.trim() || null,
        reason: form.reason.trim() || null,
      });
      toast('Movement recorded', 'success');
      set('quantity', 1);
      set('reason', '');
      loadHistory(selectedId);
      // refresh product stock levels
      ProductsApi.list().then(setProducts).catch(() => {});
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => String(p.id) === selectedId);

  if (loadingProducts) return <Spinner label="Loading…" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Stock Movements</h1>
          <p className="page-subtitle">Record stock changes and review history.</p>
        </div>
      </header>

      {products.length === 0 ? (
        <section className="card">
          <EmptyState
            title="No products available"
            hint="Create a product before recording movements."
          />
        </section>
      ) : (
        <div className="split">
          <section className="card">
            <div className="card-header">
              <h2>Record Movement</h2>
            </div>
            <form onSubmit={submit} className="form">
              <Field label="Product">
                <select
                  className="input"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku ? `${p.name} (${p.sku})` : p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedProduct && (
                <p className="hint-line">
                  Current stock: <strong>{selectedProduct.quantityInStock}</strong>
                </p>
              )}
              <div className="form-row">
                <Field label="Type">
                  <select
                    className="input"
                    value={form.type}
                    onChange={(e) => set('type', e.target.value)}
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity">
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => set('quantity', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Performed By">
                <input
                  className="input"
                  value={form.performedBy}
                  onChange={(e) => set('performedBy', e.target.value)}
                  placeholder="e.g. warehouse staff"
                />
              </Field>
              <Field label="Reason">
                <input
                  className="input"
                  value={form.reason}
                  onChange={(e) => set('reason', e.target.value)}
                  placeholder="e.g. purchase order #1234"
                />
              </Field>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Recording…' : 'Record Movement'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <h2>History</h2>
              {selectedProduct && (
                <span className="muted">{selectedProduct.name}</span>
              )}
            </div>
            {loadingHistory ? (
              <Spinner label="Loading history…" />
            ) : history.length === 0 ? (
              <EmptyState title="No movements yet" hint="Recorded changes will appear here." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th className="num">Change</th>
                    <th className="num">Resulting</th>
                    <th>By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((m) => (
                    <tr key={m.id}>
                      <td className="muted">{formatDate(m.timestamp)}</td>
                      <td>
                        <Badge tone={typeTone(m.type)}>{m.type.replace('_', ' ')}</Badge>
                      </td>
                      <td className="num">
                        {m.quantityChanged > 0 ? `+${m.quantityChanged}` : m.quantityChanged}
                      </td>
                      <td className="num strong">{m.resultingQuantity}</td>
                      <td>{m.performedBy || '—'}</td>
                      <td>{m.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
