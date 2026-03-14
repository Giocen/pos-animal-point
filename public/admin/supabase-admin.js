// /admin/supabase-admin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚠️ PEGAR AQUÍ tu service_role key DIRECTAMENTE DESDE SUPABASE
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzc2loZ3BxbG5la3Jram1lZmt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzkxMTA0MSwiZXhwIjoyMDczNDg3MDQxfQ.zaAKAo-IvH6dAl3ADQzRHuLRzGJ4w0i_Zouxha-dDH4";

export const supabaseAdmin = createClient(
  "https://yssihgpqlnekrkjmefkz.supabase.co",
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
