import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('product_scores').select('cat2');
  if (error) {
    console.error(error);
    return;
  }
  const categories = Array.from(new Set(data.map(item => item.cat2)));
  console.log("Distinct cat2 categories in database:", categories);
}
run();
