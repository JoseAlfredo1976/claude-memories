import { useEffect, useState } from 'react';
import { stockApi, productsApi } from '../api';
import Modal from '../components/Modal';

export default function Stock() {
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [adjForm, setAdjForm] = useState({ product_id: '', quantity: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('stock');

  const load = async () => {
    const [stockRes, movRes, prodRes] = await Promise.all([
      stockApi.list(), stockApi.movements({ limit: 200 }), productsApi.list()
    ]);
    setStock(stockRes.data);
    setMovements(movRes.data);
    setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const applyFilter = (items) => {
    if (filter === 'all') return items;
    return items.filter(p => p.stock_status === filter);
  };

  const adjust = async () => {
    if (!adjForm.product_id || adjForm.quantity === '') return;
    setSaving(true);
    try {
      await stockApi.adjustment({ ...adjForm, quantity: parseFloat(adjForm.quantity) });
      setModal(false);
      setAdjForm({ product_id: '', quantity: '', notes: '' });
      load();
    } finally { setSaving(false); }
  };

  const statusBadge = (s) => {
    const map = { ok: ['badge-success', 'Normal'], bajo: ['badge-warning', 'Bajo'], agotado: ['badge-danger', 'Agotado'], advertencia: ['badge-warning', 'Advertencia'] };
    const [cls, label] = map[s] || ['badge-gray', s];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  const movIcon = (type) => type.includes('entrada') || type === 'ajuste_entrada' ? '↑' : '↓';
  const movColor = (type) => type.includes('entrada') || type === 'ajuste_entrada' ? 'var(--success)' : 'var(--danger)';

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🏪 Control de Stock</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>± Ajuste manual</button>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('stock')}>Stock actual</button>
        <button className={`btn ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('movements')}>Movimientos</button>
      </div>

      {tab === 'stock' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Inventario actual</h2>
            <div className="flex gap-2">
              {['all', 'agotado', 'bajo', 'advertencia', 'ok'].map(s => (
                <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
                  {s === 'all' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
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
                  <th>Coste/ud.</th>
                  <th>Valor stock</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {applyFilter(stock).map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category}</td>
                    <td className={`stock-${p.stock_status}`}>
                      {Number(p.current_stock).toFixed(2)} {p.unit}
                    </td>
                    <td>{Number(p.min_stock).toFixed(2)} {p.unit}</td>
                    <td>{Number(p.cost_per_unit).toFixed(3)} €/{p.unit}</td>
                    <td>{(p.current_stock * p.cost_per_unit).toFixed(2)} €</td>
                    <td>{statusBadge(p.stock_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Historial de movimientos</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Origen</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td className="text-muted text-sm">{new Date(m.created_at).toLocaleString('es-ES')}</td>
                    <td>
                      <span style={{ color: movColor(m.movement_type), fontWeight: 600 }}>
                        {movIcon(m.movement_type)} {m.movement_type}
                      </span>
                    </td>
                    <td>{m.product_name}</td>
                    <td>{Number(m.quantity).toFixed(2)}</td>
                    <td><span className="badge badge-gray">{m.reference_type || '—'}</span></td>
                    <td className="text-muted text-sm">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <Modal
          title="Ajuste manual de stock"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={adjust} disabled={saving}>
                {saving ? 'Guardando...' : 'Aplicar ajuste'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label>Producto</label>
            <select value={adjForm.product_id} onChange={e => setAdjForm(p => ({ ...p, product_id: e.target.value }))}>
              <option value="">Seleccionar producto</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (actual: {p.current_stock} {p.unit})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Cantidad (positivo = entrada, negativo = salida)</label>
            <input type="number" step="0.01" value={adjForm.quantity} onChange={e => setAdjForm(p => ({ ...p, quantity: e.target.value }))} placeholder="Ej: 5 o -2" />
          </div>
          <div className="form-group">
            <label>Motivo</label>
            <input value={adjForm.notes} onChange={e => setAdjForm(p => ({ ...p, notes: e.target.value }))} placeholder="Ej: Inventario semanal, merma, etc." />
          </div>
        </Modal>
      )}
    </div>
  );
}
