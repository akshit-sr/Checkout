import { NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { ToastProvider } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Movements from './pages/Movements.jsx';
import { useAuth } from '../auth.jsx';
import './inventory.css';

const nav = [
  { to: '/admin/inventory', end: true, label: 'Dashboard', icon: '▤' },
  { to: '/admin/inventory/products', label: 'Products', icon: '▦' },
  { to: '/admin/inventory/suppliers', label: 'Suppliers', icon: '◈' },
  { to: '/admin/inventory/movements', label: 'Stock Movements', icon: '⇅' },
];

/**
 * The inventory back office, mounted at /admin/inventory/* inside the storefront
 * app. It shares the checkout session (admin-only) and the same backend origin,
 * so there is no redirect and no second app to run. Styles are scoped under
 * `.inv-scope` so the dashboard look never bleeds into the storefront.
 */
export default function InventoryApp() {
  const { user } = useAuth();
  return (
    <ToastProvider>
      <div className="inv-scope">
        <div className="app">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark">◧</span>
              <span className="brand-name">Inventory</span>
            </div>
            <nav className="nav">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    'nav-link' + (isActive ? ' nav-link-active' : '')
                  }
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="sidebar-footer">
              <div className="who">{user?.email || 'admin'}</div>
              <Link className="link" to="/">← Back to store</Link>
            </div>
          </aside>

          <main className="content">
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="suppliers" element={<Suppliers />} />
              <Route path="movements" element={<Movements />} />
              <Route path="*" element={<Navigate to="/admin/inventory" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
