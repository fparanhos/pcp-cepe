import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PCP Cepe — Digitalização',
  description: 'Planejamento e Controle de Produção — CEPE Digitalização',
  manifest: '/manifest.webmanifest',
  icons: [{ rel: 'icon', url: '/icons/icon-192.png' }],
};

export const viewport: Viewport = {
  themeColor: '#005F3B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(()=>{})); }`,
          }}
        />
      </body>
    </html>
  );
}
