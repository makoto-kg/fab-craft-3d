'use client';

import dynamic from 'next/dynamic';

// Three.js requires browser APIs — disable SSR for the entire app shell
const FabApp = dynamic(() => import('@/components/FabApp'), { ssr: false });

export default function Home() {
  return <FabApp />;
}
