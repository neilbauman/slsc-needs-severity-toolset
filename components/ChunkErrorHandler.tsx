'use client';

import { useEffect } from 'react';

/**
 * Listens for unhandled promise rejections (e.g. "Loading chunk failed" / 404 on _next/static)
 * and suggests running the fix-crashes script. Complements ErrorBoundary for chunk load errors
 * that don't always hit the React error boundary.
 */
export default function ChunkErrorHandler() {
  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = (e?.reason?.message || String(e?.reason ?? '')).toLowerCase();
      const isChunk =
        msg.includes('loading chunk') ||
        (msg.includes('chunk') && (msg.includes('failed') || msg.includes('404')));
      if (!isChunk) return;
      console.error('[ChunkErrorHandler] Chunk load failed. Use: npm start then hard-refresh.');
      if (typeof window === 'undefined') return;
      const key = 'chunk-error-seen';
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      setTimeout(() => {
        alert(
          'A script failed to load (chunk 404 / RSC payload).\n\n' +
            '1) Stop the server (Ctrl+C), then: rm -rf .next && npm start\n' +
            '2) Wait for "✓ Ready", open http://localhost:3000\n' +
            '3) Hard-refresh (Cmd+Shift+R or Ctrl+Shift+R).'
        );
      }, 100);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);
  return null;
}
