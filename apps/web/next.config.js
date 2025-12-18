/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@evernote-clone/shared'],
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '9000',
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
