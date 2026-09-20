import { useState, useEffect } from 'react';

export type AppRoute =
  | { type: 'reels'; reelId?: string }
  | { type: 'shop' }
  | { type: 'product'; productId: string }
  | { type: 'store'; sellerId: string }
  | { type: 'checkout' }
  | { type: 'cart' }
  | { type: 'messages' }
  | { type: 'profile'; userId?: string }
  | { type: 'admin' };

/**
 * Parses the current pathname into a structured AppRoute
 */
export function parseRoute(pathname: string): AppRoute {
  const normalized = pathname.trim().replace(/\/+$/, '') || '/';

  // /product/:productId
  const productMatch = normalized.match(/^\/product\/([^/]+)$/i);
  if (productMatch) {
    return { type: 'product', productId: decodeURIComponent(productMatch[1]) };
  }

  // /store/:sellerId or /creator/:sellerId
  const storeMatch = normalized.match(/^\/(?:store|creator)\/([^/]+)$/i);
  if (storeMatch) {
    return { type: 'store', sellerId: decodeURIComponent(storeMatch[1]) };
  }

  // /reel/:reelId
  const reelMatch = normalized.match(/^\/reel\/([^/]+)$/i);
  if (reelMatch) {
    return { type: 'reels', reelId: decodeURIComponent(reelMatch[1]) };
  }

  // /shop
  if (normalized === '/shop') {
    return { type: 'shop' };
  }

  // /checkout
  if (normalized === '/checkout') {
    return { type: 'checkout' };
  }

  // /cart
  if (normalized === '/cart') {
    return { type: 'cart' };
  }

  // /messages
  if (normalized === '/messages') {
    return { type: 'messages' };
  }

  // /profile or /profile/:userId
  const profileMatch = normalized.match(/^\/profile(?:\/([^/]+))?$/i);
  if (profileMatch) {
    return { type: 'profile', userId: profileMatch[1] ? decodeURIComponent(profileMatch[1]) : undefined };
  }

  // /admin
  if (normalized === '/admin') {
    return { type: 'admin' };
  }

  // Default: reels / home
  return { type: 'reels' };
}

/**
 * Hook to subscribe to URL changes (popstate and app-route-change events)
 */
export function useCurrentRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') return { type: 'reels' };
    return parseRoute(window.location.pathname);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      setRoute(parseRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('app-route-change', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('app-route-change', handleLocationChange);
    };
  }, []);

  return route;
}

/**
 * Converts a structured AppRoute to a URL pathname
 */
export function routeToPath(route: AppRoute): string {
  switch (route.type) {
    case 'product':
      return `/product/${encodeURIComponent(route.productId)}`;
    case 'store':
      return `/store/${encodeURIComponent(route.sellerId)}`;
    case 'reels':
      return route.reelId ? `/reel/${encodeURIComponent(route.reelId)}` : '/';
    case 'shop':
      return '/shop';
    case 'checkout':
      return '/checkout';
    case 'cart':
      return '/cart';
    case 'messages':
      return '/messages';
    case 'profile':
      return route.userId ? `/profile/${encodeURIComponent(route.userId)}` : '/profile';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}

/**
 * Change URL programmatically using HTML5 History API without page reload
 */
export function navigateTo(path: string, options?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (current === path) return;

  if (options?.replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  window.dispatchEvent(new CustomEvent('app-route-change', { detail: { path } }));
}

/**
 * Get full public shareable URL for a product (ideal for Meta Ads / social links)
 */
export function getProductShareUrl(productId: string): string {
  if (typeof window === 'undefined') return `/product/${productId}`;
  return `${window.location.origin}/product/${productId}`;
}

/**
 * Get full public shareable URL for a creator store
 */
export function getStoreShareUrl(sellerId: string): string {
  if (typeof window === 'undefined') return `/store/${sellerId}`;
  return `${window.location.origin}/store/${sellerId}`;
}

/**
 * Get full public shareable URL for a reel
 */
export function getReelShareUrl(reelId: string): string {
  if (typeof window === 'undefined') return `/reel/${reelId}`;
  return `${window.location.origin}/reel/${reelId}`;
}
