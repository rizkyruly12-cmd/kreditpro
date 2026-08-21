// ============================================================
// bootstrap.js — Single endpoint untuk load semua data sekaligus
// Login + customers + payments dalam 1 request
// Mengurangi cold start dari 3x menjadi 1x
// ============================================================
import { supabase, ok, err, cors, parseBody, checkEnv } from './_shared/supabase.js';
import crypto from 'crypto';

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

function toCustomer(r) {
  return {
    id: r.id, nama: r.nama, tgl: r.tgl, barang: r.barang,
    harga: Number(r.harga), dp: Number(r.dp),
    kreditPokok: Number(r.kredit_pokok), tenor: r.tenor,
    totalBunga: Number(r.total_bunga), bungaPct: Number(r.bunga_pct),
    noHp: r.no_hp, nik: r.nik, alamat: r.alamat, noSeri: r.no_seri,
  };
}

function toPayment(r) {
  return {
    id: r.id, customerId: r.customer_id, tgl: r.tgl,
    jumlahAngsuran: Number(r.jumlah_angsuran),
    cicilan: Number(r.cicilan), metode: r.metode, ket: r.ket,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  const envErr = checkEnv();
  if (envErr) return envErr;

  const body = parseBody(event);
  const action = event.queryStringParameters?.action || '';

  // ---- POST ?action=login — login + ambil semua data sekaligus ----
  if (event.httpMethod === 'POST' && action === 'login') {
    const { username, password } = body;
    if (!username || !password) return err('Username dan password wajib diisi');

    // Jalankan login + fetch data secara paralel
    const [userResult, customersResult, paymentsResult] = await Promise.all([
      supabase.from('auth_users').select('*').ilike('username', username).single(),
      supabase.from('customers').select('*').order('id'),
      supabase.from('payments').select('*').order('tgl', { ascending: true }),
    ]);

    const user = userResult.data;
    const incomingHash = hashPassword(password);

    if (!user || user.password_hash !== incomingHash) {
      return err('Username atau password salah', 401);
    }

    // Buat session
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    await Promise.all([
      supabase.from('auth_sessions').insert({ token, user_id: user.id, expires_at: expiresAt }),
      supabase.from('auth_users').update({ last_login: new Date().toISOString() }).eq('id', user.id),
    ]);

    return ok({
      token,
      expiresAt,
      user: {
        id: user.id, username: user.username,
        displayName: user.display_name, role: user.role, avatar: user.avatar || user.display_name[0]
      },
      customers: (customersResult.data || []).map(toCustomer),
      payments:  (paymentsResult.data  || []).map(toPayment),
    });
  }

  // ---- GET ?action=data — ambil customers + payments (sudah login) ----
  if (event.httpMethod === 'GET' && action === 'data') {
    const token = event.headers['x-session-token'];
    if (!token) return err('Unauthorized', 401);

    const { data: session } = await supabase
      .from('auth_sessions').select('user_id, expires_at').eq('token', token).single();

    if (!session || new Date(session.expires_at) < new Date()) return err('Session expired', 401);

    const [customersResult, paymentsResult] = await Promise.all([
      supabase.from('customers').select('*').order('id'),
      supabase.from('payments').select('*').order('tgl', { ascending: true }),
    ]);

    return ok({
      customers: (customersResult.data || []).map(toCustomer),
      payments:  (paymentsResult.data  || []).map(toPayment),
    });
  }

  return err('Unknown action', 404);
}
