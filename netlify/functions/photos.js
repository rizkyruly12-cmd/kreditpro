// ============================================================
// /api/photos  — GET · POST (upsert) · DELETE
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession } from './_shared/supabase.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  const user = await verifySession(event);
  if (!user) return err('Unauthorized', 401);

  const customerId = event.queryStringParameters?.customerId;
  const photoType  = event.queryStringParameters?.type; // 'cust' | 'item_0'..'item_4'
  const body       = parseBody(event);

  // ---- GET all photos for a customer ----
  if (event.httpMethod === 'GET') {
    if (!customerId) return err('Parameter customerId wajib');
    const { data, error } = await supabase
      .from('photos')
      .select('photo_type, data_url')
      .eq('customer_id', customerId);
    if (error) return err(error.message, 500);

    // Return as object: { cust: '...', item_0: '...', item_1: '...' }
    const result = {};
    (data || []).forEach(r => { result[r.photo_type] = r.data_url; });
    return ok(result);
  }

  // ---- POST (upsert single photo) ----
  if (event.httpMethod === 'POST') {
    const { customerId: cid, photoType: ptype, dataUrl } = body;
    if (!cid || !ptype || !dataUrl) return err('Field wajib: customerId, photoType, dataUrl');

    const { error } = await supabase.from('photos').upsert(
      { customer_id: cid, photo_type: ptype, data_url: dataUrl },
      { onConflict: 'customer_id,photo_type' }
    );
    if (error) return err(error.message, 500);
    return ok({ message: 'Foto disimpan' });
  }

  // ---- POST bulk — save all photos for a customer ----
  if (event.httpMethod === 'POST' && event.queryStringParameters?.action === 'bulk') {
    // body = { customerId, photos: { cust:'...', item_0:'...', ... } }
    const { customerId: cid, photos } = body;
    if (!cid || !photos) return err('Field wajib: customerId, photos');

    const rows = Object.entries(photos)
      .filter(([,v]) => v)
      .map(([k, v]) => ({ customer_id: cid, photo_type: k, data_url: v }));

    if (!rows.length) return ok({ message: 'Tidak ada foto' });
    const { error } = await supabase.from('photos').upsert(rows, { onConflict: 'customer_id,photo_type' });
    if (error) return err(error.message, 500);
    return ok({ saved: rows.length });
  }

  // ---- DELETE one photo ----
  if (event.httpMethod === 'DELETE') {
    if (!customerId) return err('Parameter customerId wajib');
    let query = supabase.from('photos').delete().eq('customer_id', customerId);
    if (photoType) query = query.eq('photo_type', photoType);
    const { error } = await query;
    if (error) return err(error.message, 500);
    return ok({ message: 'Foto dihapus' });
  }

  return err('Method not allowed', 405);
}
