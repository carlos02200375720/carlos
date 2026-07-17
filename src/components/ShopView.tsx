import React, { useState, useEffect, useRef } from "react";
import { ShoppingCart, Star, Heart, ArrowLeft, Trash2, Plus, Minus, CreditCard, CheckCircle2, ShoppingBag, ShieldCheck, Truck, Search, X } from "lucide-react";
import { Product, CartItem, Order, User } from "../types";
import { motion, AnimatePresence } from "motion/react";

const CATEGORIES = [
  {
    id: "todos",
    name: "Todos",
    queryTerm: "",
    imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "ropa_femenina",
    name: "Ropa Femenina",
    queryTerm: "femenina",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "ropa_masculina",
    name: "Ropa Masculina",
    queryTerm: "masculina",
    imageUrl: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "mascota",
    name: "Mascotas",
    queryTerm: "mascota",
    imageUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "hogar",
    name: "Hogar",
    queryTerm: "neon", // matches our Lotus Lamp
    imageUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "salud",
    name: "Salud",
    queryTerm: "yoga", // matches our Yoga Mat
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "joya",
    name: "Joyas",
    queryTerm: "joya",
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "bolso",
    name: "Bolsos",
    queryTerm: "bolso",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "sapato",
    name: "Zapatos",
    queryTerm: "zapato",
    imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "juguete",
    name: "Juguetes",
    queryTerm: "juguete",
    imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "deportes",
    name: "Deportes",
    queryTerm: "yoga", // matches our Yoga Mat too
    imageUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "electronica",
    name: "Electrónica",
    queryTerm: "synth", // matches Synth Keys and Headphones
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "automotriz",
    name: "Automotriz",
    queryTerm: "automotriz",
    imageUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "telefono",
    name: "Teléfonos",
    queryTerm: "telefono",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "informatica",
    name: "Informática",
    queryTerm: "informatica",
    imageUrl: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=150&q=80"
  }
];

interface ShopViewProps {
  products: Product[];
  cart: CartItem[];
  users: User[];
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (productId: string) => void;
  onUpdateCartQuantity: (productId: string, qty: number) => void;
  onCheckout: (address: string, onComplete: (newOrder: Order) => void) => void;
  onCreatorClick: (creatorId: string) => void;
  selectedProductDirectly: Product | null;
  clearDirectProduct: () => void;
  onNavigateToHistory: () => void;
}

