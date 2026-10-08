import { useState, useEffect } from 'react';

export type AppRoute =
  | { type: 'inicio'; reelId?: string; reelSlug?: string }
  | { type: 'reels'; reelId?: string; reelSlug?: string }
  | { type: 'shop' }
  | { type: 'product'; productId: string; productSlug?: string }
  | { type: 'store'; sellerId: string }
  | { type: 'checkout' }
  | { type: 'thankyou'; orderId?: string }
  | { type: 'cart' }
  | { type: 'messages' }
  | { type: 'profile'; userId?: string; profileTab?: string }
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
  if (!productOrId) return '/tienda/catalogo';
  if (typeof productOrId === 'object') {
    const id = (productOrId.id || productOrId._id || '').trim();
    if (!id) return '/tienda/catalogo';
    return `/tienda/${encodeURIComponent(id)}`;
  }

  const id = (productOrId || '').trim();
  if (!id) return '/tienda/catalogo';
  return `/tienda/${encodeURIComponent(id)}`;
}

/**
 * Returns the main shop catalog URL path `/tienda/catalogo`
 */
export function getShopPath(): string {
  return '/tienda/catalogo';
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
 * Returns the order thank you URL path `/tienda/grasia/:orderId` (or `/tienda/grasia` without ID)
 */
export function getThankYouPath(
  orderOrId?: string | { id?: string; _id?: string } | null
): string {
  if (!orderOrId) return '/tienda/grasia';
  const id = typeof orderOrId === 'object' ? orderOrId.id || (orderOrId as any)._id : orderOrId;
  const cleanId = (id || '').trim();
  if (!cleanId) return '/tienda/grasia';
  return `/tienda/grasia/${encodeURIComponent(cleanId)}`;
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
 * Returns true if the user path segment represents a generic or guest user
 */
export function isGenericProfileUser(rawUser?: string): boolean {
  if (!rawUser) return true;
  const lower = rawUser.toLowerCase().trim().replace(/^@/, '');
  return (
    !lower ||
    lower === 'usuario' ||
    lower === 'invitado' ||
    lower === 'guest' ||
    lower === 'current_user' ||
    lower === 'usuario_actual' ||
    lower.startsWith('invitado_') ||
    lower.startsWith('guest_')
  );
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

  // /tienda/verificacion (also supports /tienda/verificasion, /checkout, /shop/checkout, /tienda/checkout, or /verificacion)
  if (/^\/(?:tienda\/|shop\/)?(?:verificacion|verificasion|checkout)$/i.test(normalized)) {
    return { type: 'checkout' };
  }

  // /tienda/grasia/:orderId or /tienda/gracia/:orderId (with purchase order ID)
  const thankyouWithOrderMatch = normalized.match(
    /^\/(?:tienda\/|shop\/)?(?:gracia|gracias|grasia|grasias|thankyou|thank-you)\/([^/]+)$/i
  );
  if (thankyouWithOrderMatch) {
    return {
      type: 'thankyou',
      orderId: decodeURIComponent(thankyouWithOrderMatch[1]).trim(),
    };
  }

  // /tienda/gracia or /tienda/grasia (without order ID)
  if (/^\/(?:tienda\/|shop\/)?(?:gracia|gracias|grasia|grasias|thankyou|thank-you)$/i.test(normalized)) {
    return { type: 'thankyou' };
  }

  // /tienda or /tienda/catalogo or /shop
  if (/^\/(?:tienda|shop)(?:\/catalogo)?$/i.test(normalized)) {
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

  // /perfil/:userId/guardado or /perfil/guardado or /app/web/perfil/guardado
  const profileSavedMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/guardados?$/i
  );
  if (profileSavedMatch) {
    const rawUser = profileSavedMatch[1] ? decodeURIComponent(profileSavedMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'guardado',
    };
  }

  // /perfil/:userId/compra or /perfil/compra or /app/web/perfil/compra
  const profileCompraMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/compras?$/i
  );
  if (profileCompraMatch) {
    const rawUser = profileCompraMatch[1] ? decodeURIComponent(profileCompraMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'compra',
    };
  }

  // /perfil/:userId/config or /perfil/config or /app/web/perfil/config
  const profileConfigMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/(?:config|configuracion)$/i
  );
  if (profileConfigMatch) {
    const rawUser = profileConfigMatch[1] ? decodeURIComponent(profileConfigMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'config',
    };
  }

  // /perfil/:userId/producto or /perfil/:userId/productos or /app/web/perfil/productos
  const profileProductoMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/productos?$/i
  );
  if (profileProductoMatch) {
    const rawUser = profileProductoMatch[1] ? decodeURIComponent(profileProductoMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'producto',
    };
  }

  // /perfil/:userId/venta or /perfil/:userId/ventas or /app/web/perfil/venta
  const profileVentaMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/ventas?$/i
  );
  if (profileVentaMatch) {
    const rawUser = profileVentaMatch[1] ? decodeURIComponent(profileVentaMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'venta',
    };
  }

  // /perfil/:userId/publicaciones or /perfil/:userId/publicacion or /app/web/perfil/publicaciones
  const profilePublicacionesMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/publicacion(?:es)?$/i
  );
  if (profilePublicacionesMatch) {
    const rawUser = profilePublicacionesMatch[1] ? decodeURIComponent(profilePublicacionesMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'publicaciones',
    };
  }

  // /perfil/:userId/publicar or /app/web/perfil/publicar
  const profilePublicarMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/publicar$/i
  );
  if (profilePublicarMatch) {
    const rawUser = profilePublicarMatch[1] ? decodeURIComponent(profilePublicarMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'publicar',
    };
  }

  // /perfil/:userId/rendimiento or /app/web/perfil/usuario/rendimiento or /app/web/perfil/rendimiento
  const profileRendimientoMatch = normalized.match(
    /^\/(?:src\/app\/web\/|app\/web\/)?(?:perfil|profile)(?:\/([^/]+))?\/rendimientos?$/i
  );
  if (profileRendimientoMatch) {
    const rawUser = profileRendimientoMatch[1] ? decodeURIComponent(profileRendimientoMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return {
      type: 'profile',
      userId: isGenericUser ? undefined : rawUser,
      profileTab: 'rendimiento',
    };
  }

  // /perfil or /perfil/:userId (also supports legacy /profile or /profile/:userId)
  const profileMatch = normalized.match(/^\/(?:perfil|profile)(?:\/([^/]+))?$/i);
  if (profileMatch) {
    const rawUser = profileMatch[1] ? decodeURIComponent(profileMatch[1]) : undefined;
    const isGenericUser = isGenericProfileUser(rawUser);
    return { type: 'profile', userId: isGenericUser ? undefined : rawUser };
  }

  // /admin/resumen, /admin/usuarios, /admin/metrica, or /admin
  const adminMatch = normalized.match(/^\/(?:src\/app\/|app\/(?:web\/)?)?admin(?:\/([^/]+))?(?:\/.*)?$/i);
  if (adminMatch) {
    let decodedTab = 'resumen';
    if (adminMatch[1]) {
      try {
        decodedTab = decodeURIComponent(adminMatch[1]).toLowerCase();
      } catch {
        decodedTab = adminMatch[1].toLowerCase();
      }
    }
    return {
      type: 'admin',
      adminTab: decodedTab,
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
      if (route.profileTab === 'guardado') {
        return getProfileSavedPath(route.userId);
      }
      if (route.profileTab === 'compra') {
        return getProfileCompraPath(route.userId);
      }
      if (route.profileTab === 'config') {
        return getProfileConfigPath(route.userId);
      }
      if (route.profileTab === 'producto') {
        return getProfileProductoPath(route.userId);
      }
      if (route.profileTab === 'venta') {
        return getProfileVentaPath(route.userId);
      }
      if (route.profileTab === 'publicaciones') {
        return getProfilePublicacionesPath(route.userId);
      }
      if (route.profileTab === 'publicar') {
        return getProfilePublicarPath(route.userId);
      }
      if (route.profileTab === 'rendimiento') {
        return getProfileRendimientoPath(route.userId);
      }
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
    if (isGenericProfileUser(clean)) {
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
  if (isGenericProfileUser(clean)) {
    return '/perfil';
  }
  if (clean.includes('@')) {
    const fromName = (usernameOrUser.name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._-]/g, '');
    clean = fromName && !isGenericProfileUser(fromName) ? fromName : clean.split('@')[0];
  }
  return clean ? `/perfil/${encodeURIComponent(clean)}` : '/perfil';
}

/**
 * Returns the saved publications URL path `/perfil/:username/guardado`
 * (or `/perfil/usuario/guardado` if the user is a guest / has no username).
 */
export function getProfileSavedPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/guardado';
  }
  return `${basePath}/guardado`;
}

