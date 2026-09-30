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
  | { type: 'admin'; adminTab?: string };

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
 * Extracts the product ID from a `/tienda/:id` parameter (also supports legacy slug-id format)
 */
export function extractProductIdFromShopParam(rawParam: string): string {
  let decoded = rawParam.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {}

  // Match canonical prod_xxx suffix (e.g. "prod_abc123" or legacy "auriculares-bluetooth-prod_abc123")
  const prodMatch = decoded.match(/(?:^|-)(prod_[a-zA-Z0-9_-]+)$/i);
  if (prodMatch) {
    return prodMatch[1];
  }
  // Match 24-char hex MongoDB ObjectId suffix
  const oidMatch = decoded.match(/(?:^|-)([a-f0-9]{24})$/i);
  if (oidMatch) {
    return oidMatch[1];
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

export interface InicioReelLike {
  id?: string;
  _id?: string;
  title?: string;
  description?: string;
  caption?: string;
  creatorName?: string;
}

/**
 * Extracts the publication ID from a `/inicio/:id` route segment
 */
export function extractReelIdFromInicioParam(rawParam: string): string {
  let decoded = rawParam.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {}

  // Match canonical reel_xxx or pub_xxx suffix (e.g. "reel_abc123" or "slug-reel_abc123")
  const reelMatch = decoded.match(/(?:^|-)((?:reel|pub)_[a-zA-Z0-9_-]+)$/i);
  if (reelMatch) {
    return reelMatch[1];
  }
  // Match 24-char hex MongoDB ObjectId suffix
  const oidMatch = decoded.match(/(?:^|-)([a-f0-9]{24})$/i);
  if (oidMatch) {
    return oidMatch[1];
  }
  return decoded;
}

/**
 * Finds a publication/reel in a list by matching its ID
 */
export function findReelByInicioParam<T extends InicioReelLike>(
  reels: T[],
  rawParam?: string | null
): T | undefined {
  if (!rawParam || !Array.isArray(reels) || reels.length === 0) return undefined;
  const cleanParam = rawParam.trim();
  if (!cleanParam) return undefined;

  const extractedId = extractReelIdFromInicioParam(cleanParam);

  return reels.find((r) => {
    if (!r) return false;
    return (
      r.id === cleanParam ||
      r._id === cleanParam ||
      r.id === extractedId ||
      r._id === extractedId
    );
  });
}

/**
 * Returns the publication URL path `/inicio/:id` using the publication ID.
 */
export function getInicioPath(
  reelOrId?: string | InicioReelLike | null
): string {
  if (!reelOrId) return '/inicio';
  if (typeof reelOrId === 'object') {
    const id = (reelOrId.id || reelOrId._id || '').trim();
    if (!id) return '/inicio';
    return `/inicio/${encodeURIComponent(id)}`;
  }

  const id = (reelOrId || '').trim();
  if (!id) return '/inicio';
  return `/inicio/${encodeURIComponent(id)}`;
}

/**
 * Returns the product detail URL path `/tienda/:id` using the product ID.
 */
export function getProductPath(
  productOrId?: string | { id?: string; _id?: string; name?: string } | null,
  _productName?: string
): string {
  if (!productOrId) return '/tienda';
  if (typeof productOrId === 'object') {
    const id = (productOrId.id || productOrId._id || '').trim();
    if (!id) return '/tienda';
    return `/tienda/${encodeURIComponent(id)}`;
  }

  const id = (productOrId || '').trim();
  if (!id) return '/tienda';
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
 * Returns the admin summary URL path `/admin/resumen`
 */
export function getAdminPath(): string {
  return '/admin/resumen';
}

/**
 * Returns the admin users URL path `/admin/usuarios`
 */
export function getAdminUsersPath(): string {
  return '/admin/usuarios';
}

/**
 * Returns the admin reels URL path `/admin/reels`
 */
export function getAdminReelsPath(): string {
  return '/admin/reels';
}

/**
 * Returns the admin products URL path `/admin/producto`
 */
export function getAdminProductoPath(): string {
  return '/admin/producto';
}

/**
 * Returns the admin publish URL path `/admin/publicar`
 */
export function getAdminPublicarPath(): string {
  return '/admin/publicar';
}

/**
 * Returns the admin orders URL path `/admin/pedidos`
 */
export function getAdminPedidosPath(): string {
  return '/admin/pedidos';
}

/**
 * Returns the admin metrics URL path `/admin/metrica`
 */
export function getAdminMetricaPath(): string {
  return '/admin/metrica';
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

  // /inicio or /inicio/:id (also supports legacy /reel/:reelId or /reels/:reelId)
  if (normalized.toLowerCase() === '/inicio' || normalized.toLowerCase() === '/reels') {
    return { type: 'inicio' };
  }

  const inicioMatch = normalized.match(/^\/(?:inicio|reel|reels)\/([^/]+)$/i);
  if (inicioMatch) {
    let rawSegment = inicioMatch[1];
    try {
      rawSegment = decodeURIComponent(rawSegment);
    } catch {}
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

  // /admin/resumen, /admin/usuarios, or /admin
  const adminMatch = normalized.match(/^\/(?:src\/app\/|app\/)?admin(?:\/([^/]+))?$/i);
  if (adminMatch) {
    return {
      type: 'admin',
      adminTab: adminMatch[1] ? decodeURIComponent(adminMatch[1]).toLowerCase() : 'resumen',
    };
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
      return getProductPath(route.productId);
    case 'store':
      return `/perfil/${encodeURIComponent(route.sellerId)}`;
    case 'inicio':
    case 'reels':
      return route.reelId ? getInicioPath(route.reelId) : '/inicio';
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
      return route.adminTab ? `/admin/${encodeURIComponent(route.adminTab)}` : '/admin/resumen';
    default:
      return '/inicio';
  }
}

/**
 * Returns the profile URL path `/perfil/:username` for a registered user or username,
 * or `/perfil` if the user is a guest / not registered.
 */
export function getProfilePath(usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null): string {
  if (!usernameOrUser) return '/perfil';
  if (typeof usernameOrUser === 'string') {
    let clean = usernameOrUser.trim().replace(/^@/, '');
    if (!clean || clean.toLowerCase() === 'invitado' || clean.toLowerCase() === 'guest' || clean.toLowerCase() === 'current_user') {
      return '/perfil';
    }
    if (clean.includes('@')) {
      clean = clean.split('@')[0];
    }
    clean = clean
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '');
    return clean ? `/perfil/${encodeURIComponent(clean)}` : '/perfil';
  }
  if (usernameOrUser.isGuest) return '/perfil';
  let clean = (usernameOrUser.username || '').trim().replace(/^@/, '');
  if (!clean || clean.toLowerCase() === 'invitado' || clean.toLowerCase() === 'guest' || clean.toLowerCase() === 'current_user') {
    return '/perfil';
  }
  if (clean.includes('@')) {
    const fromName = (usernameOrUser.name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._-]/g, '');
    clean = fromName && fromName !== 'invitado' ? fromName : clean.split('@')[0];
  }
  return clean ? `/perfil/${encodeURIComponent(clean)}` : '/perfil';
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
 * Get full public shareable URL for a product (/tienda/:id)
 */
export function getProductShareUrl(
  productOrId: string | { id?: string; _id?: string; name?: string },
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
 * Get full public shareable URL for a home publication (/inicio/:id)
 */
export function getInicioShareUrl(
  reelOrId: string | InicioReelLike
): string {
  const path = getInicioPath(reelOrId);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function getReelShareUrl(
  reelOrId: string | InicioReelLike
): string {
  return getInicioShareUrl(reelOrId);
}
