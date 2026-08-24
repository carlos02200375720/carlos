import React, { useState, useEffect, useRef } from "react";
import { ShoppingCart, Star, Heart, ArrowLeft, Trash2, Plus, Minus, CreditCard, CheckCircle2, ShoppingBag, ShieldCheck, Truck, Search, X, Video, Globe, PackageCheck, Loader2, AlertCircle, ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from "lucide-react";
import { Product, CartItem, Order, User } from "../types";
import { motion, AnimatePresence } from "motion/react";

const CJ_DEST_COUNTRIES = [
  { code: "US", name: "Estados Unidos 🇺🇸" },
  { code: "ES", name: "España 🇪🇸" },
  { code: "MX", name: "México 🇲🇽" },
  { code: "CO", name: "Colombia 🇨🇴" },
  { code: "CL", name: "Chile 🇨🇱" },
  { code: "AR", name: "Argentina 🇦🇷" },
  { code: "PE", name: "Perú 🇵🇪" },
  { code: "EC", name: "Ecuador 🇪🇨" },
  { code: "DO", name: "República Dominicana 🇩🇴" },
  { code: "GT", name: "Guatemala 🇬🇹" },
  { code: "VE", name: "Venezuela 🇻🇪" },
  { code: "FR", name: "Francia 🇫🇷" },
  { code: "DE", name: "Alemania 🇩🇪" },
  { code: "GB", name: "Reino Unido 🇬🇧" },
  { code: "CA", name: "Canadá 🇨🇦" },
  { code: "BR", name: "Brasil 🇧🇷" },
  { code: "IT", name: "Italia 🇮🇹" },
  { code: "PT", name: "Portugal 🇵🇹" },
  { code: "AU", name: "Australia 🇦🇺" }
];

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
  currentUser: User;
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (productId: string, cartItemIndex?: number) => void;
  onUpdateCartQuantity: (productId: string, qty: number, cartItemIndex?: number) => void;
  onCheckout: (address: string, shippingCost: number, onComplete: (newOrder: Order) => void) => void;
  onCreatorClick: (creatorId: string) => void;
  selectedProductDirectly: Product | null;
  clearDirectProduct: () => void;
  onNavigateToHistory: () => void;
  onToggleDetailView?: (isOpen: boolean) => void;
}

