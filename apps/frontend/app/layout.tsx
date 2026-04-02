import type { Metadata } from 'next';
import Script from 'next/script';
import { fontGeist } from '../lib/fonts';
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
        <Script id="dify-chatbot-config" strategy="afterInteractive">
          {`
            window.difyChatbotConfig = {
              token: 'tK1fSX1l8egbhA8r',
              inputs: {},
              systemVariables: {},
              userVariables: {},
            };
          `}
        </Script>
        <Script
          src="https://udify.app/embed.min.js"
          id="tK1fSX1l8egbhA8r"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
