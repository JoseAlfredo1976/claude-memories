import { useEffect, useState } from 'react';
import { suppliersApi } from '../api';
import Modal from '../components/Modal';

const empty = { name: '', cif: '', address: '', phone: '', email: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(empty);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const load = () => suppliersApi.list().then(r => { setSuppliers(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (form.id) await suppliersApi.update(form.id, form);
      else         await suppliersApi.create(form);
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const remove = async id => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await suppliersApi.delete(id); load();
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  if (loading) return <div className="page"><div className="loading"><div className="spinner spinner-dark" /><p>Cargando proveedores...</p></div></div>;

  return (
    <div className="page">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">🚚 Proveedores</h1>
          <p className="page-desc">{suppliers.length} proveedores registrados</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(empty); setModal('form'); }}>+ Nuevo proveedor</button>
      </div>

      <div className="card">
        {suppliers.length === 0 ? (
          <div className="empty"><div className="empty-icon">🚚</div><p>No hay proveedores. Añade el primero.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Proveedor</th><th>CIF / NIF</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th></th></tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-semibold">{s.name}</div>
                    </td>
                    <td className="text-muted">{s.cif || '—'}</td>
                    <td>{s.phone ? <a href={`tel:${s.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.phone}</a> : '—'}</td>
                    <td>{s.email ? <a href={`mailto:${s.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{s.email}</a> : '—'}</td>
                    <td className="text-sm text-muted">{s.address || '—'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setForm(s); setModal('form'); }}>Editar</button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(s.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === 'form' && (
        <Modal title={form.id ? 'Editar proveedor' : 'Nuevo proveedor'} subtitle="Datos de contacto del proveedor"
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" /> Guardando...</> : 'Guardar proveedor'}
            </button>
          </>}
        >
          <div className="form-group">
            <label>Nombre del proveedor *</label>
            <input value={form.name} onChange={f('name')} placeholder="Ej: Pescados García S.L." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>CIF / NIF</label>
              <input value={form.cif || ''} onChange={f('cif')} placeholder="B12345678" />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input value={form.phone || ''} onChange={f('phone')} placeholder="612 345 678" />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email || ''} onChange={f('email')} type="email" placeholder="contacto@proveedor.com" />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input value={form.address || ''} onChange={f('address')} placeholder="Calle, número, ciudad" />
          </div>
        </Modal>
      )}
    </div>
  );
}
