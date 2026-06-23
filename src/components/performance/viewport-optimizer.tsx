/**
 * Viewport Optimizer
 * 
 * Optimizes viewport rendering for better mobile performance
 * Handles responsive breakpoints efficiently
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Viewport dimensions hook
 */
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      // Debounce resize events
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setViewport({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewport;
}

/**
 * Breakpoint hook
 */
export function useBreakpoint() {
  const { width } = useViewport();

  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    isLarge: width >= 1280,
    isXLarge: width >= 1536,
    width,
  };
}

/**
 * Media query hook
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
    // Legacy browsers
    else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return matches;
}

/**
 * Orientation hook
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait'
  );

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    };

    window.addEventListener('resize', handleOrientationChange, { passive: true });
    
    // Check for orientation API
    if ('orientation' in screen) {
      screen.orientation?.addEventListener('change', handleOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      if ('orientation' in screen) {
        screen.orientation?.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  return orientation;
}

/**
 * Touch device detection
 */
export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        (navigator as any).msMaxTouchPoints > 0
      );
    };

    checkTouch();
  }, []);

  return isTouch;
}

/**
 * Reduced motion preference
 */
export function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Network information
 */
export function useNetworkInfo() {
  const [networkInfo, setNetworkInfo] = useState<{
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;

    if (connection) {
      const updateNetworkInfo = () => {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });
      };

      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);

      return () => {
        connection.removeEventListener('change', updateNetworkInfo);
      };
    }
  }, []);

  return networkInfo;
}

/**
 * Device memory
 */
export function useDeviceMemory() {
  const [memory, setMemory] = useState<number | undefined>();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'deviceMemory' in navigator) {
      setMemory((navigator as any).deviceMemory);
    }
  }, []);

  return memory;
}

/**
 * Adaptive loading hook
 * Suggests loading strategy based on device capabilities
 */
export function useAdaptiveLoading() {
  const { isMobile } = useBreakpoint();
  const networkInfo = useNetworkInfo();
  const memory = useDeviceMemory();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Determine if we should use lightweight mode
  const shouldUseLightweight = 
    isMobile ||
    networkInfo.saveData ||
    networkInfo.effectiveType === 'slow-2g' ||
    networkInfo.effectiveType === '2g' ||
    (memory && memory < 4);

  return {
    shouldUseLightweight,
    shouldLazyLoad: shouldUseLightweight || isMobile,
    shouldReduceAnimations: prefersReducedMotion || shouldUseLightweight,
    shouldPreload: !shouldUseLightweight && !isMobile,
    imageQuality: shouldUseLightweight ? 75 : 85,
    recommendedChunkSize: shouldUseLightweight ? 'small' : 'normal',
  };
}

/**
 * Viewport visibility hook
 */
export function useVisibilityChange() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
