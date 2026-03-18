'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname  = usePathname();
  const isActive  = pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        'text-sm font-medium px-3 py-2 rounded-lg transition-colors',
        isActive
          ? 'text-green-700 bg-green-50'
          : 'text-gray-600 hover:text-green-700 hover:bg-green-50',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
