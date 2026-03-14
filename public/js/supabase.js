// -------------------------------------------------------
// 💜 SmartPOS – Supabase Público (ESM CORRECTO)
// -------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://yssihgpqlnekrkjmefkz.supabase.co";
const SUPABASE_PUBLIC_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2loZ3BxbG5la3Jram1lZmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MTEwNDEsImV4cCI6MjA3MzQ4NzA0MX0.P65R38CV5KaV-fNcL4rKos0jmEEiYurnjQtcMgw7rt8";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  auth: {
    persistSession: false,   // 🔥 obligatorio para vistas públicas
    autoRefreshToken: false,
  }
});
