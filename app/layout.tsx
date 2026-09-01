import type { Metadata, Viewport } from 'next';
import './globals.css';

const basePath = process.env.GITHUB_ACTIONS === 'true' ? '/solers-traffic-rush' : '';

export const metadata: Metadata = {
  title: 'SOLLERS Traffic Rush',
  description: 'Мобильная top-down аркада: маневрируй между машинами на пикапе ST9 и поставь рекорд.',
  applicationName: 'SOLLERS Traffic Rush',
  manifest: `${basePath}/manifest.webmanifest`,
  icons: { icon: `${basePath}/favicon.svg`, apple: `${basePath}/favicon.svg` },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Traffic Rush' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#071018',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
