// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let payloadToken = '';
    try {
      let payload: Record<string, unknown> | null = null;
      try {
        const maybeJson = await req.clone().json();
        if (maybeJson != null && typeof maybeJson === 'object') {
          payload = maybeJson as Record<string, unknown>;
        }
      } catch (_) {
        const textBody = await req.clone().text();
        if (textBody.trim().length > 0) {
          const decoded = JSON.parse(textBody);
          if (decoded != null && typeof decoded === 'object') {
            payload = decoded as Record<string, unknown>;
          }
        }
      }

      if (payload != null) {
        const snakeCase = payload['access_token'];
        const camelCase = payload['accessToken'];
        if (typeof snakeCase === 'string' && snakeCase.trim().length > 0) {
          payloadToken = snakeCase.trim();
        } else if (
          typeof camelCase === 'string' &&
          camelCase.trim().length > 0
        ) {
          payloadToken = camelCase.trim();
        }
      }
    } catch (_) {
      // Ignore invalid body payload and fallback to header token.
    }

    const authHeader =
      req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const headerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const primaryToken = payloadToken.length > 0 ? payloadToken : headerToken;
    const fallbackToken = payloadToken.length > 0 ? headerToken : '';
    const tokenCandidates = [primaryToken, fallbackToken].filter(
      (token, index, arr) => token.length > 0 && arr.indexOf(token) === index,
    );
    if (tokenCandidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (supabaseUrl.length === 0 || serviceRoleKey.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase environment variables' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let resolvedUser: { id: string } | null = null;
    for (const token of tokenCandidates) {
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.getUser(token);

      if (userError == null && user != null) {
        resolvedUser = { id: user.id };
        break;
      }
    }

    if (resolvedUser == null) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userId = resolvedUser.id;

    await adminClient.from('user_interactions').delete().eq('user_id', userId);
    await adminClient.from('user_login_history').delete().eq('user_id', userId);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      userId,
    );
    if (deleteUserError != null) {
      return new Response(
        JSON.stringify({ error: deleteUserError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
