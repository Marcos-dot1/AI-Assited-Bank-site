/* ═══════════════════════════════════════════════════════════
   NovaBanco — Loan Simulator JavaScript
   Interactive loan calculator with real-time updates
   ═══════════════════════════════════════════════════════════ */

const API_BASE = '';

// ── State ──
let loanType = 'pessoal';
let loanAmount = 10000;
let loanTerm = 24;
let currentSimulation = null;

// ── Toast ──
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Auth helpers ──
function getToken() {
  return localStorage.getItem('novabanco_token');
}

function getClient() {
  const data = localStorage.getItem('novabanco_client');
  return data ? JSON.parse(data) : null;
}

function logout() {
  localStorage.removeItem('novabanco_token');
  localStorage.removeItem('novabanco_client');
  window.location.href = '/login.html';
}

// ── Currency formatter ──
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// ── Simulate loan ──
async function simulateLoan() {
  try {
    const res = await fetch(`${API_BASE}/api/loans/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: loanAmount,
        term_months: loanTerm,
        type: loanType,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      currentSimulation = data.simulation;
      updateResults(data.simulation);
    }
  } catch (err) {
    console.error('Erro na simulação:', err);
  }
}

function updateResults(sim) {
  document.getElementById('resultMonthly').textContent = formatCurrency(sim.monthly_payment);
  document.getElementById('resultTermText').textContent = sim.term_months;
  document.getElementById('resultAmount').textContent = formatCurrency(sim.amount);
  document.getElementById('resultRate').textContent = sim.interest_rate.toFixed(1) + '%';
  document.getElementById('resultInterest').textContent = formatCurrency(sim.total_interest);
  document.getElementById('resultTotal').textContent = formatCurrency(sim.total_amount);
}

// ── Request loan ──
async function requestLoan() {
  const token = getToken();
  if (!token) {
    showToast('Faça login para solicitar um empréstimo.', 'error');
    setTimeout(() => window.location.href = '/login.html', 1500);
    return;
  }

  const btn = document.getElementById('requestLoanBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  try {
    const res = await fetch(`${API_BASE}/api/loans/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: loanAmount,
        term_months: loanTerm,
        type: loanType,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast('Solicitação enviada com sucesso! Acompanhe pelo Dashboard.', 'success');
      btn.textContent = '✅ Solicitação Enviada!';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = originalText;
      }, 3000);
    } else {
      const errorMsg = data.errors ? data.errors[0].msg : data.error;
      showToast(errorMsg, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  } catch (err) {
    showToast('Erro de conexão. Tente novamente.', 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  // Set user name if logged in
  const client = getClient();
  const userNameEl = document.getElementById('loanUserName');
  const loginHint = document.getElementById('loginHint');

  if (client && userNameEl) {
    userNameEl.textContent = client.name || client.email;
  }

  if (client && loginHint) {
    loginHint.style.display = 'none';
  }

  // Loan type selector
  document.querySelectorAll('.loan-type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.loan-type-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      loanType = opt.dataset.type;
      simulateLoan();
    });
  });

  // Amount slider
  const amountSlider = document.getElementById('amountSlider');
  const amountValue = document.getElementById('amountValue');
  if (amountSlider) {
    amountSlider.addEventListener('input', (e) => {
      loanAmount = parseInt(e.target.value);
      amountValue.textContent = formatCurrency(loanAmount);
      simulateLoan();
    });
  }

  // Term slider
  const termSlider = document.getElementById('termSlider');
  const termValue = document.getElementById('termValue');
  if (termSlider) {
    termSlider.addEventListener('input', (e) => {
      loanTerm = parseInt(e.target.value);
      termValue.textContent = `${loanTerm} meses`;
      simulateLoan();
    });
  }

  // Initial simulation
  simulateLoan();
});
