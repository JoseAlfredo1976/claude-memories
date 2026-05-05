import { Routes, Route, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Dashboard  from './pages/Dashboard';
import Invoices   from './pages/Invoices';
import Products   from './pages/Products';
import Suppliers  from './pages/Suppliers';
import Recipes    from './pages/Recipes';
import Sales      from './pages/Sales';
import Stock      from './pages/Stock';
import { stockApi } from './api';

const navItems = [
  { to: '/',           label: 'Dashboard',    icon: '📊', end: true },
  { to: '/facturas',   label: 'Facturas',     icon: '🧾' },
  { to: '/productos',  label: 'Productos',    icon: '📦' },
  { to: '/proveedores',label: 'Proveedores',  icon: '🚚' },
  { to: '/escandallos',label: 'Escandallos',  icon: '📋' },
  { to: '/ventas',     label: 'Ventas',       icon: '💶' },
  { to: '/stock',      label: 'Stock',        icon: '🏪', alert: true },
];

export default function App() {
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    stockApi.alerts().then(r => setAlerts(r.data.length)).catch(() => {});
    const id = setInterval(() => {
      stockApi.alerts().then(r => setAlerts(r.data.length)).catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🍽️</div>
          <div>
            <div className="logo-text">RestaurantMgr</div>
            <div className="logo-sub">Panel de gestión</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">General</div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
              {item.alert && alerts > 0 && (
                <span className="nav-badge">{alerts}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          RestaurantManager v1.0 &nbsp;·&nbsp; {new Date().getFullYear()}
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/facturas"    element={<Invoices />} />
          <Route path="/productos"   element={<Products />} />
          <Route path="/proveedores" element={<Suppliers />} />
          <Route path="/escandallos" element={<Recipes />} />
          <Route path="/ventas"      element={<Sales />} />
          <Route path="/stock"       element={<Stock />} />
        </Routes>
      </main>
    </div>
  );
}
