/* ═══════════════════════════════════════════════════════════
   NovaBanco — Dashboard JavaScript
   Client profile, overview stats & loan history
   ═══════════════════════════════════════════════════════════ */

const API_BASE = '';

// ── Toast Notifications ──
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Currency Formatter ──
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

// ── Date Formatter ──
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ── Format CPF ──
function formatCPF(cpf) {
  if (!cpf) return '-';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// ── Format Phone ──
function formatPhone(phone) {
  if (!phone) return '-';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

// ── Logout ──
function logout() {
  localStorage.removeItem('novabanco_token');
  localStorage.removeItem('novabanco_client');
  window.location.href = '/login.html';
}

// ── Auth Guard & Profile Loader ──
async function loadUserData() {
  const token = localStorage.getItem('novabanco_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      logout();
      return;
    }

    const data = await res.json();
    const client = data.client;
    localStorage.setItem('novabanco_client', JSON.stringify(client));

    // Update UI Elements
    const firstName = client.name.split(' ')[0];
    document.getElementById('dashboardUserName').textContent = client.name;
    document.getElementById('dashboardGreeting').textContent = firstName;
    
    const initials = client.name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
    document.getElementById('dashboardUserAvatar').textContent = initials;

    // Render profile details
    renderProfileTable(client);

    // Fetch user loans
    loadUserLoans(token);

  } catch (err) {
    console.error('Erro ao carregar dados do usuário:', err);
    showToast('Erro ao carregar dados da conta.', 'error');
  }
}

// ── Render Profile Information Table ──
function renderProfileTable(client) {
  const tbody = document.getElementById('profileTable');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td style="width: 25%; font-weight: 600; color: var(--color-primary);">Nome Completo</td>
      <td>${client.name}</td>
    </tr>
    <tr>
      <td style="font-weight: 600; color: var(--color-primary);">E-mail</td>
      <td>${client.email}</td>
    </tr>
    <tr>
      <td style="font-weight: 600; color: var(--color-primary);">CPF</td>
      <td>${formatCPF(client.cpf)}</td>
    </tr>
    <tr>
      <td style="font-weight: 600; color: var(--color-primary);">Telefone</td>
      <td>${formatPhone(client.phone)}</td>
    </tr>
    <tr>
      <td style="font-weight: 600; color: var(--color-primary);">Cliente Desde</td>
      <td>${formatDate(client.created_at)}</td>
    </tr>
  `;
}

// ── Load User Loans ──
async function loadUserLoans(token) {
  const container = document.getElementById('loansTableContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/loans/my`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error('Falha ao carregar empréstimos');
    }

    const data = await res.json();
    const loans = data.loans || [];

    // Calculate stats
    let activeLoansCount = 0;
    let totalRequestedAmount = 0;
    let pendingCount = 0;

    loans.forEach(loan => {
      totalRequestedAmount += loan.amount;
      if (loan.status === 'aprovado') activeLoansCount++;
      if (loan.status === 'pendente') pendingCount++;
    });

    document.getElementById('statActiveLoans').textContent = activeLoansCount;
    document.getElementById('statTotalRequested').textContent = formatCurrency(totalRequestedAmount);
    document.getElementById('statPending').textContent = pendingCount;

    if (loans.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <h3>Nenhum empréstimo solicitado ainda</h3>
          <p>Você pode simular e solicitar um empréstimo a qualquer momento.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Prazo</th>
            <th>Parcela</th>
            <th>Total</th>
            <th>Status / Parecer do Banco</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(loan => {
            const badgeClass = loan.status === 'aprovado' ? 'badge-approved' : loan.status === 'rejeitado' ? 'badge-rejected' : 'badge-pending';
            const typeLabel = loan.type === 'consignado' ? 'Consignado' : 'Pessoal';
            return `
              <tr>
                <td><strong>#${loan.id}</strong></td>
                <td><span style="font-weight: 500;">${typeLabel}</span></td>
                <td style="font-weight: 600; color: var(--color-primary);">${formatCurrency(loan.amount)}</td>
                <td>${loan.term_months}x</td>
                <td>${formatCurrency(loan.monthly_payment)}</td>
                <td>${formatCurrency(loan.total_amount)}</td>
                <td>
                  <span class="badge ${badgeClass}">${loan.status}</span>
                  ${loan.admin_note ? `<div style="font-size: 0.8rem; color: var(--color-gray-500); margin-top: 4px; font-style: italic;">📝 "${loan.admin_note}"</div>` : ''}
                </td>
                <td style="font-size: 0.82rem; color: var(--color-gray-400);">${formatDate(loan.created_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

  } catch (err) {
    console.error('Erro ao buscar empréstimos:', err);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Não foi possível carregar o histórico</h3>
        <p>Tente recarregar a página.</p>
      </div>
    `;
  }
}

// ── Load User Support Messages & Replies ──
async function loadUserContacts(token) {
  const container = document.getElementById('contactsTableContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/contact/my`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) throw new Error();

    const data = await res.json();
    const contacts = data.contacts || [];

    if (contacts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📩</div>
          <h3>Nenhuma mensagem enviada</h3>
          <p>Caso tenha dúvidas ou precise de ajuda, envie uma mensagem pelo formulário de contato.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Assunto</th>
            <th>Sua Mensagem</th>
            <th>Resposta do Banco</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(c => {
            const hasReply = !!c.reply;
            return `
              <tr>
                <td><strong>#${c.id}</strong></td>
                <td style="font-weight: 600; color: var(--color-primary);">${c.subject}</td>
                <td style="max-width: 260px; word-break: break-word; font-size: 0.85rem; color: var(--color-gray-600);">${c.message}</td>
                <td style="max-width: 300px; word-break: break-word;">
                  ${hasReply ? `
                    <div style="padding: 8px 12px; background: rgba(16,185,129,0.08); border-left: 3px solid var(--color-success); border-radius: 6px; font-size: 0.85rem;">
                      <div style="font-weight: 700; color: var(--color-success); margin-bottom: 2px;">💬 ${c.reply_by || 'Equipe NovaBanco'}:</div>
                      <div style="color: var(--color-primary);">${c.reply}</div>
                      <div style="font-size: 0.72rem; color: var(--color-gray-400); margin-top: 4px;">Respondido em ${formatDate(c.replied_at)}</div>
                    </div>
                  ` : `<span style="font-size: 0.82rem; color: var(--color-warning); font-weight: 500;">⏳ Aguardando retorno da equipe</span>`}
                </td>
                <td>
                  <span class="badge ${hasReply ? 'badge-approved' : 'badge-pending'}">
                    ${hasReply ? 'Respondida' : 'Em análise'}
                  </span>
                </td>
                <td style="font-size: 0.82rem; color: var(--color-gray-400);">${formatDate(c.created_at)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Erro ao buscar mensagens:', err);
  }
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  const token = localStorage.getItem('novabanco_token');
  if (token) {
    loadUserContacts(token);
  }
});

