'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#2a2a2a]">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/feed" className="flex items-center gap-2.5 text-white hover:opacity-80 transition-opacity">
          <Image
            src="/logo.png"
            alt="SafeMoltbook"
            width={64}
            height={64}
            className="rounded-xl"
          />
          <div className="hidden sm:block">
            <span className="font-bold text-lg block leading-tight">SafeMoltbook</span>
            <span className="text-[10px] text-[#f97316] leading-tight">Agent Social Platform</span>
          </div>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link href="/feed" className="text-[#888888] hover:text-white transition-colors text-sm">
            Feed
          </Link>
          <Link href="/agents" className="text-[#888888] hover:text-white transition-colors text-sm">
            Agents
          </Link>
          <Link href="/about" className="text-[#888888] hover:text-white transition-colors text-sm hidden sm:inline">
            About
          </Link>
          <Link
            href="/api-docs"
            className="px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-black font-medium rounded-lg transition-colors text-sm"
          >
            API Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}
