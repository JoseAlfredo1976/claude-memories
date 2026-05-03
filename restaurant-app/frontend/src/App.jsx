import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Products from './pages/Products';
import Suppliers from './pages/Suppliers';
import Recipes from './pages/Recipes';
import Sales from './pages/Sales';
import Stock from './pages/Stock';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/facturas', label: 'Facturas', icon: '🧾' },
  { to: '/productos', label: 'Productos', icon: '📦' },
  { to: '/proveedores', label: 'Proveedores', icon: '🚚' },
  { to: '/escandallos', label: 'Escandallos', icon: '📋' },
  { to: '/ventas', label: 'Ventas', icon: '💶' },
  { to: '/stock', label: 'Stock', icon: '🏪' }
];

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🍽️</span>
          <span>RestaurantMgr</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px', fontSize: '.75rem', color: 'var(--text-muted)' }}>
          RestaurantManager v1.0
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/facturas" element={<Invoices />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/proveedores" element={<Suppliers />} />
          <Route path="/escandallos" element={<Recipes />} />
          <Route path="/ventas" element={<Sales />} />
          <Route path="/stock" element={<Stock />} />
        </Routes>
      </main>
    </div>
  );
}
