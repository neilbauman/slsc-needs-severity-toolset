'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const crumbs = pathname
    .split('/')
    .filter(Boolean)
    .map((segment, i, arr) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href: '/' + arr.slice(0, i + 1).join('/'),
    }));

  return (
    <header className="bg-[#163F5B] text-white px-6 py-4 shadow">
      <div className="text-xl font-semibold">
        Philippines Shelter Severity Toolset{' '}
        <span className="text-yellow-400">(sandbox)</span>
      </div>
      <nav className="mt-1 text-sm">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        {crumbs.map((crumb, i) => (
          <span key={crumb.href}>
            {' '}
            /{' '}
            <Link href={crumb.href} className="hover:underline">
              {crumb.label}
            </Link>
          </span>
        ))}
      </nav>
    </header>
  );
}
