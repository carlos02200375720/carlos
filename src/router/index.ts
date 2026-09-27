import { useState, useEffect } from 'react';

export type AppRoute =
  | { type: 'inicio'; reelId?: string; reelSlug?: string }
  | { type: 'reels'; reelId?: string; reelSlug?: string }
  | { type: 'shop' }
  | { type: 'product'; productId: string; productSlug?: string }
  | { type: 'store'; sellerId: string }
  | { type: 'checkout' }
  | { type: 'thankyou' }
  | { type: 'cart' }
  | { type: 'messages' }
  | { type: 'profile'; userId?: string }
  | { type: 'admin' };

/**
 * Converts a product name into a clean URL-safe slug
 */
export function slugifyProductName(name?: string): string {
  if (!name) return 'producto';
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'producto';
}

/**
 * Extracts the product ID from a `/shop/:slugAndId` parameter
 */
export function extractProductIdFromShopParam(rawParam: string): string {
  const decoded = decodeURIComponent(rawParam).trim();
  // Match canonical prod_xxx suffix (e.g. "auriculares-bluetooth-prod_abc123")
  const prodMatch = decoded.match(/(?:^|-)(prod_[a-zA-Z0-9_]+)$/i);
  if (prodMatch) {
    return prodMatch[1];
  }
  // Match 24-char hex MongoDB ObjectId suffix
  const oidMatch = decoded.match(/(?:^|-)([a-f0-9]{24})$/i);
  if (oidMatch) {
    return oidMatch[1];
  }
  // If format is slug-id where id is after the last hyphen
  const lastDash = decoded.lastIndexOf('-');
  if (lastDash > 0) {
    return decoded.slice(lastDash + 1);
  }
  return decoded;
}

/**
 * Converts a publication title/description into a clean URL-safe slug
 */
