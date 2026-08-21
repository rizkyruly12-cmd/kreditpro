// ============================================================
// /api/customers  — GET all · GET one · POST · PUT · DELETE
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession, checkEnv } from './_shared/supabase.js';

// snake_case DB  ↔  camelCase frontend
function toFront(r) {
  if (!r) return null;
  return {
    id:          r.id,
    nama:        r.nama,
    tgl:         r.tgl,
    barang:      r.barang,
    harga:       Number(r.harga),
    dp:          Number(r.dp),
    kreditPokok: Number(r.kredit_pokok),
    tenor:       r.tenor,
    totalBunga:  Number(r.total_bunga),
    bungaPct:    Number(r.bunga_pct),
    noHp:        r.no_hp,
    nik:         r.nik,
    alamat:      r.alamat,
    noSeri:      r.no_seri,
  };
}

function toDb(b) {
  return {
    id:           b.id,
    nama:         b.nama,
    tgl:          b.tgl,
    barang:       b.barang,
    harga:        b.harga        || 0,
    dp:           b.dp           || 0,
    kredit_pokok: b.kreditPokok  || (b.harga - b.dp) || 0,
    tenor:        b.tenor,
    total_bunga:  b.totalBunga   || 0,
    bunga_pct:    b.bungaPct     || 0,
    no_hp:        b.noHp         || null,
    nik:          b.nik          || null,
    alamat:       b.alamat       || null,
    no_seri:      b.noSeri       || null,
  };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  const envErr = checkEnv();
  if (envErr) return envErr;

  const user = await verifySession(event);
  if (!user) return err('Unauthorized', 401);

  const id   = event.queryStringParameters?.id;
  const body = parseBody(event);

  // ---- GET /api/customers  OR  /api/customers?id=N001 ----
  if (event.httpMethod === 'GET') {
    if (id) {
      const { data, error } = await supabase
        .from('customers').select('*').eq('id', id).single();
      if (error) return err('Pelanggan tidak ditemukan', 404);
      return ok(toFront(data));
    }
    const { data, error } = await supabase
      .from('customers').select('*').order('id');
    if (error) return err(error.message, 500);
    return ok(data.map(toFront));
  }

  // ---- POST /api/customers?action=next-id ----
  if (event.httpMethod === 'POST' && event.queryStringParameters?.action === 'next-id') {
    const { data } = await supabase.from('customers').select('id').order('id', { ascending: false }).limit(1);
    const last = data?.[0]?.id || 'N000';
    const num  = parseInt(last.replace('N','')) + 1;
    return ok({ id: 'N' + String(num).padStart(3,'0') });
  }

  // ---- POST /api/customers  (create) ----
  if (event.httpMethod === 'POST') {
    if (!body.id || !body.nama || !body.tgl || !body.barang)
      return err('Field wajib: id, nama, tgl, barang');

    const { error } = await supabase.from('customers').insert(toDb(body));
    if (error) return err(error.message, 500);
    return ok({ message: 'Pelanggan ditambahkan' }, 201);
  }

  // ---- PUT /api/customers?id=N001  (update) ----
  if (event.httpMethod === 'PUT') {
    if (!id) return err('Parameter id wajib');
    const dbObj = toDb(body);
    delete dbObj.id; // jangan update PK
    const { error } = await supabase.from('customers').update(dbObj).eq('id', id);
    if (error) return err(error.message, 500);
    return ok({ message: 'Pelanggan diperbarui' });
  }

  // ---- DELETE /api/customers?id=N001 ----
  if (event.httpMethod === 'DELETE') {
    if (!id) return err('Parameter id wajib');
    // cascade delete payments & photos via FK
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) return err(error.message, 500);
    return ok({ message: 'Pelanggan dihapus' });
  }

  return err('Method not allowed', 405);
}
