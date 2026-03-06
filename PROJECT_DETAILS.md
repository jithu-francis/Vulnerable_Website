# 🔓 BreachMe — Detailed Project Documentation

> A complete breakdown of the architecture, vulnerability implementation, severity rankings, and design decisions behind the BreachMe vulnerable web application.

---

## 🏗️ Architecture Decisions

### Why Node.js + Express + SQLite?

| Choice | Reason |
|--------|--------|
| **Node.js + Express** | Lightweight, easy to understand, and most importantly — **free hosting** is widely available (Render, Glitch, Railway) |
| **SQLite (`better-sqlite3`)** | **File-based database** requiring zero setup. No MySQL/PostgreSQL servers needed. The entire DB is one auto-created file (`vulnerable.db`) |
| **EJS Templates** | Simple HTML templates with embedded JavaScript. Critical for demonstrating the XSS vulnerability through `<%-` vs `<%=` rendering |
| **Cookie-based Auth** | Intentionally insecure session management (no httpOnly, no secure flag) — part of the learning experience |

---

## 🎯 Severity Rankings — How & Why

I followed the **OWASP (Open Web Application Security Project)** severity model combined with **real-world impact assessment**.

### The Ranking Principle

| Level | Meaning |
|-------|---------|
| 🔴 **Critical** | Attacker can directly compromise the system — execute code, bypass auth, or access everything |
| 🟡 **High** | Attacker can cause significant damage but with limitations — needs user interaction or has limited scope |
| 🟢 **Medium** | Limited impact or difficult to exploit |
| ⚪ **Low** | Informational, minimal impact |

### 🔴 Critical Vulnerabilities (3)

#### 1. SQL Injection — `/login`
**Why Critical:**
- Attacker can **bypass authentication entirely** without knowing any password
- Can **read, modify, or delete the entire database**
- In real-world: leads to full data breaches (e.g., the 2017 Equifax breach affected 147 million people)
- OWASP consistently ranks injection as a top threat (A03:2021)

**Impact scope:** Full database compromise + authentication bypass

#### 2. Stored XSS — `/guestbook`
**Why Critical:**
- Script is **permanently saved** in the database
- Executes for **every single visitor** (not just one person)
- Can steal session cookies, redirect to phishing sites, completely deface the website
- "Stored" XSS is worse than "Reflected" XSS because it's persistent — the attacker plants it once and it keeps executing

**Impact scope:** All users who visit the page are affected

#### 3. Command Injection — `/tools`
**Why Critical:**
- Gives the attacker **Remote Code Execution (RCE)** — they can run *any* operating system command
- Could read files, install malware, create backdoors, pivot to other servers
- RCE is almost always rated Critical because it means **full server compromise**
- The attacker goes from "website visitor" to "server administrator"

**Impact scope:** Complete server takeover

### 🟡 High Vulnerabilities (2)

#### 4. IDOR — `/profile/:id`
**Why High (not Critical):**
- ✅ Leaks sensitive data (passwords, secrets) — that's severe
- ❌ But attacker can only **read** data, not **execute code** or **modify** the system
- ❌ Impact is limited to **information disclosure**
- Still very dangerous (leaked passwords can be used for credential stuffing)

**Impact scope:** Data exposure only, no system modification

#### 5. CSRF — `/change-password`
**Why High (not Critical):**
- ✅ Can trick users into changing their password — serious
- ❌ Requires **social engineering** — victim must visit attacker's page while logged in
- ❌ Attacker needs to know the **exact form structure**
- ❌ Impact limited to the **specific action** (password change), not full system compromise

**Impact scope:** Single action per attack, requires user interaction

---

## 🔍 Vulnerability Implementation Details

### 1. SQL Injection — String Concatenation

**Vulnerable code** (`server.js`):
```javascript
// 🔴 VULNERABLE: Direct string concatenation
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
```

**What happens with `' OR 1=1 --`:**
```sql
-- The query becomes:
SELECT * FROM users WHERE username = '' OR 1=1 --' AND password = 'anything'
-- ' closes the string early
-- OR 1=1 makes it always true (1 always equals 1)
-- -- comments out the rest (password check is skipped)
-- Result: returns the first user (admin)
```

**Safe version:**
```javascript
// ✅ SAFE: Parameterized query — ? keeps user input as DATA, not CODE
const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
```

### 2. Stored XSS — Raw HTML Rendering

**Vulnerable code** (`guestbook.ejs`):
```html
<!-- 🔴 <%- renders RAW HTML — browser treats it as real code -->
<div class="comment-body"><%- c.message %></div>
```

