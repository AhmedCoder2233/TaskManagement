'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/app/supabase-provider'
import { Profile } from '../lib/index'
import { LogOut, Home, User as UserIcon, Plus, LayoutDashboard, Menu, X, Bell, ChevronDown } from 'lucide-react'

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
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'production_admin':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
      case 'sales_admin':
        return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm'
      case 'member':
        return 'bg-gradient-to-r from-gray-700 to-gray-800 text-white shadow-sm'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo & Desktop Navigation */}
            <div className="flex items-center">
              <Link 
                href="/dashboard" 
                className="flex items-center space-x-3 group hover:opacity-80 transition-opacity"
              >
                <div className="p-2.5 bg-gradient-to-br from-gray-900 to-black rounded-xl shadow-sm group-hover:shadow transition-all">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent">
                    TaskFlow
                  </span>
                  <span className="text-xs text-gray-500 -mt-1">Workspace</span>
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-8 md:flex md:space-x-1">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <LayoutDashboard className="h-4 w-4 mr-2.5" />
                  Dashboard
                </Link>
                
                {(user.role === 'production_admin' || user.role === 'sales_admin') && (
                  <Link
                    href="/dashboard/create"
                    className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-100 rounded-xl transition-all duration-200"
                  >
                    <Plus className="h-4 w-4 mr-2.5" />
                    Create Task
                  </Link>
                )}
              </div>
            </div>

            {/* Right side - User Profile & Actions */}
            <div className="flex items-center space-x-3">
              {/* Desktop User Info */}
              <div className="hidden md:flex items-center space-x-3">
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                        <div className="text-sm font-semibold text-gray-800">
                          {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                           user.email?.split('@')[0].substring(0, 2).toUpperCase() || 'U'}
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 text-sm">{user.full_name}</div>
                        <div className="text-gray-500 text-xs truncate max-w-[120px]">{user.email}</div>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* User Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="font-medium text-gray-900 text-sm">{user.full_name}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{user.email}</div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center"
                      >
                        <LogOut className="h-4 w-4 mr-3 text-gray-400" />
                        Sign out
                      </button>
                                      <span className='text-xs border p-2 ml-3'>{user.role}</span>

                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5 text-gray-700" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-lg">
            <div className="px-4 py-3 space-y-1">
              {/* Mobile User Info */}
              <div className="px-3 py-4 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm border border-gray-300">
                    <div className="text-base font-semibold text-gray-800">
                      {user.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 
                       user.email?.split('@')[0].substring(0, 2).toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{user.full_name}</div>
                    <div className="text-gray-500 text-sm mt-0.5">{user.email}</div>
                    <div className="mt-2">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {roleLabelMap[user.role] || user.role}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-50 rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LayoutDashboard className="h-4 w-4 mr-3 text-gray-400" />
                Dashboard
              </Link>
              
              {(user.role === 'production_admin' || user.role === 'sales_admin') && (
                <Link
                  href="/dashboard/create"
                  className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-50 rounded-xl transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Plus className="h-4 w-4 mr-3 text-gray-400" />
                  Create Task
                </Link>
              )}

              <div className="pt-2 border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2 text-gray-400" />
                  Sign out
                </button>
                                      <span className='text-xs border p-2 ml-3'>{user.role}</span>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-gray-900 to-black rounded-lg shadow-sm">
                <Home className="h-4 w-4 text-white" />
              </div>
              <div className="text-gray-600 text-sm">
                © {new Date().getFullYear()} TaskFlow. All rights reserved.
              </div>
            </div>
            <div className="text-gray-500 text-sm">
              Logged in as <span className="text-gray-900 font-medium">{user.email}</span>
              <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                {roleLabelMap[user.role] || user.role}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