/**
 * Returns the purchases URL path `/perfil/:username/compra`
 * (or `/perfil/usuario/compra` if the user is a guest / has no username).
 */
export function getProfileCompraPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/compra';
  }
  return `${basePath}/compra`;
}

/**
 * Returns the profile configuration URL path `/perfil/:username/config`
 * (or `/perfil/usuario/config` if the user is a guest / has no username).
 */
export function getProfileConfigPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/config';
  }
  return `${basePath}/config`;
}

/**
 * Returns the profile products URL path `/perfil/:username/producto`
 * (or `/perfil/usuario/producto` if the user is a guest / has no username).
 */
export function getProfileProductoPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/producto';
  }
  return `${basePath}/producto`;
}

/**
 * Returns the profile incoming sales URL path `/perfil/:username/venta`
 * (or `/perfil/usuario/venta` if the user is a guest / has no username).
 */
export function getProfileVentaPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/venta';
  }
  return `${basePath}/venta`;
}

/**
 * Returns the profile publications URL path `/perfil/:username/publicaciones`
 * (or `/perfil/usuario/publicaciones` if the user is a guest / has no username).
 */
export function getProfilePublicacionesPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/publicaciones';
  }
  return `${basePath}/publicaciones`;
}

/**
 * Returns the profile publish URL path `/perfil/:username/publicar`
 * (or `/perfil/usuario/publicar` if the user is a guest / has no username).
 */
export function getProfilePublicarPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/publicar';
  }
  return `${basePath}/publicar`;
}

/**
 * Returns the profile performance URL path `/perfil/:username/rendimiento`
 * (or `/perfil/usuario/rendimiento` if the user is a guest / has no username).
 */
export function getProfileRendimientoPath(
  usernameOrUser?: string | { username?: string; name?: string; isGuest?: boolean } | null
): string {
  const basePath = getProfilePath(usernameOrUser);
  if (basePath === '/perfil') {
    return '/perfil/usuario/rendimiento';
  }
  return `${basePath}/rendimiento`;
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
