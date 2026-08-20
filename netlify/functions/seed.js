// ============================================================
// /api/seed  — Import semua data dari localStorage ke Supabase
// Dipanggil SEKALI setelah deploy pertama.
// Body: { customers: [...], payments: [...], photos: {...}, waLogs: [...] }
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession } from './_shared/supabase.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST')    return err('POST only', 405);

  const user = await verifySession(event);
  if (!user || user.role !== 'owner') return err('Hanya Owner yang bisa seed data', 403);

  const body = parseBody(event);
  const results = { customers: 0, payments: 0, photos: 0, waLogs: 0, errors: [] };

  // ---- Customers ----
  if (Array.isArray(body.customers) && body.customers.length) {
    const rows = body.customers.map(c => ({
      id:           c.id,
      nama:         c.nama,
      tgl:          c.tgl,
      barang:       c.barang,
      harga:        c.harga        || 0,
      dp:           c.dp           || 0,
      kredit_pokok: c.kreditPokok  || 0,
      tenor:        c.tenor,
      total_bunga:  c.totalBunga   || 0,
      bunga_pct:    c.bungaPct     || 0,
      no_hp:        c.noHp         || null,
      nik:          c.nik          || null,
      alamat:       c.alamat       || null,
      no_seri:      c.noSeri       || null,
    }));

    // Batch 50 at a time
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase.from('customers').upsert(batch, { onConflict: 'id' });
      if (error) results.errors.push('customers: ' + error.message);
      else results.customers += batch.length;
    }
  }

  // ---- Payments ----
  if (Array.isArray(body.payments) && body.payments.length) {
    const rows = body.payments.map(p => ({
      id:              p.id,
      customer_id:     p.customerId,
      tgl:             p.tgl,
      jumlah_angsuran: p.jumlahAngsuran || 0,
      cicilan:         p.cicilan        || 0,
      metode:          p.metode         || 'Tunai',
      ket:             p.ket            || null,
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('payments').upsert(batch, { onConflict: 'id' });
      if (error) results.errors.push('payments: ' + error.message);
      else results.payments += batch.length;
    }
  }

  // ---- Photos  { 'N001_cust': 'data:...', 'N001_item_0': 'data:...' } ----
  if (body.photos && typeof body.photos === 'object') {
    const photoRows = [];
    for (const [key, dataUrl] of Object.entries(body.photos)) {
      if (!dataUrl) continue;
      // key format: 'N001_cust'  or  'N001_items' (legacy single)  or  'N001_item_0'
      const underIdx = key.indexOf('_');
      const custId   = key.slice(0, underIdx);
      let   ptype    = key.slice(underIdx + 1);
      if (ptype === 'item') ptype = 'item_0'; // normalise legacy key
      photoRows.push({ customer_id: custId, photo_type: ptype, data_url: dataUrl });
    }

    for (let i = 0; i < photoRows.length; i += 20) {
      const batch = photoRows.slice(i, i + 20);
      const { error } = await supabase.from('photos').upsert(batch, { onConflict: 'customer_id,photo_type' });
      if (error) results.errors.push('photos: ' + error.message);
      else results.photos += batch.length;
    }
  }

  // ---- WA Logs ----
  if (Array.isArray(body.waLogs) && body.waLogs.length) {
    const rows = body.waLogs.map(l => ({
      customer_id: l.customerId || null,
      cust_name:   l.custName   || null,
      phone:       l.phone,
      message:     (l.message || '').slice(0, 500),
      sent_at:     l.sentAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('wa_logs').insert(rows);
    if (error) results.errors.push('walogs: ' + error.message);
    else results.waLogs = rows.length;
  }

  // ---- Seed default admin password ----
  // Update admin password_hash sesuai yang dipakai frontend (hash dari 'admin123')
  if (body.adminPasswordHash) {
    await supabase.from('auth_users')
      .update({ password_hash: body.adminPasswordHash })
      .eq('username', 'admin');
  }

  const status = results.errors.length > 0 ? 207 : 201;
  return ok(results, status);
}
