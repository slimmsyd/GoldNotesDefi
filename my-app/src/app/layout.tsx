import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SolanaProviderWrapper } from "@/providers/wagmi-provider";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";

const GA_MEASUREMENT_ID = "G-VBF89LR49N";

export const metadata: Metadata = {
  title: "BlackW3B - GoldBack",
  description: "Secure gold-backed digital assets on the blockchain",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: {
      rel: 'manifest',
      url: '/manifest.json',
    },
  },
  openGraph: {
    title: "GoldBack - Secure Gold-Backed Digital Assets",
    description: "Secure gold-backed digital assets on the blockchain, powered by BlackW3B.",
    siteName: 'BlackW3B',
    images: [
      {
        url: '/WebFavIcon.png',
        width: 1200,
        height: 630,
        alt: 'BlackW3B Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
      <body className="antialiased">
        <SolanaProviderWrapper>
          <ToastProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </ToastProvider>
        </SolanaProviderWrapper>
      </body>
    </html>
  );
}
