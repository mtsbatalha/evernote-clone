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
        return [
            {
                source: '/api/v1/:path*',
                destination: 'http://localhost:4000/api/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
