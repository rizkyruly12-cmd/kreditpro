// ============================================================
// /api/payments  — GET · POST · PUT · DELETE
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession } from './_shared/supabase.js';

function toFront(r) {
  return {
    id:             r.id,
    customerId:     r.customer_id,
    tgl:            r.tgl,
    jumlahAngsuran: Number(r.jumlah_angsuran),
    cicilan:        Number(r.cicilan),
    metode:         r.metode,
    ket:            r.ket,
  };
}

function toDb(b) {
  return {
    id:              b.id,
    customer_id:     b.customerId,
    tgl:             b.tgl,
    jumlah_angsuran: b.jumlahAngsuran || 0,
    cicilan:         b.cicilan        || 0,
    metode:          b.metode         || 'Tunai',
    ket:             b.ket            || null,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  const user = await verifySession(event);
  if (!user) return err('Unauthorized', 401);

  const id         = event.queryStringParameters?.id;
  const customerId = event.queryStringParameters?.customerId;
  const body       = parseBody(event);

  // ---- GET all payments  OR  by customer ----
  if (event.httpMethod === 'GET') {
    let query = supabase.from('payments').select('*');

    if (id)         query = query.eq('id', id);
    if (customerId) query = query.eq('customer_id', customerId);

    query = query.order('tgl', { ascending: true });
    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return ok(data.map(toFront));
  }

  // ---- POST — create ----
  if (event.httpMethod === 'POST') {
    if (!body.id || !body.customerId || !body.tgl)
      return err('Field wajib: id, customerId, tgl');

    const { error } = await supabase.from('payments').insert(toDb(body));
    if (error) return err(error.message, 500);
    return ok({ message: 'Pembayaran dicatat' }, 201);
  }

  // ---- POST bulk (seed) — array ----
  if (event.httpMethod === 'POST' && event.queryStringParameters?.action === 'bulk') {
    if (!Array.isArray(body)) return err('Body harus array');
    const rows = body.map(toDb);
    const { error } = await supabase.from('payments').upsert(rows, { onConflict: 'id' });
    if (error) return err(error.message, 500);
    return ok({ inserted: rows.length }, 201);
  }

  // ---- PUT — update ----
  if (event.httpMethod === 'PUT') {
    if (!id) return err('Parameter id wajib');
    const dbObj = toDb(body);
    delete dbObj.id;
    const { error } = await supabase.from('payments').update(dbObj).eq('id', id);
    if (error) return err(error.message, 500);
    return ok({ message: 'Pembayaran diperbarui' });
  }

  // ---- DELETE ----
  if (event.httpMethod === 'DELETE') {
    if (!id) return err('Parameter id wajib');
    const { error } = await supabase.from('payments').delete().eq('id', id);
    if (error) return err(error.message, 500);
    return ok({ message: 'Pembayaran dihapus' });
  }

  // ---- POST ?action=next-id ----
  if (event.queryStringParameters?.action === 'next-id') {
    const { data } = await supabase.from('payments').select('id').order('id', { ascending: false }).limit(1);
    const last = data?.[0]?.id || 'P000';
    const num  = parseInt(last.replace('P','')) + 1;
    return ok({ id: 'P' + String(num).padStart(3,'0') });
  }

  return err('Method not allowed', 405);
}
