/* =========================================================
   LEGEND — сервер сайта
   Регистрация с подтверждением почты, вход, сброс пароля
   по кодам, защищённые сессии.

   Защита:
   - пароли хранятся только как scrypt-хеш + соль
   - коды писем хранятся как sha256-хеш, живут 10 минут,
     сгорают после 5 неверных попыток и после использования
   - лимиты запросов по IP и по e-mail (антибрутфорс)
   - сессии — токен 256 бит в HttpOnly+SameSite cookie
   - безопасные заголовки (CSP, X-Frame-Options и т.д.)
   - одинаковые ответы на «нет такого e-mail» при сбросе
   ========================================================= */
'use strict';

const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ---------- .env (без лишних зависимостей) ---------- */
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT || 8787);
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mail.ru';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const DEBUG_PRINT_CODE = process.env.DEBUG_PRINT_CODE === '1';

const CODE_TTL_MS = 10 * 60 * 1000;   // код живёт 10 минут
const CODE_MAX_TRIES = 5;             // неверных попыток до сжигания кода
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

/* ---------- хранилище (файл data/users.json) ---------- */
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [], sessions: [], codes: [] }; }
}
function saveDb(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

/* ---------- крипто ---------- */
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, expectedHash) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/* ---------- антибрутфорс ---------- */
const buckets = new Map();
function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  const blocked = hits.length >= limit;
  if (!blocked) hits.push(now);
  buckets.set(key, hits);
  return blocked;
}

/* ---------- почта ---------- */
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
});

function codeEmail({ title, code, note }) {
  const html = `
  <div style="margin:0;padding:32px 16px;background:#0f1411;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#171f19;border:1px solid #26302a;border-radius:18px;padding:36px 32px">
      <div style="font-size:13px;letter-spacing:2px;color:#a3e635;font-weight:bold">LEGEND LAUNCHER</div>
      <h1 style="margin:16px 0 8px;font-size:22px;color:#edf2ea">${title}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#9aa89c">${note}</p>
      <div style="background:#0f1411;border:1px solid #26302a;border-radius:14px;padding:22px;text-align:center">
        <div style="font-size:11px;letter-spacing:2px;color:#9aa89c;margin-bottom:10px">ТВОЙ КОД</div>
        <div style="font-size:38px;letter-spacing:12px;font-weight:bold;color:#a3e635">${code}</div>
      </div>
      <p style="margin:22px 0 0;font-size:12.5px;line-height:1.6;color:#6f7c72">
        Код действует 10 минут. Если ты не запрашивал письмо — просто проигнорируй его, с аккаунтом ничего не случится.
      </p>
    </div>
  </div>`;
  const text = `${title}\n\nКод: ${code}\n\n${note}\nКод действует 10 минут.`;
  return { subject: title, html, text };
}

async function sendCodeMail(email, code, kind) {
  const mail = kind === 'reset'
    ? codeEmail({ title: 'Сброс пароля LEGEND', code, note: 'Ты запросил сброс пароля. Введи этот код, чтобы задать новый пароль.' })
    : codeEmail({ title: 'Подтверждение почты LEGEND', code, note: 'Остался последний шаг — введи этот код, чтобы подтвердить почту и активировать аккаунт.' });
  await transporter.sendMail({ from: `"LEGEND" <${SMTP_FROM}>`, to: email, ...mail });
}

function makeCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function issueCode(db, email, type) {
  const code = makeCode();
  // старые коды этого типа для этой почты сгорают
  db.codes = db.codes.filter((c) => !(c.email === email && c.type === type));
  db.codes.push({
    type,
    email,
    codeHash: sha256(code),
    expiresAt: Date.now() + CODE_TTL_MS,
    tries: 0
  });
  return code;
}

function checkCode(db, email, type, code) {
  const rec = db.codes.find((c) => c.email === email && c.type === type);
  if (!rec) return { ok: false, reason: 'Код не найден или уже использован' };
  if (rec.expiresAt < Date.now()) {
    db.codes = db.codes.filter((c) => c !== rec);
    return { ok: false, reason: 'Срок действия кода истёк — запроси новый' };
  }
  if (rec.tries >= CODE_MAX_TRIES) {
    db.codes = db.codes.filter((c) => c !== rec);
    return { ok: false, reason: 'Слишком много попыток — запроси новый код' };
  }
  rec.tries += 1;
  const valid = crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(rec.codeHash));
  if (!valid) {
    const left = CODE_MAX_TRIES - rec.tries;
    return { ok: false, reason: `Неверный код, попыток осталось: ${left}` };
  }
  db.codes = db.codes.filter((c) => c !== rec); // код одноразовый
  return { ok: true };
}

