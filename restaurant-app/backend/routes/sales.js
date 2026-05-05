const express = require('express');
const router = express.Router();
const { getDb, transaction } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  let query = 'SELECT * FROM sales';
  const params = [];
  if (from && to) { query += ' WHERE sale_date BETWEEN ? AND ?'; params.push(from, to); }
  query += ' ORDER BY sale_date DESC, created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/report/summary', (req, res) => {
  const db = getDb();
  const { from, to } = req.query;
  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const toDate   = to   || new Date().toISOString().split('T')[0];

  const summary = db.prepare(`
    SELECT COUNT(*) as total_sales, ROUND(SUM(total_amount),2) as total_revenue,
           ROUND(AVG(total_amount),2) as avg_ticket, COUNT(DISTINCT sale_date) as days_with_sales
    FROM sales WHERE sale_date BETWEEN ? AND ?
  `).get(fromDate, toDate);

  const topDishes = db.prepare(`
    SELECT recipe_name, SUM(quantity) as units_sold, ROUND(SUM(total_price),2) as revenue
    FROM sale_items si JOIN sales s ON si.sale_id = s.id
    WHERE s.sale_date BETWEEN ? AND ?
    GROUP BY recipe_name ORDER BY units_sold DESC LIMIT 10
  `).all(fromDate, toDate);

  res.json({ summary, topDishes, from: fromDate, to: toDate });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  res.json({ ...sale, items });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { sale_date, notes, items } = req.body;

  const insertSale    = db.prepare('INSERT INTO sales (sale_date, total_amount, notes) VALUES (?, ?, ?)');
  const insertItem    = db.prepare(`INSERT INTO sale_items (sale_id, recipe_id, recipe_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)`);
  const getIngredients= db.prepare(`SELECT ri.product_id, ri.quantity, p.name as product_name FROM recipe_ingredients ri JOIN products p ON ri.product_id = p.id WHERE ri.recipe_id = ?`);
  const updateStock   = db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ? AND current_stock >= ?');
  const insertMovement= db.prepare(`INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, reference_type, reference_id, notes) VALUES (?, ?, 'salida', ?, 'sale', ?, ?)`);

  try {
    const id = transaction(() => {
      const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      const saleResult  = insertSale.run(sale_date, totalAmount, notes || null);
      const saleId      = saleResult.lastInsertRowid;

      for (const item of items) {
        insertItem.run(saleId, item.recipe_id || null, item.recipe_name, item.quantity, item.unit_price, item.unit_price * item.quantity);

        if (item.recipe_id) {
          const ingredients = getIngredients.all(item.recipe_id);
          for (const ing of ingredients) {
            const consumed = ing.quantity * item.quantity;
            updateStock.run(consumed, ing.product_id, consumed);
            insertMovement.run(ing.product_id, ing.product_name, consumed, saleId, `Venta: ${item.recipe_name} x${item.quantity}`);
          }
        }
      }
      return saleId;
    });

    res.status(201).json({ id, message: 'Venta registrada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
