import { useEffect, useState } from 'react';
import { salesApi, recipesApi } from '../api';
import Modal from '../components/Modal';

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [modal, setModal] = useState(false);
  const [items, setItems] = useState([{ recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }]);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('list');
  const [report, setReport] = useState(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const load = async () => {
    const [salesRes, recRes] = await Promise.all([salesApi.list(), recipesApi.list()]);
    setSales(salesRes.data);
    setRecipes(recRes.data);
    setLoading(false);
  };

  const loadReport = async () => {
    const res = await salesApi.report({ from, to });
    setReport(res.data);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'report') loadReport(); }, [tab, from, to]);

  const addItem = () => setItems(p => [...p, { recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const updateItem = (i, key, value) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      if (key === 'recipe_id') {
        const rec = recipes.find(r => r.id === parseInt(value));
        return { ...item, recipe_id: value, recipe_name: rec?.name || '', unit_price: rec?.sale_price || 0 };
      }
      return { ...item, [key]: value };
    }));
  };

  const total = items.reduce((sum, i) => sum + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0);

  const save = async () => {
    const validItems = items.filter(i => i.recipe_name && i.quantity > 0);
    if (!validItems.length) return;
    setSaving(true);
    try {
      await salesApi.create({
        sale_date: saleDate,
        notes,
        items: validItems.map(i => ({
          recipe_id: parseInt(i.recipe_id) || null,
          recipe_name: i.recipe_name,
          quantity: parseInt(i.quantity),
          unit_price: parseFloat(i.unit_price)
        }))
      });
      setModal(false);
      setItems([{ recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }]);
      setNotes('');
      load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">💶 Ventas</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Registrar venta</button>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('list')}>Historial</button>
        <button className={`btn ${tab === 'report' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('report')}>Informe</button>
      </div>

      {tab === 'list' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Total</th><th>Notas</th></tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={3} className="empty">No hay ventas registradas</td></tr>
                ) : sales.map(s => (
                  <tr key={s.id}>
                    <td>{s.sale_date}</td>
                    <td><strong>{Number(s.total_amount).toFixed(2)} €</strong></td>
                    <td className="text-muted text-sm">{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <>
          <div className="card mb-4">
            <div className="flex gap-3 items-center">
              <div className="form-group" style={{ margin: 0 }}>
                <label>Desde</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Hasta</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          </div>
          {report && (
            <>
              <div className="stats-grid mb-4">
                <div className="stat-card primary">
                  <div className="stat-value">{report.summary.total_sales}</div>
                  <div className="stat-label">Ventas</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-value">{Number(report.summary.total_revenue || 0).toFixed(0)} €</div>
                  <div className="stat-label">Ingresos totales</div>
                </div>
                <div className="stat-card primary">
                  <div className="stat-value">{Number(report.summary.avg_ticket || 0).toFixed(2)} €</div>
                  <div className="stat-label">Ticket medio</div>
                </div>
                <div className="stat-card primary">
                  <div className="stat-value">{report.summary.days_with_sales}</div>
                  <div className="stat-label">Días con ventas</div>
                </div>
              </div>
              {report.topDishes?.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 16 }}>🏆 Platos más vendidos</div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Plato</th><th>Unidades</th><th>Ingresos</th></tr></thead>
                      <tbody>
                        {report.topDishes.map((d, i) => (
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
            </>
          )}
        </>
      )}

      {modal && (
        <Modal
          title="Registrar venta"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-success" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : `Registrar ${total.toFixed(2)} €`}
              </button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Servicio de comida, cena..." />
            </div>
          </div>

          <div className="divider" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Platos vendidos</strong>
            <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Añadir plato</button>
          </div>

          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={item.recipe_id} onChange={e => updateItem(i, 'recipe_id', e.target.value)}>
                <option value="">Seleccionar plato</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="Cant." value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Precio €" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)}>✕</button>
            </div>
          ))}

          <div className="cost-breakdown mt-4">
            <div className="cost-row total">
              <span>Total venta</span>
              <span>{total.toFixed(2)} €</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
