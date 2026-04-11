import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if(!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
}


export function createServerSupabase() {
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}
