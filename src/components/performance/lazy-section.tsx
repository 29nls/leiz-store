/**
 * Lazy Section Component
 * 
 * Lazy loads sections of content when they become visible
 * Uses Intersection Observer for efficient viewport detection
 */

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface LazySectionProps {
  children: ReactNode;
  /** Fallback content while loading */
  fallback?: ReactNode;
  /** Root margin for Intersection Observer */
  rootMargin?: string;
  /** Threshold for Intersection Observer */
  threshold?: number;
  /** Custom className */
  className?: string;
  /** Minimum height while loading */
  minHeight?: string;
  /** Whether to use fade-in animation */
  animate?: boolean;
  /** Custom style */
  style?: React.CSSProperties;
}

/**
 * Default loading skeleton
 */
function DefaultFallback({ minHeight }: { minHeight?: string }) {
  return (
    <div
      className="animate-pulse space-y-4"
      style={{ minHeight: minHeight || '200px' }}
    >
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  );
}

/**
 * Lazy Section Component
 * Only renders children when section is visible in viewport
 */
export function LazySection({
  children,
  fallback,
  rootMargin = '100px',
  threshold = 0.01,
  className = '',
  minHeight,
  animate = true,
  style,
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = sectionRef.current;
    if (!currentRef) return;

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true);
            setHasLoaded(true);
            // Disconnect after first load
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, hasLoaded]);

  return (
    <div
      ref={sectionRef}
      className={`${className} ${
        animate && isVisible
          ? 'animate-fade-in'
          : animate
          ? 'opacity-0'
          : ''
      }`}
      style={{ minHeight: !isVisible ? minHeight : undefined, ...style }}
    >
      {isVisible ? children : (fallback || <DefaultFallback minHeight={minHeight} />)}
    </div>
  );
}

/**
 * Lazy load multiple sections with staggered animation
 */
interface LazySectionsProps {
  sections: Array<{
    id: string;
    content: ReactNode;
    fallback?: ReactNode;
    minHeight?: string;
  }>;
  staggerDelay?: number;
  className?: string;
}

export function LazySections({
  sections,
  staggerDelay = 100,
  className = '',
}: LazySectionsProps) {
  return (
    <div className={className}>
      {sections.map((section, index) => (
        <LazySection
          key={section.id}
          fallback={section.fallback}
          minHeight={section.minHeight}
          className={`transition-all duration-300`}
          style={{
            transitionDelay: `${index * staggerDelay}ms`,
          }}
        >
          {section.content}
        </LazySection>
      ))}
    </div>
  );
}

/**
 * Lazy load grid items
 */
interface LazyGridProps {
  items: ReactNode[];
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export function LazyGrid({
  items,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className = '',
}: LazyGridProps) {
  const gridCols = `
    grid-cols-${columns.xs || 1}
    sm:grid-cols-${columns.sm || 2}
    md:grid-cols-${columns.md || 3}
    lg:grid-cols-${columns.lg || 4}
    ${columns.xl ? `xl:grid-cols-${columns.xl}` : ''}
  `;

  return (
    <div className={`grid ${gridCols} gap-${gap} ${className}`}>
      {items.map((item, index) => (
        <LazySection
          key={index}
          rootMargin="200px"
          className="transition-all duration-300"
        >
          {item}
        </LazySection>
      ))}
    </div>
  );
}

/**
 * Wrapper for lazily loading heavy components
 */
interface LazyComponentProps {
  /** Function that returns a dynamic import */
  loader: () => Promise<{ default: React.ComponentType<any> }>;
  /** Props to pass to the loaded component */
  componentProps?: any;
  /** Loading fallback */
  fallback?: ReactNode;
  /** Error fallback */
  errorFallback?: ReactNode;
}

export function LazyComponent({
  loader,
  componentProps = {},
  fallback,
  errorFallback,
}: LazyComponentProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    loader()
      .then((mod) => setComponent(() => mod.default))
      .catch((err) => setError(err));
  }, [isVisible, loader]);

  return (
    <div ref={ref}>
      {error && (errorFallback || <div>Error loading component</div>)}
      {!Component && !error && (fallback || <DefaultFallback />)}
      {Component && <Component {...componentProps} />}
    </div>
  );
}
