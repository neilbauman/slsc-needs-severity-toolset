module.exports = { 
  reactStrictMode: true,
  // Fix wrong static path: some cached or misconfigured requests use /next/static instead of /_next/static
  async redirects() {
    return [
      { source: '/next/static/:path*', destination: '/_next/static/:path*', permanent: false },
    ];
  },
  // Webpack: only resolve fallbacks; avoid dev overrides that break _next/static serving
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        // For all routes, set SAMEORIGIN by default
        // Middleware will remove it for embed/view routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};