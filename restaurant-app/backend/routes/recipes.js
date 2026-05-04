const express = require('express');
const router = express.Router();
const { getDb, transaction } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();
  const recipes = db.prepare('SELECT * FROM recipes ORDER BY category, name').all();

  const result = recipes.map(recipe => {
    const ingredients = db.prepare(`
      SELECT ri.*, p.name as product_name, p.unit, p.cost_per_unit
      FROM recipe_ingredients ri
      JOIN products p ON ri.product_id = p.id
      WHERE ri.recipe_id = ?
    `).all(recipe.id);

    const cost = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
    const margin = recipe.sale_price > 0 ? ((recipe.sale_price - cost) / recipe.sale_price) * 100 : 0;
    return { ...recipe, ingredients, cost: Math.round(cost * 100) / 100, margin: Math.round(margin * 10) / 10 };
  });

  res.json(result);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Receta no encontrada' });

  const ingredients = db.prepare(`
    SELECT ri.*, p.name as product_name, p.unit, p.cost_per_unit, p.current_stock
    FROM recipe_ingredients ri
    JOIN products p ON ri.product_id = p.id
    WHERE ri.recipe_id = ?
  `).all(req.params.id);

  const cost = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
  const margin = recipe.sale_price > 0 ? ((recipe.sale_price - cost) / recipe.sale_price) * 100 : 0;
  res.json({ ...recipe, ingredients, cost: Math.round(cost * 100) / 100, margin: Math.round(margin * 10) / 10 });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, portions, sale_price, category, ingredients } = req.body;

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (name, description, portions, sale_price, category)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertIng = db.prepare('INSERT INTO recipe_ingredients (recipe_id, product_id, quantity) VALUES (?, ?, ?)');

  try {
    const id = transaction(() => {
      const result = insertRecipe.run(name, description || null, portions || 1, sale_price || 0, category || 'General');
      const recipeId = result.lastInsertRowid;
      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) insertIng.run(recipeId, ing.product_id, ing.quantity);
      }
      return recipeId;
    });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description, portions, sale_price, category, ingredients } = req.body;

  const updateRecipe = db.prepare(`
    UPDATE recipes SET name = ?, description = ?, portions = ?, sale_price = ?, category = ? WHERE id = ?
  `);
  const deleteIngs = db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?');
  const insertIng  = db.prepare('INSERT INTO recipe_ingredients (recipe_id, product_id, quantity) VALUES (?, ?, ?)');

  try {
    transaction(() => {
      updateRecipe.run(name, description, portions, sale_price, category, req.params.id);
      deleteIngs.run(req.params.id);
      if (ingredients && ingredients.length > 0) {
        for (const ing of ingredients) insertIng.run(req.params.id, ing.product_id, ing.quantity);
      }
    });
    res.json({ message: 'Receta actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Receta eliminada' });
});

module.exports = router;
