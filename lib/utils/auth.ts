import { GetServerSidePropsContext } from 'next'
import { createClient } from '@/lib/supabase/server'

export async function requireAuth(context: GetServerSidePropsContext) {
  const supabase = createClient(context)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    }
  }

  return {
    props: {
      user,
    },
  }
}