export default function ShopView({
  products,
  cart,
  users,
  onAddToCart,
  onRemoveFromCart,
  onUpdateCartQuantity,
  onCheckout,
  onCreatorClick,
  selectedProductDirectly,
  clearDirectProduct,
  onNavigateToHistory
}: ShopViewProps) {
  // Navigation states: 'catalog' | 'detail' | 'cart' | 'checkout' | 'payment' | 'thankyou'
  const [activeStep, setActiveStep] = useState<'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou'>('catalog');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  
  // Checkout Form states
  const [name, setName] = useState("Carlos Gómez");
  const [address, setAddress] = useState("Avenida de la Constitución 142, Piso 4B, Madrid");
  const [cardNumber, setCardNumber] = useState("4152 8391 0023 9482");
  const [expiry, setExpiry] = useState("09/29");
  const [cvv, setCvv] = useState("384");
  const [isFormValid, setIsFormValid] = useState(true);

  // Success Order State
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Scroll Header Auto-Hide / Auto-Show states
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Avoid triggering on tiny adjustments
      if (Math.abs(currentScrollY - lastScrollY.current) < 5) {
        return;
      }

      if (currentScrollY <= 10) {
        // Always show header at the top
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Scroll para abajo (scroll down): cabecera se agacha (oculta)
        setShowHeader(false);
      } else {
        // Scroll para arriba (scroll up): cabecera aparece
        setShowHeader(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Sync direct product clicks from reels
  useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
      setActiveStep('detail');
      clearDirectProduct();
    }
  }, [selectedProductDirectly]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setActiveStep('detail');
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const startCheckout = () => {
    if (cart.length === 0) return;
    setShowCartDrawer(false);
    setActiveStep('checkout');
  };

  const executePayment = () => {
    if (!name.trim() || !address.trim() || !cardNumber.trim()) {
      setIsFormValid(false);
      return;
    }
    setIsFormValid(true);
    setActiveStep('payment');

    // Simulate Payment Gateway loading
    setTimeout(() => {
      onCheckout(address, (newOrder) => {
        setCompletedOrder(newOrder);
        setActiveStep('thankyou');
      });
    }, 2500);
  };

  const getSellerInfo = (sellerId: string) => {
    return users.find(u => u.id === sellerId) || { name: "Vendedor Destacado", avatar: "" };
  };

  const filteredProducts = products.filter((product) => {
    // 1. Filter by category
    if (selectedCategory && selectedCategory !== "todos") {
      const cat = CATEGORIES.find(c => c.id === selectedCategory);
      if (cat) {
        const term = cat.queryTerm.toLowerCase();
        const matchesCategory = 
          product.name.toLowerCase().includes(term) ||
          product.description.toLowerCase().includes(term);
        if (!matchesCategory) return false;
      }
    }

    // 2. Filter by search query
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full min-h-screen bg-white relative flex flex-col" id="shop-panel">
      {/* Shop Navigation Header */}
      <header className={`px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white gap-4 sticky top-0 z-20 transition-transform duration-300 ease-in-out ${showHeader ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="flex items-center space-x-3 shrink-0">
          {activeStep !== 'catalog' && (
            <button
              onClick={() => {
                if (activeStep === 'detail') setActiveStep('catalog');
                else if (activeStep === 'checkout') setActiveStep('catalog');
                else if (activeStep === 'thankyou') setActiveStep('catalog');
              }}
              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer flex items-center space-x-1"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-xs font-bold text-slate-700">Regresar</span>
            </button>
          )}
        </div>

        {/* Center Search Bar */}
        {activeStep === 'catalog' && (
          <div className="flex-1 max-w-md relative mx-1 sm:mx-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-100 focus:bg-white border border-transparent focus:border-slate-200 rounded-full transition-all outline-none text-slate-800 placeholder-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Cart Trigger Badge */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setShowCartDrawer(true)}
            className="relative p-2.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            id="cart-trigger-btn"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-extrabold font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4 sm:p-6 relative">
        <AnimatePresence mode="wait">
          {/* 1. CATALOG STEP */}
          {activeStep === 'catalog' && (
            <div className="flex flex-col space-y-6">
              {/* Category Carousel */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-display font-extrabold text-xs text-slate-400 uppercase tracking-wider">Categorías</h3>
                  {selectedCategory !== "todos" && (
                    <button 
                      onClick={() => setSelectedCategory("todos")} 
                      className="text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-colors"
                    >
                      Limpiar filtro
                    </button>
                  )}
                </div>
                
                {/* Scrollable track without native scrollbar styles */}
                <div 
                  className="flex items-center space-x-4 overflow-x-auto pb-3 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <style>{`
                    .overflow-x-auto::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="flex flex-col items-center space-y-2 shrink-0 outline-none group focus:outline-none cursor-pointer"
                        style={{ width: '72px' }}
                      >
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-all relative flex items-center justify-center bg-slate-50 ${isSelected ? "border-amber-500 ring-4 ring-amber-500/10 scale-105 shadow-sm" : "border-slate-100 group-hover:border-slate-300"}`}>
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                        <span className={`text-[10px] sm:text-[11px] text-center font-bold tracking-tight line-clamp-1 w-full transition-colors ${isSelected ? "text-amber-600 font-extrabold" : "text-slate-500 group-hover:text-slate-800"}`}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products List or No-results message */}
              {filteredProducts.length === 0 ? (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full py-16 flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                    <Search className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-display font-bold text-sm text-slate-800">No se encontraron productos</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Intenta buscar con otros términos o limpia el campo de búsqueda.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("todos");
                    }}
                    className="mt-4 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-full transition-colors cursor-pointer"
                  >
                    Ver todos los productos
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="catalog"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="grid grid-cols-2 gap-4"
                >
                  {filteredProducts.map((product) => {
                    const seller = getSellerInfo(product.sellerId);
                    return (
                      <div
                        key={product.id}
                        className="border border-slate-100 hover:border-amber-500/30 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between"
                        onClick={() => handleProductSelect(product)}
                        id={`prod-card-${product.id}`}
                      >
                        {/* Image Header with Badge */}
                        <div className="relative aspect-square w-full bg-slate-50 overflow-hidden flex items-center justify-center">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border border-white/10 flex items-center space-x-1">
                            <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-white text-[10px] sm:text-xs font-bold font-mono">{product.rating}</span>
                          </div>
                          
                          {/* Stock availability banner */}
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/95 text-slate-900 border border-slate-200">
                            {product.stock > 0 ? `${product.stock} en stock` : "Agotado"}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 mb-1">
                              <img src={seller.avatar} alt={seller.name} referrerPolicy="no-referrer" className="w-3.5 h-3.5 rounded-full object-cover" />
                              <span className="font-bold truncate">@{seller.name.toLowerCase().replace(/\s+/g, "")}</span>
                            </div>
                            
                            <h3 className="font-display font-bold text-xs sm:text-sm text-slate-900 group-hover:text-amber-500 transition-colors line-clamp-2 min-h-[32px] sm:min-h-[40px] leading-tight">{product.name}</h3>
                            <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed">{product.description}</p>
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">${product.price.toFixed(2)}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (product.stock > 0) onAddToCart(product);
                              }}
                              disabled={product.stock <= 0}
                              className={`w-full sm:w-auto px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${product.stock > 0 ? "bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                              id={`add-to-cart-btn-${product.id}`}
                            >
                              <ShoppingCart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              <span>Agregar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          )}

          {/* 2. DETAIL STEP */}
          {activeStep === 'detail' && selectedProduct && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {/* Image & Showcase */}
              <div className="space-y-4">
                <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Security badges */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500 font-semibold">
                  <div className="flex flex-col items-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 mb-1" />
                    <span>Pago Seguro</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-slate-200/60">
                    <Truck className="w-5 h-5 text-amber-500 mb-1" />
                    <span>Envío Rápido</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400/20 mb-1" />
                    <span>Garantía Oficial</span>
                  </div>
                </div>
              </div>

              {/* Product Specs info */}
              <div className="flex flex-col justify-between">
                <div>
                  {/* Seller Header clickable */}
                  <div
                    onClick={() => onCreatorClick(selectedProduct.sellerId)}
                    className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                  >
                    <img
                      src={getSellerInfo(selectedProduct.sellerId).avatar}
                      alt="Creator"
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span>Tienda de @{getSellerInfo(selectedProduct.sellerId).name.toLowerCase().replace(/\s+/g, "")}</span>
                    <span className="text-[10px] text-amber-600 font-medium ml-1">Ver perfil →</span>
                  </div>

                  <h1 className="font-display font-extrabold text-2xl text-slate-900 mt-4">{selectedProduct.name}</h1>
                  
                  {/* Rating Stars */}
                  <div className="flex items-center space-x-1.5 mt-2">
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-slate-700">{selectedProduct.rating} (Verificado)</span>
                  </div>

                  <p className="text-sm text-slate-600 mt-4 leading-relaxed whitespace-pre-line">{selectedProduct.description}</p>
                  
                  {/* Stock status indicator */}
                  <div className="mt-4 inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                    {selectedProduct.stock > 0 ? `${selectedProduct.stock} unidades en almacén` : "Temporalmente Agotado"}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block">Precio unitario</span>
                    <span className="text-2xl font-extrabold font-mono text-slate-950">${selectedProduct.price.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedProduct.stock > 0) {
                        onAddToCart(selectedProduct);
                        setShowCartDrawer(true);
                      }
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className={`px-6 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${selectedProduct.stock > 0 ? "bg-slate-950 hover:bg-slate-800 active:scale-95 text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                    id="add-to-cart-detail-btn"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Añadir al Carrito</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. CHECKOUT FORM STEP */}
          {activeStep === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-5 gap-8"
            >
              {/* Left Column: Checkout Inputs (3 cols) */}
              <div className="md:col-span-3 space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <span>Información de Envío</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg p-3 font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dirección de Entrega</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-xs rounded-lg p-3 font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
                    <CreditCard className="w-4 h-4 text-amber-500" />
                    <span>Información de Tarjeta</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Número de Tarjeta</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-xs rounded-lg p-3 pl-10 font-mono text-slate-800 focus:outline-none"
                        />
                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Vencimiento</label>
                        <input
                          type="text"
                          placeholder="MM/AA"
                          value={expiry}
                          onChange={(e) => setExpiry(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-xs rounded-lg p-3 font-mono text-slate-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">CVV</label>
                        <input
                          type="password"
                          placeholder="000"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-xs rounded-lg p-3 font-mono text-slate-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary (2 cols) */}
              <div className="md:col-span-2 bg-slate-950 text-white p-6 rounded-2xl flex flex-col justify-between border border-slate-900 shadow-2xl">
                <div>
                  <h3 className="font-display font-extrabold text-sm text-slate-100 mb-4">Resumen del Pedido</h3>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between text-xs py-1">
                        <div className="truncate flex-1 pr-3">
                          <span className="font-bold">{item.product.name}</span>
                          <span className="text-[10px] text-slate-400 block">Cantidad: {item.quantity}</span>
                        </div>
                        <span className="font-mono font-semibold text-slate-300">${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 mt-6 pt-4 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Envío (Express)</span>
                      <span className="text-emerald-400 font-bold font-mono">GRATIS</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-3">
                      <span>Total</span>
                      <span className="text-amber-400 font-mono text-base">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  {!isFormValid && (
                    <p className="text-[10px] text-rose-400 font-bold text-center mb-2">Complete todos los datos requeridos</p>
                  )}
                  <button
                    onClick={executePayment}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    id="pay-now-btn"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Pagar con Pasarela Certificada</span>
                  </button>
                  <p className="text-[9px] text-center text-slate-500 mt-2">Transacción segura 256-bit SSL</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. PAYMENT GATEWAY LOADING SCREEN */}
          {activeStep === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[380px] flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 mt-6 animate-pulse">Procesando Pago Seguro...</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm">
                Conectando con la pasarela bancaria WebRTC. Por favor, no recargue ni cierre la pestaña.
              </p>
            </motion.div>
          )}

          {/* 5. THANK YOU STEP */}
          {activeStep === 'thankyou' && completedOrder && (
            <motion.div
              key="thankyou"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-slate-50 border border-slate-150 p-6 rounded-2xl text-center shadow-md"
            >
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h2 className="font-display font-extrabold text-xl text-slate-900 mt-4">¡Muchas Gracias por su Compra!</h2>
              <p className="text-xs text-slate-500 mt-1">El vendedor ha verificado la transacción correctamente.</p>
              
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 mt-6 text-left space-y-3 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Código de Pedido:</span>
                  <span className="font-mono font-bold text-slate-800">{completedOrder.id}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Fecha:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(completedOrder.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Dirección de Envío:</span>
                  <span className="text-slate-700 truncate max-w-[180px] font-medium">{completedOrder.shippingAddress}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1">
                  <span>Total Cargado:</span>
                  <span className="text-emerald-500 font-mono">${completedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-8 flex space-x-3">
                <button
                  onClick={() => {
                    setActiveStep('catalog');
                    setSelectedProduct(null);
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Seguir Comprando
                </button>
                <button
                  onClick={() => {
                    onNavigateToHistory();
                    setActiveStep('catalog');
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Historial de Pedidos
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Slider Drawer */}
      <AnimatePresence>
        {showCartDrawer && (
          <>
            {/* Drawer Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartDrawer(false)}
              className="fixed inset-0 bg-black z-50"
            />

            {/* Slider Drawer Element */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[100] border-l border-slate-200 flex flex-col justify-between"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="w-5 h-5 text-amber-500" />
                  <span className="font-display font-extrabold text-slate-900">Carrito de Compra ({cartItemCount})</span>
                </div>
                <button
                  onClick={() => setShowCartDrawer(false)}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                    <ShoppingCart className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                    <p className="font-medium text-slate-600">Su carrito está vacío</p>
                    <p className="text-xs text-slate-400 mt-1">Explora productos recomendados por nuestros creadores.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-start space-x-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h4>
                        <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Precio: ${item.product.price.toFixed(2)}</span>
                        
                        {/* Incrementor buttons */}
                        <div className="flex items-center space-x-2.5 mt-2">
                          <button
                            onClick={() => onUpdateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                            className="p-1 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 font-mono">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateCartQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => onRemoveFromCart(item.product.id)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer summary */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-4">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Total del Carrito:</span>
                    <span className="font-mono text-slate-900 font-bold text-sm">${cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={startCheckout}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    id="checkout-btn"
                  >
                    <span>Iniciar Pago Seguro</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
