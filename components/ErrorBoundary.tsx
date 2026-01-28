'use client';

import React from 'react';
import Link from 'next/link';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    const msg = (error.message || '').toLowerCase();
    const isChunkOrBuildError =
      msg.includes('webpack') ||
      msg.includes('module') ||
      msg.includes('loading chunk') ||
      msg.includes('500') ||
      (msg.includes('chunk') && (msg.includes('failed') || msg.includes('404') || msg.includes('not found')));
    if (isChunkOrBuildError) {
      console.error('Chunk/build error detected. Use: npm start (then hard-refresh)');
    }
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      const msg = (error?.message || '').toLowerCase();
      const isWebpackError =
        msg.includes('webpack') ||
        msg.includes('module') ||
        msg.includes('loading chunk') ||
        msg.includes('500') ||
        (msg.includes('chunk') && (msg.includes('failed') || msg.includes('404')));
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              {error?.message || 'An unexpected error occurred'}
            </p>
            
            {isWebpackError && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-semibold mb-2">Use the reliable run (fixes most crashes)</p>
                <p className="text-xs text-amber-700 mb-2">
                  In the project folder, run:
                </p>
                <ol className="text-xs text-amber-700 list-decimal list-inside space-y-1">
                  <li><code className="bg-amber-100 px-1 rounded font-mono">npm start</code> — wait for &quot;✓ Ready&quot;</li>
                  <li>Open <strong>http://localhost:3000</strong> and do a <strong>hard refresh</strong> (Cmd+Shift+R or Ctrl+Shift+R)</li>
                </ol>
                <p className="text-xs text-amber-600 mt-2">Avoid <code className="bg-amber-100 px-0.5 rounded">npm run dev</code> if you see this often.</p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Reload Page
              </button>
              <Link
                href="/"
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 inline-block text-center"
              >
                Go Home
              </Link>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto max-h-60">
                {error?.stack || error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
