'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const [instanceName, setInstanceName] = useState<string | null>(null)

  // Check if we're on an instance detail page and fetch the instance name
  useEffect(() => {
    if (segments.length === 2 && segments[0] === 'instances') {
      const instanceId = segments[1]
      // Only try to fetch if it looks like a UUID
      if (instanceId && instanceId.length > 10 && instanceId.includes('-')) {
        const supabase = createClient()
        supabase
          .from('instances')
          .select('name')
          .eq('id', instanceId)
          .single()
          .then(({ data, error }) => {
            if (!error && data?.name) {
              setInstanceName(data.name)
            }
          })
          .catch(() => {
            // Silently fail - will just show the UUID
          })
      }
    } else {
      setInstanceName(null)
    }
  }, [segments])

  return (
    <div className="flex flex-wrap items-center gap-1 text-gray-600">
      <Link href="/" className="hover:text-blue-600 transition-colors">
        Home
      </Link>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1
        const isInstancePage = segments.length === 2 && segments[0] === 'instances' && index === 1
        
        // Use instance name if available, otherwise use capitalized segment
        const name = isInstancePage && instanceName 
          ? instanceName 
          : segment.charAt(0).toUpperCase() + segment.slice(1)
        
        return (
          <span key={href} className="flex items-center">
            <span className="mx-1 text-gray-400">›</span>
            {isLast ? (
              <span className="text-gray-800 font-medium">{name}</span>
            ) : (
              <Link href={href} className="hover:text-blue-600 transition-colors">
                {name}
              </Link>
            )}
          </span>
        )
      })}
    </div>
  )
}
