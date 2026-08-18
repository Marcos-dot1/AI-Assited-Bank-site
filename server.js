require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./src/database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve static files from /public ──
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ──
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/loans', require('./src/routes/loans'));
app.use('/api/faq', require('./src/routes/faq'));
app.use('/api/contact', require('./src/routes/contact'));
app.use('/api/admin', require('./src/routes/admin'));

// ── Health check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── SPA fallback: serve index.html for non-API routes ──
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    const requestedFile = path.join(__dirname, 'public', req.path);
    const ext = path.extname(requestedFile);
    if (ext === '.html' || ext === '') {
      // Try to serve the requested .html file, fallback to index.html
      const htmlFile = ext === '' ? `${requestedFile}.html` : requestedFile;
      res.sendFile(htmlFile, (err) => {
        if (err) {
          res.sendFile(path.join(__dirname, 'public', 'index.html'));
        }
      });
    }
  }
});

// ── Initialize database and start server ──
initializeDatabase();

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   🏦 NovaBanco Server                    ║
  ║   Running on http://localhost:${PORT}       ║
  ║                                          ║
  ║   Admin: admin@novabanco.com / admin123  ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
  `);
});