export default function ShopView({
  products,
  cart,
  users,
  currentUser,
  onAddToCart,
  onRemoveFromCart,
  onUpdateCartQuantity,
  onCheckout,
  onCreatorClick,
  selectedProductDirectly,
  clearDirectProduct,
  onNavigateToHistory,
  onToggleDetailView
}: ShopViewProps) {
  // Navigation states: 'catalog' | 'detail' | 'cart' | 'checkout' | 'payment' | 'thankyou'
  const [activeStep, setActiveStep] = useState<'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou'>('catalog');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductMediaUrl, setSelectedProductMediaUrl] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<{[key: string]: string}>({});
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  
  // Category track drag & horizontal scroll helpers
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

  // Main Product Gallery horizontal scroll & drag helpers
  const gallerySliderRef = useRef<HTMLDivElement>(null);
  const galleryVideoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);
  const [galleryStartX, setGalleryStartX] = useState(0);
  const [galleryScrollLeft, setGalleryScrollLeft] = useState(0);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryVideoPlaying, setIsGalleryVideoPlaying] = useState<boolean>(true);
  const [isGalleryVideoMuted, setIsGalleryVideoMuted] = useState<boolean>(true);

  const checkIsVideo = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      Boolean(selectedProduct?.videos && selectedProduct.videos.some(v => v === url || lower.includes(v.toLowerCase()))) ||
      lower.includes(".mp4") ||
      lower.includes(".webm") ||
      lower.includes(".mov") ||
      lower.includes(".m3u8") ||
      lower.includes(".ogg") ||
      lower.includes("video") ||
      lower.startsWith("data:video") ||
      lower.startsWith("blob:")
    );
  };

  const productGalleryMedia = React.useMemo(() => {
    if (!selectedProduct) return [];
    return Array.from(
      new Set([
        selectedProduct.imageUrl,
        ...(selectedProduct.images || []),
        ...(selectedProduct.videos || [])
      ])
    ).filter(Boolean);
  }, [selectedProduct]);

  // Sync video playback with active gallery slide
  useEffect(() => {
    productGalleryMedia.forEach((mediaUrl, idx) => {
      const isVideo = checkIsVideo(mediaUrl);
      const videoEl = galleryVideoRefs.current[idx];
      if (isVideo && videoEl) {
        if (idx === activeGalleryIndex) {
          videoEl.muted = isGalleryVideoMuted;
          if (isGalleryVideoPlaying) {
            videoEl.play().catch((err) => {
              console.log("Gallery video playback paused or blocked:", err);
              setIsGalleryVideoPlaying(false);
            });
          } else {
            videoEl.pause();
          }
        } else {
          videoEl.pause();
        }
      }
    });
  }, [activeGalleryIndex, productGalleryMedia, isGalleryVideoPlaying, isGalleryVideoMuted]);

  const handleGalleryScroll = () => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    if (width > 0) {
      const newIdx = Math.round(gallerySliderRef.current.scrollLeft / width);
      if (newIdx !== activeGalleryIndex && newIdx >= 0 && newIdx < productGalleryMedia.length) {
        setActiveGalleryIndex(newIdx);
        if (productGalleryMedia[newIdx]) {
          setSelectedProductMediaUrl(productGalleryMedia[newIdx]);
        }
      }
    }
  };

  const scrollGallery = (direction: 'left' | 'right') => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    const target = gallerySliderRef.current.scrollLeft + (direction === 'left' ? -width : width);
    gallerySliderRef.current.scrollTo({ left: target, behavior: 'smooth' });
  };

  const scrollToGalleryIndex = (index: number) => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    gallerySliderRef.current.scrollTo({ left: index * width, behavior: 'smooth' });
    setActiveGalleryIndex(index);
    if (productGalleryMedia[index]) {
      setSelectedProductMediaUrl(productGalleryMedia[index]);
    }
  };

  const handleCategoryMouseDown = (e: React.MouseEvent) => {
    if (!categoryTrackRef.current) return;
    setIsCategoryDragging(true);
    setCategoryStartX(e.pageX - categoryTrackRef.current.offsetLeft);
    setCategoryScrollLeft(categoryTrackRef.current.scrollLeft);
  };

  const handleCategoryMouseLeave = () => {
    setIsCategoryDragging(false);
  };

  const handleCategoryMouseUp = () => {
    setIsCategoryDragging(false);
  };

  const handleCategoryMouseMove = (e: React.MouseEvent) => {
    if (!isCategoryDragging || !categoryTrackRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryTrackRef.current.offsetLeft;
    const walk = (x - categoryStartX) * 1.5;
    categoryTrackRef.current.scrollLeft = categoryScrollLeft - walk;
  };

  const handleCategoryWheel = (e: React.WheelEvent) => {
    if (!categoryTrackRef.current) return;
    if (e.deltaY !== 0) {
      categoryTrackRef.current.scrollLeft += e.deltaY;
    }
  };

  const scrollCategoryTrack = (direction: 'left' | 'right') => {
    if (!categoryTrackRef.current) return;
    const amount = direction === 'left' ? -220 : 220;
    categoryTrackRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };
  
  // CJ Real-Time Shipping States
  const [shippingCountry, setShippingCountry] = useState("ES");
  const [cjShippingOptions, setCjShippingOptions] = useState<{carrier: string; aging: string; shippingCost: number}[]>([]);
  const [selectedShippingOption, setSelectedShippingOption] = useState<{carrier: string; aging: string; shippingCost: number} | null>(null);
  const [isLoadingFreight, setIsLoadingFreight] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);

  const fetchCjFreightOptions = async (countryCode: string, targetVid?: string, autoSelect: boolean = false) => {
    setIsLoadingFreight(true);
    try {
      let vidToUse = targetVid || "";
      let pidToUse = "";

      if (selectedProduct) {
        if (!vidToUse) {
          vidToUse = selectedProduct.cjVid || selectedProduct.variantList?.[0]?.vid || selectedProduct.cjPid || "";
        }
        pidToUse = selectedProduct.cjPid || "";
      }

      if (!vidToUse) {
        const cjItem = cart.find(i => i.product.cjVid || i.product.cjPid);
        if (cjItem) {
          vidToUse = cjItem.product.cjVid || cjItem.product.variantList?.[0]?.vid || cjItem.product.cjPid || "";
          pidToUse = cjItem.product.cjPid || "";
        }
      }

      if (!vidToUse && !pidToUse) {
        vidToUse = "2512100754141607700";
      }

      const res = await fetch(`/api/cj/freight-options?vid=${encodeURIComponent(vidToUse)}&pid=${encodeURIComponent(pidToUse)}&destCountry=${encodeURIComponent(countryCode)}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.options) && data.options.length > 0) {
        setCjShippingOptions(data.options);
        if (autoSelect) {
          setSelectedShippingOption(data.options[0]);
        }
      } else {
        setCjShippingOptions([]);
        if (autoSelect) {
          setSelectedShippingOption(null);
        }
      }
    } catch (err) {
      console.error("Error fetching CJ freight options:", err);
      setCjShippingOptions([]);
      if (autoSelect) {
        setSelectedShippingOption(null);
      }
    } finally {
      setIsLoadingFreight(false);
    }
  };

  useEffect(() => {
    if (activeStep === 'checkout') {
      fetchCjFreightOptions(shippingCountry, undefined, true);
    }
  }, [activeStep, shippingCountry]);

  useEffect(() => {
    if (activeStep === 'detail' && selectedProduct && (selectedProduct.cjVid || selectedProduct.cjPid)) {
      fetchCjFreightOptions(shippingCountry, selectedProduct.cjVid || selectedProduct.cjPid, false);
    }
  }, [activeStep, selectedProduct, shippingCountry]);

  useEffect(() => {
    if (onToggleDetailView) {
      onToggleDetailView(
        (activeStep === 'detail' && !!selectedProduct) ||
        activeStep === 'checkout' ||
        activeStep === 'payment'
      );
    }
  }, [activeStep, selectedProduct, onToggleDetailView]);
  
  // Checkout Form states
  const [name, setName] = useState("Carlos Gómez");
  const [email, setEmail] = useState("carlos@example.com");
  const [phone, setPhone] = useState("+34 612 345 678");
  const [address, setAddress] = useState("Avenida de la Constitución 142, Piso 4B");
  const [country, setCountry] = useState("España 🇪🇸");
  const [city, setCity] = useState("Madrid");
  const [postalCode, setPostalCode] = useState("28001");
  const [cardNumber, setCardNumber] = useState("4152 8391 0023 9482");
  const [expiry, setExpiry] = useState("09/29");
  const [cvv, setCvv] = useState("384");
  const [isFormValid, setIsFormValid] = useState(true);

  useEffect(() => {
    if (currentUser?.username === "invitado") {
      setName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCountry("España 🇪🇸");
      setCity("");
      setPostalCode("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    } else {
      setName(currentUser?.name || "Carlos Gómez");
      setEmail(currentUser?.email || "carlos@example.com");
      setPhone("+34 612 345 678");
      setAddress("Avenida de la Constitución 142, Piso 4B");
      setCountry("España 🇪🇸");
      setCity("Madrid");
      setPostalCode("28001");
      setCardNumber("4152 8391 0023 9482");
      setExpiry("09/29");
      setCvv("384");
    }
  }, [currentUser]);

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
      setSelectedProductMediaUrl(selectedProductDirectly.imageUrl);
      setSelectedVariants({});
      setSelectedShippingOption(null);
      setActiveGalleryIndex(0);
      setIsGalleryVideoPlaying(true);
      setIsGalleryVideoMuted(true);
      setActiveStep('detail');
      clearDirectProduct();
    }
  }, [selectedProductDirectly]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setSelectedProductMediaUrl(product.imageUrl);
    setSelectedVariants({});
    setSelectedShippingOption(null);
    setActiveGalleryIndex(0);
    setIsGalleryVideoPlaying(true);
    setIsGalleryVideoMuted(true);
    if (gallerySliderRef.current) {
      gallerySliderRef.current.scrollLeft = 0;
    }
    setActiveStep('detail');
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cartShippingTotal = cart.reduce((acc, item) => acc + (item.product.shippingCost || 0) * item.quantity, 0);
  const cartTotal = cartSubtotal + cartShippingTotal;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const startCheckout = () => {
    if (cart.length === 0) return;
    setShowCartDrawer(false);
    setActiveStep('checkout');
  };

  const executePayment = () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !address.trim() || !city.trim() || !postalCode.trim() || !cardNumber.trim()) {
      setIsFormValid(false);
      return;
    }
    setIsFormValid(true);
    setActiveStep('payment');

    // Simulate Payment Gateway loading
    setTimeout(() => {
      const fullShippingAddress = `${address}, ${city}, ${postalCode}, ${country} (Tel: ${phone}, Email: ${email})`;
      const totalShippingCost = cart.reduce((acc, item) => acc + ((item.product.shippingCost || 0) * item.quantity), 0);
      onCheckout(fullShippingAddress, totalShippingCost, (newOrder) => {
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
        if (product.category) {
          // Direct match with selected category display name
          if (product.category.toLowerCase() !== cat.name.toLowerCase()) {
            return false;
          }
        } else {
          // Fallback matching using queryTerm for legacy/seeded products
          const term = cat.queryTerm.toLowerCase();
          if (term) {
            const matchesCategory = 
              product.name.toLowerCase().includes(term) ||
              product.description.toLowerCase().includes(term);
            if (!matchesCategory) return false;
          } else {
            return false;
          }
        }
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
      <header className={`px-3 sm:px-5 pt-2.5 pb-2 sm:pt-3 sm:pb-2.5 flex items-center justify-between gap-3 z-30 transition-all duration-300 ease-in-out ${
        activeStep === 'detail'
          ? "absolute top-0 inset-x-0 bg-transparent border-none pointer-events-none"
          : "sticky top-0 bg-white border-b border-slate-100"
      } ${showHeader ? "translate-y-0" : "-translate-y-full"}`}>
        <div className="flex items-center space-x-2 shrink-0">
          {activeStep !== 'catalog' && (
            <button
              onClick={() => {
                if (activeStep === 'detail') setActiveStep('catalog');
                else if (activeStep === 'checkout') setActiveStep('catalog');
                else if (activeStep === 'thankyou') setActiveStep('catalog');
              }}
              className={`pointer-events-auto transition-all cursor-pointer flex items-center justify-center ${
                activeStep === 'detail'
                  ? "p-1.5 sm:p-2 rounded-full bg-white/90 hover:bg-white text-slate-900 shadow-md backdrop-blur-md border border-slate-200/80 active:scale-95"
                  : "p-1 sm:p-1.5 rounded-full hover:bg-slate-200 text-slate-600"
              }`}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              {activeStep !== 'detail' && <span className="text-xs font-bold text-slate-700 ml-1">Regresar</span>}
            </button>
          )}
        </div>

        {/* Center Search Bar */}
        {activeStep === 'catalog' && (
          <div className="flex-1 max-w-md relative mx-1 sm:mx-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-100 focus:bg-white border border-transparent focus:border-slate-200 rounded-full transition-all outline-none text-slate-800 placeholder-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Cart Trigger Badge */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setShowCartDrawer(true)}
            className="relative p-1.5 sm:p-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-sm pointer-events-auto active:scale-95"
            id="cart-trigger-btn"
          >
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-extrabold font-mono text-[9px] sm:text-[10px] w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-0 relative">
        <AnimatePresence mode="wait">
          {/* 1. CATALOG STEP */}
          {activeStep === 'catalog' && (
            <div className="flex flex-col space-y-6 p-4 sm:p-6">
              {/* Category Carousel */}
              <div className="w-full relative group/categories">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-display font-extrabold text-xs text-slate-400 uppercase tracking-wider">Categorías</h3>
                  </div>
                  {selectedCategory !== "todos" && (
                    <button 
                      onClick={() => setSelectedCategory("todos")} 
                      className="text-[10px] font-bold text-amber-500 hover:text-amber-600 transition-colors"
                    >
                      Limpiar filtro
                    </button>
                  )}
                </div>
                
                {/* Left Arrow Button */}
                <button
                  type="button"
                  onClick={() => scrollCategoryTrack('left')}
                  className="absolute left-0 top-[calc(50%+10px)] -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-white hover:text-amber-600 transition-all opacity-80 sm:opacity-0 group-hover/categories:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Deslizar a la izquierda"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Right Arrow Button */}
                <button
                  type="button"
                  onClick={() => scrollCategoryTrack('right')}
                  className="absolute right-0 top-[calc(50%+10px)] -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/90 border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:bg-white hover:text-amber-600 transition-all opacity-80 sm:opacity-0 group-hover/categories:opacity-100 hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Deslizar a la derecha"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Scrollable track with drag-to-scroll, wheel scroll and touch pan */}
                <div 
                  ref={categoryTrackRef}
                  onMouseDown={handleCategoryMouseDown}
                  onMouseLeave={handleCategoryMouseLeave}
                  onMouseUp={handleCategoryMouseUp}
                  onMouseMove={handleCategoryMouseMove}
                  onWheel={handleCategoryWheel}
                  className={`flex items-center space-x-4 overflow-x-auto scroll-smooth pb-3 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 select-none ${isCategoryDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x'
                  }}
                >
                  <style>{`
                    .overflow-x-auto::-webkit-scrollbar {
                      display: none;
                    }
                  `}</style>
                  {CATEGORIES.map((cat, idx) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button
                        key={`${cat.id}-${idx}`}
                        onClick={() => {
                          if (isCategoryDragging) return;
                          setSelectedCategory(cat.id);
                        }}
                        className="flex flex-col items-center space-y-2 shrink-0 outline-none group focus:outline-none cursor-pointer"
                        style={{ width: '72px' }}
                      >
                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-all relative flex items-center justify-center bg-white ${isSelected ? "border-amber-500 ring-4 ring-amber-500/10 scale-105 shadow-sm" : "border-slate-100 group-hover:border-slate-300"}`}>
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
                  className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 bg-white"
                >
                  {filteredProducts.map((product, index) => {
                    const seller = getSellerInfo(product.sellerId);
                    return (
                      <div
                        key={`${product.id}-${index}`}
                        className="border border-slate-100 hover:border-amber-500/30 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between"
                        onClick={() => handleProductSelect(product)}
                        id={`prod-card-${product.id}`}
                      >
                        {/* Image Header with Badge */}
                        <div className="relative aspect-square w-full bg-white overflow-hidden flex items-center justify-center">
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
                          
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">${product.price.toFixed(2)}</span>
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
            <>
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 pb-28 p-0 md:p-6"
              >
                {/* Image & Showcase */}
                <div className="space-y-4">
                  {/* Main Media Viewer - Horizontal Scroll Gallery Slider */}
                  <div className="w-full h-[360px] sm:h-[440px] md:h-[500px] rounded-none md:rounded-2xl overflow-hidden border-b md:border border-slate-200/80 bg-white relative group/gallery shadow-xs">
                    {/* Slide Counter Badge */}
                    {productGalleryMedia.length > 1 && (
                      <div className="absolute top-3 right-14 sm:right-16 z-20 bg-slate-950/75 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] font-bold font-mono tracking-wider pointer-events-none shadow-md border border-white/10">
                        {activeGalleryIndex + 1} / {productGalleryMedia.length}
                      </div>
                    )}

                    {/* Horizontal Scroll Track */}
                    <div
                      ref={gallerySliderRef}
                      onScroll={handleGalleryScroll}
                      className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
                      style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x pan-y'
                      }}
                    >
                      {productGalleryMedia.map((mediaUrl, idx) => {
                        const isVideo = checkIsVideo(mediaUrl);
                        return (
                          <div
                            key={idx}
                            className="w-full h-full flex-shrink-0 snap-center relative flex items-center justify-center bg-black overflow-hidden group/vid"
                          >
                            {isVideo ? (
                              <div className="w-full h-full relative flex items-center justify-center bg-black">
                                <video
                                  ref={(el) => { galleryVideoRefs.current[idx] = el; }}
                                  src={mediaUrl}
                                  controls
                                  loop
                                  playsInline
                                  preload="auto"
                                  muted={isGalleryVideoMuted}
                                  onPlay={() => setIsGalleryVideoPlaying(true)}
                                  onPause={() => setIsGalleryVideoPlaying(false)}
                                  onClick={() => {
                                    const videoEl = galleryVideoRefs.current[idx];
                                    if (videoEl) {
                                      if (videoEl.paused) {
                                        videoEl.play().catch(() => {});
                                        setIsGalleryVideoPlaying(true);
                                      } else {
                                        videoEl.pause();
                                        setIsGalleryVideoPlaying(false);
                                      }
                                    }
                                  }}
                                  className="w-full h-full object-contain bg-black relative z-10 cursor-pointer"
                                />

                                {/* Floating Play Button Overlay when paused */}
                                {!isGalleryVideoPlaying && idx === activeGalleryIndex && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const videoEl = galleryVideoRefs.current[idx];
                                      if (videoEl) {
                                        videoEl.play().catch(() => {});
                                        setIsGalleryVideoPlaying(true);
                                      }
                                    }}
                                    className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-950/75 border border-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-2xl hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer"
                                    aria-label="Reproducir video"
                                  >
                                    <Play className="w-8 h-8 fill-white translate-x-0.5 text-white" />
                                  </button>
                                )}

                                {/* Floating Mute/Unmute Toggle Button */}
                                {idx === activeGalleryIndex && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsGalleryVideoMuted((prev) => !prev);
                                    }}
                                    className="absolute bottom-3 left-3 z-20 p-2 text-white hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center drop-shadow-md"
                                    title={isGalleryVideoMuted ? "Activar sonido" : "Silenciar"}
                                    aria-label={isGalleryVideoMuted ? "Activar sonido" : "Silenciar"}
                                  >
                                    {isGalleryVideoMuted ? (
                                      <VolumeX className="w-6 h-6 text-white drop-shadow-md" />
                                    ) : (
                                      <Volume2 className="w-6 h-6 text-amber-400 drop-shadow-md" />
                                    )}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt={`${selectedProduct.name} - ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover p-0 m-0 bg-white"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Media Thumbnails list (including photos and videos) */}
                  <div className="px-4 md:px-0 space-y-4">
                    {productGalleryMedia.length > 1 && (
                      <div className="flex space-x-2 overflow-x-auto py-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                        {productGalleryMedia.map((url, idx) => {
                          const isVideo = checkIsVideo(url);
                          const isSelected = activeGalleryIndex === idx;
                          return (
                            <button
                              key={`thumb-${idx}`}
                              type="button"
                              onClick={() => scrollToGalleryIndex(idx)}
                              className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 relative cursor-pointer transition-all ${
                                isSelected ? "border-amber-500 scale-105 shadow-xs" : "border-slate-200 opacity-70 hover:opacity-100"
                              }`}
                            >
                              {isVideo ? (
                                <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                                  <video
                                    src={url}
                                    className="w-full h-full object-cover opacity-75"
                                    muted
                                    playsInline
                                    preload="metadata"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-xs" />
                                  </div>
                                  <span className="absolute bottom-0.5 right-0.5 bg-amber-500 text-slate-950 font-black text-[7px] px-1 rounded-xs uppercase tracking-tight">
                                    VIDEO
                                  </span>
                                </div>
                              ) : (
                                <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    
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
                </div>

                {/* Product Specs info */}
                <div className="flex flex-col justify-between px-4 md:px-0">
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

                    {/* Product Variants Selection */}
                    {((selectedProduct.variants && selectedProduct.variants.length > 0) || (selectedProduct.variantList && selectedProduct.variantList.length > 0)) && (() => {
                      // Extract unique swatches by color/image to avoid duplicate list
                      const swatchesMap = new Map<string, { name: string; color?: string; imageUrl: string }>();
                      if (selectedProduct.variantList) {
                        selectedProduct.variantList.forEach((vItem) => {
                          if (!vItem.imageUrl) return;
                          const key = (vItem.color || vItem.name || vItem.imageUrl).trim().toLowerCase();
                          if (!swatchesMap.has(key)) {
                            swatchesMap.set(key, {
                              name: vItem.color || vItem.name || "Color",
                              color: vItem.color,
                              imageUrl: vItem.imageUrl
                            });
                          }
                        });
                      }
                      const uniqueSwatches = Array.from(swatchesMap.values());
                      const hasOptionGroups = selectedProduct.variants && selectedProduct.variants.length > 0;

                      return (
                        <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Selecciona tus opciones:</p>
                          </div>

                          {/* If we have option groups (e.g. Color, Talla) */}
                          {hasOptionGroups ? (
                            selectedProduct.variants!.map((v, idx) => {
                              const groupNameLower = v.name.toLowerCase().trim();
                              const isSizeGroup = groupNameLower.includes("talla") || groupNameLower.includes("size") || groupNameLower.includes("medida") || groupNameLower.includes("dimension");
                              
                              const isColorGroup = !isSizeGroup && (
                                groupNameLower.includes("color") ||
                                groupNameLower.includes("estilo") ||
                                groupNameLower.includes("style") ||
                                groupNameLower.includes("opción") ||
                                groupNameLower.includes("option") ||
                                groupNameLower.includes("modelo") ||
                                (selectedProduct.variants!.length === 1 && uniqueSwatches.length > 0)
                              );

                              if (isColorGroup) {
                                const selectedColorVal = selectedVariants[v.name] || (uniqueSwatches.find(s => s.imageUrl === selectedProductMediaUrl)?.name) || "";

                                return (
                                  <div key={idx} className="space-y-2 text-left">
                                    <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                                      <span className="text-slate-600">{v.name}:</span>
                                      {selectedColorVal && (
                                        <span className="text-amber-600 font-extrabold capitalize bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                          {selectedColorVal}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Horizontal Carousel of Color Cards */}
                                    <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
                                      {v.options.map((opt, oIdx) => {
                                        // Find matching swatch image for this color
                                        const matchingSwatch = uniqueSwatches.find(s => 
                                          s.name.toLowerCase() === opt.toLowerCase() || 
                                          (s.color && s.color.toLowerCase() === opt.toLowerCase()) ||
                                          s.name.toLowerCase().includes(opt.toLowerCase())
                                        );
                                        const imgUrl = matchingSwatch?.imageUrl;

                                        const isSelected = selectedVariants[v.name] === opt || (imgUrl && selectedProductMediaUrl === imgUrl);

                                        return (
                                          <button
                                            key={oIdx}
                                            type="button"
                                            title={opt}
                                            onClick={() => {
                                              const nextVariants = { ...selectedVariants, [v.name]: opt };
                                              setSelectedVariants(nextVariants);
                                              if (imgUrl) {
                                                setSelectedProductMediaUrl(imgUrl);
                                              } else if (selectedProduct.variantList) {
                                                const match = selectedProduct.variantList.find((vItem) =>
                                                  (vItem.name && vItem.name.toLowerCase().includes(opt.toLowerCase())) ||
                                                  (vItem.color && vItem.color.toLowerCase().includes(opt.toLowerCase()))
                                                );
                                                if (match && match.imageUrl) {
                                                  setSelectedProductMediaUrl(match.imageUrl);
                                                }
                                              }
                                            }}
                                            className={`group snap-start flex items-center justify-center p-0 overflow-hidden rounded-xl border transition-all cursor-pointer w-16 h-16 shrink-0 relative ${
                                              isSelected 
                                                ? "bg-slate-950 border-slate-950 ring-2 ring-amber-500 shadow-md scale-[1.05]" 
                                                : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs"
                                            }`}
                                          >
                                            {imgUrl ? (
                                              <div className="w-full h-full overflow-hidden relative">
                                                <img
                                                  src={imgUrl}
                                                  alt={opt}
                                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                  referrerPolicy="no-referrer"
                                                />
                                              </div>
                                            ) : (
                                              <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                {opt.slice(0, 3)}
                                              </div>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              // Standard non-color option buttons (e.g. Talla)
                              const selectedOptVal = selectedVariants[v.name];
                              return (
                                <div key={idx} className="space-y-1.5 text-left">
                                  <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                                    <span className="text-slate-600">{v.name}:</span>
                                    {selectedOptVal && (
                                      <span className="text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded-md">
                                        {selectedOptVal}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {v.options.map((opt, oIdx) => {
                                      const isSelected = selectedVariants[v.name] === opt;
                                      return (
                                        <button
                                          key={oIdx}
                                          type="button"
                                          onClick={() => setSelectedVariants({ ...selectedVariants, [v.name]: opt })}
                                          className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                            isSelected 
                                              ? "bg-slate-950 text-white border-slate-950 shadow-sm ring-2 ring-amber-500/30" 
                                              : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })
                          ) : uniqueSwatches.length > 0 ? (
                            /* Fallback if no structured variants array, show unique color swatches in horizontal carousel */
                            <div className="space-y-2 text-left">
                              <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                                <span className="text-slate-600">Color:</span>
                                {(selectedVariants["Color"] || (uniqueSwatches.find(s => s.imageUrl === selectedProductMediaUrl)?.name)) && (
                                  <span className="text-amber-600 font-extrabold capitalize bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                    {selectedVariants["Color"] || (uniqueSwatches.find(s => s.imageUrl === selectedProductMediaUrl)?.name)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
                                {uniqueSwatches.map((swatch, sIdx) => {
                                  const isSelected = selectedProductMediaUrl === swatch.imageUrl;
                                  return (
                                    <button
                                      key={sIdx}
                                      type="button"
                                      title={swatch.name}
                                      onClick={() => {
                                        setSelectedProductMediaUrl(swatch.imageUrl);
                                        setSelectedVariants(prev => ({ ...prev, Color: swatch.name }));
                                      }}
                                      className={`group snap-start flex items-center justify-center p-0 overflow-hidden rounded-xl border transition-all cursor-pointer w-16 h-16 shrink-0 relative ${
                                        isSelected
                                          ? "bg-slate-950 border-slate-950 ring-2 ring-amber-500 shadow-md scale-[1.05]"
                                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs"
                                      }`}
                                    >
                                      <div className="w-full h-full overflow-hidden">
                                        <img src={swatch.imageUrl} alt={swatch.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                    {/* Shipping Calculation Section moved BELOW options and sizes */}
                    <div className="mt-6 border-t border-slate-100 pt-4 space-y-3" id="shipping-calculation-section">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                          <Truck className="w-4 h-4 text-amber-500" />
                          <span>Envío a tu País ({shippingCountry}):</span>
                        </p>

                        {selectedShippingOption ? (
                          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{selectedShippingOption.carrier}: {selectedShippingOption.shippingCost === 0 ? "GRATIS" : `$${selectedShippingOption.shippingCost.toFixed(2)}`}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                            Paso requerido antes de añadir
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Fixed Bottom Action Bar for Product Details (Replaces main navigation bar) */}
              <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-3 px-4 sm:px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-extrabold block">Precio unitario</span>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-950">${selectedProduct.price.toFixed(2)}</span>
                      {selectedShippingOption ? (
                        <span className="text-[10px] text-amber-800 font-extrabold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                          Envío: {selectedShippingOption.shippingCost === 0 ? "GRATIS" : `$${selectedShippingOption.shippingCost.toFixed(2)}`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-900 font-extrabold bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Envío no seleccionado</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedProduct.stock > 0) {
                        // Check if shipping option is selected for destination country
                        if (!selectedShippingOption) {
                          setShowShippingModal(true);
                          fetchCjFreightOptions(shippingCountry, selectedProduct.cjVid || selectedProduct.cjPid);
                          return;
                        }

                        const finalVariants = { ...selectedVariants };
                        if (selectedProduct.variants && selectedProduct.variants.length > 0) {
                          selectedProduct.variants.forEach((v) => {
                            if (!finalVariants[v.name]) {
                              finalVariants[v.name] = v.options[0];
                            }
                          });
                        }
                        
                        const variantStr = Object.entries(finalVariants)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ");
                        
                        // Active variant image selected by user
                        const activeImageUrl = selectedProductMediaUrl || selectedProduct.imageUrl;

                        const customizedProduct: Product = {
                          ...selectedProduct,
                          imageUrl: activeImageUrl,
                          name: variantStr ? `${selectedProduct.name} (${variantStr})` : selectedProduct.name,
                          shippingCost: selectedShippingOption.shippingCost,
                          selectedCarrier: selectedShippingOption.carrier
                        };
                        
                        onAddToCart(customizedProduct);
                        setShowCartDrawer(true);
                      }
                    }}
                    disabled={selectedProduct.stock <= 0}
                    className={`px-5 py-3 sm:px-8 sm:py-3.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md ${
                      selectedProduct.stock <= 0
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : !selectedShippingOption
                        ? "bg-amber-400 hover:bg-amber-500 text-slate-950 ring-2 ring-amber-400/50 animate-pulse"
                        : "bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 ring-2 ring-amber-500/30"
                    }`}
                    id="add-to-cart-detail-btn"
                  >
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{!selectedShippingOption ? "Calcular envío" : "Añadir al Carrito"}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 3. CHECKOUT FORM STEP */}
          {activeStep === 'checkout' && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-5 gap-8 pb-28 sm:pb-32 max-w-5xl mx-auto px-2 sm:px-4 py-2"
            >
              {/* Left Column: Checkout Inputs (3 cols) */}
              <div className="md:col-span-3 space-y-6">
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2 pb-2 border-b border-slate-100">
                    <Truck className="w-4 h-4 text-amber-500" />
                    <span>Información de Envío</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Ej: Carlos Gómez"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          placeholder="ejemplo@correo.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Número de Teléfono</label>
                        <input
                          type="tel"
                          placeholder="+34 612 345 678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Dirección de Entrega</label>
                      <input
                        type="text"
                        placeholder="Calle, Número, Piso/Puerta"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">País</label>
                        <div className="relative">
                          <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer pr-8 transition-all"
                          >
                            {CJ_DEST_COUNTRIES.map((c) => (
                              <option key={c.code} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                            ▼
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Ciudad</label>
                        <input
                          type="text"
                          placeholder="Ej: Madrid"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Código Postal</label>
                        <input
                          type="text"
                          placeholder="Ej: 28001"
                          value={postalCode}
                          onChange={(e) => setPostalCode(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
                  <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2 pb-2 border-b border-slate-100">
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
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 pl-10 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
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
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">CVV</label>
                        <input
                          type="password"
                          placeholder="000"
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value)}
                          className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary (2 cols) */}
              <div className="md:col-span-2 bg-white text-slate-900 p-6 rounded-2xl flex flex-col justify-between border border-slate-200/90 shadow-xl shadow-slate-100/80 space-y-6 h-fit sticky top-20">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      <h3 className="font-display font-extrabold text-sm text-slate-900">Resumen del Pedido</h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {cart.reduce((acc, i) => acc + i.quantity, 0)} {cart.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                      <div key={`${item.product.id}-${idx}`} className="flex items-center justify-between text-xs pt-2.5 first:pt-0">
                        <div className="flex items-center space-x-3 truncate flex-1 pr-2">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0 bg-slate-50"
                          />
                          <div className="truncate">
                            <span className="font-bold text-slate-800 text-xs block truncate">{item.product.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">Cant: {item.quantity} × ${item.product.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-xs shrink-0">${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 mt-5 pt-4 space-y-2.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Subtotal Productos</span>
                      <span className="font-mono font-semibold">${cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 items-center">
                      <span>Costo de Envío</span>
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                        {cartShippingTotal === 0 ? "GRATIS" : `$${cartShippingTotal.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200/80 pt-3 mt-2">
                      <span>Total a Pagar</span>
                      <span className="text-amber-600 font-mono text-lg">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-center">
                  <p className="text-[11px] text-amber-900 font-semibold flex items-center justify-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Pago 100% seguro con encriptación SSL 256-bit</span>
                  </p>
                </div>
              </div>

              {/* Fixed Bottom Payment Bar */}
              <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 sm:px-6 sm:py-3.5 shadow-[0_-8px_25px_rgba(0,0,0,0.08)]">
                <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <div className="hidden sm:flex p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-200/60">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none mb-0.5">Total a Pagar</span>
                      <span className="text-lg sm:text-2xl font-mono font-extrabold text-slate-900">${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    {!isFormValid && (
                      <span className="text-[10px] text-rose-500 font-bold mb-1 animate-pulse">
                        Por favor complete todos los datos
                      </span>
                    )}
                    <button
                      onClick={executePayment}
                      className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/25 border border-amber-400"
                      id="pay-now-btn"
                    >
                      <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Pagar (${cartTotal.toFixed(2)})</span>
                    </button>
                  </div>
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
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <button
                  onClick={() => setShowCartDrawer(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors"
                  id="close-cart-drawer-btn"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center space-x-1.5">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span className="font-display font-bold text-sm text-slate-900">Carrito de Compra ({cartItemCount})</span>
                </div>
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
                  cart.map((item, idx) => (
                    <div
                      key={`${item.product.id}_${idx}`}
                      className="flex items-start space-x-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 leading-tight" title={item.product.name}>{item.product.name}</h4>
                        
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-black text-slate-900 font-mono">${item.product.price.toFixed(2)}</span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-md">
                            Envío: {item.product.shippingCost && item.product.shippingCost > 0 ? `$${item.product.shippingCost.toFixed(2)}` : "GRATIS"} {item.product.selectedCarrier ? `(${item.product.selectedCarrier})` : ""}
                          </span>
                        </div>
                        
                        {/* Incrementor buttons */}
                        <div className="flex items-center space-x-2.5 mt-2">
                          <button
                            onClick={() => onUpdateCartQuantity(item.product.id, Math.max(1, item.quantity - 1), idx)}
                            className="p-1 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 font-mono">{item.quantity}</span>
                          <button
                            onClick={() => onUpdateCartQuantity(item.product.id, item.quantity + 1, idx)}
                            disabled={item.quantity >= item.product.stock}
                            className="p-1 border border-slate-200 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-50 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => onRemoveFromCart(item.product.id, idx)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer summary */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Subtotal productos:</span>
                    <span className="font-mono text-slate-800 font-semibold">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Costo de Envío:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {cartShippingTotal === 0 ? "GRATIS" : `$${cartShippingTotal.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-200/80 pt-2">
                    <span>Total del Carrito:</span>
                    <span className="font-mono text-slate-950 font-black text-sm">${cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={startCheckout}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1"
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

      {/* Bottom Sheet Modal for Calculating CJ Shipping (Sliding bottom to top) */}
      <AnimatePresence>
        {showShippingModal && selectedProduct && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-0"
            onClick={() => setShowShippingModal(false)}
            id="shipping-modal-overlay"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 flex flex-col max-h-[85vh] overflow-hidden text-slate-900 relative"
              id="shipping-modal-panel"
            >
              {/* Panel Header */}
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 bg-amber-500/15 rounded-lg text-amber-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-tight">Calcular Envío</h3>
                    <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-xs leading-none mt-0.5">
                      {selectedProduct.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShippingModal(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  id="close-shipping-modal-btn"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Country Selector Field */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Globe className="w-4 h-4 text-amber-500" />
                    <span>Selecciona el País de Destino:</span>
                  </label>
                  <div className="relative">
                    <select
                      value={shippingCountry}
                      onChange={(e) => {
                        const newCountry = e.target.value;
                        setShippingCountry(newCountry);
                        fetchCjFreightOptions(newCountry, selectedProduct.cjVid || selectedProduct.cjPid);
                      }}
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-amber-500 rounded-2xl p-3.5 pr-10 text-xs sm:text-sm font-extrabold text-slate-800 appearance-none outline-none transition-all cursor-pointer shadow-xs"
                      id="shipping-country-select"
                    >
                      {CJ_DEST_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Logistics Options Header */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 text-amber-500" />
                      <span>Opciones de Envío Disponibles CJ:</span>
                    </h4>
                  </div>

                  {/* Loading State */}
                  {isLoadingFreight ? (
                    <div className="py-10 flex flex-col items-center justify-center space-y-3 text-center">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                      <p className="text-xs font-bold text-slate-600">
                        Consultando opciones de envío de CJ Dropshipping...
                      </p>
                      <p className="text-[11px] text-slate-400">Obteniendo tarifas para {CJ_DEST_COUNTRIES.find(c => c.code === shippingCountry)?.name || shippingCountry}</p>
                    </div>
                  ) : cjShippingOptions.length === 0 ? (
                    <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-2">
                      <PackageCheck className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-extrabold text-slate-700">No hay opciones específicas</p>
                      <p className="text-[11px] text-slate-500">Se aplicará la tarifa internacional base de $3.50 para este producto.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cjShippingOptions.map((option, idx) => {
                        const isSelected = selectedShippingOption?.carrier === option.carrier;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedShippingOption(option);
                              if (selectedProduct) {
                                selectedProduct.shippingCost = option.shippingCost;
                              }
                            }}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-md"
                                : "bg-white hover:bg-slate-50 border-slate-200 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-xl mt-0.5 ${isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}>
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <h5 className="text-xs font-extrabold text-slate-900 flex items-center space-x-2">
                                  <span>{option.carrier}</span>
                                  {idx === 0 && (
                                    <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.2 rounded-md uppercase">
                                      Recomendado
                                    </span>
                                  )}
                                </h5>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                  ⏱️ Tiempo de entrega: <span className="font-bold text-slate-800">{option.aging}</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  📦 Origen: Almacén China (CN) → {shippingCountry}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-black font-mono text-slate-900 block">
                                {option.shippingCost === 0 ? "GRATIS" : `$${option.shippingCost.toFixed(2)}`}
                              </span>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-1 ${
                                isSelected ? "bg-amber-500 text-slate-950 font-black" : "bg-slate-100 text-slate-600"
                              }`}>
                                {isSelected ? "Seleccionado" : "Elegir"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-between gap-3 shrink-0">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Envío seleccionado:</span>
                  <span className="text-xs font-extrabold text-slate-900">
                    {selectedShippingOption ? `${selectedShippingOption.carrier} ($${selectedShippingOption.shippingCost.toFixed(2)})` : "Estándar ($3.50)"}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (selectedShippingOption && selectedProduct) {
                      selectedProduct.shippingCost = selectedShippingOption.shippingCost;
                    }
                    setShowShippingModal(false);
                  }}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                  id="apply-shipping-btn"
                >
                  Confirmar y Aplicar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