**The difference:**
- `<%-` → renders **raw HTML** (vulnerable — `<script>` becomes executable)
- `<%=` → **escapes** HTML (safe — `<script>` becomes `&lt;script&gt;`, displayed as text)

**What happens:** User posts `<script>alert('XSS')</script>` → saved to database → rendered as real HTML → browser executes the script for every visitor.

### 3. Command Injection — Shell Execution

**Vulnerable code** (`server.js`):
```javascript
// 🔴 VULNERABLE: execSync spawns a SHELL, so ; has special meaning
const cmd = `ping -c 2 ${target}`;
const output = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
```

**What happens with `127.0.0.1; whoami`:**
```bash
# The shell receives:
ping -c 2 127.0.0.1; whoami
# Shell interprets ; as "run next command after this one"
# So it runs: ping -c 2 127.0.0.1 AND whoami
```

**Safe version:**
```javascript
// ✅ SAFE: execFileSync does NOT use a shell — ; is just a character
execFileSync('ping', ['-c', '2', target]);
```

### 4. IDOR — Missing Authorization

**Vulnerable code** (`server.js`):
```javascript
app.get('/profile/:id', (req, res) => {
  // 🔴 Loads ANY user by ID — never checks if you're allowed to see it
  const profileUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.render('profile', { profileUser }); // Shows passwords and secrets!
});
```

**The fix would be:**
```javascript
// ✅ SAFE: Check if logged-in user owns this profile
if (req.params.id != loggedInUser.id && loggedInUser.role !== 'admin') {
  return res.status(403).send('Access denied');
}
```

### 5. CSRF — No Token Validation

**Vulnerable form** (`change-password.ejs`):
```html
<form method="POST" action="/change-password">
  <!-- 🔴 No hidden CSRF token field! Any website can submit this -->
  <input type="password" name="new_password">
  <button>Change Password</button>
</form>
```

**Vulnerable handler** (`server.js`):
```javascript
app.post('/change-password', (req, res) => {
  // 🔴 No CSRF token check, no old password required
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, user.id);
});
```

---

## 🎨 Design Decisions

### Dark Theme
Used a **cybersecurity/hacker aesthetic** — dark backgrounds (`#0a0a0f`) with purple (`#8b5cf6`) and red (`#ef4444`) accent colors. Glassmorphism effects (blur + transparency) on the navbar. This makes it feel like a legitimate security tool.

### Hint System
Each vulnerability page has a **collapsible hint box** with three sections:
1. **🧠 How it Works** — simple beginner-friendly explanation
2. **🎯 Try These** — ready-to-use attack payloads
3. **🛡️ How to Fix** — the secure code pattern

This teaches **attack AND defense** simultaneously.

### Mobile Responsive
Two CSS breakpoints:
- **768px (tablet)** — nav wraps, cards stack, profile rows stack vertically
- **480px (mobile)** — everything scales down for phone screens

### Partials Architecture
The `header.ejs` and `footer.ejs` partials are included on every page. This means:
- Navigation is consistent everywhere
- Changes (like renaming to BreachMe) only need one edit
- The copyright appears on every page automatically

---

## 📁 File Structure

```
Vulnerable_Website/
├── server.js                ← All routes & vulnerability logic
├── package.json             ← Dependencies (express, better-sqlite3, ejs, cookie-parser)
├── vulnerable.db            ← SQLite database (auto-created on first run)
├── .gitignore               ← Excludes DB, node_modules, OS files
├── ATTACK_GUIDE.md          ← Step-by-step exploitation guide with hosting instructions
├── PROJECT_DETAILS.md       ← This file — detailed technical documentation
├── public/
│   └── style.css            ← Dark theme CSS + mobile responsive breakpoints
└── views/
    ├── partials/
    │   ├── header.ejs       ← Shared nav bar (included on all pages)
    │   └── footer.ejs       ← Shared footer with copyright (included on all pages)
    ├── home.ejs             ← Landing page with vulnerability overview cards
    ├── login.ejs            ← SQL Injection target
    ├── guestbook.ejs        ← Stored XSS target
    ├── tools.ejs            ← Command Injection target
    ├── profile.ejs          ← IDOR target
    └── change-password.ejs  ← CSRF target
```

---

## 🎁 Bonus Vulnerability: API Data Leak

`/api/users` returns ALL user data as JSON with:
- ❌ No authentication required
- ❌ No rate limiting
- ❌ Passwords in plain text (not hashed)
- ❌ No access logging

This simulates a common real-world issue where developers forget to secure internal API endpoints.

---

© 2026 Jithu Francis. All rights reserved.
