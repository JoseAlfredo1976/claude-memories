import { useEffect, useState } from 'react';
import { salesApi, recipesApi } from '../api';
import Modal from '../components/Modal';

export default function Sales() {
  const [sales, setSales]     = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [modal, setModal]     = useState(false);
  const [items, setItems]     = useState([{ recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }]);
  const [saleDate, setDate]   = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes]     = useState('');
  const [tab, setTab]         = useState('list');
  const [report, setReport]   = useState(null);
  const [from, setFrom]       = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [to, setTo]           = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const load = async () => {
    const [sRes, rRes] = await Promise.all([salesApi.list(), recipesApi.list()]);
    setSales(sRes.data); setRecipes(rRes.data); setLoading(false);
  };
  const loadReport = () => salesApi.report({ from, to }).then(r => setReport(r.data));

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'report') loadReport(); }, [tab, from, to]);

  const updateItem = (i, k, v) => setItems(p => p.map((item, idx) => {
    if (idx !== i) return item;
    if (k === 'recipe_id') {
      const rec = recipes.find(r => r.id === parseInt(v));
      return { ...item, recipe_id: v, recipe_name: rec?.name || '', unit_price: rec?.sale_price || 0 };
    }
    return { ...item, [k]: v };
  }));

  const total = items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0);

  const save = async () => {
    const valid = items.filter(i => i.recipe_name && i.quantity > 0);
    if (!valid.length) return;
    setSaving(true);
    try {
      await salesApi.create({
        sale_date: saleDate, notes,
        items: valid.map(i => ({ recipe_id: parseInt(i.recipe_id) || null, recipe_name: i.recipe_name, quantity: parseInt(i.quantity), unit_price: parseFloat(i.unit_price) }))
      });
      setModal(false); setItems([{ recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }]); setNotes(''); load();
    } finally { setSaving(false); }
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando ventas...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">💶 Ventas</h1>
          <p className="page-desc">{sales.length} ventas registradas</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => setModal(true)}>+ Registrar venta</button>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>📋 Historial</button>
        <button className={`tab-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>📊 Informe</button>
      </div>

      {tab === 'list' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Total</th><th>Notas</th></tr></thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={3}><div className="empty"><div className="empty-icon">💶</div><p>Sin ventas registradas</p></div></td></tr>
                ) : sales.map(s => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.sale_date}</td>
                    <td><span className="font-bold" style={{ fontSize: '1rem', color: 'var(--success)' }}>{Number(s.total_amount).toFixed(2)} €</span></td>
                    <td className="text-sm text-muted">{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <>
          <div className="card mb-4" style={{ padding: '16px 20px' }}>
            <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Desde</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Hasta</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} />
              </div>
            </div>
          </div>
          {report && (
            <>
              <div className="stats-grid mb-4">
                <div className="stat-card primary"><div className="stat-icon">🧾</div><div className="stat-value">{report.summary.total_sales}</div><div className="stat-label">Ventas</div></div>
                <div className="stat-card success"><div className="stat-icon">💶</div><div className="stat-value">{Number(report.summary.total_revenue || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</div><div className="stat-label">Ingresos</div></div>
                <div className="stat-card primary"><div className="stat-icon">🎫</div><div className="stat-value">{Number(report.summary.avg_ticket || 0).toFixed(2)} €</div><div className="stat-label">Ticket medio</div></div>
                <div className="stat-card primary"><div className="stat-icon">📅</div><div className="stat-value">{report.summary.days_with_sales}</div><div className="stat-label">Días con ventas</div></div>
              </div>
              {report.topDishes?.length > 0 && (
                <div className="card">
                  <div className="card-header"><div className="card-title">🏆 Platos más vendidos</div></div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>#</th><th>Plato</th><th>Unidades</th><th>Ingresos</th></tr></thead>
                      <tbody>
                        {report.topDishes.map((d, i) => (
                          <tr key={d.recipe_name}>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: i < 3 ? 'var(--primary-light)' : 'var(--surface-2)', color: i < 3 ? 'var(--primary)' : 'var(--text-muted)', fontSize: '.72rem', fontWeight: 700 }}>{i + 1}</span>
                            </td>
                            <td className="font-semibold">{d.recipe_name}</td>
                            <td>{d.units_sold} uds.</td>
                            <td className="font-bold">{Number(d.revenue).toFixed(2)} €</td>
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
        <Modal title="Registrar venta" subtitle="Selecciona los platos vendidos en este servicio"
          onClose={() => setModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn btn-success btn-lg" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando...</> : `✓ Registrar ${total.toFixed(2)} €`}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label>Fecha del servicio</label>
              <input type="date" value={saleDate} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notas</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Servicio comida, cena especial..." />
            </div>
          </div>

          <div className="divider" />
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold" style={{ fontSize: '.875rem' }}>Platos vendidos</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setItems(p => [...p, { recipe_id: '', quantity: 1, unit_price: 0, recipe_name: '' }])}>+ Añadir plato</button>
          </div>

          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={item.recipe_id} onChange={e => updateItem(i, 'recipe_id', e.target.value)}>
                <option value="">— Seleccionar plato —</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="Cant." value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Precio €" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}

          <div className="cost-breakdown mt-4">
            <div className="cost-row total" style={{ fontSize: '1rem' }}>
              <span>Total venta</span>
              <span style={{ color: 'var(--success)' }}>{total.toFixed(2)} €</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
