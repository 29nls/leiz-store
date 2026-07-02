/**
 * Optimized Framer Motion Wrapper
 * 
 * Lazy loads framer-motion only when animations are needed
 * Provides lightweight alternatives for simple animations
 */

'use client';

import dynamic from 'next/dynamic';

// Lazy load framer-motion components
export const Motion = {
  div: dynamic(
    () => import('framer-motion').then((mod) => mod.motion.div),
    { ssr: true }
  ),
  section: dynamic(
    () => import('framer-motion').then((mod) => mod.motion.section),
    { ssr: true }
  ),
  span: dynamic(
    () => import('framer-motion').then((mod) => mod.motion.span),
    { ssr: true }
  ),
  button: dynamic(
    () => import('framer-motion').then((mod) => mod.motion.button),
    { ssr: true }
  ),
};

// Lazy load AnimatePresence
export const AnimatePresence = dynamic(
  () => import('framer-motion').then((mod) => mod.AnimatePresence),
  { ssr: false }
);

// Common animation variants (can be used with or without framer-motion)
export const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export const slideIn = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4 },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3 },
  },
};

/**
 * Lightweight animation hook without framer-motion
 * Use this for simple CSS-based animations
 */
export function useSimpleAnimation() {
  return {
    fadeIn: 'animate-fade-in',
    slideUp: 'animate-slide-up',
    slideInLeft: 'animate-slide-in-left',
    slideInRight: 'animate-slide-in-right',
    scaleIn: 'animate-scale-in',
  };
}

/**
 * Conditional motion wrapper
 * Uses CSS animations on low-end devices, framer-motion on high-end
 */
export function useAdaptiveMotion() {
  // Could check for reduced motion preference or device capabilities
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    shouldUseFramerMotion: !prefersReducedMotion,
    Motion: prefersReducedMotion ? SimpleDivMotion : Motion,
  };
}

// Simple div that mimics motion.div API but uses CSS
const SimpleDivMotion = ({
  children,
  className = '',
  initial: _initial,
  animate: _animate,
  exit: _exit,
  ...props
}: any) => {
  return (
    <div className={`${className} animate-fade-in`} {...props}>
      {children}
    </div>
  );
};
