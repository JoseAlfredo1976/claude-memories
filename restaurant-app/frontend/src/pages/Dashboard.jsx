import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stockApi, invoicesApi, salesApi } from '../api';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [salesSummary, setSalesSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      stockApi.summary(),
      stockApi.alerts(),
      invoicesApi.list(),
      salesApi.report()
    ]).then(([sumRes, alertRes, invRes, saleRes]) => {
      setSummary(sumRes.data);
      setAlerts(alertRes.data.slice(0, 8));
      setRecentInvoices(invRes.data.slice(0, 5));
      setSalesSummary(saleRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted text-sm">{today}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-value">{summary?.total_products ?? 0}</div>
          <div className="stat-label">Productos registrados</div>
        </div>
        <div className={`stat-card ${summary?.out_of_stock > 0 ? 'danger' : 'success'}`}>
          <div className="stat-value">{summary?.out_of_stock ?? 0}</div>
          <div className="stat-label">Productos agotados</div>
        </div>
        <div className={`stat-card ${summary?.low_stock > 0 ? 'warning' : 'success'}`}>
          <div className="stat-value">{summary?.low_stock ?? 0}</div>
          <div className="stat-label">Stock bajo</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{Number(summary?.total_value ?? 0).toFixed(0)} €</div>
          <div className="stat-label">Valor total inventario</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-value">{salesSummary?.summary?.total_sales ?? 0}</div>
          <div className="stat-label">Ventas (últimos 30 días)</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{Number(salesSummary?.summary?.total_revenue ?? 0).toFixed(0)} €</div>
          <div className="stat-label">Ingresos (últimos 30 días)</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Stock alerts */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⚠️ Alertas de stock</h2>
            <Link to="/stock" className="btn btn-secondary btn-sm">Ver todo</Link>
          </div>
          {alerts.length === 0 ? (
            <p className="text-muted text-sm">✅ Todo el stock está en niveles adecuados</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>Mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className={p.current_stock <= 0 ? 'stock-agotado' : 'stock-bajo'}>
                        {p.current_stock} {p.unit}
                      </td>
                      <td>{p.min_stock} {p.unit}</td>
                      <td>
                        <span className={`badge ${p.current_stock <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                          {p.current_stock <= 0 ? 'Agotado' : 'Bajo'}
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
            <h2 className="card-title">🧾 Últimas facturas</h2>
            <Link to="/facturas" className="btn btn-secondary btn-sm">Ver todo</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-muted text-sm">No hay facturas registradas</p>
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
                      <td>{inv.supplier_name || '—'}</td>
                      <td>{inv.invoice_date || '—'}</td>
                      <td>{Number(inv.total_amount || 0).toFixed(2)} €</td>
                      <td>
                        <span className="badge badge-primary">{inv.status}</span>
                      </td>
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
        <div className="card mt-4">
          <div className="card-header">
            <h2 className="card-title">🏆 Platos más vendidos (30 días)</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Plato</th>
                  <th>Unidades vendidas</th>
                  <th>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {salesSummary.topDishes.map((d, i) => (
                  <tr key={d.recipe_name}>
                    <td className="text-muted">{i + 1}</td>
                    <td>{d.recipe_name}</td>
                    <td>{d.units_sold}</td>
                    <td>{Number(d.revenue).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
