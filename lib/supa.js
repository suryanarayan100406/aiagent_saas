// Supabase client (server-side, service_role key — full access).
// The dashboard NEVER gets this key; only the backend uses it.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB calls will fail.');
}

export const supa = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '', {
  auth: { persistSession: false },
});

// Resolve the single active company (Balaji). Multi-tenant later keys off wa_phone_id.
let _companyCache = null;
export async function getCompany() {
  if (_companyCache) return _companyCache;
  const { data, error } = await supa.from('companies').select('*').limit(1).single();
  if (error) throw error;
  _companyCache = data;
  return data;
}

// Clear cache after knowledge/config edits so the bot picks up changes live.
export function clearCompanyCache() {
  _companyCache = null;
}
