# 🔓 BreachMe — Vulnerable Web Application

> A deliberately insecure web application built for **cybersecurity learning**. Practice exploiting real vulnerabilities in a safe environment.

> ⚠️ **DISCLAIMER**: This application is **intentionally vulnerable**. It must **never** be deployed on a production server. For **educational and ethical hacking purposes only**. Only attack systems you own or have explicit permission to test.
>
> 🚨 **PUBLIC HOSTING WARNING**: If you are hosting this on a public IP, **BE CAREFUL!** Since it features Command Injection (RCE), SSRF, and LFI, anyone on the internet can get a shell on your container, read sensitive files, or use your server to scan your internal network. **Ensure it is heavily isolated** using Docker, unprivileged users, and strict firewall rules to prevent outgoing traffic (so attackers can't pivot internally).

---

## 🔧 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# → http://localhost:3000
```

### Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| john | password1 | User |
| alice | letmein | User |
| bob | qwerty | User |

---

## 📁 File Structure

```
Vulnerable_Website/
├── server.js                ← All routes & vulnerability logic
├── package.json             ← Dependencies (express, better-sqlite3, ejs, cookie-parser)
├── vulnerable.db            ← SQLite database (auto-created on first run)
├── .gitignore               ← Excludes DB, node_modules, OS files
├── README.md                ← This file — complete documentation
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
    ├── files.ejs            ← Local File Inclusion (LFI) target
    ├── proxy.ejs            ← Server-Side Request Forgery (SSRF) target
    ├── profile.ejs          ← IDOR target
    └── change-password.ejs  ← CSRF target
```

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

## 📖 How This Website Works

This is a **deliberately vulnerable** web application. Think of it like a practice target at a shooting range — it's designed to be attacked so you can learn how real vulnerabilities work.

The website is built with:
- **Node.js** — runs the server (like the brain of the website)
- **Express** — handles URL routes (decides what to show when you visit a page)
- **SQLite** — stores data like usernames, passwords, and comments (a simple database)
- **EJS** — creates the HTML pages (templates that mix code with HTML)

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

# 🎯 Attack Guide

---

## Vulnerability #1: SQL Injection

### 📍 Where: Login Page (`/login`)

### 🧠 What is SQL Injection? (Simple Explanation)

Think of it like this: The website creates a **question to ask the database**:

```
"Hey database, is there a user with name 'john' AND password 'password1'?"
```

The code looks like this:
```sql
SELECT * FROM users WHERE username = 'john' AND password = 'password1'
```

But the website **doesn't check what you type**. So if you type `' OR 1=1 --` as your username, the question becomes:

```sql
SELECT * FROM users WHERE username = '' OR 1=1 --' AND password = 'anything'
```

- `' ` — closes the username string early
- `OR 1=1` — makes the condition always true (1 always equals 1!)
- `--` — comments out the rest (the password check is ignored)

**Result**: The database returns the first user (admin), and you're logged in!

### 🎮 Try These Attacks

| Username | Password | What happens |
|----------|----------|-------------|
| `' OR 1=1 --` | anything | Login as admin (first user in DB) |
| `' OR username='alice' --` | anything | Login specifically as alice |
| `admin'--` | anything | Login as admin by commenting out password check |

### 🔍 Vulnerable Code (`server.js`)

```javascript
// 🔴 VULNERABLE: Direct string concatenation
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
```

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (string concatenation)
const query = `SELECT * FROM users WHERE username = '${username}'`;

// ✅ SAFE (parameterized query — ? keeps user input as DATA, not CODE)
const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
```

---

## Vulnerability #2: Stored XSS (Cross-Site Scripting)

### 📍 Where: Guestbook Page (`/guestbook`)

### 🧠 What is Stored XSS? (Simple Explanation)

Imagine writing a comment on a website. Normally, you write text like "Hello!". But what if you write **JavaScript code** instead? If the website doesn't clean your input, it saves your code in the database and **runs it on every visitor's browser**.

It's like leaving a booby trap that triggers for everyone who reads the page.

### 🎮 Try These Attacks

1. **Basic Alert Box** — Post this as a message:
   ```html
   <script>alert('You have been hacked!')</script>
   ```
   Every visitor will see a popup alert.

2. **Cookie Stealing** — Post this (while logged in):
   ```html
   <script>alert('Your cookies: ' + document.cookie)</script>
   ```
   This shows the victim's session cookies. A real attacker would send these to their own server.

3. **Page Defacement** — Post this:
   ```html
   <script>document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:200px">HACKED BY YOU!</h1>'</script>
   ```
   Replaces the entire page content.

4. **Fake Login Form** — Post this:
   ```html
   <div style="background:#111;padding:20px;border-radius:10px">
     <h3 style="color:white">Session Expired! Please re-login:</h3>
     <input placeholder="Username" style="display:block;margin:5px 0;padding:8px;width:100%">
     <input type="password" placeholder="Password" style="display:block;margin:5px 0;padding:8px;width:100%">
     <button style="padding:8px 20px;background:#8b5cf6;color:white;border:none;border-radius:5px;cursor:pointer">Login</button>
   </div>
   ```
   Creates a convincing fake login form to phish credentials.

### 🔍 Vulnerable Code (`guestbook.ejs`)

```html
<!-- 🔴 <%- renders RAW HTML — browser treats it as real code -->
<div class="comment-body"><%- c.message %></div>
```

**The difference:**
- `<%-` → renders **raw HTML** (vulnerable — `<script>` becomes executable)
- `<%=` → **escapes** HTML (safe — `<script>` becomes `&lt;script&gt;`, displayed as text)

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (renders raw HTML in EJS)
<%- userMessage %>

// ✅ SAFE (auto-escapes HTML characters)
<%= userMessage %>
// Turns <script> into &lt;script&gt; which displays as text, not code
```

---

## Vulnerability #3: Command Injection

### 📍 Where: Network Tools Page (`/tools`)

### 🧠 What is Command Injection? (Simple Explanation)

The website has a "ping" tool. When you type `google.com`, the server runs:
```bash
ping -c 2 google.com
```

But you can type a **semicolon** `;` to chain another command:
```bash
ping -c 2 google.com; whoami
```
The server runs BOTH commands: the ping AND `whoami`. You now have **remote code execution** — you can run any command on the server!

### 🎮 Try These Attacks

| Enter in the ping box | What it does |
|-----------------------|-------------|
| `127.0.0.1; whoami` | Shows who the server is running as |
| `127.0.0.1; ls -la` | Lists all files in the server directory |
| `127.0.0.1; cat server.js` | Reads the entire server source code! |
| `127.0.0.1; cat /etc/passwd` | Reads the system's user list |
| `127.0.0.1; env` | Shows environment variables (may contain API keys) |
| `127.0.0.1; uname -a` | Shows operating system information |
| `127.0.0.1 \| id` | Shows user/group information (using pipe instead of semicolon) |

### 🔍 Vulnerable Code (`server.js`)

```javascript
// 🔴 VULNERABLE: execSync spawns a SHELL, so ; has special meaning
const cmd = `ping -c 2 ${target}`;
const output = execSync(cmd, { timeout: 10000, encoding: 'utf-8' });
```

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (user input in shell command)
execSync(`ping -c 2 ${userInput}`);

// ✅ SAFE (validate input, no shell)
if (/^[a-zA-Z0-9.\-]+$/.test(userInput)) {
  execFileSync('ping', ['-c', '2', userInput]); // execFileSync doesn't use a shell
}
```

---

## Vulnerability #4: IDOR (Insecure Direct Object Reference)

### 📍 Where: Profile Page (`/profile/:id`)

### 🧠 What is IDOR? (Simple Explanation)

When you're logged in, your profile URL is `/profile/1` (if your user ID is 1). The website loads the user with **whatever ID is in the URL** — it never checks if that's actually YOUR profile.

So you just change the number and see **anyone's data**, including their password and secret notes!

### 🎮 Try These Attacks

1. Login with any account (e.g., `john` / `password1`)
2. Visit your profile — notice the URL says `/profile/2`
3. Now change the URL to:
   - `/profile/1` → **Admin's profile** (has a secret admin key!)
   - `/profile/3` → Alice's profile
   - `/profile/4` → Bob's profile (has his bank PIN!)
4. You can see everyone's **password**, **email**, and **secret notes**

### 🔍 Vulnerable Code (`server.js`)

```javascript
app.get('/profile/:id', (req, res) => {
  // 🔴 Loads ANY user by ID — never checks if you're allowed to see it
  const profileUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.render('profile', { profileUser }); // Shows passwords and secrets!
});
```

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (no authorization check)
app.get('/profile/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.render('profile', { user }); // Shows anyone's data!
});

// ✅ SAFE (verify ownership)
app.get('/profile/:id', (req, res) => {
  if (req.params.id != loggedInUser.id && loggedInUser.role !== 'admin') {
    return res.status(403).send('Access denied');
  }
  // ... proceed only if authorized
});
```

---

## Vulnerability #5: CSRF (Cross-Site Request Forgery)

### 📍 Where: Change Password Page (`/change-password`)

### 🧠 What is CSRF? (Simple Explanation)

Imagine you're logged into BreachMe. An attacker sends you a link to their website. When you visit it, their page contains a **hidden form** that automatically submits a password change request to BreachMe.

Your browser **automatically includes your cookies** (because you're logged in to BreachMe), so the server thinks it's a legitimate request from you. Your password is changed without you knowing!

### 🎮 Try This Attack

1. **Login** to BreachMe in your browser
2. **Create a file** called `csrf_attack.html` on your computer with this content:

```html
<!DOCTYPE html>
<html>
<head><title>You Won a Prize!</title></head>
<body>
  <h1>🎉 Congratulations! Click to claim your prize!</h1>
  <!-- This secretly changes the victim's password -->
  <form method="POST" action="http://localhost:3000/change-password" id="csrf-form">
    <input type="hidden" name="new_password" value="hacked123">
  </form>
  <script>
    // Automatically submit the form when the page loads
    document.getElementById('csrf-form').submit();
  </script>
</body>
</html>
```

3. **Open** `csrf_attack.html` in the same browser where you're logged in
4. Your password is now `hacked123`! Try logging out and logging back in with the old password — it won't work.

### 🔍 Vulnerable Code

**Form** (`change-password.ejs`):
```html
<form method="POST" action="/change-password">
  <!-- 🔴 No hidden CSRF token field! Any website can submit this -->
  <input type="password" name="new_password">
  <button>Change Password</button>
</form>
```

**Handler** (`server.js`):
```javascript
app.post('/change-password', (req, res) => {
  // 🔴 No CSRF token check, no old password required
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(new_password, user.id);
});
```

### 🛡️ How to Fix

```javascript
// ✅ SAFE: Generate a CSRF token per session
app.get('/change-password', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session.csrfToken = csrfToken;
  res.render('change-password', { csrfToken });
});

app.post('/change-password', (req, res) => {
  if (req.body.csrfToken !== req.session.csrfToken) {
    return res.status(403).send('CSRF token invalid');
  }
  // Also require the CURRENT password before changing
});
```

---

## Vulnerability #6: Local File Inclusion (LFI) / Path Traversal

### 📍 Where: File Viewer Page (`/read`)

### 🧠 What is LFI / Path Traversal? (Simple Explanation)

The application has a feature to read and display a file from its `public` folder. However, it takes the filename you give it and blindly puts it at the end of the directory path: `/app/public/` + `YOUR_FILE`.

If you use `../`, which means "go up one directory folder", you can escape the `public` folder and read anything on the system!

### 🎮 Try These Attacks

| Enter in the file box | What it does |
|-----------------------|-------------|
| `style.css` | Normal usage, reads the safe public file |
| `../package.json` | Breaks out of `public/` and reads project dependencies |
| `../server.js` | Reads the entire backend source code |
| `../../../../../../etc/passwd` | Reads the Linux system users file |
| `../vulnerable.db` | Dumps the exact SQLite database |

### 🔍 Vulnerable Code (`server.js`)

```javascript
// 🔴 VULNERABLE: Directly using user input to form file paths
const filePath = path.join(__dirname, 'public', file);
const content = fs.readFileSync(filePath, 'utf-8');
```

### 🛡️ How to Fix

Ensure the resulting path is actually inside the directory you intended:

```javascript
// ✅ SAFE: Resolve the path and verify it starts with the target directory
const targetDir = path.resolve(__dirname, 'public');
const filePath = path.resolve(targetDir, file);

if (!filePath.startsWith(targetDir)) {
  return res.status(403).send('Directory traversal detected');
}
```

---

## Vulnerability #7: Server-Side Request Forgery (SSRF)

### 📍 Where: Web Fetcher Page (`/proxy`)

### 🧠 What is SSRF? (Simple Explanation)

The application has a feature to fetch an external website and display it to you. Usually, you provide `https://google.com`. But what if you provide an **internal** address, like `http://localhost:3000` or `http://192.168.1.1`?

Because the **server** is the one making the request, it can talk to internal tools, APIs, and databases that are normally blocked from the outside internet by firewalls!

### 🎮 Try These Attacks

| Enter in the url box | What it does |
|----------------------|-------------|
| `http://localhost:3000/api/users` | Reads the internal app's API without being constrained by browser CORS |
| `http://127.0.0.1:3000/profile/1` | Views pages bypassing standard IP location firewalls (looks like a local user) |
| `http://169.254.169.254/latest/meta-data/` | If hosted on AWS, reads secret cloud instance metadata! |
| `file:///etc/passwd` | (If `fetch` or the client library allowed files) Reads system files |

### 🔍 Vulnerable Code (`server.js`)

```javascript
// 🔴 VULNERABLE: Blindly requesting whatever URL the user provided
const response = await fetch(targetUrl);
const result = await response.text();
```

### 🛡️ How to Fix

You must parse the URL and verify that it doesn't resolve to private or loopback IP blocks!

```javascript
// ✅ SAFE: Basic protection approach
const parsedUrl = new URL(targetUrl);
if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
  throw new Error("Local addresses are blocked!");
}
// Note: Robust protection requires checking the IP *after* DNS resolution 
// to prevent DNS rebinding attacks.
```

---

## 🎁 Bonus: Hidden API Data Leak

### 📍 Where: `/api/users`

Visit `http://localhost:3000/api/users` in your browser. It returns **ALL user data as JSON**, including usernames, passwords, emails, and secret notes. This endpoint has:
- ❌ No authentication required
- ❌ No rate limiting
- ❌ Passwords stored in plain text (not hashed)
- ❌ No access logging

This simulates a common real-world issue where developers forget to secure internal API endpoints.


---

© 2026 Jithu Francis. All rights reserved.
