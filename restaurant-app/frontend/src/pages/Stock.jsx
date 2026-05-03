import { useEffect, useState } from 'react';
import { stockApi, productsApi } from '../api';
import Modal from '../components/Modal';

export default function Stock() {
  const [stock, setStock]       = useState([]);
  const [movements, setMov]     = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter]     = useState('all');
  const [modal, setModal]       = useState(false);
  const [adj, setAdj]           = useState({ product_id: '', quantity: '', notes: '' });
  const [tab, setTab]           = useState('stock');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    const [sRes, mRes, pRes] = await Promise.all([stockApi.list(), stockApi.movements({ limit: 300 }), productsApi.list()]);
    setStock(sRes.data); setMov(mRes.data); setProducts(pRes.data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const adjust = async () => {
    if (!adj.product_id || adj.quantity === '') return;
    setSaving(true);
    try { await stockApi.adjustment({ ...adj, quantity: parseFloat(adj.quantity) }); setModal(false); setAdj({ product_id: '', quantity: '', notes: '' }); load(); }
    finally { setSaving(false); }
  };

  const filtered = filter === 'all' ? stock : stock.filter(p => p.stock_status === filter);

  const statusBadge = s => {
    const m = { ok: ['badge-success','Normal'], bajo: ['badge-warning','Bajo'], agotado: ['badge-danger','Agotado'], advertencia: ['badge-warning','Atención'] };
    const [cls, label] = m[s] || ['badge-gray', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const movTypeStyle = t => ({
    color: (t.includes('entrada') || t === 'ajuste_entrada') ? 'var(--success)' : 'var(--danger)',
    background: (t.includes('entrada') || t === 'ajuste_entrada') ? 'var(--success-light)' : 'var(--danger-light)',
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 100, fontSize: '.72rem', fontWeight: 700
  });

  const summary = {
    agotado: stock.filter(p => p.stock_status === 'agotado').length,
    bajo:    stock.filter(p => p.stock_status === 'bajo').length,
    ok:      stock.filter(p => p.stock_status === 'ok').length,
    valor:   stock.reduce((s, p) => s + p.current_stock * p.cost_per_unit, 0)
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando stock...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">🏪 Control de Stock</h1>
          <p className="page-desc">Inventario en tiempo real · Valor: {summary.valor.toFixed(2)} €</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>± Ajuste manual</button>
      </div>

      {/* Mini stats */}
      <div className="stats-grid mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card danger">
          <div className="stat-icon">🚨</div>
          <div className="stat-value">{summary.agotado}</div>
          <div className="stat-label">Agotados</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{summary.bajo}</div>
          <div className="stat-label">Bajo mínimo</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{summary.ok}</div>
          <div className="stat-label">En nivel OK</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-icon">💰</div>
          <div className="stat-value">{summary.valor.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</div>
          <div className="stat-label">Valor total</div>
        </div>
      </div>

      <div className="tabs">
        {['stock', 'movements'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'stock' ? '📦 Inventario' : '📋 Movimientos'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Inventario actual</div>
            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
              {[['all','Todos'],['agotado','Agotados'],['bajo','Bajos'],['ok','OK']].map(([v,l]) => (
                <button key={v} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock actual</th>
                  <th>Mínimo</th>
                  <th>Nivel</th>
                  <th>Coste/ud.</th>
                  <th>Valor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const ratio = p.min_stock > 0 ? Math.min(p.current_stock / (p.min_stock * 2), 1) : 1;
                  const barColor = p.current_stock <= 0 ? 'var(--danger)' : p.current_stock <= p.min_stock ? 'var(--warning)' : 'var(--success)';
                  return (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.name}</td>
                      <td><span className="badge badge-gray">{p.category}</span></td>
                      <td className="font-bold">{Number(p.current_stock).toFixed(2)} {p.unit}</td>
                      <td className="text-muted">{Number(p.min_stock).toFixed(2)} {p.unit}</td>
                      <td>
                        <div style={{ width: 80 }}>
                          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                            {p.min_stock > 0 ? Math.round((p.current_stock / p.min_stock) * 100) : 100}%
                          </div>
                          <div className="stock-bar">
                            <div className="stock-bar-fill" style={{ width: `${ratio * 100}%`, background: barColor }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{Number(p.cost_per_unit).toFixed(3)} €</td>
                      <td className="font-semibold">{(p.current_stock * p.cost_per_unit).toFixed(2)} €</td>
                      <td>{statusBadge(p.stock_status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Historial de movimientos</div>
            <span className="badge badge-gray">{movements.length} registros</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty"><div className="empty-icon">📋</div><p>Sin movimientos</p></div></td></tr>
                ) : movements.map(m => (
                  <tr key={m.id}>
                    <td className="text-sm text-muted">{new Date(m.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="font-semibold">{m.product_name}</td>
                    <td><span style={movTypeStyle(m.movement_type)}>{m.movement_type.includes('entrada') || m.movement_type === 'ajuste_entrada' ? '↑' : '↓'} {m.movement_type}</span></td>
                    <td className="font-bold">{Number(m.quantity).toFixed(2)}</td>
                    <td><span className="badge badge-info">{m.reference_type || 'manual'}</span></td>
                    <td className="text-sm text-muted">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal title="Ajuste manual de stock" subtitle="Corrige el stock por merma, inventario o error" onClose={() => setModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={adjust} disabled={saving}>
              {saving ? <><span className="spinner" /> Aplicando...</> : 'Aplicar ajuste'}
            </button>
          </>}
        >
          <div className="form-group">
            <label>Producto</label>
            <select value={adj.product_id} onChange={e => setAdj(p => ({ ...p, product_id: e.target.value }))}>
              <option value="">— Seleccionar producto —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.current_stock} {p.unit})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cantidad (+ entrada · − salida)</label>
            <input type="number" step="0.01" value={adj.quantity} onChange={e => setAdj(p => ({ ...p, quantity: e.target.value }))} placeholder="Ej: 10 o -3.5" />
          </div>
          <div className="form-group">
            <label>Motivo</label>
            <input value={adj.notes} onChange={e => setAdj(p => ({ ...p, notes: e.target.value }))} placeholder="Inventario semanal, merma, rotura..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
