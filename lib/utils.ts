/**
 * Utility Functions
 */

/**
 * Format price with Mongolian Tugrik (₮)
 */
export function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) {
    return '0 ₮';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price) + ' ₮';
}

export function formatCurrency(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format phone number
 */
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3-$4');
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generate random seed for images
 */
export function getImageSeed(id: string | number): string {
  return `product${id}`;
}

/**
 * Check if product is new (within last 7 days)
 */
export function isNewProduct(id: string): boolean {
  return id.startsWith('new-');
}

/**
 * Check if a date is within the last 24 hours
 */
export function isWithin24Hours(date: string | Date | undefined): boolean {
  if (!date) return false;
  const createdAt = new Date(date);
  const now = new Date();
  const diffInMs = now.getTime() - createdAt.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours < 24;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(originalPrice: number, salePrice: number): number {
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/**
 * Generate star rating array
 */
export function getStarRating(rating: number): boolean[] {
  return Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
}

/**
 * Debounce function for search
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get absolute API URL for server or client components.
 * - Browser (client-side): always uses relative paths → same origin, no CORS
 * - Server-side: uses NEXT_PUBLIC_BASE_URL for absolute URL
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Always use relative paths in the browser — this avoids CORS entirely
  // because the request goes to the same origin as the page
  if (typeof window !== 'undefined') {
    return cleanPath;
  }

  // Server-side: need absolute URL for fetch() to work
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return cleanPath;

  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}${cleanPath}`;
}
