/* ═══════════════════════════════════════════════════════════
   NovaBanco — Auth JavaScript
   Login & Registration logic with JWT
   ═══════════════════════════════════════════════════════════ */

const API_BASE = '';

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

// ── Check if already logged in ──
function checkAuth() {
  const token = localStorage.getItem('novabanco_token');
  const client = localStorage.getItem('novabanco_client');
  if (token && client) {
    const data = JSON.parse(client);
    if (data.is_admin) {
      window.location.href = '/admin.html';
    } else {
      window.location.href = '/dashboard.html';
    }
  }
}

// ── CPF Mask ──
function maskCPF(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 9) {
    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  } else if (value.length > 6) {
    value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  } else if (value.length > 3) {
    value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  }

  input.value = value;
}

// ── Phone Mask ──
function maskPhone(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length > 11) value = value.slice(0, 11);

  if (value.length > 6) {
    value = value.replace(/(\d{2})(\d{4,5})(\d{1,4})/, '($1) $2-$3');
  } else if (value.length > 2) {
    value = value.replace(/(\d{2})(\d{1,5})/, '($1) $2');
  }

  input.value = value;
}

// ── Login Form ──
function initLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('loginSubmitBtn');
    const errorDiv = document.getElementById('loginError');
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Entrando...';
    errorDiv.classList.remove('visible');

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('novabanco_token', data.token);
        localStorage.setItem('novabanco_client', JSON.stringify(data.client));

        showToast('Login realizado com sucesso!', 'success');

        setTimeout(() => {
          if (data.client.is_admin) {
            window.location.href = '/admin.html';
          } else {
            window.location.href = '/dashboard.html';
          }
        }, 500);
      } else {
        const errorMsg = data.errors ? data.errors[0].msg : data.error;
        errorDiv.textContent = errorMsg;
        errorDiv.classList.add('visible');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (err) {
      errorDiv.textContent = 'Erro de conexão. Tente novamente.';
      errorDiv.classList.add('visible');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

// ── Register Form ──
function initRegister() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  // Add input masks
  const cpfInput = document.getElementById('regCPF');
  const phoneInput = document.getElementById('regPhone');

  if (cpfInput) cpfInput.addEventListener('input', () => maskCPF(cpfInput));
  if (phoneInput) phoneInput.addEventListener('input', () => maskPhone(phoneInput));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('registerSubmitBtn');
    const errorDiv = document.getElementById('registerError');
    const originalText = btn.textContent;

    // Validate passwords match
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;

    if (password !== confirm) {
      errorDiv.textContent = 'As senhas não coincidem.';
      errorDiv.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Criando conta...';
    errorDiv.classList.remove('visible');

    const data = {
      name: document.getElementById('regName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      cpf: document.getElementById('regCPF').value.trim(),
      password: password,
    };

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        localStorage.setItem('novabanco_token', result.token);
        localStorage.setItem('novabanco_client', JSON.stringify(result.client));

        showToast('Conta criada com sucesso! Bem-vindo ao NovaBanco!', 'success');

        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);
      } else {
        const errorMsg = result.errors ? result.errors[0].msg : result.error;
        errorDiv.textContent = errorMsg;
        errorDiv.classList.add('visible');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (err) {
      errorDiv.textContent = 'Erro de conexão. Tente novamente.';
      errorDiv.classList.add('visible');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initLogin();
  initRegister();
});