export function slugifyPublicationName(name?: string): string {
  if (!name) return 'publicacion';
  const withoutHashtags = name.replace(/#\S+/g, '').trim();
  const baseText = withoutHashtags || name;
  const slug = baseText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || 'publicacion';
}

/**
 * Extracts the publication/reel ID from a `/inicio/:slugAndId` parameter
 */
export function extractReelIdFromInicioParam(rawParam: string): string {
  const decoded = decodeURIComponent(rawParam).trim();
  // Match canonical reel_xxx or pub_xxx suffix (e.g. "nueva-coleccion-reel_abc123")
  const reelMatch = decoded.match(/(?:^|-)((?:reel|pub)_[a-zA-Z0-9_-]+)$/i);
  if (reelMatch) {
    return reelMatch[1];
  }
  // Match 24-char hex MongoDB ObjectId suffix
  const oidMatch = decoded.match(/(?:^|-)([a-f0-9]{24})$/i);
  if (oidMatch) {
    return oidMatch[1];
  }
  // If format is slug-id where id is after the last hyphen
  const lastDash = decoded.lastIndexOf('-');
  if (lastDash > 0) {
    return decoded.slice(lastDash + 1);
  }
  return decoded;
}

/**
 * Returns the publication URL path `/inicio/:nombre-de-la-publicacion-:id`
 */
export function getInicioPath(
  reelOrId?:
    | string
    | { id: string; title?: string; description?: string; caption?: string; creatorName?: string }
    | null,
  publicationName?: string
): string {
  if (!reelOrId) return '/inicio';
  if (typeof reelOrId === 'object') {
    const id = (reelOrId.id || '').trim();
    if (!id) return '/inicio';
    const rawName = (
      reelOrId.title ||
      reelOrId.description ||
      reelOrId.caption ||
      publicationName ||
      reelOrId.creatorName ||
      ''
    ).trim();
    if (rawName) {
      return `/inicio/${slugifyPublicationName(rawName)}-${encodeURIComponent(id)}`;
    }
    return `/inicio/${encodeURIComponent(id)}`;
  }

  const id = (reelOrId || '').trim();
  if (!id) return '/inicio';
  const rawName = (publicationName || '').trim();
  if (rawName) {
    return `/inicio/${slugifyPublicationName(rawName)}-${encodeURIComponent(id)}`;
  }
  return `/inicio/${encodeURIComponent(id)}`;
}

/**
 * Returns the product detail URL path `/tienda/:nombre-del-producto-:id`
 */
export function getProductPath(
  productOrId: string | { id: string; name?: string },
  productName?: string
): string {
  if (typeof productOrId === 'object' && productOrId !== null) {
    const id = (productOrId.id || '').trim();
    const name = (productOrId.name || productName || '').trim();
    if (name) {
      return `/tienda/${slugifyProductName(name)}-${encodeURIComponent(id)}`;
    }
    return `/tienda/${encodeURIComponent(id)}`;
  }

  const id = (productOrId || '').trim();
  const name = (productName || '').trim();
  if (name) {
    return `/tienda/${slugifyProductName(name)}-${encodeURIComponent(id)}`;
  }
  return `/tienda/${encodeURIComponent(id)}`;
}

/**
 * Returns the main shop catalog URL path `/tienda`
 */
export function getShopPath(): string {
  return '/tienda';
}

/**
 * Returns the cart URL path `/tienda/carrito`
 */
export function getCartPath(): string {
  return '/tienda/carrito';
}

/**
 * Returns the checkout URL path `/tienda/verificacion`
 */
export function getCheckoutPath(): string {
  return '/tienda/verificacion';
}

/**
 * Returns the order thank you URL path `/tienda/gracia`
 */
export function getThankYouPath(): string {
  return '/tienda/gracia';
}

/**
 * Parses the current pathname into a structured AppRoute
 */
export function parseRoute(pathname: string): AppRoute {
  const normalized = pathname.trim().replace(/\/+$/, '') || '/';

  // /tienda/carrito (also supports legacy /shop/cart, /tienda/cart, /cart, or /shop/carrito)
  if (/^\/(?:tienda\/|shop\/)?(?:carrito|cart)$/i.test(normalized)) {
    return { type: 'cart' };
  }

  // /tienda/verificacion (also supports /checkout, /shop/checkout, /tienda/checkout, or /verificacion)
  if (/^\/(?:tienda\/|shop\/)?(?:verificacion|checkout)$/i.test(normalized)) {
    return { type: 'checkout' };
  }

  // /tienda/gracia (also supports /tienda/gracias, /shop/gracias, /gracia, /gracias, or /shop/thankyou)
  if (/^\/(?:tienda\/|shop\/)?(?:gracia|gracias|thankyou|thank-you)$/i.test(normalized)) {
    return { type: 'thankyou' };
  }

  // /tienda or /shop
  if (normalized.toLowerCase() === '/tienda' || normalized.toLowerCase() === '/shop') {
    return { type: 'shop' };
  }

  // /tienda/:slug/:productId or /shop/:slug/:productId (two segments)
  const shopTwoSegmentMatch = normalized.match(/^\/(?:tienda|shop)\/([^/]+)\/([^/]+)$/i);
  if (shopTwoSegmentMatch) {
    return {
      type: 'product',
      productSlug: decodeURIComponent(shopTwoSegmentMatch[1]),
      productId: extractProductIdFromShopParam(shopTwoSegmentMatch[2]),
    };
  }

  // /tienda/:nombre-del-producto-y-su-id or /shop/:nombre-del-producto-y-su-id (single segment)
  const shopProductMatch = normalized.match(/^\/(?:tienda|shop)\/([^/]+)$/i);
  if (shopProductMatch) {
    const rawSegment = decodeURIComponent(shopProductMatch[1]);
    return {
      type: 'product',
      productSlug: rawSegment,
      productId: extractProductIdFromShopParam(rawSegment),
    };
  }

  // Legacy /product/:productId
  const productMatch = normalized.match(/^\/product\/([^/]+)$/i);
  if (productMatch) {
    const rawSegment = decodeURIComponent(productMatch[1]);
    return {
      type: 'product',
      productSlug: rawSegment,
      productId: extractProductIdFromShopParam(rawSegment),
    };
  }

  // /store/:sellerId or /creator/:sellerId
  const storeMatch = normalized.match(/^\/(?:store|creator)\/([^/]+)$/i);
  if (storeMatch) {
    return { type: 'store', sellerId: decodeURIComponent(storeMatch[1]) };
  }

  // /inicio or /inicio/:nombre-de-la-publicacion-y-su-id (also supports legacy /reel/:reelId or /reels/:reelId)
  if (normalized.toLowerCase() === '/inicio' || normalized.toLowerCase() === '/reels') {
    return { type: 'inicio' };
  }

  const inicioMatch = normalized.match(/^\/(?:inicio|reel|reels)\/([^/]+)$/i);
  if (inicioMatch) {
    const rawSegment = decodeURIComponent(inicioMatch[1]);
    return {
      type: 'inicio',
      reelSlug: rawSegment,
      reelId: extractReelIdFromInicioParam(rawSegment),
    };
  }

  // /messages
  if (normalized === '/messages') {
    return { type: 'messages' };
  }

  // /perfil or /perfil/:userId (also supports legacy /profile or /profile/:userId)
  const profileMatch = normalized.match(/^\/(?:perfil|profile)(?:\/([^/]+))?$/i);
  if (profileMatch) {
    return { type: 'profile', userId: profileMatch[1] ? decodeURIComponent(profileMatch[1]) : undefined };
  }

  // /admin
  if (normalized === '/admin') {
    return { type: 'admin' };
  }

  // Default: inicio / home
  return { type: 'inicio' };
}

/**
 * Hook to subscribe to URL changes (popstate and app-route-change events)
 */
export function useCurrentRoute(): AppRoute {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') return { type: 'inicio' };
    return parseRoute(window.location.pathname);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationChange = () => {
      const next = parseRoute(window.location.pathname);
      setRoute((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
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
      return getProductPath(route.productId, route.productSlug);
    case 'store':
      return `/perfil/${encodeURIComponent(route.sellerId)}`;
    case 'inicio':
    case 'reels':
      return route.reelId ? getInicioPath(route.reelId, route.reelSlug) : '/inicio';
    case 'shop':
      return '/tienda';
    case 'checkout':
      return '/tienda/verificacion';
    case 'thankyou':
      return '/tienda/gracia';
    case 'cart':
      return '/tienda/carrito';
    case 'messages':
      return '/messages';
    case 'profile':
      return route.userId ? `/perfil/${encodeURIComponent(route.userId)}` : '/perfil';
    case 'admin':
      return '/admin';
    default:
      return '/inicio';
  }
}

/**
 * Returns the profile URL path `/perfil/:username` for a registered user or username,
 * or `/perfil` if the user is a guest / not registered.
 */
export function getProfilePath(usernameOrUser?: string | { username?: string; isGuest?: boolean } | null): string {
  if (!usernameOrUser) return '/perfil';
  if (typeof usernameOrUser === 'string') {
    const clean = usernameOrUser.trim().replace(/^@/, '');
    if (!clean || clean.toLowerCase() === 'invitado' || clean.toLowerCase() === 'guest' || clean.toLowerCase() === 'current_user') {
      return '/perfil';
    }
    return `/perfil/${encodeURIComponent(clean)}`;
  }
  if (usernameOrUser.isGuest) return '/perfil';
  const clean = (usernameOrUser.username || '').trim().replace(/^@/, '');
  if (!clean || clean.toLowerCase() === 'invitado' || clean.toLowerCase() === 'guest' || clean.toLowerCase() === 'current_user') {
    return '/perfil';
  }
  return `/perfil/${encodeURIComponent(clean)}`;
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
 * Get full public shareable URL for a product (/shop/:nombre-del-producto-:id)
 */
export function getProductShareUrl(
  productOrId: string | { id: string; name?: string },
  productName?: string
): string {
  const path = getProductPath(productOrId, productName);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

/**
 * Get full public shareable URL for a creator profile/store (/perfil/:username)
 */
export function getStoreShareUrl(sellerId: string): string {
  const path = getProfilePath(sellerId);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function getProfileShareUrl(username: string): string {
  return getStoreShareUrl(username);
}

/**
 * Get full public shareable URL for a home publication (/inicio/:nombre-de-la-publicacion-:id)
 */
export function getInicioShareUrl(
  reelOrId:
    | string
    | { id: string; title?: string; description?: string; caption?: string; creatorName?: string },
  publicationName?: string
): string {
  const path = getInicioPath(reelOrId, publicationName);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function getReelShareUrl(
  reelOrId:
    | string
    | { id: string; title?: string; description?: string; caption?: string; creatorName?: string },
  publicationName?: string
): string {
  return getInicioShareUrl(reelOrId, publicationName);
}
