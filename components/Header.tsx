// components/Header.tsx
'use client'

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useCountry } from '@/lib/countryContext';
import CountrySelector from './CountrySelector';
import { User, LogOut, LogIn } from 'lucide-react';

export default function Header() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { currentCountry, isSiteAdmin } = useCountry(); // Safe - returns defaults if not in provider
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="w-full bg-[#0F2E4A] text-white shadow-sm border-b border-gray-700">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-semibold tracking-wide hover:text-blue-300 transition-colors">
          SLSC Needs Severity Toolset
        </Link>

        <div className="flex items-center gap-4">
          {/* Country Selector - only show if user is logged in and has countries */}
          {user && currentCountry && (
            <CountrySelector />
          )}

          {/* User Menu */}
          {!authLoading && (
            <>
              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 rounded-md transition-colors"
                  >
                    <User size={16} />
                    <span className="hidden sm:inline">
                      {user.email?.split('@')[0] || 'User'}
                    </span>
                    {isSiteAdmin && (
                      <span className="hidden sm:inline text-xs bg-blue-600 px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                      <div className="py-1">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <div className="text-sm font-medium text-gray-900">
                            {user.email}
                          </div>
                          {isSiteAdmin && (
                            <div className="text-xs text-blue-600 mt-1">Site Administrator</div>
                          )}
                          {currentCountry && (
                            <div className="text-xs text-gray-500 mt-1">
                              Country: {currentCountry.name}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <LogOut size={16} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 rounded-md transition-colors"
                >
                  <LogIn size={16} />
                  <span>Login</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
