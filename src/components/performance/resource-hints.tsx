/**
 * Resource Hints Component
 * 
 * Provides preconnect, dns-prefetch, and preload hints
 * to improve resource loading performance
 */

/**
 * Critical resource hints for external domains
 * Add this to your root layout for best performance
 */
export function ResourceHints() {
  return (
    <>
      {/* Preconnect to external domains used frequently */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* DNS Prefetch for less critical external resources */}
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      <link rel="dns-prefetch" href="https://www.google-analytics.com" />
      
      {/* Add more based on your external dependencies */}
      {/* Examples: */}
      {/* <link rel="preconnect" href="https://your-cdn.com" /> */}
      {/* <link rel="preconnect" href="https://your-api.com" /> */}
      {/* <link rel="dns-prefetch" href="https://analytics-provider.com" /> */}
    </>
  );
}

/**
 * Preload critical images
 * Use for hero images or above-the-fold content
 */
export function PreloadCriticalImages() {
  return (
    <>
      {/* Example: Preload hero image */}
      {/* <link
        rel="preload"
        as="image"
        href="/images/hero-image.jpg"
        type="image/jpeg"
      /> */}
      
      {/* Example: Preload logo */}
      {/* <link
        rel="preload"
        as="image"
        href="/images/logo.svg"
        type="image/svg+xml"
      /> */}
    </>
  );
}

/**
 * Preload critical CSS
 * Only use for truly critical CSS
 */
export function PreloadCriticalCSS() {
  return (
    <>
      {/* Example: Preload critical CSS file if split */}
      {/* <link
        rel="preload"
        as="style"
        href="/styles/critical.css"
      /> */}
    </>
  );
}

/**
 * Prefetch resources likely to be needed on next page
 * Use this strategically for predictable user journeys
 */
export function PrefetchNextPage({ href }: { href: string }) {
  return (
    <link rel="prefetch" href={href} />
  );
}

/**
 * Combined performance hints component
 * Use this in your root layout
 */
export function PerformanceHints() {
  return (
    <>
      <ResourceHints />
      <PreloadCriticalImages />
      <PreloadCriticalCSS />
    </>
  );
}

/**
 * Custom hook for prefetching routes programmatically
 */
export function usePrefetch() {
  const prefetch = (url: string) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  };

  return { prefetch };
}

/**
 * Component to prefetch on hover
 * Wrap links that should prefetch on hover
 */
export function PrefetchOnHover({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const { prefetch } = usePrefetch();

  return (
    <div
      onMouseEnter={() => prefetch(href)}
      onTouchStart={() => prefetch(href)}
    >
      {children}
    </div>
  );
}
