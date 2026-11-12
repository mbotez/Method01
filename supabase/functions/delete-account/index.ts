import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: missing Supabase URL or service role key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Initialize client with user JWT to securely identify user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid token or user not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // 2. Initialize admin client with service role key for deletions and auth admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // 3. Delete user rows in exact order (children first, parents last) with strict error checking
    const { error: e1 } = await supabaseAdmin.from('comments').delete().eq('user_id', userId);
    if (e1) throw new Error(`Failed to delete comments: ${e1.message}`);

    const { error: e2 } = await supabaseAdmin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (e2) throw new Error(`Failed to delete messages: ${e2.message}`);

    const { error: e3 } = await supabaseAdmin.from('follows').delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    if (e3) throw new Error(`Failed to delete follows: ${e3.message}`);

    const { error: e4 } = await supabaseAdmin.from('posts').delete().eq('user_id', userId);
    if (e4) throw new Error(`Failed to delete posts: ${e4.message}`);

    const { error: e5 } = await supabaseAdmin.from('upp').delete().eq('user_id', userId);
    if (e5) throw new Error(`Failed to delete upp (saved products): ${e5.message}`);

    const { error: e6 } = await supabaseAdmin.from('product_user_ratings').delete().eq('user_id', userId);
    if (e6) throw new Error(`Failed to delete product user ratings: ${e6.message}`);

    const { error: e7 } = await supabaseAdmin.from('tracker').delete().eq('user_id', userId);
    if (e7) throw new Error(`Failed to delete tracker records: ${e7.message}`);

    const { error: e8 } = await supabaseAdmin.from('routines').delete().eq('user_id', userId);
    if (e8) throw new Error(`Failed to delete routines: ${e8.message}`);

    const { error: e9 } = await supabaseAdmin.from('progress').delete().eq('user_id', userId);
    if (e9) throw new Error(`Failed to delete progress records: ${e9.message}`);

    const { error: e10 } = await supabaseAdmin.from('user_contacts').delete().eq('user_id', userId);
    if (e10) throw new Error(`Failed to delete user contacts: ${e10.message}`);

    const { error: e11 } = await supabaseAdmin.from('user_profile').delete().eq('id', userId);
    if (e11) throw new Error(`Failed to delete user profile: ${e11.message}`);

    // Set products.user_id to null for custom products created by this user to prevent FK violations
    const { error: e12 } = await supabaseAdmin.from('products').update({ user_id: null }).eq('user_id', userId);
    if (e12) throw new Error(`Failed to update custom products user_id: ${e12.message}`);

    const { error: e13 } = await supabaseAdmin.from('users').delete().eq('id', userId);
    if (e13) throw new Error(`Failed to delete user record: ${e13.message}`);

    // 4. Remove storage files from all listed buckets under user_id/ prefix
    const buckets = ['progress', 'avatars', 'tracker', 'images', 'public'];
    for (const bucket of buckets) {
      try {
        const { data: listData, error: listError } = await supabaseAdmin.storage.from(bucket).list(userId);
        if (!listError && listData && listData.length > 0) {
          const filesToRemove = listData.map((file) => `${userId}/${file.name}`);
          const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(filesToRemove);
          if (removeError) {
            console.warn(`Warning: failed to remove storage files in bucket ${bucket}: ${removeError.message}`);
          }
        }
      } catch (err) {
        console.warn(`Warning: bucket ${bucket} operation failed:`, err);
      }
    }

    // 5. Delete auth user via admin API only after all earlier database and storage steps succeeded
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      throw new Error(`Failed to delete auth user: ${deleteAuthError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
