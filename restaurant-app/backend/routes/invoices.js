const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, transaction } = require('../db');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    cb(null, `invoice_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/invoices
router.get('/', (req, res) => {
  const db = getDb();
  const invoices = db.prepare(`
    SELECT i.*, s.name as supplier_name_ref
    FROM invoices i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(invoices);
});

// GET /api/invoices/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const invoice = db.prepare(`
    SELECT i.*, s.name as supplier_name_ref, s.cif as supplier_cif
    FROM invoices i
    LEFT JOIN suppliers s ON i.supplier_id = s.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

  const items = db.prepare(`
    SELECT ii.*, p.name as product_name, p.unit as product_unit
    FROM invoice_items ii
    LEFT JOIN products p ON ii.product_id = p.id
    WHERE ii.invoice_id = ?
  `).all(req.params.id);

  res.json({ ...invoice, items });
});

// POST /api/invoices/ocr
router.post('/ocr', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const isPdf = mimeType === 'application/pdf';
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Image } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } };

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `Eres un experto en análisis de facturas de proveedores para restaurantes españoles.
Extrae los datos de la factura y devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "supplier_name": "nombre del proveedor",
  "supplier_cif": "CIF o NIF si es visible, si no null",
  "invoice_number": "número de factura o null",
  "invoice_date": "fecha en formato YYYY-MM-DD o null",
  "items": [
    {
      "description": "descripción del artículo",
      "quantity": número,
      "unit": "kg/L/ud/caja/etc",
      "unit_price": número,
      "total_price": número
    }
  ],
  "subtotal": número,
  "tax_rate": número,
  "tax_amount": número,
  "total": número,
  "notes": "observaciones o null"
}
Devuelve SOLO el JSON sin ningún texto adicional.`,
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Analiza esta factura y extrae todos sus datos.' }
          ]
        }
      ]
    });

    const text = message.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    const data = JSON.parse(text);
    res.json({ ...data, image_path: `/uploads/${req.file.filename}` });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'Error al analizar la imagen: ' + err.message });
  }
});

// POST /api/invoices
router.post('/', (req, res) => {
  const db = getDb();
  const { invoice_number, supplier_id, supplier_name, invoice_date, subtotal, tax_amount, total_amount, image_path, notes, status, items } = req.body;

  const insertInvoice = db.prepare(`
    INSERT INTO invoices (invoice_number, supplier_id, supplier_name, invoice_date, subtotal, tax_amount, total_amount, image_path, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const updateStock = db.prepare('UPDATE products SET current_stock = current_stock + ?, cost_per_unit = ? WHERE id = ?');
  const insertMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, product_name, movement_type, quantity, reference_type, reference_id, notes)
    VALUES (?, ?, 'entrada', ?, 'invoice', ?, ?)
  `);

  try {
    const id = transaction(() => {
      const invoiceResult = insertInvoice.run(
        invoice_number, supplier_id || null, supplier_name || '', invoice_date,
        subtotal || 0, tax_amount || 0, total_amount || 0, image_path || null, notes || null,
        status || 'registrada'
      );
      const invoiceId = invoiceResult.lastInsertRowid;

      if (items && items.length > 0) {
        for (const item of items) {
          insertItem.run(invoiceId, item.product_id || null, item.description, item.quantity, item.unit, item.unit_price, item.total_price);

          if (item.product_id && item.quantity > 0) {
            const product = getProduct.get(item.product_id);
            if (product) {
              const totalStock = product.current_stock + item.quantity;
              const newCost = totalStock > 0
                ? (product.current_stock * product.cost_per_unit + item.quantity * item.unit_price) / totalStock
                : item.unit_price;
              updateStock.run(item.quantity, newCost, item.product_id);
              insertMovement.run(item.product_id, product.name, item.quantity, invoiceId, `Factura ${invoice_number || invoiceId}`);
            }
          }
        }
      }
      return invoiceId;
    });

    res.status(201).json({ id, message: 'Factura registrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Estado actualizado' });
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Factura eliminada' });
});

module.exports = router;
