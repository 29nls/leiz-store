/**
 * Optimized Image Component
 * 
 * Wrapper around Next.js Image with performance best practices
 * - Automatic lazy loading for below-the-fold images
 * - Priority loading for above-the-fold images
 * - Blur placeholder for better perceived performance
 * - Responsive sizing
 */

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder'> {
  /** Mark as critical for above-the-fold images */
  priority?: boolean;
  /** Add blur placeholder */
  withBlur?: boolean;
  /** Custom blur data URL */
  blurDataURL?: string;
  /** Show loading skeleton */
  showSkeleton?: boolean;
  /** Aspect ratio (width/height) */
  aspectRatio?: number;
  /** Container className */
  containerClassName?: string;
}

/**
 * Generate a simple blur placeholder
 */
function generateBlurDataURL(width = 10, height = 10): string {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) {
    // Fallback blur data URL
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=';
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas.toDataURL();
}

/**
 * Loading skeleton for images
 */
function ImageSkeleton({ aspectRatio }: { aspectRatio?: number }) {
  const paddingBottom = aspectRatio ? `${(1 / aspectRatio) * 100}%` : '100%';
  
  return (
    <div
      className="animate-pulse bg-gray-200"
      style={{ paddingBottom }}
    />
  );
}

/**
 * Optimized Image Component
 */
export function OptimizedImage({
  priority = false,
  withBlur = true,
  blurDataURL,
  showSkeleton = true,
  aspectRatio,
  containerClassName = '',
  className = '',
  alt,
  onLoadingComplete,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadingComplete: ImageProps['onLoadingComplete'] = (result) => {
    setIsLoading(false);
    onLoadingComplete?.(result);
  };

  const handleError: ImageProps['onError'] = (error) => {
    setIsLoading(false);
    setHasError(true);
    props.onError?.(error);
  };

  // Generate blur placeholder if needed
  const placeholder = withBlur ? 'blur' : 'empty';
  const finalBlurDataURL = withBlur 
    ? (blurDataURL || generateBlurDataURL())
    : undefined;

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Loading skeleton */}
      {showSkeleton && isLoading && (
        <div className="absolute inset-0 z-10">
          <ImageSkeleton aspectRatio={aspectRatio} />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">Image not available</p>
          </div>
        </div>
      )}

      {/* Actual image */}
      <Image
        {...props}
        alt={alt}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={finalBlurDataURL}
        onLoadingComplete={handleLoadingComplete}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
}

/**
 * Product Image with optimized defaults
 */
export function ProductImage({
  src,
  alt,
  priority = false,
  ...props
}: Omit<OptimizedImageProps, 'aspectRatio'>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      priority={priority}
      aspectRatio={1} // Square aspect ratio for products
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      {...props}
    />
  );
}

/**
 * Hero Image with optimized defaults
 */
export function HeroImage({
  src,
  alt,
  ...props
}: Omit<OptimizedImageProps, 'priority' | 'aspectRatio'>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      priority={true} // Always prioritize hero images
      aspectRatio={16 / 9}
      sizes="100vw"
      quality={90}
      {...props}
    />
  );
}

/**
 * Avatar Image with optimized defaults
 */
export function AvatarImage({
  src,
  alt,
  size = 40,
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height' | 'aspectRatio'> & {
  size?: number;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      aspectRatio={1}
      className="rounded-full"
      {...props}
    />
  );
}

/**
 * Background Image with optimized defaults
 */
export function BackgroundImage({
  src,
  alt,
  priority = false,
  children,
  ...props
}: OptimizedImageProps & {
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <OptimizedImage
        src={src}
        alt={alt}
        priority={priority}
        fill
        className="object-cover"
        sizes="100vw"
        {...props}
      />
      {children && (
        <div className="relative z-10">{children}</div>
      )}
    </div>
  );
}
