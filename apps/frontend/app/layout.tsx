import type { Metadata } from 'next';
import { fontGeist } from '../lib/fonts';
import { DifyChatbot } from '../components/dify-chatbot';
import './globals.css';

export const metadata: Metadata = {
  title: 'OptiTrade',
  description: 'OptiTrade Copilot: An AI-Driven Trading Portal with Interactive Dynamic Canvas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontGeist}>
      <body>
        {children}
        <DifyChatbot />
      </body>
    </html>
  );
}
