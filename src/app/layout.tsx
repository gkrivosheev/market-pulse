import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Market Pulse — Smart Financial Asset Tracker',
  description:
    "Track financial assets with AI-powered anomaly detection and market intelligence. Know what's noteworthy in your watchlist every day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased bg-[#0a0e17] text-slate-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
