module.exports = { 
  reactStrictMode: true,
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