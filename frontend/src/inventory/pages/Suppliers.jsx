import { useEffect, useState } from 'react';
import { SuppliersApi, errorMessage } from '../api/client.js';
import {
  EmptyState,
  Field,
  Modal,
  Spinner,
  useToast,
} from '../components/ui.jsx';

export default function Suppliers() {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setSuppliers(await SuppliersApi.list());
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p className="page-subtitle">Vendors that supply your products.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + New Supplier
        </button>
      </header>

      <section className="card">
        {loading ? (
          <Spinner label="Loading suppliers…" />
        ) : suppliers.length === 0 ? (
          <EmptyState title="No suppliers yet" hint="Add your first supplier to get started." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="strong">{s.name}</td>
                  <td>{s.contactEmail || '—'}</td>
                  <td>{s.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modalOpen && (
        <SupplierModal
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

function SupplierModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', contactEmail: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail))
      e.contactEmail = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await SuppliersApi.create({
        name: form.name.trim(),
        contactEmail: form.contactEmail.trim() || null,
        phone: form.phone.trim() || null,
      });
      toast('Supplier created', 'success');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Supplier" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label="Name" error={errors.name}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Contact Email" error={errors.contactEmail}>
          <input
            className="input"
            type="email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Create Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
