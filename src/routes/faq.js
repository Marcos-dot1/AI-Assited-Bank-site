const express = require('express');
const router = express.Router();
const { db } = require('../database/init');

// ── GET /api/faq ── (Mostra as perguntas frequentes)
router.get('/', (req, res) => {
  const faqs = db.prepare('SELECT * FROM faq ORDER BY order_num ASC').all();
  res.json({ faqs });
});

// ── GET /api/faq/search?q= ── (Busca perguntas frequentes)
router.get('/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Busca deve ter pelo menos 2 caracteres.' });
  }

  const searchTerm = `%${q.trim()}%`;
  const faqs = db.prepare(
    'SELECT * FROM faq WHERE question LIKE ? OR answer LIKE ? ORDER BY order_num ASC'
  ).all(searchTerm, searchTerm);

  res.json({ faqs });
});

module.exports = router;
