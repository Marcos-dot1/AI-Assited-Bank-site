const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { db } = require('../database/init');
const { authenticate } = require('../middleware/auth');

// Interest rates by loan type (Taxa de juros por tipo de empréstimo)
const INTEREST_RATES = {
  pessoal: 0.015,    // 1.5% a.m.
  consignado: 0.01,  // 1.0% a.m.
};

/**
 * Calculate loan details using Price table (French amortization). 
 (Calcula os juros e o valor das parcelas)
 */
function calculateLoan(amount, termMonths, type) {
  const monthlyRate = INTEREST_RATES[type] || INTEREST_RATES.pessoal;

  // PMT formula: M = P * [r(1+r)^n] / [(1+r)^n - 1] (Essa e a formula para calcular os juros)
  const factor = Math.pow(1 + monthlyRate, termMonths);
  const monthlyPayment = amount * (monthlyRate * factor) / (factor - 1);
  const totalAmount = monthlyPayment * termMonths;

  return {
    amount: Math.round(amount * 100) / 100,
    term_months: termMonths,
    interest_rate: monthlyRate * 100, // porcentagem 
    monthly_payment: Math.round(monthlyPayment * 100) / 100, // o valor da parcela
    total_amount: Math.round(totalAmount * 100) / 100, // o valor total
    total_interest: Math.round((totalAmount - amount) * 100) / 100, // o valor dos juros
    type, // tipo de empréstimo
  };
}

// ── POST /api/loans/simulate ── (public) (Simula o empréstimo)
router.post('/simulate', [
  body('amount').isFloat({ min: 1000, max: 500000 }).withMessage('Valor deve ser entre R$ 1.000 e R$ 500.000.'),
  body('term_months').isInt({ min: 6, max: 60 }).withMessage('Prazo deve ser entre 6 e 60 meses.'),
  body('type').isIn(['pessoal', 'consignado']).withMessage('Tipo deve ser "pessoal" ou "consignado".'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, term_months, type } = req.body;
  const simulation = calculateLoan(amount, term_months, type);

  res.json({ simulation });
});

// ── POST /api/loans/request ── (authenticated) (Solicita o empréstimo) (requer autenticação)
router.post('/request', authenticate, [
  body('amount').isFloat({ min: 1000, max: 500000 }).withMessage('Valor deve ser entre R$ 1.000 e R$ 500.000.'),
  body('term_months').isInt({ min: 6, max: 60 }).withMessage('Prazo deve ser entre 6 e 60 meses.'),
  body('type').isIn(['pessoal', 'consignado']).withMessage('Tipo deve ser "pessoal" ou "consignado".'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, term_months, type } = req.body;
  const loan = calculateLoan(amount, term_months, type);

  const result = db.prepare(`
    INSERT INTO loans (client_id, type, amount, term_months, interest_rate, monthly_payment, total_amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente')
  `).run(
    req.client.id,
    loan.type,
    loan.amount,
    loan.term_months,
    loan.interest_rate,
    loan.monthly_payment,
    loan.total_amount
  );

  res.status(201).json({
    message: 'Solicitação de empréstimo enviada com sucesso!',
    loan: {
      id: result.lastInsertRowid,
      ...loan,
      status: 'pendente',
    },
  });
});

// ── GET /api/loans/my ── (authenticated) (Mostra os empréstimos do cliente) (requer autenticação)
router.get('/my', authenticate, (req, res) => {
  const loans = db.prepare(`
    SELECT * FROM loans WHERE client_id = ? ORDER BY created_at DESC
  `).all(req.client.id);

  res.json({ loans });
});

module.exports = router;
