'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabaseClient'
import { useCountry } from '@/lib/countryContext'

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const [instanceName, setInstanceName] = useState<string | null>(null)
  const { currentCountry } = useCountry()

  // Check if we're on an instance detail page and fetch the instance name
  useEffect(() => {
    if (segments.length === 2 && segments[0] === 'instances') {
      const instanceId = segments[1]
      // Only try to fetch if it looks like a UUID
      if (instanceId && instanceId.length > 10 && instanceId.includes('-')) {
        const supabase = createClient()
        const loadInstanceName = async () => {
          try {
            const { data, error } = await supabase
              .from('instances')
              .select('name')
              .eq('id', instanceId)
              .single()
            
            if (!error && data?.name) {
              setInstanceName(data.name)
            }
          } catch (err) {
            // Silently fail - will just show the UUID
          }
        }
        loadInstanceName()
      }
    } else {
      setInstanceName(null)
    }
  }, [segments])

  // Check if we're on the country dashboard page
  const isCountryDashboard = segments.length === 2 && segments[0] === 'countries'
  
  // Filter out 'countries' segment and ISO code - we show country name separately
  const displaySegments = segments.filter((seg, idx) => {
    // Skip 'countries' segment and its ISO code child
    if (seg === 'countries' || (idx > 0 && segments[idx - 1] === 'countries')) {
      return false
    }
    return true
  })

  return (
    <div className="flex flex-wrap items-center gap-1 text-gray-600">
      <Link href="/" className="hover:text-blue-600 transition-colors">
        Home
      </Link>
      {/* Include country in breadcrumb if available and not on home page */}
      {currentCountry && segments.length > 0 && (
        <>
          <span className="mx-1 text-gray-400">›</span>
          {isCountryDashboard ? (
            // On country dashboard, show country name as current page (not a link)
            <span className="text-gray-800 font-medium">{currentCountry.name}</span>
          ) : (
            // On other pages, show country name as link to dashboard
            <Link 
              href={`/countries/${currentCountry.iso_code.toLowerCase()}`}
              className="hover:text-blue-600 transition-colors"
            >
              {currentCountry.name}
            </Link>
          )}
        </>
      )}
      {/* Show page segments (excluding countries route) */}
      {displaySegments.map((segment, index) => {
        // Find the original index in the full segments array to build correct href
        const segmentIndex = segments.indexOf(segment)
        const href = '/' + segments.slice(0, segmentIndex + 1).join('/')
        const isLast = index === displaySegments.length - 1
        const isInstancePage = segments.length === 2 && segments[0] === 'instances' && segmentIndex === 1
        
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
