import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_ANON_KEY}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/openapi+json' }});
  const data = await res.json();
  if (data.paths) {
      const paths = Object.keys(data.paths).filter(p => p.includes('get_meli_product_sort'));
      for (const path of paths) {
          console.log(path);
          console.log(JSON.stringify(data.paths[path], null, 2));
      }
  } else {
      console.log(data);
  }
}
run();
