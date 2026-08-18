const express = require('express');
const router = express.Router();
const { db } = require('../database/init');
const { authenticate, adminOnly } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, adminOnly);

// ── GET /api/admin/clients ──
router.get('/clients', (req, res) => {
  const clients = db.prepare(`
    SELECT id, name, email, cpf, phone, is_admin, created_at 
    FROM clients 
    ORDER BY created_at DESC
  `).all();

  res.json({ clients });
});

// ── GET /api/admin/loans ──
router.get('/loans', (req, res) => {
  const loans = db.prepare(`
    SELECT loans.*, clients.name as client_name, clients.email as client_email
    FROM loans
    JOIN clients ON loans.client_id = clients.id
    ORDER BY loans.created_at DESC
  `).all();

  res.json({ loans });
});

// ── PATCH /api/admin/loans/:id ──
router.patch('/loans/:id', (req, res) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;

  if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
    return res.status(400).json({ error: 'Status deve ser: aprovado, rejeitado ou pendente.' });
  }

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!loan) {
    return res.status(404).json({ error: 'Empréstimo não encontrado.' });
  }

  const note = admin_note !== undefined ? admin_note : (loan.admin_note || '');
  db.prepare('UPDATE loans SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, note, id);

  res.json({ message: `Empréstimo #${id} ${status} com sucesso!` });
});

// ── GET /api/admin/contacts ──
router.get('/contacts', (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  res.json({ contacts });
});

// ── POST /api/admin/contacts/:id/reply ──
router.post('/contacts/:id/reply', (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply || reply.trim().length < 2) {
    return res.status(400).json({ error: 'A resposta deve ter pelo menos 2 caracteres.' });
  }

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) {
    return res.status(404).json({ error: 'Mensagem não encontrada.' });
  }

  const adminName = req.client ? req.client.name : 'Equipe NovaBanco';
  db.prepare('UPDATE contacts SET reply = ?, reply_by = ?, replied_at = CURRENT_TIMESTAMP, is_read = 1 WHERE id = ?').run(
    reply.trim(),
    adminName,
    id
  );

  res.json({ message: 'Resposta enviada e registrada com sucesso!' });
});

// ── PATCH /api/admin/contacts/:id/read ──
router.patch('/contacts/:id/read', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE contacts SET is_read = 1 WHERE id = ?').run(id);
  res.json({ message: 'Mensagem marcada como lida.' });
});

// ── GET /api/admin/stats ──
router.get('/stats', (req, res) => {
  const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients WHERE is_admin = 0').get().count;
  const totalLoans = db.prepare('SELECT COUNT(*) as count FROM loans').get().count;
  const pendingLoans = db.prepare("SELECT COUNT(*) as count FROM loans WHERE status = 'pendente'").get().count;
  const approvedLoans = db.prepare("SELECT COUNT(*) as count FROM loans WHERE status = 'aprovado'").get().count;
  const totalContacts = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
  const unreadContacts = db.prepare('SELECT COUNT(*) as count FROM contacts WHERE is_read = 0').get().count;
  const totalLoanAmount = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status = 'aprovado'").get().total;

  res.json({
    stats: {
      totalClients,
      totalLoans,
      pendingLoans,
      approvedLoans,
      totalContacts,
      unreadContacts,
      totalLoanAmount,
    },
  });
});

module.exports = router;
