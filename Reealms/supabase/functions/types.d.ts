declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): any;
}

declare namespace Deno {
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;

  namespace env {
    function get(name: string): string | undefined;
  }
}
