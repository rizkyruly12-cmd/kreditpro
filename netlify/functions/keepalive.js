// ============================================================
// keepalive.js — Scheduled function untuk mencegah Supabase
// auto-pause. Berjalan otomatis setiap 3 hari sekali jam 8 pagi.
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { schedule } from '@netlify/functions';

const handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[keepalive] ENV vars tidak ditemukan, skip.');
    return new Response('skipped', { status: 200 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch },
    });

    // Query ringan — cukup untuk menandai project sebagai aktif
    const { data, error } = await supabase
      .from('auth_users')
      .select('id')
      .limit(1);

    if (error) throw error;

    // Bersihkan session expired sekalian
    await supabase
      .from('auth_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString());

    const now = new Date().toISOString();
    console.log(`[keepalive] OK pada ${now} — Supabase aktif.`);
    return new Response(`keepalive OK at ${now}`, { status: 200 });

  } catch (err) {
    console.error('[keepalive] ERROR:', err.message);
    return new Response('error: ' + err.message, { status: 500 });
  }
};

// Jadwal: setiap 3 hari sekali, jam 8 pagi UTC (3 siang WIB)
export default schedule('0 8 */3 * *', handler);
