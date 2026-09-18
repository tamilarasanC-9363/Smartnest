// Supabase Client Initialization for SmartNest AI Backend
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_URL.includes('YourProjectRef')
);

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      }
    });
    console.log('[Supabase] Initialized client with URL:', SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ? '(Using Service Role)' : '(Using Anon Key)');
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err.message);
  }
}

module.exports = {
  supabase,
  isSupabaseConfigured
};
