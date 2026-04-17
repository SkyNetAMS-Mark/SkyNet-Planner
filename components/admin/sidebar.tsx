'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Truck,
  Mail,
  Calendar,
  Package,
  Settings,
  Route,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Parcels', href: '/parcels', icon: Package },
  { name: 'Schedules', href: '/schedules', icon: Calendar },
]

const settingsNavigation = [
  { name: 'Routes', href: '/routes', icon: Route },
  { name: 'Drivers', href: '/drivers', icon: Truck },
  { name: 'Postal Codes', href: '/postal-codes', icon: Mail },
]

export function Sidebar() {
  const pathname = usePathname()
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith('/schedules') ||
    pathname.startsWith('/drivers') ||
    pathname.startsWith('/postal-codes') ||
    pathname.startsWith('/settings')
  )

  return (
    <div className="flex h-full w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <img
            src="/Skynet-logo.svg"
            alt="SkyNet Logo"
            className="h-8 w-auto"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {/* Main Navigation */}
        {mainNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}

        {/* Settings Section */}
        <div className="pt-2">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              settingsOpen || pathname.startsWith('/settings')
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </div>
            {settingsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Settings Submenu */}
          {settingsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="text-xs text-gray-500">
          <p className="font-medium">SkyNet Belgium</p>
          <p>Delivery Management v1.0</p>
        </div>
      </div>
    </div>
  )
}
