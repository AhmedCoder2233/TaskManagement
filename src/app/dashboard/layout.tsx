'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { Profile } from '../lib/index'
import { LogOut, Home, User as UserIcon, Plus, LayoutDashboard, Menu, X } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = useSupabase()
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        if (!authUser) {
          router.push('/auth/signin')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single()

        setUser(profile)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [supabase, router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  const roleLabelMap: Record<string, string> = {
  member: 'Member',
  production_admin: 'Admin',
  sales_admin: 'Sales Admin',
};

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo & Desktop Navigation */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3 group">
                <div className="p-2 bg-white rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Home className="h-5 w-5 text-black" />
                </div>
                <span className="text-xl font-bold text-black">TaskManager</span>
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-10 md:flex md:space-x-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-black hover:text-blue-600 border-b-2 border-transparent hover:border-white transition-all"
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/dashboard/create"
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-black hover:text-blue-600 border-b-2 border-transparent hover:border-white transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Link>
                )}
              </div>
            </div>

            {/* Right side - User Profile & Actions */}
            <div className="flex items-center space-x-4">
              {/* Desktop User Info */}
              <div className="hidden md:flex items-center space-x-3">
                <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center border border-gray-700">
                  <UserIcon className="h-4 w-4 text-black" />
                </div>
                <div className="text-sm">
                  <div className="font-semibold text-black">{user.full_name}</div>
                  <div className="text-black text-xs truncate max-w-[150px]">{user.email}</div>
                  <div className="text-black text-xs capitalize mt-0.5">
                    <span className="px-2 py-0.5 bg-black text-white rounded-full">  {roleLabelMap[user.role] || user.role}
</span>
                  </div>
                </div>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-800"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 text-black" />
                ) : (
                  <Menu className="h-5 w-5 text-black" />
                )}
              </button>

              {/* Desktop Sign Out */}
              <button
                onClick={handleSignOut}
                className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-black hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm">
            <div className="px-4 py-3 space-y-3">
              <Link
                href="/dashboard"
                className="flex items-center px-3 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 mr-3" />
                Dashboard
              </Link>
              
              {user.role === 'admin' && (
                <Link
                  href="/dashboard/create"
                  className="flex items-center px-3 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Plus className="h-4 w-4 mr-3" />
                  Create Task
                </Link>
              )}

              {/* Mobile User Info */}
              <div className="px-3 py-4 border-t border-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-gray-700">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{user.full_name}</div>
                    <div className="text-gray-400 text-sm">{user.email}</div>
                    <div className="text-gray-500 text-xs capitalize mt-1">
                      <span className="px-2 py-1 bg-gray-800 rounded-full">{user.role}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="w-full mt-4 flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-700"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl border border-gray-800 p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-500 text-sm">
              © {new Date().getFullYear()} TaskManager. All rights reserved.
            </div>
            <div className="text-gray-500 text-sm mt-2 md:mt-0">
              Logged in as <span className="text-white font-medium">{user.email}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}