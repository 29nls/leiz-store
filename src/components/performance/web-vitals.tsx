/**
 * Web Vitals Monitoring Component
 * 
 * Reports Core Web Vitals metrics to analytics
 * Helps track performance in production
 */

'use client';

import { useEffect, useRef } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

/**
 * Web Vitals Reporter
 * Add this component to your root layout to track performance
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Web Vital:', {
        name: metric.name,
        value: Math.round(metric.value),
        rating: metric.rating,
        id: metric.id,
      });
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production') {
      // Send to Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', metric.name, {
          value: Math.round(metric.value),
          event_category: 'Web Vitals',
          event_label: metric.id,
          non_interaction: true,
        });
      }

      // Send to custom analytics endpoint
      sendToAnalytics(metric);
    }
  });

  return null;
}

/**
 * Send metrics to custom analytics endpoint
 */
async function sendToAnalytics(metric: any) {
  try {
    const _body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });

    // Send to your analytics API
    // Uncomment and configure your endpoint
    /*
    await fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
    */

    // Or send to external service
    // await fetch('https://analytics.example.com/vitals', { ... });
  } catch (error) {
    // Fail silently in production
    console.error('Failed to send web vitals:', error);
  }
}

/**
 * Performance Observer Hook
 * Monitor specific performance entries
 */
export function usePerformanceObserver(
  entryTypes: string[],
  callback: (entries: PerformanceEntry[]) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Stabilize entryTypes with JSON.stringify to avoid re-creating observer on every render
  const typesKey = JSON.stringify(entryTypes);

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      callbackRef.current(list.getEntries());
    });

    try {
      observer.observe({ entryTypes: JSON.parse(typesKey) });
    } catch (error) {
      console.error('Performance observer error:', error);
    }

    return () => observer.disconnect();
  }, [typesKey]);
}

/**
 * Core Web Vitals thresholds
 */
export const WEB_VITALS_THRESHOLDS = {
  // Largest Contentful Paint
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  // First Input Delay
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  // Cumulative Layout Shift
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // First Contentful Paint
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  // Time to First Byte
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  // Interaction to Next Paint
  INP: {
    good: 200,
    needsImprovement: 500,
  },
};

/**
 * Get rating for a metric
 */
export function getMetricRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];
  
  if (!thresholds) return 'good';

  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Format metric value for display
 */
export function formatMetricValue(name: string, value: number): string {
  if (name === 'CLS') {
    return value.toFixed(3);
  }
  if (name === 'TTFB' || name === 'FCP' || name === 'LCP' || name === 'FID' || name === 'INP') {
    return `${Math.round(value)}ms`;
  }
  return Math.round(value).toString();
}

/**
 * Performance Budget Checker
 * Warn if metrics exceed budgets
 */
export function usePerformanceBudget(budgets: Record<string, number>) {
  useReportWebVitals((metric) => {
    const budget = budgets[metric.name];
    if (budget && metric.value > budget) {
      console.warn(
        `⚠️ Performance Budget Exceeded: ${metric.name}`,
        `Value: ${Math.round(metric.value)}, Budget: ${budget}`
      );
    }
  });
}

/**
 * Example usage in root layout:
 * 
 * import { WebVitalsReporter, usePerformanceBudget } from '@/components/performance/web-vitals';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <WebVitalsReporter />
 *         {children}
 *       </body>
 *     </html>
 *   );
 * }
 */
