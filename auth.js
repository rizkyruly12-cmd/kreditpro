// ============================================================
// auth.js — Frontend Auth Module (backed by server)
// Semua operasi auth memanggil /api/auth via db.js
// ============================================================

// Konstanta (harus load db.js lebih dulu)
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// ---- Hash (untuk login form — dikirim ke server) ----
function hashPassword(password) {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash) ^ password.charCodeAt(i);
    hash = hash >>> 0;
  }
  const salted = 'bk_' + hash.toString(16) + '_' + password.length + '_credit';
  let h2 = 5381;
  for (let i = 0; i < salted.length; i++) {
    h2 = ((h2 << 5) + h2) ^ salted.charCodeAt(i);
    h2 = h2 >>> 0;
  }
  return h2.toString(16).padStart(8, '0') + hash.toString(16).padStart(8, '0');
}

// ---- Login ----
async function login(username, password) {
  return DB.auth.login(username, password);
}

// ---- Logout ----
async function logout() {
  await DB.auth.logout();
}

// ---- Get current session user (sync from sessionStorage) ----
function getSession() {
  if (!DB.auth.isLoggedIn()) return null;
  const user = DB.auth.getSessionUser();
  const expires = sessionStorage.getItem('kp_expires');
  if (!user || !expires) return null;
  if (new Date(expires) < new Date()) {
    DB.auth.logout();
    return null;
  }
  return {
    userId:      user.id,
    username:    user.username,
    displayName: user.displayName,
    role:        user.role,
    avatar:      user.avatar,
    expiresAt:   new Date(expires).getTime()
  };
}

// ---- Extend session (called on activity) ----
async function extendSession() {
  const s = getSession();
  if (!s) return;
  // Verify & extend on server (silently)
  const res = await DB.auth.me();
  if (!res) {
    window.location.href = 'login.html';
  }
}

// ---- Destroy session ----
function destroySession() {
  sessionStorage.removeItem('kp_token');
  sessionStorage.removeItem('kp_user');
  sessionStorage.removeItem('kp_expires');
}

// ---- Require auth (call on every protected page load) ----
async function requireAuth() {
  // Check local session first (fast)
  if (!DB.auth.isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  // Verify with server (also extends session)
  const user = await DB.auth.me();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ---- Change password ----
async function changePassword(userId, oldPassword, newPassword) {
  const res = await DB.auth.changePassword(oldPassword, newPassword);
  if (!res) return { ok: false, reason: 'Network error' };
  if (!res.ok) return { ok: false, reason: res.error };
  return { ok: true };
}

// ---- User management ----
function getUsers() {
  // async — returns promise
  return DB.auth.getUsers();
}

function addUser(username, password, displayName, role) {
  return DB.auth.addUser(username, password, displayName, role);
}

function saveUsers() {} // no-op, managed server-side

// ---- Audit log ----
function addLog(action, username, detail) {
  // Audit logging is handled server-side in auth function
}

function getLogs() {
  return DB.auth.getLogs();
}

// ---- Lockout state (client-side only, non-critical) ----
const LOCKOUT_KEY = 'kp_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

function getAttempts() {
  try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{"count":0,"lockedUntil":0}'); }
  catch { return { count: 0, lockedUntil: 0 }; }
}

function saveAttempts(data) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
}

function isLocked() {
  return getAttempts().lockedUntil > Date.now();
}

function getLockRemaining() {
  return Math.max(0, Math.ceil((getAttempts().lockedUntil - Date.now()) / 1000));
}

function recordFailedAttempt() {
  const a = getAttempts();
  a.count++;
  if (a.count >= MAX_ATTEMPTS) { a.lockedUntil = Date.now() + LOCKOUT_MS; a.count = 0; }
  saveAttempts(a);
}

function resetAttempts() { saveAttempts({ count: 0, lockedUntil: 0 }); }

function getRemainingAttempts() { return Math.max(0, MAX_ATTEMPTS - getAttempts().count); }

// ---- Default user init (for login page — no-op now, handled by schema seed) ----
function initDefaultUser() {
  // Users are managed in Supabase — no local init needed
}
