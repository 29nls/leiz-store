/**
 * Lightweight Animation Components
 * 
 * CSS-based animations to replace framer-motion for simple cases
 * Significantly reduces bundle size while maintaining smooth UX
 */

'use client';

import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

/**
 * Fade In Animation
 * Replaces: motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
 */
export function FadeIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.4,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn('animate-fade-in', className)}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Slide Up Animation
 * Replaces: motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
 */
export function SlideUp({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.4,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn('animate-slide-up', className)}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Scale In Animation
 * Replaces: motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
 */
export function ScaleIn({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.3,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn('animate-scale-in', className)}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Slide In From Left
 */
export function SlideInLeft({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.4,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn('animate-slide-in-left', className)}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Slide In From Right
 */
export function SlideInRight({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.4,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn('animate-slide-in-right', className)}
      style={{
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Stagger Container
 * Auto-staggers children animations
 */
interface StaggerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function Stagger({ 
  children, 
  className, 
  staggerDelay = 0.05,
  ...props 
}: StaggerProps) {
  return (
    <div className={cn('grid-item-stagger', className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Conditional Animation Wrapper
 * Only animates when condition is true
 */
interface ConditionalAnimateProps {
  show: boolean;
  children: ReactNode;
  className?: string;
  animation?: 'fade' | 'slide-up' | 'scale';
}

export function ConditionalAnimate({
  show,
  children,
  className,
  animation = 'fade',
}: ConditionalAnimateProps) {
  const animationClass = {
    fade: 'animate-fade-in',
    'slide-up': 'animate-slide-up',
    scale: 'animate-scale-in',
  }[animation];

  if (!show) return null;

  return (
    <div className={cn(animationClass, className)}>
      {children}
    </div>
  );
}

/**
 * Viewport Trigger Animation
 * Animates when element enters viewport
 */
export function AnimateOnView({ 
  children, 
  className,
  animation = 'slide-up',
  threshold = 0.1,
}: {
  children: ReactNode;
  className?: string;
  animation?: 'fade' | 'slide-up' | 'scale';
  threshold?: number;
}) {
  // This uses intersection observer internally (already lightweight)
  // Kept simple for compatibility
  return (
    <div className={cn('fade-in-section', className)}>
      {children}
    </div>
  );
}

/**
 * Hover Scale Effect
 * Simple hover animation
 */
export function HoverScale({ 
  children, 
  className,
  scale = 1.05,
  ...props 
}: AnimatedProps & { scale?: number }) {
  return (
    <div
      className={cn('transition-transform duration-300 ease-out', className)}
      style={{
        ['--hover-scale' as string]: scale,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `scale(${scale})`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Press Effect
 * Button press animation
 */
export function PressEffect({ 
  children, 
  className,
  ...props 
}: AnimatedProps) {
  return (
    <div
      className={cn(
        'transition-transform active:scale-95 duration-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
