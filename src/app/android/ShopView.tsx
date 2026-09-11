import React, { useState, useMemo, useRef, useEffect } from "react";
import { Product, CartItem, User, Order, Reel } from "../../types";
import { ShoppingBag, Search, Plus, Minus, Trash2, X, Check, ArrowRight, Sparkles, Filter, CreditCard, Tag, Truck, ShieldCheck, Heart, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { androidApiFetch } from "./api";

export interface AndroidShopViewProps {
  products: Product[];
  onAddToCart: (product: Product, quantity?: number, selectedOptions?: Record<string, string>, selectedVariantVid?: string) => void;
  cart: CartItem[];
  currentUser: User;
  onUpdateCartQuantity?: (param1: any, param2: any, param3?: any) => void;
  onRemoveFromCart?: (param1: any, param2?: any) => void;
  onClearCart?: () => void;
  users: User[];
  onSelectProduct?: (product: Product) => void;
  onSelectUser?: (user: User) => void;
  onCreatorClick?: (creatorId: string) => void;
  onOrderPlaced?: () => void;
  onOpenSocial?: () => void;
  unreadCount?: number;
  initialSelectedProduct?: Product | null;
  selectedProductDirectly?: Product | null;
  clearDirectProduct?: () => void;
  onClearInitialProduct?: () => void;
  reels?: Reel[];
  orders?: Order[];
  onUpdateOrders?: (orders: Order[]) => void;
  onCheckout?: (
    address: string,
    shippingCost: number,
    onComplete: (newOrder: Order) => void,
    itemsToCheckout?: CartItem[]
  ) => void;
  onNavigateToHistory?: () => void;
  onToggleDetailView?: (open: boolean) => void;
  initialStep?: 'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou';
  initialSelectedCartIndices?: number[];
  onClearInitialStep?: () => void;
  isLoading?: boolean;
  onRefreshProducts?: () => void;
  cartDrawerRequest?: number;
}

const DEFAULT_CATEGORIES = ["Todos", "Moda", "Calzado", "Accesorios", "Tecnología", "Belleza"];

export default function AndroidShopView({
  products,
  onAddToCart,
  cart,
  currentUser,
  onUpdateCartQuantity,
  onRemoveFromCart,
  onClearCart,
  users,
  onSelectProduct,
  onCreatorClick,
  onOrderPlaced,
  initialSelectedProduct,
  selectedProductDirectly,
  clearDirectProduct,
  onClearInitialProduct,
  onCheckout,
  isLoading = false,
  onRefreshProducts,
  cartDrawerRequest = 0,
}: AndroidShopViewProps) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    selectedProductDirectly || initialSelectedProduct || null
  );
  const [detailGalleryIndex, setDetailGalleryIndex] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showCheckoutPage, setShowCheckoutPage] = useState(false);
  const [showThankYouPage, setShowThankYouPage] = useState(false);
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]);
  const [lastDeliveryAddress, setLastDeliveryAddress] = useState("");
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    shippingAddress: "",
    country: "",
    postalCode: "",
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
  });
  const detailGalleryRef = useRef<HTMLDivElement | null>(null);

  type DetailGalleryItem = {
    type: "image" | "video";
    url: string;
  };

  const detailGallery = useMemo<DetailGalleryItem[]>(() => {
    if (!selectedProduct) return [];

    const gallery: DetailGalleryItem[] = [];
    const seen = new Set<string>();

    const push = (url?: string, type: "image" | "video" = "image") => {
      if (!url || seen.has(`${type}:${url}`)) return;
      seen.add(`${type}:${url}`);
      gallery.push({ type, url });
    };

    push(selectedProduct.imageUrl, "image");
    (selectedProduct.images || []).forEach((img) => push(img, "image"));
    (selectedProduct.videos || []).forEach((videoUrl) => push(videoUrl, "video"));

    // Mantener compatibilidad con el esquema MongoDB: variantList conserva
    // una imagen por variante (ProductVariantItem.imageUrl).
    (selectedProduct.variantList || []).forEach((variant) => push(variant.imageUrl, "image"));

    return gallery.length ? gallery : [{ type: "image", url: selectedProduct.imageUrl }];
  }, [selectedProduct]);

  useEffect(() => {
    setDetailGalleryIndex(0);
  }, [selectedProduct?.id]);

  const handleGalleryPrev = () => {
    if (!selectedProduct || detailGallery.length <= 1) return;
    setDetailGalleryIndex((prev) => (prev === 0 ? detailGallery.length - 1 : prev - 1));
  };

  const handleGalleryNext = () => {
    if (!selectedProduct || detailGallery.length <= 1) return;
    setDetailGalleryIndex((prev) => (prev + 1) % detailGallery.length);
  };

  // Sync selectedProduct if selectedProductDirectly changes
  React.useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
    }
  }, [selectedProductDirectly]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>(["Todos"]);
    (products || []).forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    DEFAULT_CATEGORIES.forEach((c) => set.add(c));
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === "Todos" || p.category === activeCategory;
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * (item.quantity || 1), 0);
  }, [cart]);

  React.useEffect(() => {
    if (cartDrawerRequest > 0) {
      setIsCartOpen(true);
    }
  }, [cartDrawerRequest]);

  const handleItemRemove = (idx: number, item: CartItem) => {
    if (!onRemoveFromCart) return;
    if (onRemoveFromCart.length >= 2) {
      // (productId, idx)
      (onRemoveFromCart as any)(item.product.id, idx);
    } else {
      // (idx)
      (onRemoveFromCart as any)(idx);
    }
  };

  const handleItemQtyChange = (idx: number, item: CartItem, newQty: number) => {
    if (!onUpdateCartQuantity) return;
    if (onUpdateCartQuantity.length >= 2) {
      // (productId, qty, idx)
      (onUpdateCartQuantity as any)(item.product.id, newQty, idx);
    } else {
      // (idx, newQty)
      (onUpdateCartQuantity as any)(idx, newQty);
    }
  };

  const finalizeOrder = (shippingAddress: string, itemsToCheckout: CartItem[]) => {
    const address = shippingAddress || "Dirección Android Principal";
    setLastOrderItems(itemsToCheckout.map((item) => ({ ...item, product: { ...item.product } })));
    setLastDeliveryAddress(address);

    setCheckoutSuccess(true);
    onClearCart?.();
    onOrderPlaced?.();
    setTimeout(() => {
      setCheckoutSuccess(false);
      setIsCartOpen(false);
      setIsCheckingOut(false);
      setShowCheckoutPage(false);
      setShowThankYouPage(true);
    }, 1500);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    const shippingAddress = checkoutForm.shippingAddress || "Dirección Android Principal";

    if (onCheckout) {
      onCheckout(shippingAddress, 0, (newOrder) => {
        finalizeOrder(shippingAddress, cart);
      }, cart);
      return;
    }

    try {
      const orderPayload = {
        userId: currentUser.originalId || currentUser.id,
        userName: checkoutForm.fullName || currentUser.name,
        userEmail: checkoutForm.email || currentUser.email || `${currentUser.username}@android.mallsocial`,
        buyerPhone: checkoutForm.phone,
        buyerShippingAddress: shippingAddress,
        buyerCountry: checkoutForm.country,
        buyerPostalCode: checkoutForm.postalCode,
        items: cart,
        total: cartTotal,
        platform: "android",
        createdAt: new Date().toISOString(),
      };

      const res = await androidApiFetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        finalizeOrder(shippingAddress, cart);
      }
    } catch (err) {
      console.error("Android checkout error:", err);
      setIsCheckingOut(false);
    }
  };

  if (showThankYouPage) {
    const thankYouTotal = lastOrderItems.reduce((sum, item) => sum + item.product.price * (item.quantity || 1), 0);

    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-amber-950 via-slate-950 to-rose-950 text-slate-50 flex flex-col font-sans select-none overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[-8%] top-[-4%] w-44 h-44 rounded-full bg-amber-500/30 blur-3xl animate-pulse" />
          <div className="absolute right-[-6%] bottom-[-12%] w-56 h-56 rounded-full bg-orange-600/30 blur-3xl animate-pulse" />
          <div className="absolute left-[12%] top-[18%] w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_12px_#fde68a,0_0_20px_#fbbf24] animate-ping" />
          <div className="absolute right-[16%] top-[30%] w-2 h-2 bg-orange-300 rounded-full shadow-[0_0_12px_#fdba74,0_0_20px_#fb923c] animate-ping" />
        </div>

        <div className="relative z-10 px-4 py-8 flex flex-col min-h-screen">
          <div className="flex items-center justify-center mt-4">
            <div className="relative">
              <div className="w-28 h-28 rounded-full border-4 border-amber-300/80 bg-amber-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.8)]">
                <Sparkles className="w-12 h-12 text-amber-300" />
              </div>
              <div className="absolute -left-3 -top-2 w-7 h-14 rounded-full bg-gradient-to-b from-amber-300 to-red-500 blur-[1px] opacity-90 animate-[pulse_1200ms_ease-in-out_infinite]" />
              <div className="absolute -right-3 top-1 w-7 h-16 rounded-full bg-gradient-to-b from-orange-300 to-red-700 blur-[1px] opacity-90 animate-[pulse_1200ms_ease-in-out_infinite]" />
            </div>
          </div>

          <div className="text-center mt-5">
            <div className="text-[11px] uppercase tracking-[0.3em] text-amber-300 font-black">Compra confirmada</div>
            <h1 className="mt-3 text-3xl font-black text-white tracking-tight">¡Gracias por tu compra!</h1>
            <p className="mt-2 text-[11px] text-slate-300">Tu pedido fue recibido con éxito y está siendo preparado.</p>
          </div>

          <div className="mt-5 bg-white/12 border border-white/20 backdrop-blur-md rounded-[2rem] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wide text-amber-200">Resumen de productos</span>
              <span className="text-[11px] font-black text-white">{lastOrderItems.length} artículos</span>
            </div>

            <div className="mt-4 space-y-3">
              {lastOrderItems.length === 0 ? (
                <div className="text-center text-[11px] text-slate-300 py-3">Sin productos en esta compra.</div>
              ) : (
                lastOrderItems.map((item, idx) => (
                  <div key={`${item.product.id}-${idx}`} className="flex items-center gap-3 rounded-2xl bg-white/8 border border-white/10 p-3">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-12 h-12 rounded-xl object-cover border border-white/20" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-white line-clamp-1">{item.product.name}</span>
                        <span className="text-[11px] font-black text-amber-300">${(item.product.price * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-400">Cantidad: {item.quantity || 1}</span>
                        <span className="text-[10px] text-slate-400">${item.product.price.toFixed(2)} c/u</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Dirección de entrega</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{lastDeliveryAddress}</span>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm font-black">
                <span className="text-slate-200">Total</span>
                <span className="text-amber-300">${thankYouTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center">
            <button
              onClick={() => {
                setShowThankYouPage(false);
                setShowCheckoutPage(false);
                setSelectedProduct(null);
                setIsCartOpen(false);
              }}
              className="w-full max-w-xs py-3.5 bg-gradient-to-r from-amber-300 to-orange-500 text-slate-950 font-black rounded-2xl shadow-xl shadow-orange-900/40 flex items-center justify-center space-x-2 active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4" />
              <span>Volver al catálogo</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showCheckoutPage) {
    return (
      <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <button onClick={() => setShowCheckoutPage(false)} className="p-2 rounded-full bg-slate-100 text-slate-900 active:scale-95">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-black text-slate-900">Checkout</h1>
            <p className="text-[10px] text-slate-500">Entrega y pago</p>
          </div>
          <div className="w-8" />
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Información de envío</span>
              <ShoppingBag className="w-5 h-5 text-amber-500" />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-700">Nombre completo</label>
                <input value={checkoutForm.fullName} onChange={(e) => setCheckoutForm({ ...checkoutForm, fullName: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-700">Correo</label>
                <input value={checkoutForm.email} onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="correo@ejemplo.com" type="email" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-700">Número de celular</label>
                <input value={checkoutForm.phone} onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="+52 555 000 0000" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-700">Dirección de entrega</label>
                <input value={checkoutForm.shippingAddress} onChange={(e) => setCheckoutForm({ ...checkoutForm, shippingAddress: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="Calle, número, colonia" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-700">País de residencia</label>
                  <input value={checkoutForm.country} onChange={(e) => setCheckoutForm({ ...checkoutForm, country: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="País" />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-700">Código postal</label>
                  <input value={checkoutForm.postalCode} onChange={(e) => setCheckoutForm({ ...checkoutForm, postalCode: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="00000" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Datos de la tarjeta</span>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-700">Nombre en la tarjeta</label>
                <input value={checkoutForm.cardName} onChange={(e) => setCheckoutForm({ ...checkoutForm, cardName: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="Nombre en la tarjeta" />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-700">Número de tarjeta</label>
                <input value={checkoutForm.cardNumber} onChange={(e) => setCheckoutForm({ ...checkoutForm, cardNumber: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="1234 5678 9012 3456" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black text-slate-700">Expira</label>
                  <input value={checkoutForm.expiry} onChange={(e) => setCheckoutForm({ ...checkoutForm, expiry: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="MM/AA" />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-700">CVV</label>
                  <input value={checkoutForm.cvv} onChange={(e) => setCheckoutForm({ ...checkoutForm, cvv: e.target.value })} className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs text-slate-900 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="123" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Resumen del carrito</span>
            <div className="mt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center text-[11px] text-slate-500 py-3">Tu carrito está vacío.</div>
              ) : (
                cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                    <img src={item.product.imageUrl} alt={item.product.name} className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-900 line-clamp-1">{item.product.name}</span>
                        <span className="text-[11px] font-black text-amber-600">${(item.product.price * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500">Cantidad: {item.quantity || 1}</span>
                        <span className="text-[10px] text-slate-500">${item.product.price.toFixed(2)} c/u</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Total</span>
              <span className="text-amber-600">${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-3xl border border-slate-200 p-4">
            <div className="flex items-center justify-between text-sm font-black text-slate-900">
              <span>Total</span>
              <span className="text-amber-600">${cartTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full mt-4 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
              style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isCheckingOut ? "Procesando..." : "Completar Compra"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none pb-24" id="android-shop-view">
      {/* Top Android Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900">Tienda MallSocial</h1>
            <p className="text-[10px] text-amber-500 font-medium">Catálogo Android</p>
          </div>
        </div>

        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-5 h-5 text-amber-500" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center shadow">
              {cart.reduce((s, i) => s + (i.quantity || 1), 0)}
            </span>
          )}
        </button>
      </div>

      {/* Search Input */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos en Android..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-4 py-2 overflow-x-auto flex space-x-2 no-scrollbar">
        {categoriesList.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "bg-slate-900 text-slate-400 border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 flex-1">
        {isLoading && products.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col animate-pulse">
              <div className="w-full aspect-square bg-slate-800 rounded-xl mb-3" />
              <div className="h-3.5 bg-slate-800 rounded w-3/4 mb-2" />
              <div className="h-2.5 bg-slate-800 rounded w-1/2 mb-3" />
              <div className="h-5 bg-slate-800 rounded mt-auto" />
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-2 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3 text-amber-400">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-200">
              {searchQuery || activeCategory !== "Todos"
                ? "No se encontraron productos en esta categoría."
                : "No se encontraron productos en este catálogo."}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              {searchQuery || activeCategory !== "Todos"
                ? "Prueba seleccionando otra categoría o cambiando la búsqueda."
                : "Comprueba tu conexión o reintenta sincronizar con el catálogo."}
            </p>
            {onRefreshProducts && (
              <button
                type="button"
                onClick={onRefreshProducts}
                className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center space-x-1.5 transition-transform shadow-lg shadow-amber-500/10"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar conexión</span>
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProduct(p);
                onSelectProduct?.(p);
              }}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer shadow-sm"
            >
              <div className="relative w-full aspect-square overflow-hidden bg-slate-100">
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[9px] font-bold text-amber-400">
                  {p.category}
                </span>
              </div>

              <div className="p-2.5">
                <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{p.name}</h3>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{p.description}</p>
              </div>

              <div className="flex items-center justify-between mt-0 px-2.5 pb-2.5 pt-2 border-t border-slate-100">
                <span className="text-xs font-black text-amber-500">${p.price.toFixed(2)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(p, 1);
                  }}
                  className="p-1.5 bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 active:scale-90 transition-transform font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Detail Sheet */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-h-[85vh] bg-white border-t border-slate-200 rounded-t-3xl flex flex-col overflow-hidden text-slate-900"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
            >
              <div className="flex-1 overflow-y-auto">
                <div className="relative w-full h-72 overflow-hidden bg-slate-800">
                  <div
                    ref={detailGalleryRef}
                    className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-none"
                    onScroll={() => {
                      const el = detailGalleryRef.current;
                      if (!el || detailGallery.length <= 1) return;
                      const nextIndex = Math.min(
                        Math.max(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)), 0),
                        detailGallery.length - 1
                      );
                      if (nextIndex !== detailGalleryIndex) {
                        setDetailGalleryIndex(nextIndex);
                      }
                    }}
                  >
                    {detailGallery.map((media, idx) => (
                      <div key={`${media.type}-${media.url}-${idx}`} className="min-w-full h-full snap-center">
                        {media.type === "video" ? (
                          <video
                            src={media.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            autoPlay={idx === detailGalleryIndex}
                            controls={false}
                          />
                        ) : (
                          <img src={media.url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>

                  {detailGallery.length > 1 && (
                    <div className="absolute left-3 top-3 z-10 px-2 py-1 rounded-full border border-white/30 text-[10px] font-black text-white bg-transparent">
                      {detailGalleryIndex + 1}/{detailGallery.length}
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 space-y-4">
                  <h2 className="text-base font-bold text-white">{selectedProduct.name}</h2>
                  <p className="text-lg font-black text-amber-400 mt-1">${selectedProduct.price.toFixed(2)}</p>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{selectedProduct.description}</p>
                </div>

                {onCreatorClick && selectedProduct.sellerId && (
                  <div
                    onClick={() => onCreatorClick(selectedProduct.sellerId!)}
                    className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 flex items-center justify-between cursor-pointer active:scale-[0.99]"
                  >
                    <span className="text-xs text-slate-300">Vendedor: {selectedProduct.sellerName || "Vendedor Oficial"}</span>
                    <span className="text-xs font-bold text-amber-400">Ver Perfil</span>
                  </div>
                )}

                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 flex items-center space-x-3 text-xs text-slate-400">
                  <Truck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Envío directo gestionado a través de la pasarela Android.</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onAddToCart(selectedProduct, 1);
                  setSelectedProduct(null);
                  clearDirectProduct?.();
                  onClearInitialProduct?.();
                }}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Agregar al Carrito</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Android Shopping Cart Sheet */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-h-[85vh] bg-white border-t border-slate-200 rounded-t-3xl flex flex-col overflow-hidden p-5 text-slate-900"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold">Carrito de Compras ({cart.length})</span>
                </div>
                <button onClick={() => setIsCartOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {checkoutSuccess ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                    <Check className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">¡Pedido Confirmado!</h3>
                  <p className="text-xs text-slate-400 mt-1">Tu orden ha sido registrada en el servidor de Android.</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto py-3 space-y-3">
                    {cart.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500">
                        Tu carrito de compras está vacío.
                      </div>
                    ) : (
                      cart.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-100 rounded-xl border border-slate-200">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleItemQtyChange(idx, item, Math.max(1, (item.quantity || 1) - 1))}
                              className="p-1 rounded-md bg-white text-slate-900 border border-slate-300 active:scale-95"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-black w-6 text-center text-slate-900">{item.quantity || 1}</span>
                            <button
                              onClick={() => handleItemQtyChange(idx, item, (item.quantity || 1) + 1)}
                              className="p-1 rounded-md bg-white text-slate-900 border border-slate-300 active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1 px-3">
                            <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.product.name}</h4>
                            <p className="text-[11px] text-amber-500 font-black">${item.product.price.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => handleItemRemove(idx, item)}
                            className="p-1 text-rose-500 hover:text-rose-600 ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {cart.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>Total:</span>
                        <span className="text-amber-400">${cartTotal.toFixed(2)}</span>
                      </div>
                      <button
                        onClick={() => {
                          setIsCartOpen(false);
                          setShowCheckoutPage(true);
                        }}
                        disabled={isCheckingOut}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
                        style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>{isCheckingOut ? "Procesando..." : "Completar Compra en Android"}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
