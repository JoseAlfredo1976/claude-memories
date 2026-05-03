import { useEffect, useState } from 'react';
import { recipesApi, productsApi } from '../api';
import Modal from '../components/Modal';

const emptyRecipe = { name: '', description: '', portions: 1, sale_price: 0, category: 'General' };
const CATEGORIES  = ['General', 'Entrantes', 'Primeros', 'Segundos', 'Postres', 'Bebidas', 'Infantil', 'Menú del día'];

const marginClass = m => m >= 65 ? 'margin-high' : m >= 50 ? 'margin-medium' : 'margin-low';
const marginColor = m => m >= 65 ? 'var(--success)' : m >= 50 ? 'var(--warning)' : 'var(--danger)';

export default function Recipes() {
  const [recipes, setRecipes]   = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(emptyRecipe);
  const [ingredients, setIngs]  = useState([{ product_id: '', quantity: '' }]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const load = async () => {
    const [rRes, pRes] = await Promise.all([recipesApi.list(), productsApi.list()]);
    setRecipes(rRes.data); setProducts(pRes.data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyRecipe); setIngs([{ product_id: '', quantity: '' }]); setModal('form'); };
  const openEdit   = r  => { setForm(r); setIngs(r.ingredients?.map(i => ({ product_id: String(i.product_id), quantity: i.quantity })) || [{ product_id: '', quantity: '' }]); setModal('form'); };
  const openView   = r  => { setSelected(r); setModal('view'); };

  const updateIng = (i, k, v) => setIngs(p => p.map((ing, idx) => idx === i ? { ...ing, [k]: v } : ing));
  const addIng    = ()        => setIngs(p => [...p, { product_id: '', quantity: '' }]);
  const removeIng = i         => setIngs(p => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.name.trim()) return;
    const validIngs = ingredients.filter(i => i.product_id && parseFloat(i.quantity) > 0);
    setSaving(true);
    try {
      const payload = { ...form, ingredients: validIngs.map(i => ({ product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity) })) };
      if (form.id) await recipesApi.update(form.id, payload);
      else         await recipesApi.create(payload);
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const remove = async id => { if (!confirm('¿Eliminar este escandallo?')) return; await recipesApi.delete(id); load(); };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const getProduct = id => products.find(p => p.id === parseInt(id));

  const liveCost = ingredients.reduce((sum, ing) => {
    const p = getProduct(ing.product_id);
    return sum + (p ? (parseFloat(ing.quantity) || 0) * p.cost_per_unit : 0);
  }, 0);
  const liveMargin = form.sale_price > 0 ? ((form.sale_price - liveCost / (form.portions || 1)) / form.sale_price) * 100 : 0;

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando escandallos...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">📋 Escandallos</h1>
          <p className="page-desc">Costes y márgenes de cada plato</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo escandallo</button>
      </div>

      <div className="card">
        {recipes.length === 0 ? (
          <div className="empty"><div className="empty-icon">📋</div><p>No hay escandallos. Crea el primero.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Plato</th><th>Categoría</th><th>Raciones</th><th>Coste/ración</th><th>PVP</th><th>Margen</th><th></th></tr>
              </thead>
              <tbody>
                {recipes.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      {r.description && <div className="text-xs text-muted">{r.description}</div>}
                    </td>
                    <td><span className="badge badge-gray">{r.category}</span></td>
                    <td className="text-muted">{r.portions}</td>
                    <td className="font-semibold">{(r.cost / (r.portions || 1)).toFixed(3)} €</td>
                    <td className="font-bold">{Number(r.sale_price).toFixed(2)} €</td>
                    <td>
                      <span className={`margin-pill ${marginClass(r.margin)}`}>{r.margin.toFixed(1)}%</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => openView(r)}>Ver</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Editar</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(r.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View detail */}
      {modal === 'view' && selected && (
        <Modal title={selected.name} subtitle={selected.description || selected.category} onClose={() => setModal(null)}>
          <div className="cost-breakdown">
            <div className="font-semibold mb-3" style={{ fontSize: '.85rem' }}>
              Ingredientes · {selected.portions} ración{selected.portions > 1 ? 'es' : ''}
            </div>
            {selected.ingredients?.map((ing, i) => (
              <div key={i} className="cost-row">
                <span>{ing.product_name} <span className="text-muted">— {ing.quantity} {ing.unit}</span></span>
                <span className="font-semibold">{(ing.quantity * ing.cost_per_unit).toFixed(3)} €</span>
              </div>
            ))}
            <div className="cost-row total"><span>Coste total</span><span>{Number(selected.cost).toFixed(3)} €</span></div>
            <div className="cost-row"><span>Coste por ración</span><span>{(selected.cost / (selected.portions || 1)).toFixed(3)} €</span></div>
            <div className="cost-row"><span>PVP</span><span className="font-bold">{Number(selected.sale_price).toFixed(2)} €</span></div>
            <div className="cost-row" style={{ color: marginColor(selected.margin) }}>
              <span className="font-bold">Margen neto</span>
              <span className="font-bold">{selected.margin.toFixed(1)}%</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Form */}
      {modal === 'form' && (
        <Modal title={form.id ? 'Editar escandallo' : 'Nuevo escandallo'} subtitle="Define ingredientes para calcular el coste automáticamente"
          onClose={() => setModal(null)} size="lg"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando...</> : 'Guardar escandallo'}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label>Nombre del plato *</label>
              <input value={form.name} onChange={f('name')} placeholder="Ej: Paella valenciana" />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select value={form.category} onChange={f('category')}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Número de raciones</label>
              <input type="number" min="1" value={form.portions} onChange={f('portions')} />
            </div>
            <div className="form-group">
              <label>Precio de venta / PVP (€)</label>
              <input type="number" min="0" step="0.01" value={form.sale_price} onChange={f('sale_price')} />
            </div>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea value={form.description || ''} onChange={f('description')} rows={2} placeholder="Descripción breve del plato..." />
          </div>

          <div className="divider" />
          <div className="flex justify-between items-center mb-3">
            <div className="font-semibold" style={{ fontSize: '.875rem' }}>Ingredientes</div>
            <button className="btn btn-secondary btn-sm" onClick={addIng}>+ Añadir</button>
          </div>

          {ingredients.map((ing, i) => {
            const prod = getProduct(ing.product_id);
            const cost = prod && ing.quantity ? (parseFloat(ing.quantity) || 0) * prod.cost_per_unit : 0;
            return (
              <div key={i} className="ingredient-row">
                <select value={ing.product_id} onChange={e => updateIng(i, 'product_id', e.target.value)}>
                  <option value="">— Seleccionar ingrediente —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
                <input type="number" min="0" step="0.001" placeholder={`Cantidad${prod ? ` (${prod.unit})` : ''}`}
                  value={ing.quantity} onChange={e => updateIng(i, 'quantity', e.target.value)} />
                <span className="text-sm" style={{ color: cost > 0 ? 'var(--text-secondary)' : 'var(--text-faint)' }}>
                  {cost > 0 ? `${cost.toFixed(3)} €` : '—'}
                </span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeIng(i)}>✕</button>
              </div>
            );
          })}

          <div className="cost-breakdown mt-4">
            <div className="cost-row"><span>Coste total ingredientes</span><span>{liveCost.toFixed(3)} €</span></div>
            <div className="cost-row"><span>Coste por ración ({form.portions})</span><span>{(liveCost / (form.portions || 1)).toFixed(3)} €</span></div>
            {form.sale_price > 0 && (
              <div className="cost-row total" style={{ color: marginColor(liveMargin) }}>
                <span>Margen estimado</span>
                <span>{liveMargin.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
