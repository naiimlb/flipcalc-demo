/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les affiches TMDB sont servies par le CDN de TMDB : on l'autorise explicitement.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org', pathname: '/t/p/**' },
      { protocol: 'https', hostname: 'i.ytimg.com', pathname: '/**' },
    ],
  },
};
export default nextConfig;
