import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductsApi, SuppliersApi, errorMessage } from '../api/client.js';
import { api } from '../../api.js';
import { Badge, EmptyState, Spinner, currency, useToast } from '../components/ui.jsx';

export default function Dashboard() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([ProductsApi.list(), SuppliersApi.list(), api.getAllOrders()])
      .then(([p, s, o]) => {
        if (!active) return;
        setProducts(p);
        setSuppliers(s);
        setOrders(o);
      })
      .catch((err) => toast(errorMessage(err), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [toast]);

  const stats = useMemo(() => {
    const lowStock = products.filter((p) => p.lowStock);
    const totalValue = products.reduce(
      (sum, p) => sum + Number(p.unitCost || 0) * Number(p.quantityInStock || 0),
      0
    );
    const totalUnits = products.reduce((sum, p) => sum + Number(p.quantityInStock || 0), 0);
    return { lowStock, totalValue, totalUnits };
  }, [products]);

  const sales = useMemo(() => {
    // Revenue counts orders that were actually sold (not cancelled).
    const sold = orders.filter((o) => o.status !== 'CANCELLED');
    const revenue = sold.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const unitsSold = sold.reduce(
      (s, o) => s + o.items.reduce((n, it) => n + it.quantity, 0),
      0
    );
    const toShip = orders.filter((o) => o.status === 'PAID').length;
    return { revenue, unitsSold, orderCount: sold.length, toShip };
  }, [orders]);

  if (loading) return <Spinner label="Loading dashboard…" />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Live overview of sales and inventory.</p>
        </div>
      </header>

      <h2 className="section-title">Sales</h2>
      <section className="stat-grid">
        <StatCard label="Revenue" value={currency(sales.revenue)} accent="green" />
        <StatCard label="Orders" value={sales.orderCount} accent="blue" />
        <StatCard label="Units Sold" value={sales.unitsSold.toLocaleString()} accent="violet" />
        <StatCard
          label="Awaiting Shipment"
          value={sales.toShip}
          accent={sales.toShip ? 'amber' : 'green'}
        />
      </section>

      <h2 className="section-title">Inventory</h2>
      <section className="stat-grid">
        <StatCard label="Products" value={products.length} accent="blue" />
        <StatCard label="Total Units" value={stats.totalUnits.toLocaleString()} accent="green" />
        <StatCard label="Inventory Value" value={currency(stats.totalValue)} accent="violet" />
        <StatCard
          label="Low Stock"
          value={stats.lowStock.length}
          accent={stats.lowStock.length ? 'red' : 'green'}
        />
        <StatCard label="Suppliers" value={suppliers.length} accent="amber" />
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Low Stock Alerts</h2>
          <Link className="link" to="/admin/inventory/products">
            Manage products →
          </Link>
        </div>
        {stats.lowStock.length === 0 ? (
          <EmptyState title="All good" hint="No products are below their reorder threshold." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th className="num">In Stock</th>
                <th className="num">Threshold</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {stats.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="mono">{p.sku}</td>
                  <td className="num">
                    <Badge tone="danger">{p.quantityInStock}</Badge>
                  </td>
                  <td className="num">{p.lowStockThreshold ?? '—'}</td>
                  <td>{p.supplierName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
