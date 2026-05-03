import { useEffect, useState } from 'react';
import { productsApi } from '../api';
import Modal from '../components/Modal';

const UNITS = ['kg', 'g', 'L', 'ml', 'ud', 'caja', 'bote', 'bolsa', 'lata', 'docena'];
const CATEGORIES = ['General', 'Carnes', 'Pescados', 'Verduras', 'Frutas', 'Lácteos', 'Panadería', 'Bebidas', 'Conservas', 'Especias', 'Aceites', 'Otros'];

const empty = { name: '', unit: 'kg', category: 'General', min_stock: 0, current_stock: 0, cost_per_unit: 0 };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => productsApi.list().then(r => { setProducts(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setModal('create'); };
  const openEdit = (p) => { setForm(p); setModal('edit'); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'edit') await productsApi.update(form.id, form);
      else await productsApi.create(form);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await productsApi.delete(id);
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.category.toLowerCase().includes(filter.toLowerCase())
  );

  const stockBadge = (p) => {
    if (p.current_stock <= 0) return <span className="badge badge-danger">Agotado</span>;
    if (p.current_stock <= p.min_stock) return <span className="badge badge-warning">Bajo</span>;
    return <span className="badge badge-success">OK</span>;
  };

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📦 Productos / Ingredientes</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo producto</button>
      </div>

      <div className="card mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="🔍 Buscar por nombre o categoría..." />
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
                <th>Stock mín.</th>
                <th>Coste/ud.</th>
                <th>Valor</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty">No hay productos</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.category}</td>
                  <td>{p.unit}</td>
                  <td className={p.current_stock <= 0 ? 'stock-agotado' : p.current_stock <= p.min_stock ? 'stock-bajo' : ''}>
                    {Number(p.current_stock).toFixed(2)} {p.unit}
                  </td>
                  <td>{Number(p.min_stock).toFixed(2)} {p.unit}</td>
                  <td>{Number(p.cost_per_unit).toFixed(3)} €</td>
                  <td>{(p.current_stock * p.cost_per_unit).toFixed(2)} €</td>
                  <td>{stockBadge(p)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === 'edit' ? 'Editar producto' : 'Nuevo producto'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label>Nombre *</label>
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
