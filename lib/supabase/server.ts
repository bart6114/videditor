import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { GetServerSidePropsContext } from 'next'
import type { Database } from '@/types/database'

export function createClient(context: GetServerSidePropsContext) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return context.req.cookies[name]
        },
        set(name: string, value: string, options: CookieOptions) {
          context.res.setHeader(
            'Set-Cookie',
            `${name}=${value}; Path=${options.path || '/'}; Max-Age=${options.maxAge || 0}; ${options.sameSite ? `SameSite=${options.sameSite}` : ''}; ${options.secure ? 'Secure' : ''}`
          )
        },
        remove(name: string, options: CookieOptions) {
          context.res.setHeader(
            'Set-Cookie',
            `${name}=; Path=${options.path || '/'}; Max-Age=0`
          )
        },
      },
    }
  )
}
