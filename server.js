const express = require('express');
const Database = require('better-sqlite3');
const cookieParser = require('cookie-parser');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Setup (SQLite) ─────────────────────────────
const db = new Database(path.join(__dirname, 'vulnerable.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'user',
    secret_note TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS guestbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default users (only if table is empty)
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (username, password, email, role, secret_note) VALUES (?, ?, ?, ?, ?)'
  );
  insertUser.run('admin', 'admin123', 'admin@vulnsite.com', 'admin', 'The admin secret key is: SUPERSECRET-2026-ADMIN');
  insertUser.run('john', 'password1', 'john@example.com', 'user', 'John keeps his Bitcoin wallet seed phrase here: abandon ability able ...');
  insertUser.run('alice', 'letmein', 'alice@example.com', 'user', 'Alice\'s private diary: I secretly love hacking CTFs!');
  insertUser.run('bob', 'qwerty', 'bob@example.com', 'user', 'Bob\'s bank PIN: 4521');
}

// Seed a guestbook entry
const gbCount = db.prepare('SELECT COUNT(*) as count FROM guestbook').get();
if (gbCount.count === 0) {
  db.prepare('INSERT INTO guestbook (name, message) VALUES (?, ?)').run(
    'Welcome Bot',
    'Welcome to the guestbook! Feel free to leave a message. 🎉'
  );
}

// ─── Simple session via cookies (intentionally insecure) ──
function getLoggedInUser(req) {
  const userId = req.cookies.userId;
  if (!userId) return null;
  try {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════

// ─── Home ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  const user = getLoggedInUser(req);
  res.render('home', { user });
});

// ─── LOGIN (Vulnerability #1: SQL Injection) ─────────────
app.get('/login', (req, res) => {
  const user = getLoggedInUser(req);
  res.render('login', { user, error: null, success: null });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // 🔴 VULNERABLE: Direct string concatenation in SQL query
  // A safe version would use parameterized queries: db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password)
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  try {
    const user = db.prepare(query).get();
    if (user) {
      // Set insecure cookie (no httpOnly, no secure flag)
      res.cookie('userId', user.id, { httpOnly: false });
      res.render('login', { user, error: null, success: `Welcome back, ${user.username}!` });
    } else {
      res.render('login', { user: null, error: 'Invalid username or password', success: null });
    }
  } catch (err) {
    // 🔴 VULNERABLE: Exposing raw SQL errors to the user
    res.render('login', { user: null, error: `Database error: ${err.message}`, success: null });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.redirect('/');
});

// ─── GUESTBOOK (Vulnerability #2: Stored XSS) ───────────
app.get('/guestbook', (req, res) => {
  const user = getLoggedInUser(req);
  const comments = db.prepare('SELECT * FROM guestbook ORDER BY created_at DESC').all();
  res.render('guestbook', { user, comments });
});

app.post('/guestbook', (req, res) => {
  const { name, message } = req.body;

  // 🔴 VULNERABLE: Storing user input without any sanitization
  // The message will be rendered as raw HTML in the template (using <%- %> instead of <%= %>)
  db.prepare('INSERT INTO guestbook (name, message) VALUES (?, ?)').run(name, message);
  res.redirect('/guestbook');
});

// Delete guestbook comment (admin only)
app.post('/guestbook/delete/:id', (req, res) => {
  const user = getLoggedInUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).send('Only admins can delete comments');
  }
  db.prepare('DELETE FROM guestbook WHERE id = ?').run(req.params.id);
  res.redirect('/guestbook');
});

// ─── NETWORK TOOLS (Vulnerability #3: Command Injection) ─
app.get('/tools', (req, res) => {
  const user = getLoggedInUser(req);
  res.render('tools', { user, output: null, target: '' });
});

app.post('/tools', (req, res) => {
  const user = getLoggedInUser(req);
  const { target } = req.body;

  // 🔴 VULNERABLE: Directly passing user input to OS command
  // A safe version would validate the input is a valid IP/hostname first
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? `ping -n 2 ${target}` : `ping -c 2 ${target}`;
    const output = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
    res.render('tools', { user, output, target });
  } catch (err) {
    res.render('tools', { user, output: err.message || 'Command failed', target });
  }
});

// ─── FILE VIEWER (Vulnerability #6: Local File Inclusion / Path Traversal) ─
app.get('/read', (req, res) => {
  const user = getLoggedInUser(req);
  const file = req.query.file;

  if (!file) {
    return res.render('files', { user, selectedFile: '', content: null, error: null });
  }

  // 🔴 VULNERABLE: No path validation/sanitization
  // Allows directory traversal (e.g. ?file=../server.js)
  try {
    const filePath = path.join(__dirname, 'public', file);
    const content = fs.readFileSync(filePath, 'utf-8');
    res.render('files', { user, selectedFile: file, content, error: null });
  } catch (err) {
    res.render('files', { user, selectedFile: file, content: null, error: `Error reading file: ${err.message}` });
  }
});

// ─── WEB FETCHER (Vulnerability #7: Server-Side Request Forgery) ─
app.get('/proxy', (req, res) => {
  const user = getLoggedInUser(req);
  res.render('proxy', { user, url: '', result: null, error: null });
});

app.post('/proxy', async (req, res) => {
  const user = getLoggedInUser(req);
  const targetUrl = req.body.url;

  // 🔴 VULNERABLE: No validation on target URL
  // The server blindly requests the URL. Allows reaching internal endpoints.
  try {
    const response = await fetch(targetUrl);
    const result = await response.text();
    res.render('proxy', { user, url: targetUrl, result, error: null });
  } catch (err) {
    res.render('proxy', { user, url: targetUrl, result: null, error: `Fetch failed: ${err.message}` });
  }
});

// ─── PROFILE (Vulnerability #4: IDOR) ────────────────────
app.get('/profile/:id', (req, res) => {
  const loggedInUser = getLoggedInUser(req);
  const { id } = req.params;

  // 🔴 VULNERABLE: No authorization check — any user can view any profile
  // A safe version would verify that the logged-in user owns this profile
  const profileUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

  if (!profileUser) {
    return res.status(404).render('profile', { user: loggedInUser, profileUser: null, error: 'User not found' });
  }

  res.render('profile', { user: loggedInUser, profileUser, error: null });
});

// ─── CHANGE PASSWORD (Vulnerability #5: CSRF) ────────────
app.get('/change-password', (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.redirect('/login');
  res.render('change-password', { user, error: null, success: null });
});

app.post('/change-password', (req, res) => {
  const user = getLoggedInUser(req);
  if (!user) return res.redirect('/login');

  const { new_password } = req.body;

  // 🔴 VULNERABLE: No CSRF token validation, no old password verification
  // A safe version would require a CSRF token AND the user's current password
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, user.id);

  // Refresh user data after update
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.render('change-password', { user: updatedUser, error: null, success: 'Password changed successfully!' });
});

// ─── API: List users (bonus info leak) ───────────────────
app.get('/api/users', (req, res) => {
  // 🔴 VULNERABLE: Exposes all user data including passwords
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

// ─── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔓 BreachMe — Vulnerable Website running at http://localhost:${PORT}`);
  console.log(`⚠️  This app is INTENTIONALLY INSECURE — for educational use only!\n`);
});
