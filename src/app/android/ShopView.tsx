import React, { useState, useMemo } from "react";
import { Product, CartItem, User, Order, Reel } from "../../types";
import { ShoppingBag, Search, Plus, Minus, Trash2, X, Check, ArrowRight, Sparkles, Filter, CreditCard, Tag, Truck, ShieldCheck, Heart } from "lucide-react";
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
}

const CATEGORIES = ["Todos", "Moda", "Calzado", "Accesorios", "Tecnología", "Belleza"];

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
}: AndroidShopViewProps) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    selectedProductDirectly || initialSelectedProduct || null
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Sync selectedProduct if selectedProductDirectly changes
  React.useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
    }
  }, [selectedProductDirectly]);

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

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    if (onCheckout) {
      onCheckout("Dirección Android Principal", 0, (newOrder) => {
        setCheckoutSuccess(true);
        onClearCart?.();
        onOrderPlaced?.();
        setTimeout(() => {
          setCheckoutSuccess(false);
          setIsCartOpen(false);
          setIsCheckingOut(false);
        }, 1500);
      });
      return;
    }

    try {
      const orderPayload = {
        userId: currentUser.originalId || currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email || `${currentUser.username}@android.mallsocial`,
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
        setCheckoutSuccess(true);
        onClearCart?.();
        onOrderPlaced?.();
        setTimeout(() => {
          setCheckoutSuccess(false);
          setIsCartOpen(false);
        }, 1500);
      }
    } catch (err) {
      console.error("Android checkout error:", err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none pb-24" id="android-shop-view">
      {/* Top Android Header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Tienda MallSocial</h1>
            <p className="text-[10px] text-amber-400 font-medium">Catálogo Android</p>
          </div>
        </div>

        <button
          onClick={() => setIsCartOpen(true)}
          className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white active:scale-95 transition-transform"
        >
          <ShoppingBag className="w-5 h-5 text-amber-400" />
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
        {CATEGORIES.map((cat) => (
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
        {filteredProducts.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-xs text-slate-500">
            No se encontraron productos en esta categoría.
          </div>
        ) : (
          filteredProducts.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedProduct(p);
                onSelectProduct?.(p);
              }}
              className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col justify-between p-2.5 active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2">
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[9px] font-bold text-amber-400">
                  {p.category}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-white line-clamp-1">{p.name}</h3>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</p>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                <span className="text-xs font-black text-amber-400">${p.price.toFixed(2)}</span>
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
              className="w-full max-h-[85vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl flex flex-col overflow-hidden p-5 text-white"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Detalle del Producto</span>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    clearDirectProduct?.();
                    onClearInitialProduct?.();
                  }}
                  className="p-1 rounded-full text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                <div className="w-full h-56 rounded-2xl overflow-hidden bg-slate-800">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
                <div>
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
              className="w-full max-h-[85vh] bg-slate-900 border-t border-slate-800 rounded-t-3xl flex flex-col overflow-hidden p-5 text-white"
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
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-800">
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover" />
                          <div className="flex-1 px-3">
                            <h4 className="text-xs font-bold text-white line-clamp-1">{item.product.name}</h4>
                            <p className="text-[11px] text-amber-400">${item.product.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleItemQtyChange(idx, item, (item.quantity || 1) - 1)}
                              className="p-1 rounded-md bg-slate-700 text-white active:scale-95"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity || 1}</span>
                            <button
                              onClick={() => handleItemQtyChange(idx, item, (item.quantity || 1) + 1)}
                              className="p-1 rounded-md bg-slate-700 text-white active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleItemRemove(idx, item)}
                              className="p-1 text-rose-400 hover:text-rose-300 ml-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
                        onClick={handleCheckout}
                        disabled={isCheckingOut}
                        className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
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
