import { useEffect, useState } from 'react';
import { invoicesApi, suppliersApi, productsApi } from '../api';
import Modal from '../components/Modal';
import CameraCapture from '../components/CameraCapture';

const today = new Date().toISOString().split('T')[0];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null); // null | 'new' | 'view'
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New invoice form
  const [capturedFile, setCapturedFile] = useState(null);
  const [ocrDone, setOcrDone] = useState(false);
  const [form, setForm] = useState({
    invoice_number: '', supplier_id: '', supplier_name: '', invoice_date: today,
    subtotal: 0, tax_amount: 0, total_amount: 0, image_path: '', notes: '', status: 'registrada'
  });
  const [items, setItems] = useState([]);

  const load = async () => {
    const [invRes, supRes, prodRes] = await Promise.all([
      invoicesApi.list(), suppliersApi.list(), productsApi.list()
    ]);
    setInvoices(invRes.data);
    setSuppliers(supRes.data);
    setProducts(prodRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setCapturedFile(null);
    setOcrDone(false);
    setError('');
    setForm({ invoice_number: '', supplier_id: '', supplier_name: '', invoice_date: today, subtotal: 0, tax_amount: 0, total_amount: 0, image_path: '', notes: '', status: 'registrada' });
    setItems([]);
    setModal('new');
  };

  const handleCapture = (file) => {
    setCapturedFile(file);
    setOcrDone(false);
  };

  const analyzeWithAI = async () => {
    if (!capturedFile) return;
    setAnalyzing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', capturedFile);
      const res = await invoicesApi.ocr(fd);
      const data = res.data;

      // Find or suggest supplier
      const supplierMatch = suppliers.find(s =>
        s.name?.toLowerCase().includes((data.supplier_name || '').toLowerCase()) ||
        (data.supplier_name || '').toLowerCase().includes(s.name?.toLowerCase())
      );

      setForm(prev => ({
        ...prev,
        invoice_number: data.invoice_number || '',
        supplier_id: supplierMatch?.id || '',
        supplier_name: data.supplier_name || '',
        invoice_date: data.invoice_date || today,
        subtotal: data.subtotal || 0,
        tax_amount: data.tax_amount || 0,
        total_amount: data.total || 0,
        image_path: data.image_path || '',
        notes: data.notes || ''
      }));

      setItems((data.items || []).map(item => ({
        description: item.description || '',
        quantity: item.quantity || 0,
        unit: item.unit || 'ud',
        unit_price: item.unit_price || 0,
        total_price: item.total_price || 0,
        product_id: ''
      })));

      setOcrDone(true);
    } catch (err) {
      setError('Error al analizar la imagen. Rellena los datos manualmente.');
    } finally {
      setAnalyzing(false);
    }
  };

  const addItem = () => setItems(p => [...p, { description: '', quantity: 1, unit: 'ud', unit_price: 0, total_price: 0, product_id: '' }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, k, v) => {
    setItems(p => p.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [k]: v };
      if (k === 'quantity' || k === 'unit_price') {
        updated.total_price = (parseFloat(k === 'quantity' ? v : item.quantity) || 0) *
          (parseFloat(k === 'unit_price' ? v : item.unit_price) || 0);
      }
      if (k === 'product_id' && v) {
        const prod = products.find(p => p.id === parseInt(v));
        if (prod) updated.unit = prod.unit;
      }
      return updated;
    }));
  };

  const recalcTotals = () => {
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.total_price) || 0), 0);
    setForm(p => ({ ...p, subtotal: subtotal.toFixed(2) }));
  };

  const save = async () => {
    if (!form.invoice_date) return;
    setSaving(true);
    try {
      await invoicesApi.create({
        ...form,
        supplier_id: form.supplier_id || null,
        items: items.map(i => ({
          ...i,
          product_id: i.product_id ? parseInt(i.product_id) : null,
          quantity: parseFloat(i.quantity) || 0,
          unit_price: parseFloat(i.unit_price) || 0,
          total_price: parseFloat(i.total_price) || 0
        }))
      });
      setModal(null);
      load();
    } catch (err) {
      setError('Error al guardar la factura');
    } finally { setSaving(false); }
  };

  const openView = async (id) => {
    const res = await invoicesApi.get(id);
    setSelected(res.data);
    setModal('view');
  };

  const deleteInvoice = async (id) => {
    if (!confirm('¿Eliminar esta factura?')) return;
    await invoicesApi.delete(id);
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const statusBadge = (s) => {
    const map = { registrada: 'badge-primary', procesada: 'badge-success', pagada: 'badge-success', pendiente: 'badge-warning' };
    return <span className={`badge ${map[s] || 'badge-gray'}`}>{s}</span>;
  };

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🧾 Facturas</h1>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva factura</button>
      </div>

      <div className="card">
        {invoices.length === 0 ? (
          <div className="empty">No hay facturas. ¡Registra la primera!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº Factura</th>
                  <th>Proveedor</th>
                  <th>Fecha</th>
                  <th>Base imp.</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number || `#${inv.id}`}</td>
                    <td>{inv.supplier_name || inv.supplier_name_ref || '—'}</td>
                    <td>{inv.invoice_date || '—'}</td>
                    <td>{Number(inv.subtotal || 0).toFixed(2)} €</td>
                    <td>{Number(inv.tax_amount || 0).toFixed(2)} €</td>
                    <td><strong>{Number(inv.total_amount || 0).toFixed(2)} €</strong></td>
                    <td>{statusBadge(inv.status)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => openView(inv.id)}>Ver</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteInvoice(inv.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View invoice modal */}
      {modal === 'view' && selected && (
        <Modal title={`Factura ${selected.invoice_number || '#' + selected.id}`} onClose={() => setModal(null)}>
          <div className="form-row mb-4">
            <div>
              <div className="text-muted text-sm">Proveedor</div>
              <strong>{selected.supplier_name || '—'}</strong>
              {selected.supplier_cif && <div className="text-muted text-sm">CIF: {selected.supplier_cif}</div>}
            </div>
            <div>
              <div className="text-muted text-sm">Fecha</div>
              <strong>{selected.invoice_date || '—'}</strong>
            </div>
          </div>
          {selected.image_path && (
            <img src={selected.image_path} alt="Factura" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, marginBottom: 16, background: '#f1f5f9' }} />
          )}
          <div className="table-wrap mb-4">
            <table>
              <thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>Precio/ud.</th><th>Total</th></tr></thead>
              <tbody>
                {(selected.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.description || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td>{Number(item.unit_price).toFixed(3)} €</td>
                    <td>{Number(item.total_price).toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="cost-breakdown">
            <div className="cost-row"><span>Base imponible</span><span>{Number(selected.subtotal || 0).toFixed(2)} €</span></div>
            <div className="cost-row"><span>IVA</span><span>{Number(selected.tax_amount || 0).toFixed(2)} €</span></div>
            <div className="cost-row total"><span>Total</span><span>{Number(selected.total_amount || 0).toFixed(2)} €</span></div>
          </div>
          {selected.notes && <p className="text-muted text-sm mt-4">Notas: {selected.notes}</p>}
        </Modal>
      )}

      {/* New invoice modal */}
      {modal === 'new' && (
        <Modal
          title="Nueva factura"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar factura'}
              </button>
            </>
          }
        >
          {error && <div className="alert alert-danger">{error}</div>}

          {/* Step 1: Camera */}
          <div style={{ marginBottom: 20 }}>
            <strong style={{ display: 'block', marginBottom: 8 }}>1. Fotografía de la factura</strong>
            <CameraCapture onCapture={handleCapture} />
            {capturedFile && !ocrDone && (
              <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={analyzeWithAI} disabled={analyzing}>
                {analyzing ? <><span className="spinner" style={{ marginRight: 8 }}></span>Analizando con IA...</> : '🤖 Analizar con IA'}
              </button>
            )}
            {ocrDone && (
              <div className="ocr-result">
                ✅ Datos extraídos automáticamente. Revisa y corrige si es necesario.
              </div>
            )}
          </div>

          <div className="divider" />

          {/* Step 2: Invoice data */}
          <strong style={{ display: 'block', marginBottom: 12 }}>2. Datos de la factura</strong>
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
                <option value="">— Seleccionar proveedor —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Nombre proveedor (manual)</label>
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
            <input value={form.notes || ''} onChange={f('notes')} placeholder="Observaciones..." />
          </div>

          <div className="divider" />

          {/* Step 3: Items */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>3. Líneas de factura</strong>
            <div className="flex gap-2">
              <button className="btn btn-secondary btn-sm" onClick={recalcTotals}>Recalcular totales</button>
              <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Añadir línea</button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-muted text-sm">No hay líneas. Usa la IA o añade manualmente.</p>
          ) : items.map((item, i) => (
            <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Descripción</label>
                  <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Nombre del producto" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Vincular a producto</label>
                  <select value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                    <option value="">— Sin vincular —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 1fr 32px', gap: 8, alignItems: 'end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Cantidad</label>
                  <input type="number" min="0" step="0.001" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Unidad</label>
                  <input value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Precio/ud. (€)</label>
                  <input type="number" min="0" step="0.001" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Total (€)</label>
                  <input type="number" min="0" step="0.01" value={item.total_price} onChange={e => updateItem(i, 'total_price', e.target.value)} />
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)} style={{ marginBottom: 1 }}>✕</button>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
