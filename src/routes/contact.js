const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');

// ── POST /api/contact ── (envia mensagens do formulario)
router.post('/', [
  body('name').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.'),
  body('subject').trim().isLength({ min: 3 }).withMessage('Assunto deve ter pelo menos 3 caracteres.'),
  body('message').trim().isLength({ min: 10 }).withMessage('Mensagem deve ter pelo menos 10 caracteres.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, subject, message } = req.body;

  db.prepare(
    'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)'
  ).run(name, email, subject, message);

  res.status(201).json({ message: 'Mensagem enviada com sucesso! Retornaremos em breve.' });
});

// ── GET /api/contact/my ── (Retorna mensagens enviadas pelo cliente logado e respostas do banco)
const { authenticate } = require('../middleware/auth');
router.get('/my', authenticate, (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts WHERE email = ? ORDER BY created_at DESC').all(req.client.email);
  res.json({ contacts });
});

module.exports = router;

