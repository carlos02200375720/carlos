import React, { useState, useEffect, useRef } from "react";
import { ShoppingCart, ArrowLeft, Search, X, Check, Bookmark } from "lucide-react";
import { Product, CartItem, Order, User } from "../../../types";
import { motion, AnimatePresence } from "motion/react";
import { getProductShareUrl, getProductPath, navigateTo, parseRoute } from "../../../router";
import ProductoIdTiendaView from "./productoid";
import CarritoTiendaView from "./carrito";
import VerificasionTiendaView from "./verificasion";
import GraciaTiendaView from "./gracia";
import { trackFunnelStep } from "../../../utils/analyticsTracker";

export const CATEGORIES = [
  {
    id: "todos",
    name: "Todos",
    queryTerm: "",
    imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "ropa_femenina",
    name: "Ropa Femenina",
    queryTerm: "femenina",
    imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "ropa_masculina",
    name: "Ropa Masculina",
    queryTerm: "masculina",
    imageUrl: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "mascota",
    name: "Mascotas",
    queryTerm: "mascota",
    imageUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "hogar",
    name: "Hogar",
    queryTerm: "neon",
    imageUrl: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "salud",
    name: "Salud",
    queryTerm: "yoga",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "joya",
    name: "Joyas",
    queryTerm: "joya",
    imageUrl: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "bolso",
    name: "Bolsos",
    queryTerm: "bolso",
    imageUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "sapato",
    name: "Zapatos",
    queryTerm: "zapato",
    imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "juguete",
    name: "Juguetes",
    queryTerm: "juguete",
    imageUrl: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "deportes",
    name: "Deportes",
    queryTerm: "yoga",
    imageUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "electronica",
    name: "Electrónica",
    queryTerm: "synth",
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "automotriz",
    name: "Automotriz",
    queryTerm: "automotriz",
    imageUrl: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "telefono",
    name: "Teléfonos",
    queryTerm: "telefono",
    imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=150&q=80",
  },
  {
    id: "informatica",
    name: "Informática",
    queryTerm: "informatica",
    imageUrl: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=150&q=80",
  },
];

export interface ShopProps {
  products: Product[];
  cart: CartItem[];
  users: User[];
  currentUser: User;
  onAddToCart: (product: Product) => void;
  onRemoveFromCart: (productId: string, cartItemIndex?: number) => void;
  onUpdateCartQuantity: (productId: string, qty: number, cartItemIndex?: number) => void;
  onCheckout: (
    address: string,
    shippingCost: number,
    onComplete: (newOrder: Order) => void,
    itemsToCheckout?: CartItem[],
    buyerInfo?: { buyerName?: string; buyerEmail?: string; buyerPhone?: string }
  ) => void;
  onCreatorClick: (creatorId: string) => void;
  selectedProductDirectly: Product | null;
  clearDirectProduct: () => void;
  onNavigateToHistory: () => void;
  onToggleDetailView?: (isOpen: boolean) => void;
  onLoginSuccess?: (user: User) => void;
  initialStep?: "catalog" | "detail" | "cart" | "checkout" | "payment" | "thankyou";
  initialSelectedCartIndices?: number[];
  onClearInitialStep?: () => void;
  onProductSelect?: (product: Product) => void;
  onBackToCatalog?: () => void;
  onStepChange?: (step: "catalog" | "detail" | "cart" | "checkout" | "payment" | "thankyou") => void;
  savedReelIds?: string[];
  onToggleSave?: (id: string) => void;
  onGuestInteraction?: (action: string) => void;
}

export type TiendaProps = ShopProps;
export type ShopViewProps = ShopProps;
export type CatalogoTiendaViewProps = ShopProps;

