import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '学内教科書フリマ',
  description: 'キャンパス内で手軽に教科書を取引できるフリマアプリ',
};

// 画面の拡大・縮小ズームを防止し、適切な100%スケールで表示
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
        {children}
      </body>
    </html>
  );
}