import { createClient } from '@supabase/supabase-js';

const supabaseHistoricoUrl = process.env.SUPABASE_TEST_URL;
const supabaseHistoricoKey = process.env.SUPABASE_TEST_PUB_KEY;

if (!supabaseHistoricoUrl || !supabaseHistoricoKey) {
  throw new Error('Faltan SUPABASE_TEST_URL o SUPABASE_TEST_PUB_KEY en .env.local');
}

// Cliente del Supabase de histórico (proyecto separado, solo lectura)
export const supabaseHistorico = createClient(supabaseHistoricoUrl, supabaseHistoricoKey);