// ============================================================
// Shared Supabase client — dipakai semua Netlify Functions
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const _missingEnv = !SUPABASE_URL || !SUPABASE_KEY;

// Patch global WebSocket untuk Node < 22 agar supabase realtime tidak crash
// Kita tidak pakai realtime, tapi supabase-js tetap menginisialisasi RealtimeClient
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    // Coba pakai ws package jika tersedia
    const { WebSocket: WS } = await import('ws');
    globalThis.WebSocket = WS;
  } catch {
    // Fallback: dummy WebSocket agar tidak crash saat init
    globalThis.WebSocket = class DummyWebSocket {
      constructor() { this.readyState = 3; } // CLOSED
      close() {}
      send() {}
      addEventListener() {}
      removeEventListener() {}
    };
  }
}

export const supabase = _missingEnv
  ? null
  : createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch },
    });

export function checkEnv() {
  if (_missingEnv) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', ...cors() },
      body: JSON.stringify({
        ok: false,
        error: 'Server tidak dikonfigurasi: SUPABASE_URL atau SUPABASE_SERVICE_KEY belum diset.'
      })
    };
  }
  return null;
}

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

export function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}
