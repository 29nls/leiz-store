/**
 * Font Optimization Configuration
 * 
 * Optimized font loading to prevent FOIT (Flash of Invisible Text)
 * and improve First Contentful Paint (FCP)
 */

import { Inter, Roboto, Playfair_Display, Montserrat } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Primary font - Inter
 * Used for body text and UI elements
 */
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevent FOIT
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
  weight: ['300', '400', '500', '600', '700'],
});

/**
 * Secondary font - Roboto
 * Used for headings and emphasis
 */
export const roboto = Roboto({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
  weight: ['300', '400', '500', '700', '900'],
  fallback: ['helvetica', 'arial'],
  adjustFontFallback: true,
});

/**
 * Display font - Playfair Display
 * Used for hero sections and marketing content
 */
export const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700', '900'],
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: true,
});

/**
 * Modern font - Montserrat
 * Used for modern, clean designs
 */
export const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700', '800'],
  fallback: ['system-ui', 'arial'],
  adjustFontFallback: true,
});

/**
 * Optional: Custom local font
 * Example of loading a custom font file
 */
export const customFont = localFont({
  src: [
    {
      path: '../../public/fonts/custom-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/custom-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-custom',
  display: 'swap',
  fallback: ['system-ui', 'arial'],
  preload: false, // Only load when needed
});

/**
 * Font class names to apply to root element
 * Usage: <body className={fontClassNames}>
 */
export const fontClassNames = `${inter.variable} ${roboto.variable} ${playfair.variable} ${montserrat.variable}`;

/**
 * Font CSS variables for Tailwind configuration
 * Add these to your tailwind.config.ts
 */
export const fontVariables = {
  '--font-inter': inter.style.fontFamily,
  '--font-roboto': roboto.style.fontFamily,
  '--font-playfair': playfair.style.fontFamily,
  '--font-montserrat': montserrat.style.fontFamily,
};

/**
 * Preload critical fonts
 * Call this in your layout or _document to preload fonts
 */
export function preloadFonts() {
  return (
    <>
      <link
        rel="preload"
        href="/_next/static/media/inter-var.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/_next/static/media/roboto-var.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
    </>
  );
}
