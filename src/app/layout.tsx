import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "@/styles/performance-animations.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CartDrawer from "@/components/cart/CartDrawer";
import LivePurchaseTicker from "@/components/layout/LivePurchaseTicker";
import { PerformanceHints } from "@/components/performance/resource-hints";
import { ThirdPartyScripts } from "@/components/performance/third-party-scripts";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "LEIZ STORE - Premium Game Materials Marketplace",
    template: "%s | LEIZ STORE",
  },
  description:
    "Your trusted source for game currencies, accounts, skins, and more. Instant delivery, secure payments, and 24/7 support.",
  keywords: [
    "game store",
    "game materials",
    "game currency",
    "accounts",
    "skins",
    "digital goods",
  ],
  authors: [{ name: "LEIZ STORE" }],
  creator: "LEIZ STORE",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://leizstore.com"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "LEIZ STORE",
    title: "LEIZ STORE - Premium Game Materials Marketplace",
    description:
      "Your trusted source for game currencies, accounts, skins, and more.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LEIZ STORE",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LEIZ STORE - Premium Game Materials Marketplace",
    description:
      "Your trusted source for game currencies, accounts, skins, and more.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1E1F26",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        {/* Performance Hints for faster resource loading */}
        <PerformanceHints />

        {/* PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LEIZ STORE" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="LEIZ STORE" />
        <meta name="msapplication-TileColor" content="#7C3AED" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* PWA Service Worker Registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) { console.log('SW registered:', registration.scope); },
                    function(err) { console.log('SW registration failed:', err); }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text noise-overlay" style={{ fontFamily: "Helvetica, Arial, system-ui, sans-serif", paddingBottom: "80px" }}>
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
        <CartDrawer />
        <LivePurchaseTicker />
        
        {/* Third-party scripts loaded optimally */}
        <ThirdPartyScripts />

        {/* Vercel Speed Insights */}
        <SpeedInsights />
        
        {/* Vercel Web Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
