/* ═══════════════════════════════════════════════════════════
   NovaBanco — Main JavaScript
   Navigation, FAQ, Contact Form, Animations
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

// ── Navbar Scroll Effect ──
function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // Mobile toggle
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      links.classList.toggle('active');
    });

    // Close on link click
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        links.classList.remove('active');
      });
    });
  }

  // Update nav actions if user is logged in
  updateNavForAuth();
}

function updateNavForAuth() {
  const token = localStorage.getItem('novabanco_token');
  const clientData = localStorage.getItem('novabanco_client');
  const navActions = document.getElementById('navActions');

  if (token && clientData && navActions) {
    const client = JSON.parse(clientData);
    const dashLink = client.is_admin ? '/admin.html' : '/dashboard.html';
    navActions.innerHTML = `
      <a href="${dashLink}" class="nav-login-link">Meu Painel</a>
      <button class="btn btn-primary btn-sm" onclick="logoutMain()">Sair</button>
    `;
  }
}

function logoutMain() {
  localStorage.removeItem('novabanco_token');
  localStorage.removeItem('novabanco_client');
  window.location.reload();
}

// ── Scroll Reveal Animations ──
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  });

  reveals.forEach(el => observer.observe(el));
}

// ── FAQ ──
async function initFAQ() {
  const faqList = document.getElementById('faqList');
  const faqSearch = document.getElementById('faqSearch');
  const faqCategories = document.getElementById('faqCategories');

  if (!faqList) return;

  let allFaqs = [];
  let currentCategory = 'all';

  // Fetch FAQs from API
  try {
    const res = await fetch(`${API_BASE}/api/faq`);
    const data = await res.json();
    allFaqs = data.faqs;
    renderFAQ(allFaqs);
  } catch (err) {
    faqList.innerHTML = '<p style="text-align:center; color: var(--color-gray-400);">Erro ao carregar FAQ.</p>';
  }

  function renderFAQ(faqs) {
    if (faqs.length === 0) {
      faqList.innerHTML = '<p style="text-align:center; color: var(--color-gray-400); padding: 2rem;">Nenhuma pergunta encontrada.</p>';
      return;
    }

    faqList.innerHTML = faqs.map(faq => `
      <div class="faq-item" data-category="${faq.category}">
        <div class="faq-question" onclick="toggleFAQ(this)">
          <span>${faq.question}</span>
          <span class="faq-toggle">+</span>
        </div>
        <div class="faq-answer">
          <div class="faq-answer-inner">${faq.answer}</div>
        </div>
      </div>
    `).join('');
  }

  // Search
  if (faqSearch) {
    let searchTimeout;
    faqSearch.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 2) {
          filterFAQ(currentCategory);
          return;
        }
        const filtered = allFaqs.filter(faq =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
        );
        renderFAQ(filtered);
      }, 300);
    });
  }

  // Category filter
  if (faqCategories) {
    faqCategories.addEventListener('click', (e) => {
      if (e.target.classList.contains('faq-category-btn')) {
        faqCategories.querySelectorAll('.faq-category-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.dataset.category;
        filterFAQ(currentCategory);
      }
    });
  }

  function filterFAQ(category) {
    if (category === 'all') {
      renderFAQ(allFaqs);
    } else {
      renderFAQ(allFaqs.filter(f => f.category === category));
    }
  }
}

function toggleFAQ(element) {
  const item = element.closest('.faq-item');
  const answer = item.querySelector('.faq-answer');
  const inner = answer.querySelector('.faq-answer-inner');
  const isOpen = item.classList.contains('active');

  // Close all others
  document.querySelectorAll('.faq-item.active').forEach(el => {
    if (el !== item) {
      el.classList.remove('active');
      el.querySelector('.faq-answer').style.maxHeight = '0';
    }
  });

  if (isOpen) {
    item.classList.remove('active');
    answer.style.maxHeight = '0';
  } else {
    item.classList.add('active');
    answer.style.maxHeight = inner.scrollHeight + 24 + 'px';
  }
}

// ── Contact Form ──
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('contactSubmitBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Enviando...';

    const data = {
      name: document.getElementById('contactName').value.trim(),
      email: document.getElementById('contactEmail').value.trim(),
      subject: document.getElementById('contactSubject').value.trim(),
      message: document.getElementById('contactMessage').value.trim(),
    };

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        showToast(result.message, 'success');
        form.reset();
      } else {
        const errorMsg = result.errors ? result.errors[0].msg : result.error;
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      showToast('Erro de conexão. Tente novamente.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

// ── Smooth scroll for anchor links ──
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ── Initialize everything ──
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollReveal();
  initFAQ();
  initContactForm();
  initSmoothScroll();
});
