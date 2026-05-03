import { useEffect, useState } from 'react';
import { suppliersApi } from '../api';
import Modal from '../components/Modal';

const empty = { name: '', cif: '', address: '', phone: '', email: '' };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => suppliersApi.list().then(r => { setSuppliers(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(empty); setModal('create'); };
  const openEdit = (s) => { setForm(s); setModal('edit'); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal === 'edit') await suppliersApi.update(form.id, form);
      else await suppliersApi.create(form);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await suppliersApi.delete(id);
    load();
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  if (loading) return <div className="page"><div className="loading">Cargando...</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">🚚 Proveedores</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo proveedor</button>
      </div>

      <div className="card">
        {suppliers.length === 0 ? (
          <div className="empty">No hay proveedores registrados. ¡Añade el primero!</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CIF/NIF</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Dirección</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.cif || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.address || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal
          title={modal === 'edit' ? 'Editar proveedor' : 'Nuevo proveedor'}
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
            <input value={form.name} onChange={f('name')} placeholder="Nombre del proveedor" />
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
