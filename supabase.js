import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// WPISZ TUTAJ SWOJE DANE Z SUPABASE:
const SUPABASE_URL = 'https://mwymbvvlxcnmqtvdewgh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ih2IDk7NUpRav8RC-pVHdg_HRdb2vyN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
