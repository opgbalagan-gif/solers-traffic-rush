import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Traffic Rush — дорожная аркада',
  description: 'Маневрируй между машинами и поставь новый рекорд.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
