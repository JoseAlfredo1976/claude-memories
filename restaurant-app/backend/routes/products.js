const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/products
router.get('/', (req, res) => {
  const db = getDb();
  const products = db.prepare('SELECT * FROM products ORDER BY category, name').all();
  res.json(products);
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

// POST /api/products
router.post('/', (req, res) => {
  const db = getDb();
  const { name, unit, category, min_stock, current_stock, cost_per_unit } = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, unit, category, min_stock, current_stock, cost_per_unit)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, unit || 'ud', category || 'General', min_stock || 0, current_stock || 0, cost_per_unit || 0);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, unit, category, min_stock, cost_per_unit } = req.body;
  db.prepare(`
    UPDATE products SET name = ?, unit = ?, category = ?, min_stock = ?, cost_per_unit = ?
    WHERE id = ?
  `).run(name, unit, category, min_stock, cost_per_unit, req.params.id);
  res.json({ message: 'Producto actualizado' });
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ message: 'Producto eliminado' });
});

module.exports = router;
