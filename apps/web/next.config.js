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
    // Note: /api routing is handled by Nginx Proxy Manager, not Next.js rewrites
};

module.exports = nextConfig;
