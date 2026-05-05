const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDb } = require('./db');
const invoicesRouter = require('./routes/invoices');
const productsRouter = require('./routes/products');
const suppliersRouter = require('./routes/suppliers');
const stockRouter = require('./routes/stock');
const recipesRouter = require('./routes/recipes');
const salesRouter = require('./routes/sales');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initDb();

app.use('/api/invoices', invoicesRouter);
app.use('/api/products', productsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/stock', stockRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/sales', salesRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
