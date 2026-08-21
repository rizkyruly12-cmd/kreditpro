// ============================================================
// /api/walogs  — GET · POST · DELETE all
// ============================================================
import { supabase, ok, err, cors, parseBody, verifySession, checkEnv } from './_shared/supabase.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  const envErr = checkEnv();
  if (envErr) return envErr;

  const user = await verifySession(event);
  if (!user) return err('Unauthorized', 401);

  const body = parseBody(event);

  // ---- GET logs (latest 100) ----
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('wa_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100);
    if (error) return err(error.message, 500);

    // camelCase for frontend
    return ok((data || []).map(r => ({
      id:         r.id,
      customerId: r.customer_id,
      custName:   r.cust_name,
      phone:      r.phone,
      message:    r.message,
      sentAt:     r.sent_at,
    })));
  }

  // ---- POST — add log entry ----
  if (event.httpMethod === 'POST') {
    const { customerId, custName, phone, message } = body;
    if (!phone || !message) return err('Field wajib: phone, message');

    const { error } = await supabase.from('wa_logs').insert({
      customer_id: customerId || null,
      cust_name:   custName   || null,
      phone,
      message:     message.slice(0, 500),
    });
    if (error) return err(error.message, 500);
    return ok({ message: 'Log WA disimpan' }, 201);
  }

  // ---- DELETE all logs ----
  if (event.httpMethod === 'DELETE') {
    const { error } = await supabase.from('wa_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) return err(error.message, 500);
    return ok({ message: 'Log WA dihapus' });
  }

  return err('Method not allowed', 405);
}
