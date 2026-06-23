/**
 * Dynamic Import Utilities for Performance Optimization
 * 
 * This file provides utilities for lazy loading components
 * to reduce initial bundle size and improve Core Web Vitals.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * Loading skeleton placeholder
 */
export const LoadingSkeleton = () => {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
};

/**
 * Generic dynamic import with loading state
 */
export function lazyLoad<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  options: {
    loading?: () => React.ReactElement;
    ssr?: boolean;
  } = {}
) {
  return dynamic(importFunc, {
    loading: options.loading || LoadingSkeleton,
    ssr: options.ssr !== false,
  });
}

/**
 * Lazy load for components that don't need SSR
 */
export function clientOnly<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  loading?: () => React.ReactElement
) {
  return dynamic(importFunc, {
    ssr: false,
    loading: loading || LoadingSkeleton,
  });
}

/**
 * Preload a dynamic component
 * Useful for components that will likely be needed soon
 */
export function preloadComponent<P extends object>(
  component: ReturnType<typeof dynamic<P>>
) {
  if ('preload' in component && typeof component.preload === 'function') {
    component.preload();
  }
}

/**
 * Common lazy-loaded components
 * These are heavy components that should be loaded on demand
 */

// Example usage patterns (uncomment and adjust based on your components):
// export const LazyProductGrid = lazyLoad(() => import('@/components/product/product-grid'));
// export const LazyTestimonials = lazyLoad(() => import('@/components/testimonials'));
// export const LazyNewsletterForm = clientOnly(() => import('@/components/newsletter-form'));

// For modals and dialogs (client-only, no SSR needed)
// export const LazyModal = clientOnly(() => import('@/components/ui/modal'));
// export const LazyDialog = clientOnly(() => import('@/components/ui/dialog'));

// For charts and data visualization
// export const LazyChart = clientOnly(() => import('@/components/charts'));
// export const LazyAnalyticsDashboard = clientOnly(() => import('@/components/analytics-dashboard'));

// For rich text editors
// export const LazyRichTextEditor = clientOnly(() => import('@/components/rich-text-editor'));

// For image galleries
// export const LazyImageGallery = clientOnly(() => import('@/components/image-gallery'));

// Export a function to dynamically import any component by path
export function dynamicImport<P extends object>(
  path: string,
  options?: Parameters<typeof lazyLoad>[1]
) {
  return lazyLoad<P>(() => import(`@/${path}` as any), options);
}
