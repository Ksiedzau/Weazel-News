import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// WPISZ TUTAJ SWOJE DANE Z SUPABASE:
const SUPABASE_URL = 'TUTAJ_TWÓJ_SUPABASE_URL';
const SUPABASE_KEY = 'TUTAJ_TWÓJ_SUPABASE_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
