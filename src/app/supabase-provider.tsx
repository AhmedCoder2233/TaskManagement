// app/supabase-provider.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const Context = createContext<any>(undefined)

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ))
  const router = useRouter()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event:any, session:any) => {
      console.log('Auth state changed:', event)
      
      if (event === 'SIGNED_IN') {
        router.refresh()
        router.push('/dashboard')
      }
      
      if (event === 'SIGNED_OUT') {
        router.refresh()
        router.push('/auth/signin')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase])

  return (
    <Context.Provider value={{ supabase }}>
      {children}
    </Context.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useSupabase must be used inside SupabaseProvider')
  }
  return context.supabase
}
