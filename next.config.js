module.exports = { 
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Allow iframe embedding from same origin, or use 'ALLOWALL' for any origin (less secure)
          },
        ],
      },
    ];
  },
};