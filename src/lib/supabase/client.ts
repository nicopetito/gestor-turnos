import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for use in Client Components and hooks.
 * Uses the public anon key — Row Level Security must be enabled in Supabase.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
