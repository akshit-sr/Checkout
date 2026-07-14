import { useEffect, useMemo, useState } from 'react';
import {
  ProductsApi,
  SuppliersApi,
  errorMessage,
} from '../api/client.js';
import {
  Badge,
  EmptyState,
  Field,
  Modal,
  Spinner,
  currency,
  useToast,
} from '../components/ui.jsx';

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  sellingPrice: '',
  quantityInStock: 0,
  lowStockThreshold: 10,
  unitCost: '',
  supplierId: '',
};

export default function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([ProductsApi.list(), SuppliersApi.list()]);
      setProducts(p);
      setSuppliers(s);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (showLowOnly && !p.lowStock) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)
      );
    });
  }, [products, search, showLowOnly]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setModalOpen(true);
  }

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await ProductsApi.remove(product.id);
      toast('Product deleted', 'success');
      load();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Products</h1>
          <p className="page-subtitle">Manage your catalog and stock levels.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + New Product
        </button>
      </header>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showLowOnly}
            onChange={(e) => setShowLowOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      <section className="card">
        {loading ? (
          <Spinner label="Loading products…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No products found"
            hint="Try adjusting your search or add a new product."
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th className="num">In Stock</th>
                <th className="num">Unit Cost</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="strong">{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td className="num">{p.quantityInStock}</td>
                  <td className="num">{currency(p.unitCost)}</td>
                  <td>{p.supplierName || '—'}</td>
                  <td>
                    {p.lowStock ? (
                      <Badge tone="danger">Low</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </td>
                  <td className="actions-col">
                    <button className="btn btn-ghost" onClick={() => openEdit(p)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-danger"
                      onClick={() => handleDelete(p)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modalOpen && (
        <ProductModal
          editing={editing}
          suppliers={suppliers}
          existingSkus={[...new Set(products.map((p) => p.sku).filter(Boolean))].sort()}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ editing, suppliers, existingSkus = [], onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(
    editing
      ? {
          name: editing.name ?? '',
          sku: editing.sku ?? '',
          description: editing.description ?? '',
          sellingPrice: editing.sellingPrice ?? '',
          quantityInStock: editing.quantityInStock ?? 0,
          lowStockThreshold: editing.lowStockThreshold ?? 10,
          unitCost: editing.unitCost ?? '',
          supplierId: '',
        }
      : emptyForm
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Match the current supplier by name when editing (response has no supplierId).
  useEffect(() => {
    if (editing?.supplierName) {
      const match = suppliers.find((s) => s.name === editing.supplierName);
      if (match) setForm((f) => ({ ...f, supplierId: String(match.id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, suppliers]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.sku.trim()) e.sku = 'SKU is required';
    if (form.quantityInStock === '' || Number(form.quantityInStock) < 0)
      e.quantityInStock = 'Must be 0 or more';
    if (form.unitCost !== '' && Number(form.unitCost) <= 0)
      e.unitCost = 'Must be greater than 0';
    if (form.sellingPrice === '' || Number(form.sellingPrice) <= 0)
      e.sellingPrice = 'Enter a selling price greater than 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const body = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim() || null,
      sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice),
      quantityInStock: Number(form.quantityInStock),
      lowStockThreshold:
        form.lowStockThreshold === '' ? null : Number(form.lowStockThreshold),
      unitCost: form.unitCost === '' ? null : Number(form.unitCost),
      supplierId: form.supplierId ? Number(form.supplierId) : null,
    };
    try {
      if (editing) {
        await ProductsApi.update(editing.id, body);
        toast('Product updated', 'success');
      } else {
        await ProductsApi.create(body);
        toast('Product created', 'success');
      }
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit Product' : 'New Product'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Name" error={errors.name}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="SKU" error={errors.sku}>
          <input
            className="input"
            list="sku-options"
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder="Select an existing SKU or type a new one"
          />
          <datalist id="sku-options">
            {existingSkus.map((sku) => (
              <option key={sku} value={sku} />
            ))}
          </datalist>
        </Field>
        <Field label="Storefront Description">
          <textarea
            className="input"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Shown to customers on the storefront"
          />
        </Field>
        <div className="form-row">
          <Field label="Quantity in Stock" error={errors.quantityInStock}>
            <input
              className="input"
              type="number"
              min="0"
              value={form.quantityInStock}
              onChange={(e) => set('quantityInStock', e.target.value)}
            />
          </Field>
          <Field label="Low Stock Threshold">
            <input
              className="input"
              type="number"
              min="0"
              value={form.lowStockThreshold}
              onChange={(e) => set('lowStockThreshold', e.target.value)}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Unit Cost (USD)" error={errors.unitCost}>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.unitCost}
              onChange={(e) => set('unitCost', e.target.value)}
            />
          </Field>
          <Field label="Selling Price (USD)" error={errors.sellingPrice}>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={form.sellingPrice}
              onChange={(e) => set('sellingPrice', e.target.value)}
              placeholder="Storefront price"
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Supplier">
            <select
              className="input"
              value={form.supplierId}
              onChange={(e) => set('supplierId', e.target.value)}
            >
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
