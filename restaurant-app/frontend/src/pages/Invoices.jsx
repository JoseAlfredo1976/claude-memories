import { useEffect, useState } from 'react';
import { invoicesApi, suppliersApi, productsApi } from '../api';
import Modal from '../components/Modal';
import CameraCapture from '../components/CameraCapture';

const today = new Date().toISOString().split('T')[0];

export default function Invoices() {
  const [invoices, setInvoices]   = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [modal, setModal]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const [capturedFile, setCaptured] = useState(null);
  const [ocrDone, setOcrDone]       = useState(false);
  const [form, setForm] = useState({ invoice_number: '', supplier_id: '', supplier_name: '', invoice_date: today, subtotal: 0, tax_amount: 0, total_amount: 0, image_path: '', notes: '', status: 'registrada' });
  const [items, setItems] = useState([]);

  const load = async () => {
    const [iRes, sRes, pRes] = await Promise.all([invoicesApi.list(), suppliersApi.list(), productsApi.list()]);
    setInvoices(iRes.data); setSuppliers(sRes.data); setProducts(pRes.data); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setCaptured(null); setOcrDone(false); setError('');
    setForm({ invoice_number: '', supplier_id: '', supplier_name: '', invoice_date: today, subtotal: 0, tax_amount: 0, total_amount: 0, image_path: '', notes: '', status: 'registrada' });
    setItems([]); setModal('new');
  };

  const analyzeWithAI = async () => {
    if (!capturedFile) return;
    setAnalyzing(true); setError('');
    try {
      const fd = new FormData(); fd.append('image', capturedFile);
      const res = await invoicesApi.ocr(fd);
      const d = res.data;
      const match = suppliers.find(s => s.name?.toLowerCase().includes((d.supplier_name || '').toLowerCase()) || (d.supplier_name || '').toLowerCase().includes(s.name?.toLowerCase()));
      setForm(p => ({ ...p, invoice_number: d.invoice_number || '', supplier_id: match?.id || '', supplier_name: d.supplier_name || '', invoice_date: d.invoice_date || today, subtotal: d.subtotal || 0, tax_amount: d.tax_amount || 0, total_amount: d.total || 0, image_path: d.image_path || '', notes: d.notes || '' }));
      setItems((d.items || []).map(i => ({ description: i.description || '', quantity: i.quantity || 0, unit: i.unit || 'ud', unit_price: i.unit_price || 0, total_price: i.total_price || 0, product_id: '' })));
      setOcrDone(true);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error desconocido';
      setError(`Error al analizar: ${msg}`);
    }
    finally { setAnalyzing(false); }
  };

  const updateItem = (i, k, v) => setItems(p => p.map((item, idx) => {
    if (idx !== i) return item;
    const u = { ...item, [k]: v };
    if (k === 'quantity' || k === 'unit_price') u.total_price = ((k === 'quantity' ? parseFloat(v) : parseFloat(item.quantity)) || 0) * ((k === 'unit_price' ? parseFloat(v) : parseFloat(item.unit_price)) || 0);
    if (k === 'product_id' && v) { const prod = products.find(p => p.id === parseInt(v)); if (prod) u.unit = prod.unit; }
    return u;
  }));

  const save = async () => {
    setSaving(true);
    try {
      await invoicesApi.create({ ...form, supplier_id: form.supplier_id || null, items: items.map(i => ({ ...i, product_id: i.product_id ? parseInt(i.product_id) : null, quantity: parseFloat(i.quantity) || 0, unit_price: parseFloat(i.unit_price) || 0, total_price: parseFloat(i.total_price) || 0 })) });
      setModal(null); load();
    } catch { setError('Error al guardar la factura'); }
    finally { setSaving(false); }
  };

  const openView = async id => { const r = await invoicesApi.get(id); setSelected(r.data); setModal('view'); };
  const deleteInv = async id => { if (!confirm('¿Eliminar esta factura?')) return; await invoicesApi.delete(id); load(); };
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const statusBadge = s => {
    const m = { registrada: 'badge-primary', procesada: 'badge-success', pagada: 'badge-success', pendiente: 'badge-warning' };
    return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
  };

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando facturas...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">🧾 Facturas</h1>
          <p className="page-desc">{invoices.length} facturas registradas</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={openNew}>+ Nueva factura</button>
      </div>

      <div className="card">
        {invoices.length === 0 ? (
          <div className="empty"><div className="empty-icon">🧾</div><p>No hay facturas. Registra la primera haciendo una foto.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nº Factura</th><th>Proveedor</th><th>Fecha</th><th>Base imp.</th><th>IVA</th><th>Total</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-semibold text-sm">{inv.invoice_number || `#${inv.id}`}</td>
                    <td className="font-semibold">{inv.supplier_name || inv.supplier_name_ref || '—'}</td>
                    <td className="text-muted text-sm">{inv.invoice_date || '—'}</td>
                    <td>{Number(inv.subtotal || 0).toFixed(2)} €</td>
                    <td className="text-muted">{Number(inv.tax_amount || 0).toFixed(2)} €</td>
                    <td><span className="font-bold" style={{ fontSize: '1rem' }}>{Number(inv.total_amount || 0).toFixed(2)} €</span></td>
                    <td>{statusBadge(inv.status)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => openView(inv.id)}>Ver</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteInv(inv.id)}>🗑</button>
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
        <Modal title={`Factura ${selected.invoice_number || '#' + selected.id}`} subtitle={`Proveedor: ${selected.supplier_name || '—'}`} onClose={() => setModal(null)} size="lg">
          {selected.image_path && (
            <img src={selected.image_path} alt="Factura original" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, marginBottom: 20, background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
          )}
          <div className="form-row mb-4">
            <div><div className="text-xs text-muted mb-1">Proveedor</div><div className="font-semibold">{selected.supplier_name || '—'}</div>{selected.supplier_cif && <div className="text-xs text-muted">CIF: {selected.supplier_cif}</div>}</div>
            <div><div className="text-xs text-muted mb-1">Fecha</div><div className="font-semibold">{selected.invoice_date || '—'}</div></div>
          </div>
          <div className="table-wrap mb-4">
            <table>
              <thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Precio/ud.</th><th>Total</th></tr></thead>
              <tbody>
                {(selected.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.description || '—'}</td>
                    <td>{item.quantity}</td>
                    <td><span className="badge badge-gray">{item.unit}</span></td>
                    <td>{Number(item.unit_price).toFixed(3)} €</td>
                    <td className="font-semibold">{Number(item.total_price).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cost-breakdown">
            <div className="cost-row"><span>Base imponible</span><span>{Number(selected.subtotal || 0).toFixed(2)} €</span></div>
            <div className="cost-row"><span>IVA</span><span>{Number(selected.tax_amount || 0).toFixed(2)} €</span></div>
            <div className="cost-row total"><span>Total factura</span><span>{Number(selected.total_amount || 0).toFixed(2)} €</span></div>
          </div>
          {selected.notes && <p className="text-sm text-muted mt-4">Notas: {selected.notes}</p>}
        </Modal>
      )}

      {/* New invoice modal */}
      {modal === 'new' && (
        <Modal title="Nueva factura" subtitle="Fotografia la factura o rellena los datos manualmente"
          onClose={() => setModal(null)} size="lg"
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando...</> : '✓ Registrar factura'}
            </button>
          </>}
        >
          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          {/* Step 1 */}
          <div className="section-label">Paso 1 — Fotografía de la factura</div>
          <CameraCapture onCapture={f => { setCaptured(f); setOcrDone(false); }} />
          {capturedFile && !ocrDone && (
            <button className="btn btn-primary w-full mt-3" style={{ justifyContent: 'center' }} onClick={analyzeWithAI} disabled={analyzing}>
              {analyzing ? <><span className="spinner" /> Analizando con IA... (puede tardar unos segundos)</> : '🤖 Analizar con IA — Claude extraerá los datos automáticamente'}
            </button>
          )}
          {ocrDone && <div className="ocr-result">✅ Datos extraídos. Revisa y corrige si es necesario antes de guardar.</div>}

          <div className="divider" />

          {/* Step 2 */}
          <div className="section-label">Paso 2 — Datos de la factura</div>
          <div className="form-row">
            <div className="form-group">
              <label>Número de factura</label>
              <input value={form.invoice_number} onChange={f('invoice_number')} placeholder="F-2024-001" />
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" value={form.invoice_date} onChange={f('invoice_date')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Proveedor (de la lista)</label>
              <select value={form.supplier_id} onChange={f('supplier_id')}>
                <option value="">— Sin vincular —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nombre proveedor (libre)</label>
              <input value={form.supplier_name} onChange={f('supplier_name')} placeholder="Si no está en la lista" />
            </div>
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Base imponible (€)</label>
              <input type="number" step="0.01" value={form.subtotal} onChange={f('subtotal')} />
            </div>
            <div className="form-group">
              <label>IVA (€)</label>
              <input type="number" step="0.01" value={form.tax_amount} onChange={f('tax_amount')} />
            </div>
            <div className="form-group">
              <label>Total (€)</label>
              <input type="number" step="0.01" value={form.total_amount} onChange={f('total_amount')} />
            </div>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <input value={form.notes || ''} onChange={f('notes')} placeholder="Observaciones adicionales..." />
          </div>

          <div className="divider" />

          {/* Step 3 */}
          <div className="flex justify-between items-center mb-3">
            <div className="section-label" style={{ margin: 0 }}>Paso 3 — Líneas de factura</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setItems(p => [...p, { description: '', quantity: 1, unit: 'ud', unit_price: 0, total_price: 0, product_id: '' }])}>
              + Añadir línea
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-muted">No hay líneas. La IA las rellenará automáticamente, o añádelas manualmente.</p>
          ) : items.map((item, i) => (
            <div key={i} className="invoice-item-card">
              <div className="form-row mb-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Descripción</label>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Nombre del producto en factura" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Vincular a producto del inventario</label>
                  <select value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    <option value="">— Sin vincular (no actualiza stock) —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr 1fr 32px', gap: 8, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Cantidad</label>
                  <input type="number" min="0" step="0.001" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Ud.</label>
                  <input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Precio/ud. (€)</label>
                  <input type="number" min="0" step="0.001" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Total línea (€)</label>
                  <input type="number" min="0" step="0.01" value={item.total_price} onChange={e => updateItem(i, 'total_price', e.target.value)} />
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ marginBottom: 1 }}>✕</button>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
