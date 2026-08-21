// ============================================================
// Shared Supabase client — dipakai semua Netlify Functions
// Key disimpan aman di environment variable Netlify, tidak
// pernah terekspos ke browser.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service_role key

// Graceful check — return 503 from handler if not configured
const _missingEnv = !SUPABASE_URL || !SUPABASE_KEY;

export const supabase = _missingEnv
  ? null
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        transport: WebSocket,
      },
      global: {
        fetch: fetch,
      }
    });

// Call this at the top of each handler to short-circuit if env is missing
export function checkEnv() {
  if (_missingEnv) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', ...cors() },
      body: JSON.stringify({
        ok: false,
        error: 'Server tidak dikonfigurasi: SUPABASE_URL atau SUPABASE_SERVICE_KEY belum diset di environment variables Netlify.'
      })
    };
  }
  return null;
}

// ---- Response helpers ----
export function ok(data, status = 200) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...cors() },
    body: JSON.stringify({ ok: true, data })
  };
}

export function err(message, status = 400) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...cors() },
    body: JSON.stringify({ ok: false, error: message })
  };
}

export function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
}

// ---- Session verification ----
export async function verifySession(event) {
  const token = event.headers['x-session-token'] || event.headers['authorization']?.replace('Bearer ', '');
  if (!token) return null;

  const { data, error } = await supabase
    .from('auth_sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) {
    // expired — cleanup
    await supabase.from('auth_sessions').delete().eq('token', token);
    return null;
  }

  const { data: user } = await supabase
    .from('auth_users')
    .select('id, username, display_name, role, avatar')
    .eq('id', data.user_id)
    .single();

  return user || null;
}

// ---- Body parser ----
export function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}
