import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import ClientLayout from './ClientLayout';
import NextTopLoader from 'nextjs-toploader';
import CapacitorBackButton from '@components/providers/CapacitorBackButton';
import { SITE_CONFIG } from '@lib/constants';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-soyol',
  weight: ['400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FF4500',
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://soyolvideoshop.mn'),
  title: {
    default: `${SITE_CONFIG.name} - ${SITE_CONFIG.description}`,
    template: `%s | ${SITE_CONFIG.name}`,
  },
  description: 'Soyol Delivery — хүргэгч апп, диспетчер, захиалагчийн live tracking.',
  keywords: ['soyol delivery', 'хүргэлт', 'courier', 'mongolia', 'dispatch'],
  authors: [{ name: 'Soyol Delivery' }],
  creator: 'Soyol Delivery',
  publisher: 'Soyol Delivery',
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'mn_MN',
    url: 'https://soyolvideoshop.mn',
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} - ${SITE_CONFIG.description}`,
    description: 'Хурдан, найдвартай хүргэлт',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_CONFIG.name} - ${SITE_CONFIG.description}`,
    description: 'Хурдан, найдвартай хүргэлт',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="mn"
      className={manrope.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SITE_CONFIG.name} />
      </head>
      <body className={`${manrope.className} min-h-screen bg-[var(--soyol-canvas)] text-[var(--soyol-ink)] antialiased`}>
        <NextTopLoader color="#FF4500" showSpinner={false} height={2.5} />
        <CapacitorBackButton />
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
