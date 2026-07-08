import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/`;
  const res = await fetch(url, { headers: { 'apikey': process.env.VITE_SUPABASE_ANON_KEY }});
  const data = await res.json();
  const paths = Object.keys(data.paths).filter(p => p.includes('get_meli_product_sort'));
  for (const path of paths) {
      console.log(path);
      console.log(JSON.stringify(data.paths[path], null, 2));
  }
}
run();
