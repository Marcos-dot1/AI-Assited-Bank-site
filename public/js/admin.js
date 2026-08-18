/* ═══════════════════════════════════════════════════════════
   NovaBanco — Admin Panel JavaScript
   Full management for clients, loans, contacts & statistics
   ═══════════════════════════════════════════════════════════ */

const API_BASE = '';

let allContacts = [];
let allLoans = [];
let selectedContactId = null;
let selectedLoanId = null;
let selectedLoanAction = null;

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

function getAuthHeader() {
  const token = localStorage.getItem('novabanco_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// ── Auth Guard for Admin ──
async function checkAdminAuth() {
  const token = localStorage.getItem('novabanco_token');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      logout();
      return false;
    }

    const data = await res.json();
    if (!data.client.is_admin) {
      showToast('Acesso negado. Apenas administradores.', 'error');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1200);
      return false;
    }

    return true;
  } catch (err) {
    logout();
    return false;
  }
}

// ── Load Stats ──
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`, {
      headers: getAuthHeader()
    });
    if (!res.ok) return;

    const data = await res.json();
    const stats = data.stats;

    document.getElementById('adminTotalClients').textContent = stats.totalClients;
    document.getElementById('adminPendingLoans').textContent = stats.pendingLoans;
    document.getElementById('adminTotalAmount').textContent = formatCurrency(stats.totalLoanAmount);
    document.getElementById('adminApprovedLoans').textContent = stats.approvedLoans;
    document.getElementById('adminTotalContacts').textContent = stats.totalContacts;
    document.getElementById('adminUnreadContacts').textContent = stats.unreadContacts;

    // Badges
    const loansBadge = document.getElementById('loansBadge');
    if (stats.pendingLoans > 0) {
      loansBadge.textContent = stats.pendingLoans;
      loansBadge.style.display = 'inline-flex';
    } else {
      loansBadge.style.display = 'none';
    }

    const contactsBadge = document.getElementById('contactsBadge');
    if (stats.unreadContacts > 0) {
      contactsBadge.textContent = stats.unreadContacts;
      contactsBadge.style.display = 'inline-flex';
    } else {
      contactsBadge.style.display = 'none';
    }
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err);
  }
}

// ── Load Loans ──
async function loadLoans() {
  const container = document.getElementById('adminLoansTable');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/loans`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error();

    const data = await res.json();
    allLoans = data.loans || [];

    if (allLoans.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💰</div>
          <h3>Nenhuma solicitação de empréstimo</h3>
          <p>As novas solicitações aparecerão aqui.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Prazo</th>
            <th>Parcela</th>
            <th>Total</th>
            <th>Status / Parecer</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${allLoans.map(loan => {
            const badgeClass = loan.status === 'aprovado' ? 'badge-approved' : loan.status === 'rejeitado' ? 'badge-rejected' : 'badge-pending';
            const typeLabel = loan.type === 'consignado' ? 'Consignado' : 'Pessoal';
            
            const actionButtons = `
              <div class="table-actions">
                <button class="table-btn table-btn-approve" onclick="updateLoanStatusDirect(${loan.id}, 'aprovado')" title="Aprovar com 1 clique">✓ Aprovar</button>
                <button class="table-btn table-btn-reject" onclick="updateLoanStatusDirect(${loan.id}, 'rejeitado')" title="Rejeitar com 1 clique">✗ Rejeitar</button>
                <button class="table-btn" style="background: rgba(10,22,40,0.06); color: var(--color-primary);" onclick="openLoanModal(${loan.id}, '${loan.status === 'pendente' ? 'aprovado' : loan.status}')" title="Adicionar observação personalizada">📝 Parecer</button>
              </div>
            `;

            return `
              <tr>
                <td><strong>#${loan.id}</strong></td>
                <td>
                  <div style="font-weight: 600; color: var(--color-primary);">${loan.client_name || 'Desconhecido'}</div>
                  <div style="font-size: 0.78rem; color: var(--color-gray-400);">${loan.client_email || ''}</div>
                </td>
                <td>${typeLabel}</td>
                <td style="font-weight: 600; color: var(--color-primary);">${formatCurrency(loan.amount)}</td>
                <td>${loan.term_months}x</td>
                <td>${formatCurrency(loan.monthly_payment)}</td>
                <td>${formatCurrency(loan.total_amount)}</td>
                <td>
                  <span class="badge ${badgeClass}">${loan.status}</span>
                  ${loan.admin_note ? `<div style="font-size: 0.78rem; color: var(--color-gray-500); margin-top: 4px; font-style: italic;">📝 "${loan.admin_note}"</div>` : ''}
                </td>
                <td style="font-size: 0.8rem; color: var(--color-gray-400);">${formatDate(loan.created_at)}</td>
                <td>${actionButtons}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erro ao carregar empréstimos.</p></div>`;
  }
}

// ── Direct 1-Click Status Update ──
async function updateLoanStatusDirect(loanId, status) {
  const defaultNote = status === 'aprovado' 
    ? 'Solicitação aprovada pela gerência. Crédito liberado na conta do cliente.' 
    : 'Solicitação não aprovada após análise cadastral e de crédito.';

  try {
    const res = await fetch(`${API_BASE}/api/admin/loans/${loanId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify({
        status,
        admin_note: defaultNote
      })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || `Empréstimo #${loanId} ${status}!`, 'success');
      loadLoans();
      loadStats();
    } else {
      showToast(data.error || 'Erro ao atualizar empréstimo', 'error');
    }
  } catch (err) {
    showToast('Erro de comunicação com o servidor.', 'error');
  }
}

// ── Loan Decision Modal Handlers ──
function openLoanModal(loanId, action) {
  selectedLoanId = loanId;
  selectedLoanAction = action;
  const loan = allLoans.find(l => l.id === loanId);
  if (!loan) return;

  const modal = document.getElementById('loanModal');
  const title = document.getElementById('loanModalTitle');
  const info = document.getElementById('loanModalClientInfo');
  const noteInput = document.getElementById('loanAdminNote');
  const btn = document.getElementById('btnConfirmLoanAction');

  title.textContent = action === 'aprovado' ? `Aprovar Empréstimo #${loanId}` : `Rejeitar Empréstimo #${loanId}`;
  info.innerHTML = `
    <strong>Cliente:</strong> ${loan.client_name} (${loan.client_email})<br>
    <strong>Valor Solicitado:</strong> ${formatCurrency(loan.amount)} em ${loan.term_months}x de ${formatCurrency(loan.monthly_payment)}<br>
    <strong>Tipo:</strong> ${loan.type === 'consignado' ? 'Consignado (1.0% a.m.)' : 'Pessoal (1.5% a.m.)'}
  `;

  noteInput.value = loan.admin_note || (action === 'aprovado' ? 'Solicitação aprovada. Crédito liberado na conta em até 24 horas.' : 'Solicitação não aprovada devido a critérios internos de crédito.');
  btn.className = action === 'aprovado' ? 'btn btn-primary btn-sm' : 'btn btn-sm';
  btn.style.background = action === 'aprovado' ? '' : 'var(--color-error)';
  btn.style.color = '#fff';
  btn.textContent = action === 'aprovado' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação';

  modal.classList.add('active');
}

function closeLoanModal() {
  const modal = document.getElementById('loanModal');
  if (modal) modal.classList.remove('active');
  selectedLoanId = null;
  selectedLoanAction = null;
}

async function submitLoanDecision() {
  if (!selectedLoanId || !selectedLoanAction) return;

  const note = document.getElementById('loanAdminNote').value.trim();
  const btn = document.getElementById('btnConfirmLoanAction');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Gravando...';

  try {
    const res = await fetch(`${API_BASE}/api/admin/loans/${selectedLoanId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: JSON.stringify({
        status: selectedLoanAction,
        admin_note: note
      })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Decisão registrada com sucesso!', 'success');
      closeLoanModal();
      loadLoans();
      loadStats();
    } else {
      showToast(data.error || 'Erro ao registrar decisão', 'error');
    }
  } catch (err) {
    showToast('Erro de comunicação com o servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ── Load Clients ──
async function loadClients() {
  const container = document.getElementById('adminClientsTable');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/clients`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error();

    const data = await res.json();
    const clients = data.clients || [];

    if (clients.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>Nenhum cliente cadastrado</h3>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>E-mail</th>
            <th>CPF</th>
            <th>Telefone</th>
            <th>Perfil</th>
            <th>Data de Cadastro</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(c => `
            <tr>
              <td><strong>#${c.id}</strong></td>
              <td style="font-weight: 600; color: var(--color-primary);">${c.name}</td>
              <td>${c.email}</td>
              <td>${formatCPF(c.cpf)}</td>
              <td>${formatPhone(c.phone)}</td>
              <td>
                <span class="badge ${c.is_admin ? 'badge-approved' : 'badge-pending'}">
                  ${c.is_admin ? 'Admin' : 'Cliente'}
                </span>
              </td>
              <td style="font-size: 0.8rem; color: var(--color-gray-400);">${formatDate(c.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erro ao carregar clientes.</p></div>`;
  }
}

// ── Load Contacts ──
async function loadContacts() {
  const container = document.getElementById('adminContactsTable');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/contacts`, {
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error();

    const data = await res.json();
    allContacts = data.contacts || [];

    if (allContacts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📩</div>
          <h3>Nenhuma mensagem recebida</h3>
          <p>As mensagens do formulário de contato aparecerão aqui.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Remetente</th>
            <th>Assunto</th>
            <th>Mensagem & Resposta</th>
            <th>Status</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${allContacts.map(c => {
            const hasReply = !!c.reply;
            const statusBadge = hasReply 
              ? `<span class="badge badge-approved">Respondida</span>`
              : (c.is_read ? `<span class="badge badge-pending">Lida</span>` : `<span class="badge badge-rejected">Nova</span>`);

            return `
              <tr style="${!c.is_read ? 'background: rgba(201, 168, 76, 0.04); font-weight: 500;' : ''}">
                <td><strong>#${c.id}</strong></td>
                <td>
                  <div style="font-weight: 600; color: var(--color-primary);">${c.name}</div>
                  <div style="font-size: 0.78rem; color: var(--color-gray-400);">${c.email}</div>
                </td>
                <td style="font-weight: 600;">${c.subject}</td>
                <td style="max-width: 320px; word-break: break-word;">
                  <div style="font-size: 0.85rem; color: var(--color-gray-600);">${c.message}</div>
                  ${hasReply ? `
                    <div style="margin-top: 6px; padding: 6px 10px; background: rgba(16,185,129,0.08); border-left: 2px solid var(--color-success); border-radius: 4px; font-size: 0.8rem; color: var(--color-primary);">
                      <strong>Resposta (${c.reply_by || 'Admin'}):</strong> ${c.reply}
                      <div style="font-size: 0.7rem; color: var(--color-gray-400); margin-top: 2px;">${formatDate(c.replied_at)}</div>
                    </div>
                  ` : ''}
                </td>
                <td>${statusBadge}</td>
                <td style="font-size: 0.8rem; color: var(--color-gray-400);">${formatDate(c.created_at)}</td>
                <td>
                  <div class="table-actions">
                    <button class="table-btn table-btn-reply" onclick="openReplyModal(${c.id})">
                      ${hasReply ? 'Ver / Editar' : 'Responder'}
                    </button>
                    ${!c.is_read && !hasReply ? `
                      <button class="table-btn table-btn-approve" onclick="markContactAsRead(${c.id})">Lida</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Erro ao carregar mensagens.</p></div>`;
  }
}

// ── Contact Reply Modal Handlers ──
function openReplyModal(contactId) {
  selectedContactId = contactId;
  const contact = allContacts.find(c => c.id === contactId);
  if (!contact) return;

  document.getElementById('modalContactSender').textContent = contact.name;
  document.getElementById('modalContactEmail').textContent = contact.email;
  document.getElementById('modalContactSubject').textContent = contact.subject;
  document.getElementById('modalContactMsg').textContent = contact.message;

  const replyInput = document.getElementById('adminReplyText');
  replyInput.value = contact.reply || `Olá ${contact.name.split(' ')[0]}, obrigado pelo contato! `;

  const modal = document.getElementById('replyModal');
  if (modal) modal.classList.add('active');
}

function closeReplyModal() {
  const modal = document.getElementById('replyModal');
  if (modal) modal.classList.remove('active');
  selectedContactId = null;
}

async function submitReply() {
  if (!selectedContactId) return;

  const replyText = document.getElementById('adminReplyText').value.trim();
  if (replyText.length < 2) {
    showToast('Escreva uma resposta antes de enviar.', 'error');
    return;
  }

  const btn = document.getElementById('btnSendReply');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando...';

  try {
    const res = await fetch(`${API_BASE}/api/admin/contacts/${selectedContactId}/reply`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ reply: replyText })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Resposta enviada com sucesso!', 'success');
      closeReplyModal();
      loadContacts();
      loadStats();
    } else {
      showToast(data.error || 'Erro ao enviar resposta', 'error');
    }
  } catch (err) {
    showToast('Erro de comunicação com o servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ── Mark Contact As Read ──
async function markContactAsRead(contactId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/contacts/${contactId}/read`, {
      method: 'PATCH',
      headers: getAuthHeader()
    });

    if (res.ok) {
      showToast('Mensagem marcada como lida.', 'success');
      loadContacts();
      loadStats();
    }
  } catch (err) {
    showToast('Erro ao atualizar mensagem.', 'error');
  }
}

// ── Tab Navigation ──
function initTabs() {
  const tabsContainer = document.getElementById('adminTabs');
  if (!tabsContainer) return;

  tabsContainer.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.admin-tab');
    if (!tabBtn) return;

    const tabName = tabBtn.dataset.tab;
    
    // Toggle active tab buttons
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    tabBtn.classList.add('active');

    // Toggle panels
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) targetPanel.classList.add('active');

    // Refresh tab content
    if (tabName === 'loans') loadLoans();
    if (tabName === 'clients') loadClients();
    if (tabName === 'contacts') loadContacts();
  });
}

// ── Initialize Admin Page ──
document.addEventListener('DOMContentLoaded', async () => {
  const isAuthorized = await checkAdminAuth();
  if (isAuthorized) {
    initTabs();
    loadStats();
    loadLoans();
    loadClients();
    loadContacts();
  }
});
