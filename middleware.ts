import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Check if this is an embed or view route
  const path = request.nextUrl.pathname;
  const isEmbedRoute = path.includes('/instances/') && (path.endsWith('/embed') || path.endsWith('/view'));
  
  if (isEmbedRoute) {
    // Remove X-Frame-Options header to allow cross-origin embedding
    response.headers.delete('X-Frame-Options');
    
    // Set Content-Security-Policy to explicitly allow all origins
    response.headers.set('Content-Security-Policy', "frame-ancestors *;");
  }
  
  return response;
}

export const config = {
  matcher: [
    '/instances/:path*/embed',
    '/instances/:path*/view',
  ],
};

