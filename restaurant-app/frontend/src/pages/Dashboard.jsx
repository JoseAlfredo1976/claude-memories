import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stockApi, invoicesApi, salesApi } from '../api';

export default function Dashboard() {
  const [summary, setSummary]         = useState(null);
  const [alerts, setAlerts]           = useState([]);
  const [recentInvoices, setRecent]   = useState([]);
  const [salesSummary, setSales]      = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      stockApi.summary(), stockApi.alerts(), invoicesApi.list(), salesApi.report()
    ]).then(([s, a, i, sr]) => {
      setSummary(s.data);
      setAlerts(a.data.slice(0, 6));
      setRecent(i.data.slice(0, 5));
      setSales(sr.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page">
      <div className="loading">
        <div className="spinner spinner-dark" />
        <p>Cargando dashboard...</p>
      </div>
    </div>
  );

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statusBadge = (s) => {
    const m = { registrada:'badge-primary', procesada:'badge-success', pagada:'badge-success', pendiente:'badge-warning' };
    return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
        <Link to="/facturas" className="btn btn-primary btn-lg">
          + Nueva factura
        </Link>
      </div>

      {/* KPI stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">📦</div>
          <div className="stat-value">{summary?.total_products ?? 0}</div>
          <div className="stat-label">Productos en catálogo</div>
        </div>
        <div className={`stat-card ${summary?.out_of_stock > 0 ? 'danger' : 'success'}`}>
          <div className="stat-icon">{summary?.out_of_stock > 0 ? '🚨' : '✅'}</div>
          <div className="stat-value">{summary?.out_of_stock ?? 0}</div>
          <div className="stat-label">Productos agotados</div>
        </div>
        <div className={`stat-card ${summary?.low_stock > 0 ? 'warning' : 'success'}`}>
          <div className="stat-icon">{summary?.low_stock > 0 ? '⚠️' : '✅'}</div>
          <div className="stat-value">{summary?.low_stock ?? 0}</div>
          <div className="stat-label">Stock bajo mínimo</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{Number(summary?.total_value ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</div>
          <div className="stat-label">Valor del inventario</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{salesSummary?.summary?.total_sales ?? 0}</div>
          <div className="stat-label">Ventas (30 días)</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">💶</div>
          <div className="stat-value">{Number(salesSummary?.summary?.total_revenue ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</div>
          <div className="stat-label">Ingresos (30 días)</div>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Stock alerts */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">⚠️ Alertas de stock</div>
              <div className="card-subtitle">{alerts.length} producto{alerts.length !== 1 ? 's' : ''} requieren atención</div>
            </div>
            <Link to="/stock" className="btn btn-ghost btn-sm">Ver todo →</Link>
          </div>
          {alerts.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">✅</div>
              <p>Todo el stock en niveles adecuados</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Actual</th>
                    <th>Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(p => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.name}</td>
                      <td className={p.current_stock <= 0 ? 'stock-agotado-text font-bold' : 'stock-bajo-text font-bold'}>
                        {Number(p.current_stock).toFixed(2)} {p.unit}
                      </td>
                      <td className="text-muted">{p.min_stock} {p.unit}</td>
                      <td>
                        <span className={`badge ${p.current_stock <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                          {p.current_stock <= 0 ? 'Agotado' : 'Stock bajo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent invoices */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🧾 Últimas facturas</div>
              <div className="card-subtitle">Facturas registradas recientemente</div>
            </div>
            <Link to="/facturas" className="btn btn-ghost btn-sm">Ver todo →</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>
              <p>No hay facturas registradas</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proveedor</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="font-semibold">{inv.supplier_name || '—'}</td>
                      <td className="text-muted text-sm">{inv.invoice_date || '—'}</td>
                      <td className="font-bold">{Number(inv.total_amount || 0).toFixed(2)} €</td>
                      <td>{statusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top dishes */}
      {salesSummary?.topDishes?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">🏆 Platos más vendidos</div>
              <div className="card-subtitle">Últimos 30 días</div>
            </div>
            <Link to="/ventas" className="btn btn-ghost btn-sm">Ver informe →</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Plato</th>
                  <th>Unidades</th>
                  <th>Ingresos</th>
                  <th>Contribución</th>
                </tr>
              </thead>
              <tbody>
                {salesSummary.topDishes.map((d, i) => {
                  const total = salesSummary.summary?.total_revenue || 1;
                  const pct = Math.round((d.revenue / total) * 100);
                  return (
                    <tr key={d.recipe_name}>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: '50%',
                          background: i < 3 ? 'var(--primary-light)' : 'var(--surface-2)',
                          color: i < 3 ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '.72rem', fontWeight: 700
                        }}>{i + 1}</span>
                      </td>
                      <td className="font-semibold">{d.recipe_name}</td>
                      <td>{d.units_sold} uds.</td>
                      <td className="font-bold">{Number(d.revenue).toFixed(2)} €</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 100 }} />
                          </div>
                          <span className="text-xs text-muted">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
