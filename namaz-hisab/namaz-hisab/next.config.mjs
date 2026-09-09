/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        // কুরআনের লেখা কখনো বদলায় না — একবার নামলে ব্রাউজারে থেকে যাক।
        // এটা না থাকায় প্রতিবার সুরা খুললে আবার নামত (সুরা বাকারা একাই ৩৪৫ কিলোবাইট)।
        source: '/quran/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // সার্ভিস ওয়ার্কার নিজে জমা থাকলে নতুন নিয়ম আর পৌঁছাবে না
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
      {
        // হিসাব, পয়েন্ট, সঙ্গীর তথ্য — সবই ব্যক্তিগত আর সবসময় টাটকা লাগে।
        // কোথাও যেন জমা না থাকে, বিশেষত মাঝের কোনো প্রক্সিতে।
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
