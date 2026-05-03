import { useEffect, useState } from 'react';
import { recipesApi, productsApi } from '../api';
import Modal from '../components/Modal';

const emptyRecipe = { name: '', description: '', portions: 1, sale_price: 0, category: 'General' };
const CATEGORIES = ['General', 'Entrantes', 'Primeros', 'Segundos', 'Postres', 'Bebidas', 'Infantil', 'Menú del día'];

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyRecipe);
  const [ingredients, setIngredients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [recRes, prodRes] = await Promise.all([recipesApi.list(), productsApi.list()]);
    setRecipes(recRes.data);
    setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyRecipe);
    setIngredients([{ product_id: '', quantity: '' }]);
    setModal('form');
  };

  const openEdit = (r) => {
    setForm(r);
    setIngredients(r.ingredients?.map(i => ({ product_id: String(i.product_id), quantity: i.quantity })) || [{ product_id: '', quantity: '' }]);
    setModal('form');
  };

  const openView = (r) => { setSelected(r); setModal('view'); };

  const addIngredient = () => setIngredients(p => [...p, { product_id: '', quantity: '' }]);
  const removeIngredient = (i) => setIngredients(p => p.filter((_, idx) => idx !== i));
  const updateIng = (i, k, v) => setIngredients(p => p.map((ing, idx) => idx === i ? { ...ing, [k]: v } : ing));

  const save = async () => {
    if (!form.name.trim()) return;
    const validIngs = ingredients.filter(i => i.product_id && i.quantity > 0);
    setSaving(true);
    try {
      const payload = { ...form, ingredients: validIngs.map(i => ({ product_id: parseInt(i.product_id), quantity: parseFloat(i.quantity) })) };
      if (form.id) await recipesApi.update(form.id, payload);
      else await recipesApi.create(payload);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este escandallo?')) return;
    await recipesApi.delete(id);
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const getProduct = (id) => products.find(p => p.id === parseInt(id));

  // Calculate live cost in form
  const liveCost = ingredients.reduce((sum, ing) => {
    const p = getProduct(ing.product_id);
    return sum + (p ? (parseFloat(ing.quantity) || 0) * p.cost_per_unit : 0);
  }, 0);

  const marginColor = (margin) => margin >= 65 ? 'var(--success)' : margin >= 50 ? 'var(--warning)' : 'var(--danger)';

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📋 Escandallos</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo escandallo</button>
      </div>

      <div className="card">
        {recipes.length === 0 ? (
          <div className="empty">No hay escandallos. ¡Crea el primero!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plato</th>
                  <th>Categoría</th>
                  <th>Raciones</th>
                  <th>Coste/ración</th>
                  <th>PVP</th>
                  <th>Margen</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recipes.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.category}</td>
                    <td>{r.portions}</td>
                    <td>{Number(r.cost / (r.portions || 1)).toFixed(3)} €</td>
                    <td>{Number(r.sale_price).toFixed(2)} €</td>
                    <td style={{ color: marginColor(r.margin), fontWeight: 600 }}>
                      {r.margin.toFixed(1)}%
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => openView(r)}>Ver</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View modal */}
      {modal === 'view' && selected && (
        <Modal title={`Escandallo: ${selected.name}`} onClose={() => setModal(null)}>
          <p className="text-muted text-sm mb-4">{selected.description}</p>
          <div className="cost-breakdown">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Ingredientes ({selected.portions} ración{selected.portions > 1 ? 'es' : ''})</div>
            {selected.ingredients?.map((ing, i) => (
              <div key={i} className="cost-row">
                <span>{ing.product_name} — {ing.quantity} {ing.unit}</span>
                <span>{(ing.quantity * ing.cost_per_unit).toFixed(3)} €</span>
              </div>
            ))}
            <div className="cost-row total">
              <span>Coste total</span>
              <span>{Number(selected.cost).toFixed(3)} €</span>
            </div>
            <div className="cost-row">
              <span>Coste por ración</span>
              <span>{(selected.cost / (selected.portions || 1)).toFixed(3)} €</span>
            </div>
            <div className="cost-row">
              <span>PVP</span>
              <span>{Number(selected.sale_price).toFixed(2)} €</span>
            </div>
            <div className="cost-row" style={{ color: marginColor(selected.margin), fontWeight: 600 }}>
              <span>Margen</span>
              <span>{selected.margin.toFixed(1)}%</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Form modal */}
      {modal === 'form' && (
        <Modal
          title={form.id ? 'Editar escandallo' : 'Nuevo escandallo'}
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
              <label>Precio de venta (€)</label>
              <input type="number" min="0" step="0.01" value={form.sale_price} onChange={f('sale_price')} />
            </div>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea value={form.description || ''} onChange={f('description')} rows={2} placeholder="Descripción del plato..." />
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>Ingredientes</strong>
            <button className="btn btn-secondary btn-sm" onClick={addIngredient}>+ Añadir</button>
          </div>

          {ingredients.map((ing, i) => {
            const prod = getProduct(ing.product_id);
            return (
              <div key={i} className="ingredient-row">
                <select value={ing.product_id} onChange={e => updateIng(i, 'product_id', e.target.value)}>
                  <option value="">Seleccionar ingrediente</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
                <input type="number" min="0" step="0.001" placeholder={`Cantidad (${prod?.unit || 'ud'})`}
                  value={ing.quantity} onChange={e => updateIng(i, 'quantity', e.target.value)} />
                <span className="text-muted text-sm">
                  {prod && ing.quantity ? `${((parseFloat(ing.quantity) || 0) * prod.cost_per_unit).toFixed(3)} €` : '—'}
                </span>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeIngredient(i)}>✕</button>
              </div>
            );
          })}

          <div className="cost-breakdown mt-4">
            <div className="cost-row"><span>Coste ingredientes</span><span>{liveCost.toFixed(3)} €</span></div>
            <div className="cost-row"><span>Por ración ({form.portions} rac.)</span><span>{(liveCost / (form.portions || 1)).toFixed(3)} €</span></div>
            {form.sale_price > 0 && (
              <div className="cost-row total" style={{ color: marginColor(((form.sale_price - liveCost / (form.portions || 1)) / form.sale_price) * 100) }}>
                <span>Margen estimado</span>
                <span>{(((form.sale_price - liveCost / (form.portions || 1)) / form.sale_price) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
