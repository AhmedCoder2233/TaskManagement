'use client'

import { createContext, useContext, useState } from 'react'
import { createClient } from './lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/supabasetypes'

type SupabaseContext = {
  supabase: SupabaseClient<Database>
}

const Context = createContext<SupabaseContext | undefined>(undefined)

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [supabase] = useState(() => createClient())

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