/* ---------- сессии ---------- */
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function createSession(db, userId, res, req) {
  const token = randomToken();
  db.sessions = db.sessions.filter((s) => s.userId !== userId); // одна сессия на аккаунт
  db.sessions.push({ tokenHash: sha256(token), userId, createdAt: Date.now() });
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie',
    `legend_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`);
}

function currentUser(req, db) {
  const token = parseCookies(req).legend_session;
  if (!token) return null;
  const sess = db.sessions.find((s) => s.tokenHash === sha256(token));
  if (!sess) return null;
  return db.users.find((u) => u.id === sess.userId) || null;
}

/* ---------- приложение ---------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// безопасные заголовки
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const okUser = (u) => ({ nickname: u.nickname, email: u.email, joined: u.createdAt });

const asyncRoute = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch(() => {
  if (!res.headersSent) res.status(500).json({ error: 'Что-то пошло не так, попробуй позже' });
});

/* ---------- API ---------- */

// Регистрация: создаём аккаунт (неактивным) и шлём код на почту
app.post('/api/register', asyncRoute(async (req, res) => {
  const ip = req.ip;
  if (rateLimited(`reg:ip:${ip}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много запросов, подожди пару минут' });
  }

  const nickname = String(req.body.nickname || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (nickname.length < 3 || nickname.length > 16) return res.status(400).json({ error: 'Никнейм — от 3 до 16 символов' });
  if (!emailRe.test(email) || email.length > 120) return res.status(400).json({ error: 'Проверь e-mail' });
  if (password.length < 6 || password.length > 100) return res.status(400).json({ error: 'Пароль — минимум 6 символов' });

  const db = loadDb();
  if (db.users.some((u) => u.email === email)) return res.status(400).json({ error: 'Такой e-mail уже зарегистрирован' });
  if (db.users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) return res.status(400).json({ error: 'Такой никнейм уже занят' });

  const { salt, hash } = hashPassword(password);
  db.users.push({
    id: randomToken(),
    nickname,
    email,
    salt,
    hash,
    verified: false,
    createdAt: new Date().toISOString()
  });

  const code = issueCode(db, email, 'verify');
  saveDb(db);

  try {
    await sendCodeMail(email, code, 'verify');
  } catch {
    return res.status(502).json({ error: 'Не получилось отправить письмо, попробуй позже' });
  }
  if (DEBUG_PRINT_CODE) console.log(`[DEBUG] код подтверждения для ${email}: ${code}`);
  res.json({ ok: true, needVerify: true, email });
}));

// Подтверждение кода из письма → аккаунт активен + вход
app.post('/api/verify', asyncRoute(async (req, res) => {
  const ip = req.ip;
  if (rateLimited(`verify:ip:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много запросов, подожди пару минут' });
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  if (!emailRe.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Введи код из письма' });

  const db = loadDb();
  const result = checkCode(db, email, 'verify', code);
  if (!result.ok) { saveDb(db); return res.status(400).json({ error: result.reason }); }

  const user = db.users.find((u) => u.email === email);
  if (!user) { saveDb(db); return res.status(400).json({ error: 'Код не найден или уже использован' }); }
  user.verified = true;
  createSession(db, user.id, res, req);
  saveDb(db);
  res.json({ ok: true, user: okUser(user) });
}));

// Вход
app.post('/api/login', asyncRoute(async (req, res) => {
  const ip = req.ip;
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (rateLimited(`login:ip:${ip}`, 20, 15 * 60 * 1000) || rateLimited(`login:mail:${email}`, 8, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много попыток входа, подожди пару минут' });
  }

  const db = loadDb();
  const user = db.users.find((u) => u.email === email);
  // одинаковый ответ на «нет юзера» и «не тот пароль»
  if (!user || !verifyPassword(password, user.salt, user.hash)) {
    return res.status(400).json({ error: 'Неверный e-mail или пароль' });
  }
  if (!user.verified) {
    if (!rateLimited(`resend:${email}`, 3, 15 * 60 * 1000)) {
      const code = issueCode(db, email, 'verify');
      saveDb(db);
      try { await sendCodeMail(email, code, 'verify'); } catch { /* молча */ }
      if (DEBUG_PRINT_CODE) console.log(`[DEBUG] код подтверждения для ${email}: ${code}`);
    } else {
      saveDb(db);
    }
    return res.status(403).json({ error: 'Почта ещё не подтверждена — мы отправили код ещё раз', needVerify: true, email });
  }

  createSession(db, user.id, res, req);
  saveDb(db);
  res.json({ ok: true, user: okUser(user) });
}));

// Текущий пользователь
app.get('/api/me', (req, res) => {
  const db = loadDb();
  const user = currentUser(req, db);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: okUser(user) });
});

// Выход
app.post('/api/logout', (req, res) => {
  const db = loadDb();
  const token = parseCookies(req).legend_session;
  if (token) db.sessions = db.sessions.filter((s) => s.tokenHash !== sha256(token));
  saveDb(db);
  res.setHeader('Set-Cookie', 'legend_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});

// Сброс пароля, шаг 1: просим код (всегда одинаковый ответ — не выдаём, есть ли аккаунт)
app.post('/api/reset/request', asyncRoute(async (req, res) => {
  const ip = req.ip;
  const email = String(req.body.email || '').trim().toLowerCase();
  if (rateLimited(`reset:ip:${ip}`, 10, 15 * 60 * 1000) || rateLimited(`reset:mail:${email}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много запросов, подожди пару минут' });
  }
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Проверь e-mail' });

  const db = loadDb();
  const user = db.users.find((u) => u.email === email);
  if (user) {
    const code = issueCode(db, email, 'reset');
    saveDb(db);
    try {
      await sendCodeMail(email, code, 'reset');
      if (DEBUG_PRINT_CODE) console.log(`[DEBUG] код сброса для ${email}: ${code}`);
    } catch { /* молча */ }
  } else {
    saveDb(db);
  }
  res.json({ ok: true }); // раскрываем одинаковый ответ
}));

// Сброс пароля, шаг 2: код + новый пароль
app.post('/api/reset/confirm', asyncRoute(async (req, res) => {
  const ip = req.ip;
  if (rateLimited(`resetc:ip:${ip}`, 20, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много запросов, подожди пару минут' });
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '').trim();
  const password = String(req.body.password || '');

  if (!emailRe.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Введи код из письма' });
  if (password.length < 6 || password.length > 100) return res.status(400).json({ error: 'Новый пароль — минимум 6 символов' });

  const db = loadDb();
  const result = checkCode(db, email, 'reset', code);
  if (!result.ok) { saveDb(db); return res.status(400).json({ error: result.reason }); }

  const user = db.users.find((u) => u.email === email);
  if (!user) { saveDb(db); return res.status(400).json({ error: 'Код не найден или уже использован' }); }

  const { salt, hash } = hashPassword(password);
  user.salt = salt;
  user.hash = hash;
  user.verified = true;
  db.sessions = db.sessions.filter((s) => s.userId !== user.id); // все старые сессии сгорают
  createSession(db, user.id, res, req);
  saveDb(db);
  res.json({ ok: true, user: okUser(user) });
}));

// Повторная отправка кода
app.post('/api/resend', asyncRoute(async (req, res) => {
  const ip = req.ip;
  const email = String(req.body.email || '').trim().toLowerCase();
  const type = req.body.type === 'reset' ? 'reset' : 'verify';
  if (rateLimited(`resend2:ip:${ip}`, 6, 15 * 60 * 1000) || rateLimited(`resend2:mail:${email}`, 3, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком часто, подожди пару минут' });
  }

  const db = loadDb();
  const user = db.users.find((u) => u.email === email);
  if (!user) return res.json({ ok: true }); // не раскрываем информацию
  if (type === 'verify' && user.verified) return res.json({ ok: true });

  const code = issueCode(db, email, type);
  saveDb(db);
  try {
    await sendCodeMail(email, code, type);
    if (DEBUG_PRINT_CODE) console.log(`[DEBUG] код (${type}) для ${email}: ${code}`);
  } catch { /* молча */ }
  res.json({ ok: true });
}));

/* ---------- скачивание клиента (только для авторизованных) ---------- */
const PRIVATE_DIR = path.join(__dirname, 'private');

app.get('/api/download', (req, res) => {
  const db = loadDb();
  const user = currentUser(req, db);
  if (!user) return res.redirect('/?dl=auth');

  if (rateLimited(`dl:user:${user.id}`, 20, 60 * 60 * 1000)) {
    return res.redirect('/?dl=limit');
  }

  let name = process.env.CLIENT_FILE;
  if (!name) {
    try {
      name = fs.readdirSync(PRIVATE_DIR).find((f) => f.toLowerCase() !== 'readme.txt');
    } catch { /* папки нет */ }
  }
  const file = name ? path.join(PRIVATE_DIR, name) : null;
  if (!file || !fs.existsSync(file)) return res.redirect('/?dl=missing');

  res.download(file, name);
});

/* ---------- статика сайта ---------- */
// служебные файлы и приватная папка извне не видны
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  if (
    p.startsWith('/private') || p.startsWith('/data') ||
    p === '/.env' || p === '/server.js' || p === '/package.json' ||
    p === '/package-lock.json' || p === '/.gitignore' || p.endsWith('/users.json')
  ) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'ignore' }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

app.listen(PORT, () => {
  console.log(`LEGEND сайт запущен: http://localhost:${PORT}`);
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('ВНИМАНИЕ: SMTP не настроен — письма с кодами уходить не будут (заполни .env)');
  }
  if (DEBUG_PRINT_CODE) {
    console.log('DEBUG_PRINT_CODE=1 — коды печатаются в консоль. В бою выключи!');
  }
});
