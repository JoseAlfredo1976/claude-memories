const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/suppliers
router.get('/', (req, res) => {
  const db = getDb();
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY name').all();
  res.json(suppliers);
});

// POST /api/suppliers
router.post('/', (req, res) => {
  const db = getDb();
  const { name, cif, address, phone, email } = req.body;
  const result = db.prepare(
    'INSERT INTO suppliers (name, cif, address, phone, email) VALUES (?, ?, ?, ?, ?)'
  ).run(name, cif || null, address || null, phone || null, email || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/suppliers/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, cif, address, phone, email } = req.body;
  db.prepare(
    'UPDATE suppliers SET name = ?, cif = ?, address = ?, phone = ?, email = ? WHERE id = ?'
  ).run(name, cif, address, phone, email, req.params.id);
  res.json({ message: 'Proveedor actualizado' });
});

// DELETE /api/suppliers/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Proveedor eliminado' });
});

module.exports = router;