export default function Tienda({
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
  onToggleDetailView,
  onLoginSuccess,
  initialStep,
  initialSelectedCartIndices,
  onClearInitialStep,
  onProductSelect,
  onBackToCatalog,
  onStepChange,
  savedReelIds = [],
  onToggleSave,
  onGuestInteraction,
}: ShopProps) {
  const [activeStep, setActiveStep] = useState<
    "catalog" | "detail" | "checkout" | "payment" | "thankyou"
  >(() => {
    if (initialStep && initialStep !== "cart") return initialStep;
    if (typeof window !== "undefined") {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "checkout") return "checkout";
      if (parsed.type === "thankyou") return "thankyou";
      if (parsed.type === "product") return "detail";
    }
    if (selectedProductDirectly) return "detail";
    return "catalog";
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => {
    if (selectedProductDirectly) return selectedProductDirectly;
    if (typeof window !== "undefined") {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "product" && Array.isArray(products)) {
        return (
          products.find(
            (p) =>
              p.id === parsed.productId ||
              (p as any)._id === parsed.productId ||
              (parsed.productSlug && p.id === parsed.productSlug)
          ) || null
        );
      }
    }
    return null;
  });

  const [showCartDrawer, setShowCartDrawer] = useState(() => {
    if (initialStep === "cart") return true;
    if (
      typeof window !== "undefined" &&
      /^\/(?:tienda\/|shop\/)?(?:carrito|cart)$/i.test(window.location.pathname.replace(/\/+$/, ""))
    ) {
      return true;
    }
    return false;
  });

  const [copiedProductLink, setCopiedProductLink] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const toggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [displayCount, setDisplayCount] = useState<number>(12);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const infiniteLoaderRef = useRef<HTMLDivElement>(null);

  // Category track drag, infinite auto-scroll & horizontal scroll helpers
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [isCategoryHovered, setIsCategoryHovered] = useState(false);
  const isCategoryInteractingRef = useRef(false);
  const categoryHasMovedRef = useRef(false);
  const categoryResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

  // Duplicated list of categories for seamless infinite loop
  const infiniteCategories = React.useMemo(() => [...CATEGORIES, ...CATEGORIES], []);

  // Smooth infinite horizontal continuous motion
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 0.5;

    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      const track = categoryTrackRef.current;
      if (
        track &&
        !isCategoryDragging &&
        !isCategoryHovered &&
        !isCategoryInteractingRef.current
      ) {
        track.scrollLeft += speed * delta;

        const singleSetWidth = track.scrollWidth / 2;
        if (singleSetWidth > 0 && track.scrollLeft >= singleSetWidth) {
          track.scrollLeft -= singleSetWidth;
        } else if (track.scrollLeft <= 0) {
          track.scrollLeft += singleSetWidth;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCategoryDragging, isCategoryHovered]);

  const handleCategoryMouseDown = (e: React.MouseEvent) => {
    if (!categoryTrackRef.current) return;
    setIsCategoryDragging(true);
    categoryHasMovedRef.current = false;
    setCategoryStartX(e.pageX - categoryTrackRef.current.offsetLeft);
    setCategoryScrollLeft(categoryTrackRef.current.scrollLeft);
  };

  const handleCategoryMouseLeave = () => {
    setIsCategoryDragging(false);
    setIsCategoryHovered(false);
  };

  const handleCategoryMouseUp = () => {
    setIsCategoryDragging(false);
    setTimeout(() => {
      categoryHasMovedRef.current = false;
    }, 60);
  };

  const handleCategoryMouseMove = (e: React.MouseEvent) => {
    if (!isCategoryDragging || !categoryTrackRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoryTrackRef.current.offsetLeft;
    const walk = (x - categoryStartX) * 1.5;
    if (Math.abs(walk) > 4) {
      categoryHasMovedRef.current = true;
    }
    categoryTrackRef.current.scrollLeft = categoryScrollLeft - walk;
  };

  const handleCategoryWheel = (e: React.WheelEvent) => {
    if (!categoryTrackRef.current) return;
    if (e.deltaY !== 0 || e.deltaX !== 0) {
      categoryTrackRef.current.scrollLeft += e.deltaY || e.deltaX;
      isCategoryInteractingRef.current = true;
      if (categoryResumeTimeoutRef.current) clearTimeout(categoryResumeTimeoutRef.current);
      categoryResumeTimeoutRef.current = setTimeout(() => {
        isCategoryInteractingRef.current = false;
      }, 1200);
    }
  };

  const handleCategoryTouchStart = () => {
    isCategoryInteractingRef.current = true;
    if (categoryResumeTimeoutRef.current) clearTimeout(categoryResumeTimeoutRef.current);
  };

  const handleCategoryTouchEnd = () => {
    if (categoryResumeTimeoutRef.current) clearTimeout(categoryResumeTimeoutRef.current);
    categoryResumeTimeoutRef.current = setTimeout(() => {
      isCategoryInteractingRef.current = false;
    }, 1500);
  };

  // Checkout Form states
  const [name, setName] = useState("Carlos Gómez");
  const [email, setEmail] = useState("carlos@example.com");
  const [phone, setPhone] = useState("+34 612 345 678");
  const [address, setAddress] = useState("Avenida de la Constitución 142, Piso 4B");
  const [country, setCountry] = useState("República Dominicana 🇩🇴");
  const [city, setCity] = useState("Santo Domingo");
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
      setCountry("República Dominicana 🇩🇴");
      setCity("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
    } else {
      setName(currentUser?.name || "Carlos Gómez");
      setEmail(currentUser?.email || "carlos@example.com");
      setPhone("+34 612 345 678");
      setAddress("Avenida de la Constitución 142, Piso 4B");
      setCountry("República Dominicana 🇩🇴");
      setCity("Santo Domingo");
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
      let hideThreshold = 220;
      const secondProductCard =
        document.getElementById("prod-card-1") || document.querySelector("[id^='prod-card-']");
      if (secondProductCard) {
        const rect = secondProductCard.getBoundingClientRect();
        const cardBottom = rect.bottom + window.scrollY;
        if (cardBottom > 100) {
          hideThreshold = Math.max(180, cardBottom - 80);
        }
      }

      if (Math.abs(currentScrollY - lastScrollY.current) < 6) {
        return;
      }

      if (currentScrollY <= hideThreshold) {
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Notify parent component about detail/checkout view
  useEffect(() => {
    if (onToggleDetailView) {
      onToggleDetailView(
        (activeStep === "detail" && !!selectedProduct) ||
          activeStep === "checkout" ||
          activeStep === "payment"
      );
    }
    if (activeStep === "detail") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [activeStep, selectedProduct, onToggleDetailView]);

  // Track sales funnel steps in real time
  useEffect(() => {
    if (showCartDrawer) {
      trackFunnelStep("carrito", { path: "/tienda/carrito" });
      return;
    }
    if (activeStep === "catalog") {
      trackFunnelStep("tienda", { path: "/tienda" });
    } else if (activeStep === "detail" && selectedProduct) {
      trackFunnelStep("producto_id", {
        path: getProductPath(selectedProduct),
        productId: selectedProduct.id,
      });
    } else if (activeStep === "checkout") {
      trackFunnelStep("verificacion", { path: "/tienda/verificacion" });
    } else if (activeStep === "thankyou") {
      trackFunnelStep("gracia", { path: "/tienda/gracia" });
    }
  }, [activeStep, selectedProduct?.id, showCartDrawer]);

  // Sync direct product clicks from reels or routes
  useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
      setActiveStep("detail");
      const targetPath = getProductPath(selectedProductDirectly);
      if (typeof window !== "undefined" && window.location.pathname !== targetPath) {
        navigateTo(targetPath, { replace: true });
      }
    }
  }, [selectedProductDirectly]);

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setActiveStep("detail");
    if (onProductSelect) {
      onProductSelect(product);
    } else {
      navigateTo(getProductPath(product));
    }
    onStepChange?.("detail");
  };

  const handleBackToCatalog = () => {
    setActiveStep("catalog");
    setSelectedProduct(null);
    clearDirectProduct?.();
    if (onBackToCatalog) {
      onBackToCatalog();
    } else {
      navigateTo("/tienda");
    }
    onStepChange?.("catalog");
  };

  // Cart selection state
  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>([]);

  // Respond to initialStep or initialSelectedCartIndices from external navigation
  useEffect(() => {
    if (initialStep === "cart") {
      setShowCartDrawer(true);
      onClearInitialStep?.();
    } else if (initialStep && initialStep !== "catalog") {
      setShowCartDrawer(false);
      setActiveStep(initialStep);
      if (initialSelectedCartIndices && initialSelectedCartIndices.length > 0) {
        setSelectedCartIndices(initialSelectedCartIndices);
      }
      onClearInitialStep?.();
    }
  }, [initialStep, initialSelectedCartIndices, onClearInitialStep]);

  // Synchronize Product Detail, Cart Drawer, Checkout, and Thank You step with browser URL
  useEffect(() => {
    const syncStepFromUrl = () => {
      const parsed = parseRoute(window.location.pathname);
      if (parsed.type === "cart") {
        setShowCartDrawer(true);
      } else if (parsed.type === "checkout") {
        setShowCartDrawer(false);
        setActiveStep("checkout");
      } else if (parsed.type === "thankyou") {
        setShowCartDrawer(false);
        setActiveStep("thankyou");
      } else if (parsed.type === "product") {
        setShowCartDrawer(false);
        setActiveStep("detail");
        const matched = (products || []).find(
          (p) =>
            p.id === parsed.productId ||
            (p as any)._id === parsed.productId ||
            (parsed.productSlug && p.id === parsed.productSlug)
        );
        if (matched) {
          setSelectedProduct(matched);
        }
      } else if (parsed.type === "shop") {
        setShowCartDrawer(false);
        setActiveStep("catalog");
        setSelectedProduct(null);
      } else {
        setShowCartDrawer(false);
      }
    };
    window.addEventListener("popstate", syncStepFromUrl);
    window.addEventListener("app-route-change", syncStepFromUrl);
    return () => {
      window.removeEventListener("popstate", syncStepFromUrl);
      window.removeEventListener("app-route-change", syncStepFromUrl);
    };
  }, [products]);

  const openCartDrawer = () => {
    setShowCartDrawer(true);
    navigateTo("/tienda/carrito");
  };

  const closeCartDrawer = () => {
    setShowCartDrawer(false);
    if (activeStep === "detail" && selectedProduct) {
      navigateTo(getProductPath(selectedProduct));
    } else if (activeStep === "checkout") {
      navigateTo("/tienda/verificacion");
    } else if (activeStep === "thankyou") {
      navigateTo("/tienda/gracia");
    } else {
      navigateTo("/tienda");
    }
  };

  // Automatically sync cart selections when cart items change
  useEffect(() => {
    setSelectedCartIndices((prev) => {
      if (cart.length === 0) return [];
      if (prev.length === 0) return cart.map((_, i) => i);
      const valid = prev.filter((i) => i < cart.length);
      return valid.length > 0 ? valid : cart.map((_, i) => i);
    });
  }, [cart.length]);

  const toggleItemSelection = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCartIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const isAllCartSelected = cart.length > 0 && selectedCartIndices.length === cart.length;

  const toggleSelectAllCart = () => {
    if (isAllCartSelected) {
      setSelectedCartIndices([]);
    } else {
      setSelectedCartIndices(cart.map((_, i) => i));
    }
  };

  const selectedCartItems = cart.filter((_, idx) => selectedCartIndices.includes(idx));
  const effectiveCheckoutItems = selectedCartItems.length > 0 ? selectedCartItems : cart;

  const cartSubtotal = effectiveCheckoutItems.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const cartShippingTotal = effectiveCheckoutItems.reduce((acc, item) => {
    const shippingFee =
      item.selectedShippingCost !== undefined
        ? item.selectedShippingCost
        : item.product.shippingCost !== undefined
        ? item.product.shippingCost
        : 0;
    return acc + shippingFee * item.quantity;
  }, 0);
  const cartTotal = cartSubtotal + cartShippingTotal;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const startCheckout = () => {
    if (effectiveCheckoutItems.length === 0) return;
    setShowCartDrawer(false);
    setActiveStep("checkout");
    navigateTo("/tienda/verificacion");
    onStepChange?.("checkout");
  };

  const executePayment = () => {
    if (
      !name.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !address.trim() ||
      !city.trim() ||
      !cardNumber.trim()
    ) {
      setIsFormValid(false);
      return;
    }
    setIsFormValid(true);
    setActiveStep("payment");

    setTimeout(() => {
      const fullShippingAddress = `${address}, ${city}, ${country} (Tel: ${phone}, Email: ${email})`;
      const totalShippingCost = effectiveCheckoutItems.reduce((acc, item) => {
        const shippingFee =
          item.selectedShippingCost !== undefined
            ? item.selectedShippingCost
            : item.product.shippingCost !== undefined
            ? item.product.shippingCost
            : 0;
        return acc + (shippingFee || 0) * item.quantity;
      }, 0);
      onCheckout(
        fullShippingAddress,
        totalShippingCost,
        (newOrder) => {
          setCompletedOrder(newOrder);
          setActiveStep("thankyou");
          navigateTo("/tienda/gracia");
          onStepChange?.("thankyou");
        },
        effectiveCheckoutItems,
        {
          buyerName: name.trim(),
          buyerEmail: email.trim().toLowerCase(),
          buyerPhone: phone.trim(),
        }
      );
    }, 2500);
  };

  const getSellerInfo = (sellerId: string) => {
    return users.find((u) => u.id === sellerId) || { name: "Vendedor Destacado", avatar: "" };
  };

  const filteredProducts = products.filter((product) => {
    if (selectedCategory && selectedCategory !== "todos") {
      const cat = CATEGORIES.find((c) => c.id === selectedCategory);
      if (cat) {
        if (product.category) {
          if (product.category.toLowerCase() !== cat.name.toLowerCase()) {
            return false;
          }
        } else {
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

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      product.name.toLowerCase().includes(q) || product.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setDisplayCount(12);
  }, [selectedCategory, searchQuery]);

  // Infinite Scroll Trigger
  useEffect(() => {
    if (activeStep !== "catalog") return;

    const handleWindowScroll = () => {
      if (isLoadingMore || filteredProducts.length === 0) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 500;
      if (scrollPosition >= threshold) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setDisplayCount((prev) => prev + 8);
          setIsLoadingMore(false);
        }, 200);
      }
    };

    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    const target = infiniteLoaderRef.current;
    let observer: IntersectionObserver | null = null;

    if (target) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMore && filteredProducts.length > 0) {
            setIsLoadingMore(true);
            setTimeout(() => {
              setDisplayCount((prev) => prev + 8);
              setIsLoadingMore(false);
            }, 200);
          }
        },
        { threshold: 0, rootMargin: "600px" }
      );
      observer.observe(target);
    }

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
      if (observer) observer.disconnect();
    };
  }, [activeStep, isLoadingMore, filteredProducts.length]);

  const displayedProducts = React.useMemo(() => {
    if (filteredProducts.length === 0) return [];
    const result: Product[] = [];
    for (let i = 0; i < displayCount; i++) {
      result.push(filteredProducts[i % filteredProducts.length]);
    }
    return result;
  }, [filteredProducts, displayCount]);

  return (
    <div
      className="w-full min-h-screen bg-white relative flex flex-col no-scrollbar"
      id="shop-panel"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {/* Toast Notification when Product Link is Copied */}
      {copiedProductLink && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl border border-amber-500/50 flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
          <Check className="w-4 h-4 text-amber-400" />
          <span>¡Enlace del producto copiado al portapapeles!</span>
        </div>
      )}

      {/* 1. Detail Page Transparent Fixed Header */}
      {activeStep === "detail" ? (
        <header
          className="fixed top-0 left-0 right-0 md:left-60 lg:left-64 z-40 flex items-center justify-between px-3 sm:px-5 pb-2 bg-transparent border-0 pointer-events-none transition-all duration-200"
          style={{
            paddingTop: "0.5rem",
          }}
          id="product-detail-transparent-header"
        >
          <div className="flex items-center">
            <button
              type="button"
              onClick={handleBackToCatalog}
              className="w-10 h-10 rounded-full bg-transparent text-black flex items-center justify-center hover:scale-105 transition-all active:scale-95 pointer-events-auto cursor-pointer border-0 shadow-none outline-none"
              aria-label="Regresar al catálogo"
              id="detail-back-button"
            >
              <ArrowLeft className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedProduct) return;
                if (onToggleSave) {
                  onToggleSave(selectedProduct.id);
                } else {
                  toggleFavorite(selectedProduct.id);
                }
              }}
              className="w-10 h-10 rounded-full bg-transparent text-black flex items-center justify-center hover:scale-105 transition-all active:scale-95 pointer-events-auto cursor-pointer border-0 shadow-none outline-none"
              id="detail-save-trigger-btn"
              aria-label="Guardar producto"
              title={
                selectedProduct &&
                (savedReelIds.includes(selectedProduct.id) ||
                  favorites.includes(selectedProduct.id))
                  ? "Guardado"
                  : "Guardar producto"
              }
            >
              <Bookmark
                className={`w-5 h-5 transition-all duration-200 ${
                  selectedProduct &&
                  (savedReelIds.includes(selectedProduct.id) ||
                    favorites.includes(selectedProduct.id))
                    ? "fill-amber-500 text-amber-500 scale-105"
                    : "text-black"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={openCartDrawer}
              className="relative w-10 h-10 rounded-full bg-transparent text-black flex items-center justify-center hover:scale-105 transition-all active:scale-95 pointer-events-auto cursor-pointer border-0 shadow-none outline-none"
              id="detail-cart-trigger-btn"
              aria-label="Ver carrito"
            >
              <ShoppingCart className="w-5 h-5 text-black" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-extrabold font-mono text-[9px] sm:text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-none">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </header>
      ) : (
        /* 2. Regular Shop Navigation Header (Catalog / Checkout / Thankyou) */
        <header
          className={`z-30 sticky top-0 bg-white border-b border-slate-100 shadow-2xs transition-all duration-300 ease-in-out flex flex-col ${
            showHeader ? "translate-y-0" : "-translate-y-full"
          }`}
          style={{
            paddingTop: "0.5rem",
          }}
        >
          {/* Top Bar: Navigation / Search / Cart */}
          <div className="px-3 sm:px-5 pb-1.5 sm:pb-2 flex items-center justify-between gap-3 w-full">
            <div
              className={`flex items-center space-x-2 shrink-0 ${
                activeStep === "catalog" ? "pl-10 md:pl-0" : ""
              }`}
            >
              {activeStep !== "catalog" && (
                <button
                  onClick={handleBackToCatalog}
                  className="p-1 sm:p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-all cursor-pointer flex items-center justify-center pointer-events-auto"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs font-bold text-slate-700 ml-1">Regresar</span>
                </button>
              )}
            </div>

            {/* Center Search Bar */}
            {activeStep === "catalog" && (
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
                onClick={openCartDrawer}
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
          </div>

          {/* Sticky Category Carousel directly anchored below search bar */}
          {activeStep === "catalog" && (
            <div className="w-full relative group/categories border-t border-slate-50/80 pt-0.5 pb-1">
              {selectedCategory !== "todos" && (
                <div className="flex items-center justify-end mb-0.5 px-3 sm:px-5">
                  <button
                    onClick={() => setSelectedCategory("todos")}
                    className="text-[9.5px] font-bold text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                  >
                    Limpiar filtro ({CATEGORIES.find((c) => c.id === selectedCategory)?.name})
                  </button>
                </div>
              )}

              <div
                ref={categoryTrackRef}
                onMouseEnter={() => setIsCategoryHovered(true)}
                onMouseDown={handleCategoryMouseDown}
                onMouseLeave={handleCategoryMouseLeave}
                onMouseUp={handleCategoryMouseUp}
                onMouseMove={handleCategoryMouseMove}
                onWheel={handleCategoryWheel}
                onTouchStart={handleCategoryTouchStart}
                onTouchEnd={handleCategoryTouchEnd}
                className={`flex items-center space-x-2.5 sm:space-x-3.5 overflow-x-auto pb-0.5 pt-0.5 px-3 sm:px-5 select-none no-scrollbar ${
                  isCategoryDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-x",
                  height: "56px",
                }}
              >
                {infiniteCategories.map((cat, idx) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={`${cat.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        if (categoryHasMovedRef.current) return;
                        setSelectedCategory(cat.id);
                      }}
                      className="flex flex-col items-center space-y-1 shrink-0 outline-none group focus:outline-none cursor-pointer select-none"
                      style={{ width: "52px" }}
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-[1.5px] transition-all relative flex items-center justify-center bg-white ${
                          isSelected
                            ? "border-amber-500 ring-2 ring-amber-500/20 scale-105 shadow-xs"
                            : "border-slate-100 group-hover:border-slate-300"
                        }`}
                      >
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                      <span
                        className={`text-[8.5px] sm:text-[9.5px] leading-tight text-center font-bold tracking-tight line-clamp-1 w-full transition-colors ${
                          isSelected
                            ? "text-amber-600 font-extrabold"
                            : "text-slate-500 group-hover:text-slate-800"
                        }`}
                      >
                        {cat.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 p-0 relative">
        <AnimatePresence mode="wait">
          {/* 1. CATALOG STEP (app/web/tienda/catalogo.tsx) */}
          {activeStep === "catalog" && (
            <div
              className="flex flex-col space-y-4 p-3 sm:p-5 pt-3 pb-28 sm:pb-24"
              style={{
                paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
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
                  <h3 className="font-display font-bold text-sm text-slate-800">
                    No se encontraron productos
                  </h3>
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
                <>
                  <motion.div
                    key="catalog"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 bg-white"
                  >
                    {displayedProducts.map((product, index) => {
                      const seller = getSellerInfo(product.sellerId);
                      return (
                        <div
                          key={`${product.id}-${index}`}
                          className="border border-slate-100 hover:border-amber-500/30 rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col bg-white group cursor-pointer justify-between"
                          onClick={() => handleProductSelect(product)}
                          id={`prod-card-${product.id}`}
                        >
                          <div className="relative aspect-square w-full bg-white overflow-hidden flex items-center justify-center">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>

                          <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 mb-1">
                                <img
                                  src={
                                    seller.avatar ||
                                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                                  }
                                  alt={seller.name}
                                  referrerPolicy="no-referrer"
                                  className="w-3.5 h-3.5 rounded-full object-cover"
                                />
                                <span className="font-bold truncate">
                                  @{seller.name.toLowerCase().replace(/\s+/g, "")}
                                </span>
                              </div>

                              <h3 className="font-display font-bold text-xs sm:text-sm text-slate-900 group-hover:text-amber-500 transition-colors line-clamp-2 min-h-[32px] sm:min-h-[40px] leading-tight">
                                {product.name}
                              </h3>
                              <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col items-start gap-0.5">
                              <div className="w-full flex items-center justify-between">
                                <span className="text-sm sm:text-base font-extrabold font-mono text-slate-900">
                                  ${product.price.toFixed(2)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isGuest =
                                      !currentUser ||
                                      currentUser.username === "invitado" ||
                                      currentUser.isGuest ||
                                      !currentUser.username;
                                    if (isGuest) {
                                      if (onGuestInteraction) {
                                        onGuestInteraction("guardar este producto en tu perfil");
                                      } else if (onToggleSave) {
                                        onToggleSave(product.id);
                                      }
                                      return;
                                    }
                                    if (onToggleSave) {
                                      onToggleSave(product.id);
                                    } else {
                                      toggleFavorite(product.id);
                                    }
                                  }}
                                  className="bg-transparent border-0 p-0 shadow-none outline-none flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
                                  id={`card-save-btn-${product.id}`}
                                  aria-label="Guardar producto"
                                  title={
                                    savedReelIds.includes(product.id) ||
                                    favorites.includes(product.id)
                                      ? "Guardado"
                                      : "Guardar producto"
                                  }
                                >
                                  <Bookmark
                                    className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-colors duration-200 ${
                                      savedReelIds.includes(product.id) ||
                                      favorites.includes(product.id)
                                        ? "fill-amber-500 text-amber-500"
                                        : "text-slate-400 hover:text-amber-500"
                                    }`}
                                  />
                                </button>
                              </div>
                              {Boolean(product.freeShipping) && (
                                <span className="text-[10px] font-bold bg-transparent text-emerald-700 leading-tight">
                                  Envío Gratis
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* Infinite Scroll Loader & Sentinel */}
                  <div
                    ref={infiniteLoaderRef}
                    className="w-full py-6 flex flex-col items-center justify-center space-y-2"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold bg-slate-50 px-4 py-2 rounded-full border border-slate-200 shadow-xs">
                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Cargando más productos...</span>
                      </div>
                    ) : (
                      <div className="h-4 flex items-center justify-center opacity-40">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 2. PRODUCT DETAIL STEP (app/web/tienda/productoid.tsx) */}
          {activeStep === "detail" && (
            <ProductoIdTiendaView
              selectedProduct={selectedProduct}
              users={users}
              handleBackToCatalog={handleBackToCatalog}
              onCreatorClick={onCreatorClick}
              onAddToCart={onAddToCart}
              openCartDrawer={openCartDrawer}
              onProductViewsUpdated={(prodId, views) => {
                setSelectedProduct((prev) =>
                  prev && prev.id === prodId ? { ...prev, views } : prev
                );
              }}
            />
          )}

          {/* 3 & 4. CHECKOUT FORM & PAYMENT GATEWAY STEP (app/web/tienda/verificasion.tsx) */}
          {(activeStep === "checkout" || activeStep === "payment") && (
            <VerificasionTiendaView
              activeStep={activeStep}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
              address={address}
              setAddress={setAddress}
              country={country}
              setCountry={setCountry}
              city={city}
              setCity={setCity}
              cardNumber={cardNumber}
              setCardNumber={setCardNumber}
              expiry={expiry}
              setExpiry={setExpiry}
              cvv={cvv}
              setCvv={setCvv}
              isFormValid={isFormValid}
              effectiveCheckoutItems={effectiveCheckoutItems}
              cartSubtotal={cartSubtotal}
              cartShippingTotal={cartShippingTotal}
              cartTotal={cartTotal}
              executePayment={executePayment}
            />
          )}

          {/* 5. THANK YOU STEP (app/web/tienda/gracia.tsx) */}
          {activeStep === "thankyou" && (
            <GraciaTiendaView
              completedOrder={completedOrder}
              onLoginSuccess={onLoginSuccess}
              onContinueShopping={() => {
                setActiveStep("catalog");
                setSelectedProduct(null);
                navigateTo("/tienda");
                onStepChange?.("catalog");
              }}
              onViewOrderHistory={() => {
                if (completedOrder?.autoCreatedUser?.user && onLoginSuccess) {
                  onLoginSuccess(completedOrder.autoCreatedUser.user);
                } else {
                  onNavigateToHistory();
                }
                setActiveStep("catalog");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Cart Slider Drawer (app/web/tienda/carrito.tsx) */}
      <CarritoTiendaView
        showCartDrawer={showCartDrawer}
        closeCartDrawer={closeCartDrawer}
        cart={cart}
        cartItemCount={cartItemCount}
        selectedCartIndices={selectedCartIndices}
        isAllCartSelected={isAllCartSelected}
        toggleSelectAllCart={toggleSelectAllCart}
        toggleItemSelection={toggleItemSelection}
        onRemoveFromCart={onRemoveFromCart}
        onUpdateCartQuantity={onUpdateCartQuantity}
        onSelectProductFromCart={(prod) => {
          setShowCartDrawer(false);
          handleProductSelect(prod);
        }}
        selectedCartItems={selectedCartItems}
        cartSubtotal={cartSubtotal}
        cartShippingTotal={cartShippingTotal}
        cartTotal={cartTotal}
        startCheckout={startCheckout}
      />
    </div>
  );
}

export const Catalogo = Tienda;
export const CatalogoTiendaView = Tienda;
export const Shop = Tienda;
export const ShopView = Tienda;
