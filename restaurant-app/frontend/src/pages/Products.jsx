import { useEffect, useState } from 'react';
import { productsApi } from '../api';
import Modal from '../components/Modal';

const UNITS       = ['kg', 'g', 'L', 'ml', 'ud', 'caja', 'bote', 'bolsa', 'lata', 'docena'];
const CATEGORIES  = ['General', 'Carnes', 'Pescados', 'Verduras', 'Frutas', 'Lácteos', 'Panadería', 'Bebidas', 'Conservas', 'Especias', 'Aceites', 'Otros'];
const empty       = { name: '', unit: 'kg', category: 'General', min_stock: 0, current_stock: 0, cost_per_unit: 0 };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(empty);
  const [filter, setFilter]     = useState('');
  const [catFilter, setCat]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = () => productsApi.list().then(r => { setProducts(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (form.id) await productsApi.update(form.id, form);
      else         await productsApi.create(form);
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const remove = async id => {
    if (!confirm('¿Eliminar este producto? El historial de stock se conservará.')) return;
    await productsApi.delete(id); load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtered = products.filter(p =>
    (!catFilter || p.category === catFilter) &&
    (p.name.toLowerCase().includes(filter.toLowerCase()) || p.category.toLowerCase().includes(filter.toLowerCase()))
  );

  const stockStatus = p => {
    if (p.current_stock <= 0)                   return { cls: 'badge-danger',  label: 'Agotado',  textCls: 'stock-agotado-text', pct: 0 };
    if (p.current_stock <= p.min_stock)         return { cls: 'badge-warning', label: 'Bajo',     textCls: 'stock-bajo-text',    pct: Math.min((p.current_stock / (p.min_stock || 1)) * 100, 100) };
    if (p.current_stock <= p.min_stock * 1.5)  return { cls: 'badge-warning', label: 'Atención', textCls: 'stock-advertencia-text', pct: Math.min((p.current_stock / (p.min_stock * 2 || 1)) * 100, 100) };
    return { cls: 'badge-success', label: 'OK', textCls: 'stock-ok-text', pct: 100 };
  };

  const cats = [...new Set(products.map(p => p.category))].sort();

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando productos...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">📦 Productos</h1>
          <p className="page-desc">{products.length} productos · Valor total: {products.reduce((s, p) => s + p.current_stock * p.cost_per_unit, 0).toFixed(2)} €</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setModal('form'); }}>+ Nuevo producto</button>
      </div>

      {/* Filters */}
      <div className="card mb-4" style={{ padding: '14px 18px' }}>
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <input style={{ maxWidth: 260 }} value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔍 Buscar producto..." />
          <select style={{ maxWidth: 180 }} value={catFilter} onChange={e => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-sm text-muted">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th>Stock actual</th>
                <th>Mínimo</th>
                <th>Coste/ud.</th>
                <th>Valor</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><div className="empty"><div className="empty-icon">📦</div><p>No hay productos que coincidan</p></div></td></tr>
              ) : filtered.map(p => {
                const st = stockStatus(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold">{p.name}</div>
                    </td>
                    <td><span className="badge badge-gray">{p.category}</span></td>
                    <td className="text-muted">{p.unit}</td>
                    <td>
                      <div className={`font-bold ${st.textCls}`}>{Number(p.current_stock).toFixed(2)} {p.unit}</div>
                      <div className="stock-bar" style={{ width: 60 }}>
                        <div className="stock-bar-fill" style={{ width: `${st.pct}%`, background: p.current_stock <= 0 ? 'var(--danger)' : p.current_stock <= p.min_stock ? 'var(--warning)' : 'var(--success)' }} />
                      </div>
                    </td>
                    <td className="text-muted">{Number(p.min_stock).toFixed(2)} {p.unit}</td>
                    <td>{Number(p.cost_per_unit).toFixed(3)} €</td>
                    <td className="font-semibold">{(p.current_stock * p.cost_per_unit).toFixed(2)} €</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setForm(p); setModal('form'); }}>Editar</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(p.id)} title="Eliminar">🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'form' && (
        <Modal
          title={form.id ? 'Editar producto' : 'Nuevo producto'}
          subtitle="Define el ingrediente y sus parámetros de stock"
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando...</> : 'Guardar producto'}
            </button>
          </>}
        >
          <div className="form-group">
            <label>Nombre del producto *</label>
            <input value={form.name} onChange={f('name')} placeholder="Ej: Aceite de oliva virgen extra" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Unidad de medida</label>
              <select value={form.unit} onChange={f('unit')}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select value={form.category} onChange={f('category')}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Stock mínimo</label>
              <input type="number" min="0" step="0.01" value={form.min_stock} onChange={f('min_stock')} />
            </div>
            <div className="form-group">
              <label>Stock actual</label>
              <input type="number" min="0" step="0.01" value={form.current_stock} onChange={f('current_stock')} />
            </div>
            <div className="form-group">
              <label>Coste por unidad (€)</label>
              <input type="number" min="0" step="0.001" value={form.cost_per_unit} onChange={f('cost_per_unit')} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
