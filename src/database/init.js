const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'novabanco.json');

// In-memory state
let storage = {
  clients: [],
  loans: [],
  contacts: [],
  faq: []
};

// Load initial data from JSON file if exists
function loadStorage() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      storage = JSON.parse(data);
      if (!storage.clients) storage.clients = [];
      if (!storage.loans) storage.loans = [];
      if (!storage.contacts) storage.contacts = [];
      if (!storage.faq) storage.faq = [];
    } catch (e) {
      console.error('Error reading storage JSON, starting fresh:', e);
    }
  }
}

function saveStorage() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(storage, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving storage:', e);
  }
}

loadStorage();

/**
 * Lightweight SQL-like query interface matching better-sqlite3 API
 */
const db = {
  pragma: () => {},
  exec: (sql) => {},
  transaction: (fn) => {
    return (...args) => {
      const res = fn(...args);
      saveStorage();
      return res;
    };
  },
  prepare: (sql) => {
    const trimmed = sql.trim().replace(/\s+/g, ' ');

    return {
      run: (...params) => {
        let result = { lastInsertRowid: 0, changes: 0 };

        // INSERT INTO clients
        if (/INSERT INTO clients/i.test(trimmed)) {
          const id = storage.clients.length > 0 ? Math.max(...storage.clients.map(c => c.id || 0)) + 1 : 1;
          const is_admin = params.length >= 6 ? params[5] : 0;
          const newClient = {
            id,
            name: params[0],
            email: params[1],
            cpf: params[2],
            phone: params[3],
            password: params[4],
            is_admin: Number(is_admin) || 0,
            created_at: new Date().toISOString()
          };
          storage.clients.push(newClient);
          saveStorage();
          return { lastInsertRowid: id, changes: 1 };
        }

        // INSERT INTO loans
        if (/INSERT INTO loans/i.test(trimmed)) {
          const id = storage.loans.length > 0 ? Math.max(...storage.loans.map(l => l.id || 0)) + 1 : 1;
          const newLoan = {
            id,
            client_id: params[0],
            type: params[1],
            amount: params[2],
            term_months: params[3],
            interest_rate: params[4],
            monthly_payment: params[5],
            total_amount: params[6],
            status: 'pendente',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          storage.loans.push(newLoan);
          saveStorage();
          return { lastInsertRowid: id, changes: 1 };
        }

        // INSERT INTO contacts
        if (/INSERT INTO contacts/i.test(trimmed)) {
          const id = storage.contacts.length > 0 ? Math.max(...storage.contacts.map(c => c.id || 0)) + 1 : 1;
          const newContact = {
            id,
            name: params[0],
            email: params[1],
            subject: params[2],
            message: params[3],
            is_read: 0,
            created_at: new Date().toISOString()
          };
          storage.contacts.push(newContact);
          saveStorage();
          return { lastInsertRowid: id, changes: 1 };
        }

        // INSERT INTO faq
        if (/INSERT INTO faq/i.test(trimmed)) {
          const id = storage.faq.length > 0 ? Math.max(...storage.faq.map(f => f.id || 0)) + 1 : 1;
          const newFaq = {
            id,
            question: params[0],
            answer: params[1],
            category: params[2] || 'geral',
            order_num: params[3] || 0
          };
          storage.faq.push(newFaq);
          saveStorage();
          return { lastInsertRowid: id, changes: 1 };
        }

        // UPDATE loans SET status = ... WHERE id = ?
        if (/UPDATE loans SET status/i.test(trimmed)) {
          const status = params[0];
          let admin_note = null;
          let id;
          if (params.length >= 3) {
            admin_note = params[1];
            id = Number(params[2]);
          } else {
            id = Number(params[1]);
          }

          const loan = storage.loans.find(l => Number(l.id) === Number(id));
          if (loan) {
            loan.status = status;
            if (admin_note !== undefined && admin_note !== null) {
              loan.admin_note = admin_note;
            }
            loan.updated_at = new Date().toISOString();
            saveStorage();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        // UPDATE contacts SET reply = ... WHERE id = ?
        if (/UPDATE contacts SET reply/i.test(trimmed)) {
          const reply = params[0];
          const reply_by = params[1] || 'Equipe NovaBanco';
          const id = Number(params[2]);

          const contact = storage.contacts.find(c => Number(c.id) === Number(id));
          if (contact) {
            contact.reply = reply;
            contact.reply_by = reply_by;
            contact.replied_at = new Date().toISOString();
            contact.is_read = 1;
            saveStorage();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        // UPDATE contacts SET is_read = 1 WHERE id = ?
        if (/UPDATE contacts SET is_read/i.test(trimmed)) {
          const id = Number(params[0]);
          const contact = storage.contacts.find(c => Number(c.id) === Number(id));
          if (contact) {
            contact.is_read = 1;
            saveStorage();
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        return result;
      },

      get: (...params) => {
        // SELECT COUNT(*) as count FROM clients WHERE is_admin = 1 / 0
        if (/SELECT COUNT\(\*\) as count FROM clients WHERE is_admin = 1/i.test(trimmed)) {
          return { count: storage.clients.filter(c => c.is_admin === 1).length };
        }
        if (/SELECT COUNT\(\*\) as count FROM clients WHERE is_admin = 0/i.test(trimmed)) {
          return { count: storage.clients.filter(c => !c.is_admin).length };
        }
        if (/SELECT COUNT\(\*\) as count FROM clients/i.test(trimmed)) {
          return { count: storage.clients.length };
        }

        // SELECT COUNT(*) as count FROM loans WHERE status = 'pendente' / 'aprovado'
        if (/SELECT COUNT\(\*\) as count FROM loans WHERE status = 'pendente'/i.test(trimmed)) {
          return { count: storage.loans.filter(l => l.status === 'pendente').length };
        }
        if (/SELECT COUNT\(\*\) as count FROM loans WHERE status = 'aprovado'/i.test(trimmed)) {
          return { count: storage.loans.filter(l => l.status === 'aprovado').length };
        }
        if (/SELECT COUNT\(\*\) as count FROM loans/i.test(trimmed)) {
          return { count: storage.loans.length };
        }

        // SELECT COALESCE(SUM(amount), 0) as total FROM loans WHERE status = 'aprovado'
        if (/SUM\(amount\)/i.test(trimmed)) {
          const total = storage.loans
            .filter(l => l.status === 'aprovado')
            .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
          return { total };
        }

        // SELECT COUNT(*) as count FROM contacts WHERE is_read = 0
        if (/SELECT COUNT\(\*\) as count FROM contacts WHERE is_read = 0/i.test(trimmed)) {
          return { count: storage.contacts.filter(c => !c.is_read).length };
        }
        if (/SELECT COUNT\(\*\) as count FROM contacts/i.test(trimmed)) {
          return { count: storage.contacts.length };
        }

        // SELECT COUNT(*) as count FROM faq
        if (/SELECT COUNT\(\*\) as count FROM faq/i.test(trimmed)) {
          return { count: storage.faq.length };
        }

        // SELECT ... FROM clients WHERE id = ?
        if (/SELECT (.*) FROM clients WHERE id = \?/i.test(trimmed)) {
          const client = storage.clients.find(c => Number(c.id) === Number(params[0]));
          return client ? { ...client } : undefined;
        }

        // SELECT id FROM clients WHERE email = ?
        if (/SELECT id FROM clients WHERE email = \?/i.test(trimmed)) {
          const client = storage.clients.find(c => c.email.toLowerCase() === String(params[0]).toLowerCase());
          return client ? { id: client.id } : undefined;
        }

        // SELECT id FROM clients WHERE cpf = ?
        if (/SELECT id FROM clients WHERE cpf = \?/i.test(trimmed)) {
          const client = storage.clients.find(c => c.cpf === String(params[0]));
          return client ? { id: client.id } : undefined;
        }

        // SELECT * FROM clients WHERE email = ?
        if (/SELECT \* FROM clients WHERE email = \?/i.test(trimmed)) {
          const client = storage.clients.find(c => c.email.toLowerCase() === String(params[0]).toLowerCase());
          return client ? { ...client } : undefined;
        }

        // SELECT * FROM loans WHERE id = ?
        if (/SELECT \* FROM loans WHERE id = \?/i.test(trimmed)) {
          const loan = storage.loans.find(l => Number(l.id) === Number(params[0]));
          return loan ? { ...loan } : undefined;
        }

        // SELECT * FROM contacts WHERE id = ?
        if (/SELECT \* FROM contacts WHERE id = \?/i.test(trimmed)) {
          const contact = storage.contacts.find(c => Number(c.id) === Number(params[0]));
          return contact ? { ...contact } : undefined;
        }

        return undefined;
      },

      all: (...params) => {
        // SELECT * FROM faq ORDER BY order_num ASC
        if (/SELECT \* FROM faq/i.test(trimmed) && !/LIKE/i.test(trimmed)) {
          return [...storage.faq].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
        }

        // SELECT * FROM faq WHERE question LIKE ? OR answer LIKE ?
        if (/SELECT \* FROM faq WHERE question LIKE/i.test(trimmed)) {
          const q = (params[0] || '').replace(/%/g, '').toLowerCase();
          return storage.faq.filter(f => 
            f.question.toLowerCase().includes(q) || 
            f.answer.toLowerCase().includes(q)
          ).sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
        }

        // SELECT * FROM loans WHERE client_id = ? ORDER BY created_at DESC
        if (/SELECT \* FROM loans WHERE client_id = \?/i.test(trimmed)) {
          const clientId = Number(params[0]);
          return storage.loans
            .filter(l => l.client_id === clientId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // SELECT loans.*, clients.name as client_name, clients.email as client_email FROM loans JOIN clients...
        if (/FROM loans(.*)JOIN clients/i.test(trimmed)) {
          return storage.loans.map(loan => {
            const client = storage.clients.find(c => c.id === loan.client_id) || {};
            return {
              ...loan,
              client_name: client.name || 'Cliente',
              client_email: client.email || ''
            };
          }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // SELECT ... FROM clients ORDER BY created_at DESC
        if (/FROM clients/i.test(trimmed)) {
          return [...storage.clients]
            .map(c => ({ id: c.id, name: c.name, email: c.email, cpf: c.cpf, phone: c.phone, is_admin: c.is_admin, created_at: c.created_at }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // SELECT * FROM contacts WHERE email = ? ORDER BY created_at DESC
        if (/SELECT \* FROM contacts WHERE email = \?/i.test(trimmed)) {
          const email = String(params[0]).toLowerCase();
          return storage.contacts
            .filter(c => c.email.toLowerCase() === email)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // SELECT * FROM contacts ORDER BY created_at DESC
        if (/FROM contacts/i.test(trimmed)) {
          return [...storage.contacts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        return [];
      }
    };
  }
};

function initializeDatabase() {
  loadStorage();

  // ── Seed FAQ data if empty ──
  const faqCount = db.prepare('SELECT COUNT(*) as count FROM faq').get();
  if (faqCount.count === 0) {
    const insertFaq = db.prepare('INSERT INTO faq (question, answer, category, order_num) VALUES (?, ?, ?, ?)');
    const faqData = [
      ['Como abro uma conta no NovaBanco?', 'Você pode abrir sua conta diretamente pelo nosso site! Basta clicar em "Abrir Conta", preencher o formulário com seus dados pessoais e aguardar a confirmação. O processo é 100% digital e leva menos de 5 minutos.', 'conta', 1],
      ['Quais documentos preciso para abrir uma conta?', 'Para abrir sua conta, você precisa de: CPF válido, e-mail ativo e um número de telefone. Futuramente, poderemos solicitar comprovante de renda para serviços específicos como empréstimos.', 'conta', 2],
      ['A conta no NovaBanco tem taxa de manutenção?', 'Não! A conta digital NovaBanco é totalmente gratuita. Não cobramos taxa de manutenção mensal, taxa de abertura ou taxa de encerramento.', 'conta', 3],
      ['Quais tipos de empréstimo o NovaBanco oferece?', 'Oferecemos duas modalidades principais: Empréstimo Pessoal (taxa a partir de 1,5% a.m.) e Empréstimo Consignado (taxa a partir de 1,0% a.m.). Os prazos variam de 6 a 60 meses.', 'emprestimo', 4],
      ['Como faço uma simulação de empréstimo?', 'Acesse nossa página de Empréstimos e utilize o simulador interativo. Basta informar o valor desejado, o prazo e o tipo de empréstimo. O sistema calcula automaticamente as parcelas e o custo total.', 'emprestimo', 5],
      ['Quanto tempo leva para o empréstimo ser aprovado?', 'Após a solicitação, nossa equipe analisa o pedido em até 2 dias úteis. Após aprovação, o valor é depositado na sua conta em até 24 horas.', 'emprestimo', 6],
      ['Posso antecipar parcelas do meu empréstimo?', 'Sim! Você pode antecipar parcelas a qualquer momento pelo seu painel do cliente. Ao antecipar, você recebe desconto nos juros proporcionais ao período antecipado.', 'emprestimo', 7],
      ['O NovaBanco é seguro?', 'Absolutamente! Utilizamos criptografia de ponta a ponta, autenticação segura com JWT e todas as senhas são armazenadas com hash bcrypt. Seus dados estão protegidos seguindo as melhores práticas de segurança.', 'seguranca', 8],
      ['Esqueci minha senha, como recupero?', 'Na página de login, clique em "Esqueci minha senha" e informe seu e-mail cadastrado. Enviaremos instruções para redefinir sua senha com segurança.', 'seguranca', 9],
      ['Como entro em contato com o suporte?', 'Você pode nos contatar através do formulário na seção "Contato" do nosso site, pelo e-mail contato@novabanco.com.br ou pelo telefone 0800-123-4567. Nosso atendimento funciona de segunda a sexta, das 8h às 20h.', 'geral', 10],
      ['O NovaBanco tem aplicativo?', 'No momento, nossos serviços estão disponíveis exclusivamente pela plataforma web, otimizada para desktop e dispositivos móveis. Um aplicativo nativo está em nosso roadmap para o futuro.', 'geral', 11],
      ['Quais são as taxas de juros do NovaBanco?', 'Nossas taxas são competitivas: Empréstimo Pessoal a partir de 1,5% a.m. e Consignado a partir de 1,0% a.m. As taxas podem variar conforme análise de crédito e perfil do cliente.', 'geral', 12],
    ];

    faqData.forEach(row => insertFaq.run(...row));
    console.log('✅ FAQ data seeded successfully');
  }

  // ── Create default admin if not exists ──
  const adminExists = db.prepare('SELECT COUNT(*) as count FROM clients WHERE is_admin = 1').get();
  if (adminExists.count === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO clients (name, email, cpf, phone, password, is_admin) 
      VALUES (?, ?, ?, ?, ?, 1)
    `).run('Administrador', 'admin@novabanco.com', '00000000000', '11999999999', hashedPassword, 1);
    console.log('✅ Default admin created (admin@novabanco.com / admin123)');
  }

  console.log('✅ Database initialized successfully');
}

module.exports = { db, initializeDatabase };
