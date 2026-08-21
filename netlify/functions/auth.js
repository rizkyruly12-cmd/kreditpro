// ============================================================
// /api/auth  — Login · Logout · Me · Change Password · Users
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession, checkEnv } from './_shared/supabase.js';
import crypto from 'crypto';

// ---- Hash (sama persis dengan auth.js frontend) ----
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
  return h2.toString(16).padStart(8,'0') + hash.toString(16).padStart(8,'0');
}

// ---- Debug: log hash untuk verifikasi ----
const ADMIN_HASH = hashPassword('admin123');
console.log('[AUTH] admin123 hash:', ADMIN_HASH);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_HOURS = 8;

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }

  const envErr = checkEnv();
  if (envErr) return envErr;

  const action = event.queryStringParameters?.action || '';
  const body   = parseBody(event);

  // ---- POST /api/auth?action=login ----
  if (event.httpMethod === 'POST' && action === 'login') {
    const { username, password } = body;
    if (!username || !password) return err('Username dan password wajib diisi');

    const { data: user } = await supabase
      .from('auth_users')
      .select('*')
      .ilike('username', username)
      .single();

    const incomingHash = hashPassword(password);
    console.log('[AUTH] login attempt for:', username, 'incoming hash:', incomingHash, 'stored hash:', user?.password_hash);

    if (!user || user.password_hash !== incomingHash) {
      return err('Username atau password salah', 401);
    }

    // Create session
    const token     = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();

    await supabase.from('auth_sessions').insert({ token, user_id: user.id, expires_at: expiresAt });
    await supabase.from('auth_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
    await supabase.from('audit_logs').insert({ action: 'login', username: user.username, detail: 'Login berhasil', user_agent: event.headers['user-agent']?.slice(0,80) });

    return ok({
      token,
      expiresAt,
      user: {
        id:          user.id,
        username:    user.username,
        displayName: user.display_name,
        role:        user.role,
        avatar:      user.avatar || user.display_name[0]
      }
    });
  }

  // ---- POST /api/auth?action=logout ----
  if (event.httpMethod === 'POST' && action === 'logout') {
    const user = await verifySession(event);
    const token = event.headers['x-session-token'];
    if (token) {
      await supabase.from('auth_sessions').delete().eq('token', token);
      if (user) await supabase.from('audit_logs').insert({ action: 'logout', username: user.username, detail: 'Logout' });
    }
    return ok({ message: 'Logged out' });
  }

  // ---- GET /api/auth?action=me ----
  if (event.httpMethod === 'GET' && action === 'me') {
    const user = await verifySession(event);
    if (!user) return err('Session tidak valid atau kadaluarsa', 401);
    // Extend session
    const token = event.headers['x-session-token'];
    const newExpiry = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
    await supabase.from('auth_sessions').update({ expires_at: newExpiry }).eq('token', token);
    return ok({ user, expiresAt: newExpiry });
  }

  // ---- POST /api/auth?action=change-password ----
  if (event.httpMethod === 'POST' && action === 'change-password') {
    const user = await verifySession(event);
    if (!user) return err('Unauthorized', 401);
    const { oldPassword, newPassword } = body;
    if (!oldPassword || !newPassword) return err('Semua field wajib');
    if (newPassword.length < 6) return err('Password minimal 6 karakter');

    const { data: dbUser } = await supabase.from('auth_users').select('password_hash').eq('id', user.id).single();
    if (dbUser.password_hash !== hashPassword(oldPassword)) return err('Password lama salah');

    await supabase.from('auth_users').update({ password_hash: hashPassword(newPassword) }).eq('id', user.id);
    await supabase.from('auth_sessions').delete().eq('user_id', user.id); // force re-login
    await supabase.from('audit_logs').insert({ action: 'change_password', username: user.username, detail: 'Password diubah' });
    return ok({ message: 'Password berhasil diubah. Silakan login ulang.' });
  }

  // ---- GET /api/auth?action=users ----
  if (event.httpMethod === 'GET' && action === 'users') {
    const user = await verifySession(event);
    if (!user) return err('Unauthorized', 401);
    const { data } = await supabase.from('auth_users').select('id,username,display_name,role,avatar,last_login,created_at').order('created_at');
    return ok(data);
  }

  // ---- POST /api/auth?action=add-user ----
  if (event.httpMethod === 'POST' && action === 'add-user') {
    const user = await verifySession(event);
    if (!user || user.role !== 'owner') return err('Hanya Owner yang bisa menambah user', 403);
    const { username, password, displayName, role } = body;
    if (!username || !password || !displayName) return err('Semua field wajib');
    if (password.length < 6) return err('Password minimal 6 karakter');

    const { data: existing } = await supabase.from('auth_users').select('id').ilike('username', username).single();
    if (existing) return err('Username sudah dipakai');

    const { data: allUsers } = await supabase.from('auth_users').select('id');
    const newId = 'U' + String((allUsers?.length || 0) + 1).padStart(3,'0');

    await supabase.from('auth_users').insert({
      id: newId, username, display_name: displayName,
      role: role || 'staff', password_hash: hashPassword(password),
      avatar: displayName[0].toUpperCase()
    });
    return ok({ message: 'User berhasil ditambahkan' }, 201);
  }

  // ---- DELETE /api/auth?action=delete-user&id=xxx ----
  if (event.httpMethod === 'DELETE' && action === 'delete-user') {
    const user = await verifySession(event);
    if (!user || user.role !== 'owner') return err('Hanya Owner yang bisa menghapus user', 403);
    const targetId = event.queryStringParameters?.id;
    if (!targetId || targetId === user.id) return err('Tidak bisa menghapus diri sendiri');
    await supabase.from('auth_sessions').delete().eq('user_id', targetId);
    await supabase.from('auth_users').delete().eq('id', targetId);
    return ok({ message: 'User dihapus' });
  }

  // ---- GET /api/auth?action=logs ----
  if (event.httpMethod === 'GET' && action === 'logs') {
    const user = await verifySession(event);
    if (!user) return err('Unauthorized', 401);
    const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    return ok(data);
  }

  return err('Unknown action', 404);
}
