const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

/**
 * Middleware to verify JWT token and attach client data to request.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const client = db.prepare('SELECT id, name, email, cpf, phone, is_admin, created_at FROM clients WHERE id = ?').get(decoded.id);

    if (!client) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    req.client = client;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

/**
 * Middleware to verify admin access.
 */
function adminOnly(req, res, next) {
  if (!req.client || !req.client.is_admin) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

module.exports = { authenticate, adminOnly };
