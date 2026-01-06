'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function SignOut() {
  const router = useRouter()

  useEffect(() => {
    const signOut = async () => {
      await supabase.auth.signOut()
      router.push('/auth/signin')
    }

    signOut()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900">Signing out...</h2>
        <p className="mt-2 text-gray-600">Please wait while we sign you out.</p>
      </div>
    </div>
  )
}