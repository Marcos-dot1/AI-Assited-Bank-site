const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');
const { authenticate } = require('../middleware/auth');

// ── Validation helpers ──
function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  return true;
}

// ── POST /api/auth/register ──
router.post('/register', [
  body('name').trim().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres.'),
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.'),
  body('cpf').trim().custom((value) => {
    if (!validateCPF(value)) throw new Error('CPF inválido.');
    return true;
  }),
  body('phone').trim().isLength({ min: 10 }).withMessage('Telefone deve ter pelo menos 10 dígitos.'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, cpf, phone, password } = req.body;
  const cleanCPF = cpf.replace(/\D/g, '');

  // Checa por um e-mail ou CPF ja cadastrado no banco de dados
  const existingEmail = db.prepare('SELECT id FROM clients WHERE email = ?').get(email);
  if (existingEmail) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
  }

  const existingCPF = db.prepare('SELECT id FROM clients WHERE cpf = ?').get(cleanCPF);
  if (existingCPF) {
    return res.status(409).json({ error: 'Este CPF já está cadastrado.' });
  }

  // Utilizando do algoritmo bcrypt todas as senhas guardadas no banco de dados viram Hash.
  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO clients (name, email, cpf, phone, password) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, cleanCPF, phone.replace(/\D/g, ''), hashedPassword);

  const token = jwt.sign({ id: result.lastInsertRowid }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.status(201).json({
    message: 'Conta criada com sucesso!',
    token,
    client: {
      id: result.lastInsertRowid,
      name,
      email,
    },
  });
});

// ── POST /api/auth/login ──
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('E-mail inválido.'),
  body('password').notEmpty().withMessage('Senha é obrigatória.'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  const client = db.prepare('SELECT * FROM clients WHERE email = ?').get(email);
  if (!client) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  // Compara a senha informada no Login com a senha criptografada (Hash)
  const isMatch = bcrypt.compareSync(password, client.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = jwt.sign({ id: client.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

  res.json({
    message: 'Login realizado com sucesso!',
    token,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      is_admin: client.is_admin,
    },
  });
});

// ── GET /api/auth/me ── (se estiver logado mostra seus dados)
router.get('/me', authenticate, (req, res) => {
  res.json({ client: req.client });
});

module.exports = router;
