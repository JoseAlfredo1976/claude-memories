const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/stock - current stock for all products
router.get('/', (req, res) => {
  const db = getDb();
  const products = db.prepare(`
    SELECT p.*,
      CASE
        WHEN p.current_stock <= 0 THEN 'agotado'
        WHEN p.current_stock <= p.min_stock THEN 'bajo'
        WHEN p.current_stock <= p.min_stock * 1.5 THEN 'advertencia'
        ELSE 'ok'
      END as stock_status
    FROM products p
    ORDER BY stock_status, p.name
  `).all();
  res.json(products);
});

// GET /api/stock/alerts
router.get('/alerts', (req, res) => {
  const db = getDb();
  const alerts = db.prepare(`
    SELECT * FROM products
    WHERE current_stock <= min_stock
    ORDER BY current_stock ASC
  `).all();
  res.json(alerts);
});

// GET /api/stock/movements
router.get('/movements', (req, res) => {
  const db = getDb();
  const { limit = 100, product_id } = req.query;
  let query = `
    SELECT sm.*, p.name as product_name, p.unit as product_unit
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
  `;
  const params = [];
  if (product_id) {
    query += ' WHERE sm.product_id = ?';
    params.push(product_id);
  }
  query += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const movements = db.prepare(query).all(...params);
  res.json(movements);
});

// POST /api/stock/adjustment - manual stock adjustment
router.post('/adjustment', (req, res) => {
  const db = getDb();
  const { product_id, quantity, notes } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const movementType = quantity >= 0 ? 'ajuste_entrada' : 'ajuste_salida';
  const absQty = Math.abs(quantity);

  db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(quantity, product_id);
  db.prepare(`
    INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, reference_type, notes)
    VALUES (?, ?, ?, ?, 'manual', ?)
  `).run(product_id, product.name, movementType, absQty, notes || 'Ajuste manual');

  res.json({ message: 'Stock ajustado' });
});

// GET /api/stock/summary
router.get('/summary', (req, res) => {
  const db = getDb();
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_products,
      SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock,
      SUM(CASE WHEN current_stock > 0 AND current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock,
      ROUND(SUM(current_stock * cost_per_unit), 2) as total_value
    FROM products
  `).get();
  res.json(summary);
});

module.exports = router;
