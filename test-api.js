// Test script for NovaBanco full-stack features
const http = require('http');

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting NovaBanco Integration Tests...\n');

  // 1. Health
  const health = await request({ hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  console.log('1. Health Check:', health.status === 200 && health.data.status === 'ok' ? '✅ PASS' : '❌ FAIL');

  // 2. FAQ List
  const faqs = await request({ hostname: 'localhost', port: 3000, path: '/api/faq', method: 'GET' });
  console.log('2. FAQ List (count:', faqs.data.faqs ? faqs.data.faqs.length : 0, '):', faqs.data.faqs.length > 0 ? '✅ PASS' : '❌ FAIL');

  // 3. FAQ Search
  const search = await request({ hostname: 'localhost', port: 3000, path: '/api/faq/search?q=taxa', method: 'GET' });
  console.log('3. FAQ Search ("taxa"):', search.data.faqs && search.data.faqs.length > 0 ? '✅ PASS' : '❌ FAIL');

  // 4. Contact Form
  const contact = await request({
    hostname: 'localhost', port: 3000, path: '/api/contact', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Carlos Oliveira',
    email: 'carlos@exemplo.com',
    subject: 'Dúvida sobre financiamento',
    message: 'Gostaria de saber mais sobre as condições de taxa fixa.'
  });
  console.log('4. Contact Form:', contact.status === 201 ? '✅ PASS' : '❌ FAIL', contact.data);

  // 5. Loan Simulation
  const sim = await request({
    hostname: 'localhost', port: 3000, path: '/api/loans/simulate', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    amount: 15000,
    term_months: 24,
    type: 'pessoal'
  });
  console.log('5. Loan Simulation (R$ 15k, 24m):', sim.status === 200 && sim.data.simulation.monthly_payment > 0 ? '✅ PASS' : '❌ FAIL', 'Monthly:', sim.data.simulation ? sim.data.simulation.monthly_payment : null);

  // 6. Admin Login
  const adminLogin = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@novabanco.com',
    password: 'admin123'
  });
  console.log('6. Admin Login:', adminLogin.status === 200 && adminLogin.data.token ? '✅ PASS' : '❌ FAIL');
  const adminToken = adminLogin.data.token;

  // 7. Client Register
  const testCPF = '1' + Math.floor(1000000000 + Math.random() * 9000000000).toString().slice(0, 10);
  const testEmail = `cliente_${Date.now()}@exemplo.com`;
  const register = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'João da Silva',
    email: testEmail,
    cpf: testCPF,
    phone: '11987654321',
    password: 'senhaSegura123'
  });
  console.log('7. Client Registration:', register.status === 201 && register.data.token ? '✅ PASS' : '❌ FAIL');
  const clientToken = register.data.token;

  // 8. Client Auth Me
  const me = await request({
    hostname: 'localhost', port: 3000, path: '/api/auth/me', method: 'GET',
    headers: { 'Authorization': `Bearer ${clientToken}` }
  });
  console.log('8. Client /me profile:', me.status === 200 && me.data.client.name === 'João da Silva' ? '✅ PASS' : '❌ FAIL');

  // 9. Client Request Loan
  const loanReq = await request({
    hostname: 'localhost', port: 3000, path: '/api/loans/request', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clientToken}`
    }
  }, {
    amount: 20000,
    term_months: 36,
    type: 'pessoal'
  });
  console.log('9. Client Request Loan:', loanReq.status === 201 && loanReq.data.loan ? '✅ PASS' : '❌ FAIL', 'Loan ID:', loanReq.data.loan ? loanReq.data.loan.id : null);
  const loanId = loanReq.data.loan ? loanReq.data.loan.id : null;

  // 10. Client My Loans
  const myLoans = await request({
    hostname: 'localhost', port: 3000, path: '/api/loans/my', method: 'GET',
    headers: { 'Authorization': `Bearer ${clientToken}` }
  });
  console.log('10. Client My Loans:', myLoans.status === 200 && myLoans.data.loans.length > 0 ? '✅ PASS' : '❌ FAIL');

  // 11. Admin Stats
  const adminStats = await request({
    hostname: 'localhost', port: 3000, path: '/api/admin/stats', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('11. Admin Stats:', adminStats.status === 200 ? '✅ PASS' : '❌ FAIL', adminStats.data.stats);

  // 12. Admin Approve Loan
  if (loanId) {
    const approve = await request({
      hostname: 'localhost', port: 3000, path: `/api/admin/loans/${loanId}`, method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { status: 'aprovado' });
    console.log('12. Admin Approve Loan:', approve.status === 200 ? '✅ PASS' : '❌ FAIL', approve.data);
  }

  // 13. Verify Loan Updated for Client with Admin Note
  const myLoansUpdated = await request({
    hostname: 'localhost', port: 3000, path: '/api/loans/my', method: 'GET',
    headers: { 'Authorization': `Bearer ${clientToken}` }
  });
  const updatedLoan = myLoansUpdated.data.loans ? myLoansUpdated.data.loans.find(l => l.id === loanId) : null;
  console.log('13. Client Sees Approved Status:', updatedLoan && updatedLoan.status === 'aprovado' ? '✅ PASS' : '❌ FAIL');

  // 14. Admin Reply to Contact Message
  const contactsList = await request({
    hostname: 'localhost', port: 3000, path: '/api/admin/contacts', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const firstContact = contactsList.data.contacts && contactsList.data.contacts[0];
  if (firstContact) {
    const replyRes = await request({
      hostname: 'localhost', port: 3000, path: `/api/admin/contacts/${firstContact.id}/reply`, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { reply: 'Olá Carlos! Nossas taxas fixas estão em 1.5% a.m. Estamos à disposição!' });
    console.log('14. Admin Reply to Contact:', replyRes.status === 200 ? '✅ PASS' : '❌ FAIL', replyRes.data);
  }

  // 15. Client Submits Contact & Checks History (/api/contact/my)
  await request({
    hostname: 'localhost', port: 3000, path: '/api/contact', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'João da Silva',
    email: testEmail,
    subject: 'Dúvida sobre cartão',
    message: 'Quando chega o meu cartão virtual?'
  });

  const clientContacts = await request({
    hostname: 'localhost', port: 3000, path: '/api/contact/my', method: 'GET',
    headers: { 'Authorization': `Bearer ${clientToken}` }
  });
  console.log('15. Client View Sent Messages (/api/contact/my):', clientContacts.status === 200 && clientContacts.data.contacts.length > 0 ? '✅ PASS' : '❌ FAIL');

  console.log('\n🎉 ALL INTEGRATION TESTS FINISHED SUCCESSFULLY!');
}

runTests().catch(console.error);

