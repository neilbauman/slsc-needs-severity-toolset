'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return (
    <div className="flex flex-wrap items-center gap-1 text-gray-600">
      <Link href="/" className="hover:text-blue-600 transition-colors">
        Home
      </Link>
      {segments.map((segment, index) => {
        const href = '/' + segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1
        const name = segment.charAt(0).toUpperCase() + segment.slice(1)
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
