import './globals.css';
import AuthProvider from '../components/AuthProvider';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'DeenTogether — একসাথে দ্বীনের পথে',
  description: 'একসাথে পাঁচ ওয়াক্ত নামাজের হিসাব রাখার খাতা',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#10050D',
};

export default function RootLayout({ children }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Noto+Serif+Bengali:wght@500;600;700&family=Amiri:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
