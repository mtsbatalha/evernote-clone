/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@evernote-clone/shared'],
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: process.env.API_PUBLIC_URL ? new URL(process.env.API_PUBLIC_URL).hostname : 'localhost',
                port: process.env.API_PUBLIC_URL ? (new URL(process.env.API_PUBLIC_URL).port || '') : '9000',
                pathname: '/evernote-attachments/**',
            },
        ],
    },
    async rewrites() {
        // Use the public API URL if available, otherwise fallback to local
        const apiBaseUrl = process.env.API_PUBLIC_URL || 'http://localhost:4000';
        return [
            {
                source: '/api/:path*',
                destination: `${apiBaseUrl}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
