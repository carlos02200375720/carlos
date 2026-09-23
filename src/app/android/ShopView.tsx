import React, { useState, useMemo, useRef, useEffect } from "react";
import { Product, CartItem, User, Order, Reel } from "../../types";
import { ShoppingBag, Search, Plus, Minus, Trash2, X, Check, ArrowRight, Sparkles, Filter, CreditCard, Tag, Truck, ShieldCheck, Heart, RefreshCw, Star, Eye, AlertCircle, ShoppingCart, Volume2, VolumeX, Play, CheckCircle2, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { androidApiFetch } from "./api";
import { AndroidVideoPlayer } from "./components/AndroidVideoPlayer";

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
  onBackToCatalog?: () => void;
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
  onToggleCart?: (open: boolean) => void;
  initialStep?: 'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou';
  initialSelectedCartIndices?: number[];
  onClearInitialStep?: () => void;
  isLoading?: boolean;
  onRefreshProducts?: () => void;
  cartDrawerRequest?: number;
  savedReelIds?: string[];
  onToggleSave?: (productId: string) => void;
}

export interface AndroidCategory {
  id: string;
  name: string;
  queryTerm?: string;
  imageUrl: string;
}

const CATEGORIES_WITH_IMAGES: AndroidCategory[] = [
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
  onToggleDetailView,
  onToggleCart,
  initialStep,
  onClearInitialStep,
  initialSelectedCartIndices,
  savedReelIds = [],
  onToggleSave,
  onBackToCatalog,
}: AndroidShopViewProps) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayCount, setDisplayCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isCategoryVisible, setIsCategoryVisible] = useState(true);
  const isCategoryVisibleRef = useRef(true);
  const infiniteLoaderRef = useRef<HTMLDivElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    selectedProductDirectly || initialSelectedProduct || null
  );
  const [detailGalleryIndex, setDetailGalleryIndex] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [showCheckoutPage, setShowCheckoutPage] = useState(false);
  const [showThankYouPage, setShowThankYouPage] = useState(false);

  // Cart selection state: allows customer to choose specific products to buy
  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>(() => {
    if (initialSelectedCartIndices && initialSelectedCartIndices.length > 0) {
      return initialSelectedCartIndices;
    }
    return (cart || []).map((_, i) => i);
  });

  useEffect(() => {
    if (initialSelectedCartIndices && initialSelectedCartIndices.length > 0) {
      setSelectedCartIndices(initialSelectedCartIndices);
    }
  }, [initialSelectedCartIndices]);

  useEffect(() => {
    setSelectedCartIndices((prev) => {
      if (!cart || cart.length === 0) return [];
      const valid = prev.filter((i) => i < cart.length);
      if (valid.length > 0) return valid;
      return cart.map((_, i) => i);
    });
  }, [cart?.length]);

  const toggleSelectCartItem = (idx: number) => {
    setSelectedCartIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
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

  const selectedCartItems = useMemo(() => {
    return (cart || []).filter((_, idx) => selectedCartIndices.includes(idx));
  }, [cart, selectedCartIndices]);

  const effectiveCheckoutItems = useMemo(() => {
    return selectedCartItems.length > 0 ? selectedCartItems : (cart || []);
  }, [selectedCartItems, cart]);

  // Route directly to checkout if initiated from Reels/outside
  useEffect(() => {
    if (initialStep === 'checkout') {
      setIsCartOpen(false);
      setSelectedProduct(null);
      setShowCheckoutPage(true);
      onClearInitialStep?.();
    }
  }, [initialStep, onClearInitialStep]);

  // Synchronize cart & detail view visibility with Android navigation bar
  useEffect(() => {
    onToggleCart?.(isCartOpen || showCheckoutPage || showThankYouPage);
  }, [isCartOpen, showCheckoutPage, showThankYouPage, onToggleCart]);

  useEffect(() => {
    onToggleDetailView?.(Boolean(selectedProduct));
  }, [selectedProduct, onToggleDetailView]);
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]);
  const [lastDeliveryAddress, setLastDeliveryAddress] = useState("");
  const [lastContactInfo, setLastContactInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
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
  const [selectedProductMediaUrl, setSelectedProductMediaUrl] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<{ [key: string]: string }>({});
  // Normalize imported/CJ variants for the product detail UI.
  const effectiveVariantGroups = React.useMemo(() => {
    if (!selectedProduct) return [];
    if (Array.isArray(selectedProduct.variants) && selectedProduct.variants.length > 0) return selectedProduct.variants;
    const groups = new Map<string, Set<string>>();
    for (const item of (Array.isArray(selectedProduct.variantList) ? selectedProduct.variantList : [])) {
      const color = typeof item.color === "string" ? item.color.trim() : "";
      const size = typeof item.size === "string" ? item.size.trim() : "";
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (color) { if (!groups.has("Color")) groups.set("Color", new Set()); groups.get("Color")!.add(color); }
      if (size) { if (!groups.has("Talla")) groups.set("Talla", new Set()); groups.get("Talla")!.add(size); }
      if (!color && !size && name) { if (!groups.has("Opción")) groups.set("Opción", new Set()); groups.get("Opción")!.add(name); }
    }
    return Array.from(groups.entries()).map(([name, options]) => ({ name, options: Array.from(options) }));
  }, [selectedProduct]);
  const [optionsValidationError, setOptionsValidationError] = useState<string | null>(null);
  const [isGalleryVideoMuted, setIsGalleryVideoMuted] = useState(true);

  // Cart Shockwave & Success button states
  const [isAddedSuccess, setIsAddedSuccess] = useState(false);
  const [isCartShockwave, setIsCartShockwave] = useState(false);
  const [shockwaveKey, setShockwaveKey] = useState(0);
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  const shockwaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerCartShockwave = () => {
    setShockwaveKey(Date.now());
    setIsCartShockwave(true);
    if (shockwaveTimerRef.current) clearTimeout(shockwaveTimerRef.current);
    shockwaveTimerRef.current = setTimeout(() => {
      setIsCartShockwave(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (shockwaveTimerRef.current) clearTimeout(shockwaveTimerRef.current);
      if (addedSuccessTimerRef.current) clearTimeout(addedSuccessTimerRef.current);
      if (listAddedTimerRef.current) clearTimeout(listAddedTimerRef.current);
    };
  }, []);

  const gallerySliderRef = useRef<HTMLDivElement | null>(null);
  const galleryVideoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const thumbnailTrackRef = useRef<HTMLDivElement | null>(null);
  const thumbnailItemRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  const checkIsVideo = (url: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      Boolean(selectedProduct?.videos && selectedProduct.videos.some((v) => v === url || lower.includes(v.toLowerCase()))) ||
      lower.includes(".m3u8") ||
      lower.includes("video") ||
      lower.startsWith("data:video") ||
      lower.startsWith("blob:")
    );
  };

  const productGalleryMedia = useMemo(() => {
    if (!selectedProduct) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (u?: string) => {
      if (!u || seen.has(u)) return;
      seen.add(u);
      list.push(u);
    };

    push(selectedProduct.imageUrl);
    (selectedProduct.images || []).forEach(push);
    (selectedProduct.videos || []).forEach(push);
    (selectedProduct.variantList || []).forEach((variant) => push(variant.imageUrl));

    return list.length ? list : [selectedProduct.imageUrl];
  }, [selectedProduct]);

  const getMissingOptions = (product: Product | null, selected: { [key: string]: string }) => {
    if (!product) return [];
    const missing: string[] = [];
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((v) => {
        if (!selected[v.name] || !selected[v.name].trim()) {
          missing.push(v.name);
        }
      });
    } else if (product.variantList && product.variantList.length > 0) {
      const hasSwatches = product.variantList.some((item) => item.imageUrl || item.color || item.name);
      if (hasSwatches && !selected["Color"] && !selected["Opción"]) {
        missing.push("Color");
      }
    }
    return missing;
  };

  const getSellerInfo = (sellerId?: string) => {
    if (!sellerId) return { name: "Vendedor Oficial", avatar: "" };
    return users.find((u) => u.id === sellerId) || { name: "Vendedor Oficial", avatar: "" };
  };

  const handleGalleryScroll = () => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    if (width > 0) {
      const newIdx = Math.round(gallerySliderRef.current.scrollLeft / width);
      if (newIdx !== detailGalleryIndex && newIdx >= 0 && newIdx < productGalleryMedia.length) {
        setDetailGalleryIndex(newIdx);
        if (productGalleryMedia[newIdx]) {
          setSelectedProductMediaUrl(productGalleryMedia[newIdx]);
        }
      }
    }
  };

  const scrollToGalleryIndex = (index: number) => {
    if (!gallerySliderRef.current) return;
    const width = gallerySliderRef.current.clientWidth;
    gallerySliderRef.current.scrollTo({ left: index * width, behavior: "smooth" });
    setDetailGalleryIndex(index);
    if (productGalleryMedia[index]) {
      setSelectedProductMediaUrl(productGalleryMedia[index]);
    }
  };

  // Sync thumbnail container scroll with active gallery index
  useEffect(() => {
    const thumbEl = thumbnailItemRefs.current[detailGalleryIndex];
    if (thumbEl && thumbnailTrackRef.current) {
      const container = thumbnailTrackRef.current;
      const thumbLeft = thumbEl.offsetLeft;
      const thumbWidth = thumbEl.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScroll = thumbLeft - containerWidth / 2 + thumbWidth / 2;
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [detailGalleryIndex]);

  // Reset product details state when selectedProduct changes
  useEffect(() => {
    if (selectedProduct) {
      setDetailGalleryIndex(0);
      setSelectedProductMediaUrl(selectedProduct.imageUrl || "");
      setSelectedVariants({});
      setOptionsValidationError(null);
    }
  }, [selectedProduct?.id]);

  // Cleanup video references on unmount
  useEffect(() => {
    return () => {
      Object.keys(galleryVideoRefs.current).forEach((key) => {
        const videoEl = galleryVideoRefs.current[Number(key)];
        if (videoEl) {
          try {
            videoEl.pause();
            videoEl.muted = true;
          } catch {}
        }
      });
    };
  }, []);

  // Sync selectedProduct if selectedProductDirectly changes
  React.useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
    }
  }, [selectedProductDirectly]);

  const categoriesList = useMemo(() => {
    const list: AndroidCategory[] = [...CATEGORIES_WITH_IMAGES];

    (products || []).forEach((p) => {
      if (p.category && p.category.trim()) {
        const catName = p.category.trim();
        const exists = list.some(
          (c) => c.name.toLowerCase() === catName.toLowerCase() || c.id.toLowerCase() === catName.toLowerCase()
        );
        if (!exists) {
          list.push({
            id: catName.toLowerCase().replace(/\s+/g, "_"),
            name: catName,
            queryTerm: catName.toLowerCase(),
            imageUrl: p.imageUrl || "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80",
          });
        }
      }
    });

    return list;
  }, [products]);

  // Category track drag, infinite auto-scroll & horizontal scroll helpers (matching Web version)
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const [isCategoryDragging, setIsCategoryDragging] = useState(false);
  const [isCategoryHovered, setIsCategoryHovered] = useState(false);
  const isCategoryInteractingRef = useRef(false);
  const categoryHasMovedRef = useRef(false);
  const categoryResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [categoryStartX, setCategoryStartX] = useState(0);
  const [categoryScrollLeft, setCategoryScrollLeft] = useState(0);

  // Duplicated list of categories for seamless infinite loop (identical to Web version)
  const infiniteCategories = useMemo(() => {
    if (categoriesList.length === 0) return [];
    return [...categoriesList, ...categoriesList];
  }, [categoriesList]);

  // Smooth infinite horizontal continuous motion
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    const speed = 0.45; // gentle, smooth continuous scroll speed

    const animate = (now: number) => {
      const delta = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      const track = categoryTrackRef.current;
      if (
        track &&
        isCategoryVisible &&
        !isCategoryDragging &&
        !isCategoryHovered &&
        !isCategoryInteractingRef.current
      ) {
        track.scrollLeft += speed * delta;

        // When scrolled past the first set, seamlessly wrap back
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
      if (categoryResumeTimeoutRef.current) {
        clearTimeout(categoryResumeTimeoutRef.current);
      }
    };
  }, [isCategoryDragging, isCategoryHovered, isCategoryVisible]);

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

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      let matchCat = activeCategory === "Todos" || activeCategory === "todos";
      if (!matchCat) {
        const activeCatObj = categoriesList.find(
          (c) => c.name.toLowerCase() === activeCategory.toLowerCase() || c.id.toLowerCase() === activeCategory.toLowerCase()
        );
        if (p.category) {
          matchCat = p.category.toLowerCase().trim() === (activeCatObj ? activeCatObj.name.toLowerCase() : activeCategory.toLowerCase().trim());
        } else if (activeCatObj?.queryTerm) {
          const term = activeCatObj.queryTerm.toLowerCase();
          matchCat =
            p.name.toLowerCase().includes(term) ||
            Boolean(p.description && p.description.toLowerCase().includes(term));
        }
      }

      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(p.description?.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery, categoriesList]);

  // Reset infinite scroll count when filter or search changes
  useEffect(() => {
    setDisplayCount(10);
  }, [activeCategory, searchQuery]);

  // Infinite Scroll Trigger via IntersectionObserver and scroll events
  useEffect(() => {
    if (isCartOpen || selectedProduct || showCheckoutPage || showThankYouPage) return;

    const triggerLoadMore = () => {
      if (isLoadingMore || filteredProducts.length === 0) return;
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount((prev) => prev + 8);
        setIsLoadingMore(false);
      }, 200);
    };

    const handleScroll = () => {
      if (isLoadingMore || filteredProducts.length === 0) return;
      const scrollPos = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 400;
      if (scrollPos >= threshold) {
        triggerLoadMore();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const target = infiniteLoaderRef.current;
    let observer: IntersectionObserver | null = null;
    if (target) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMore && filteredProducts.length > 0) {
            triggerLoadMore();
          }
        },
        { threshold: 0.1, rootMargin: "400px" }
      );
      observer.observe(target);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (observer) observer.disconnect();
    };
  }, [isLoadingMore, filteredProducts.length, isCartOpen, selectedProduct, showCheckoutPage, showThankYouPage]);

  // Show/hide category carousel based on scroll direction after ~2 cards (~160px)
  useEffect(() => {
    let lastScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    let pivotY = lastScrollY;
    let scrollDirection: "up" | "down" | "none" = "none";
    let isLocked = false;
    let lockTimer: any = null;
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        ticking = false;
        const currentY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);

        // Near top of the page (within first 80px): ALWAYS show and unlock
        if (currentY <= 80) {
          pivotY = currentY;
          scrollDirection = "none";
          lastScrollY = currentY;
          if (!isCategoryVisibleRef.current) {
            isCategoryVisibleRef.current = true;
            setIsCategoryVisible(true);
          }
          return;
        }

        // If locked during an animation transition, don't change state
        if (isLocked) {
          lastScrollY = currentY;
          pivotY = currentY;
          return;
        }

        const diff = currentY - lastScrollY;

        // Ignore tiny micro-jitter (< 3px)
        if (Math.abs(diff) < 3) {
          return;
        }

        if (diff > 0) {
          // Scrolling DOWN (advancing into feed)
          if (scrollDirection !== "down") {
            scrollDirection = "down";
            pivotY = currentY;
          }

          // User scrolled down by at least 45px past pivot AND past first row of cards (160px)
          if (currentY - pivotY > 45 && currentY > 160) {
            if (isCategoryVisibleRef.current) {
              isCategoryVisibleRef.current = false;
              setIsCategoryVisible(false);
              isLocked = true;
              clearTimeout(lockTimer);
              lockTimer = setTimeout(() => {
                isLocked = false;
                const freshY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
                pivotY = freshY;
                lastScrollY = freshY;
              }, 320);
            }
          }
        } else if (diff < 0) {
          // Scrolling UP (returning towards top)
          if (scrollDirection !== "up") {
            scrollDirection = "up";
            pivotY = currentY;
          }

          // User scrolled up by at least 35px past pivot
          if (pivotY - currentY > 35) {
            if (!isCategoryVisibleRef.current) {
              isCategoryVisibleRef.current = true;
              setIsCategoryVisible(true);
              isLocked = true;
              clearTimeout(lockTimer);
              lockTimer = setTimeout(() => {
                isLocked = false;
                const freshY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
                pivotY = freshY;
                lastScrollY = freshY;
              }, 320);
            }
          }
        }

        lastScrollY = currentY;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(lockTimer);
    };
  }, []);

  // Compute displayed products for continuous infinite exploration
  const displayedProducts = useMemo(() => {
    if (filteredProducts.length === 0) return [];
    const list: (Product & { _renderKey: string })[] = [];
    for (let i = 0; i < displayCount; i++) {
      const prod = filteredProducts[i % filteredProducts.length];
      list.push({
        ...prod,
        _renderKey: `${prod.id}-android-inf-${i}`,
      });
    }
    return list;
  }, [filteredProducts, displayCount]);

  const cartTotal = useMemo(() => {
    return effectiveCheckoutItems.reduce((sum, item) => sum + item.product.price * (item.quantity || 1), 0);
  }, [effectiveCheckoutItems]);

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
    setLastContactInfo({
      fullName: checkoutForm.fullName || currentUser.name || "Cliente",
      email: checkoutForm.email || currentUser.email || `${currentUser.username}@android.mallsocial`,
      phone: checkoutForm.phone || (currentUser as any).phone || "Sin teléfono",
    });

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
    if (effectiveCheckoutItems.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    const shippingAddress = checkoutForm.shippingAddress || "Dirección Android Principal";

    if (onCheckout) {
      onCheckout(shippingAddress, 0, (newOrder) => {
        finalizeOrder(shippingAddress, effectiveCheckoutItems);
      }, effectiveCheckoutItems);
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
        items: effectiveCheckoutItems,
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
        finalizeOrder(shippingAddress, effectiveCheckoutItems);
      }
    } catch (err) {
      console.error("Android checkout error:", err);
      setIsCheckingOut(false);
    }
  };

  if (showThankYouPage) {
    const thankYouTotal = lastOrderItems.reduce((sum, item) => sum + item.product.price * (item.quantity || 1), 0);

    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-amber-950 via-slate-950 to-rose-950 text-slate-50 flex flex-col font-sans select-none overflow-x-hidden overflow-y-auto">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[-8%] top-[-4%] w-44 h-44 rounded-full bg-amber-500/30 blur-3xl animate-pulse" />
          <div className="absolute right-[-6%] bottom-[-12%] w-56 h-56 rounded-full bg-orange-600/30 blur-3xl animate-pulse" />
          <div className="absolute left-[12%] top-[18%] w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_12px_#fde68a,0_0_20px_#fbbf24] animate-ping" />
          <div className="absolute right-[16%] top-[30%] w-2 h-2 bg-orange-300 rounded-full shadow-[0_0_12px_#fdba74,0_0_20px_#fb923c] animate-ping" />
        </div>

        <div className="relative z-10 px-4 py-8 flex flex-col min-h-screen" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}>
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

            <div className="mt-4 border-t border-white/10 pt-3 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Dirección de entrega</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{lastDeliveryAddress}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Contacto</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{lastContactInfo.fullName}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Email</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{lastContactInfo.email}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Teléfono</span>
                <span className="font-black text-white text-right max-w-[60%] truncate">{lastContactInfo.phone}</span>
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
              style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 3px)" }}
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
        <div
          className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pb-3 border-b border-slate-200 flex items-center justify-between"
          style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top, 0px) + 8px))" }}
        >
          <button
            type="button"
            onClick={() => {
              setShowCheckoutPage(false);
              setIsCartOpen(true);
            }}
            className="p-2 rounded-full bg-slate-100 text-slate-900 active:scale-95 cursor-pointer hover:bg-slate-200 transition-colors"
            id="android-checkout-back-btn"
            title="Volver al carrito"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-black text-slate-900">Checkout</h1>
            <p className="text-[10px] text-slate-500">Entrega y pago</p>
          </div>
          <div className="w-8" />
        </div>

        <div className="px-4 py-4 space-y-4 pb-36">
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
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Resumen de compra</span>
              <span className="text-[11px] font-bold text-amber-700">
                {effectiveCheckoutItems.length} de {cart.length} {cart.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {effectiveCheckoutItems.length === 0 ? (
                <div className="text-center text-[11px] text-slate-500 py-3">No hay productos seleccionados para pagar.</div>
              ) : (
                effectiveCheckoutItems.map((item, idx) => (
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

          {/* Fixed Checkout Footer */}
          <div
            id="android-checkout-footer-action"
            className="fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
            style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
          >
            <div className="max-w-md mx-auto w-full">
              <div className="flex items-center justify-between text-sm font-black text-slate-900 mb-2.5">
                <span className="text-xs text-slate-500 font-bold">Total a pagar</span>
                <span className="text-base text-amber-600 font-black">${cartTotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut || effectiveCheckoutItems.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-2xl text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                <span>{isCheckingOut ? "Procesando..." : `Completar Compra (${effectiveCheckoutItems.length}) - $${cartTotal.toFixed(2)}`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCartOpen) {
    return (
      <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none" id="android-cart-page">
        {/* Cart Top Header */}
        <div
          className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pb-3 border-b border-slate-200 flex items-center justify-between"
          style={{ paddingTop: "max(12px, calc(env(safe-area-inset-top, 0px) + 8px))" }}
        >
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-full bg-slate-100 text-slate-900 active:scale-95 cursor-pointer hover:bg-slate-200 transition-colors"
            id="android-cart-back-btn"
            title="Volver"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-sm font-black text-slate-900">Carrito de Compras</h1>
            <p className="text-[10px] text-slate-500 font-semibold">
              {selectedCartItems.length} de {cart.length} seleccionados
            </p>
          </div>
          <div className="w-8" />
        </div>

        {/* Cart Items List */}
        <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 ${cart.length > 0 ? "pb-36" : "pb-10"}`}>
          {cart.length === 0 ? (
            <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
                <ShoppingBag className="w-10 h-10 text-amber-500" />
              </div>
              <h3 className="mt-4 text-sm font-black text-slate-900">Tu carrito está vacío</h3>
              <p className="text-[11px] text-slate-500 mt-1">Añade productos para empezar tu compra.</p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setSelectedProduct(null);
                }}
                className="mt-5 px-5 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer shadow-md hover:bg-amber-400 active:scale-95 transition-all"
              >
                Explorar productos
              </button>
            </div>
          ) : (
            <>
              {/* Select all bar */}
              <div className="flex items-center justify-between pb-1 px-1">
                <button
                  type="button"
                  onClick={toggleSelectAllCart}
                  className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-amber-600 transition-colors cursor-pointer select-none"
                >
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                      isAllCartSelected
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : selectedCartIndices.length > 0
                        ? "bg-amber-200 text-amber-900"
                        : "border-2 border-slate-300 bg-white"
                    }`}
                  >
                    {isAllCartSelected ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : selectedCartIndices.length > 0 ? (
                      <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" />
                    ) : null}
                  </div>
                  <span>
                    {isAllCartSelected ? "Deseleccionar todo" : "Seleccionar todo"} ({selectedCartIndices.length}/{cart.length})
                  </span>
                </button>
                <span className="text-[11px] font-bold text-amber-700">
                  {selectedCartIndices.length} para pagar
                </span>
              </div>

              {cart.map((item, idx) => {
                const isSelected = selectedCartIndices.includes(idx);
                return (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className={`flex items-center justify-between rounded-3xl border p-3 shadow-xs transition-all ${
                      isSelected
                        ? "border-amber-300/90 bg-amber-50/40 ring-1 ring-amber-400/30"
                        : "border-slate-200 bg-slate-50/70 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleSelectCartItem(idx)}
                        aria-label={isSelected ? "Deseleccionar producto" : "Seleccionar producto"}
                        className="shrink-0 p-1 -m-1 cursor-pointer"
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-amber-500 text-slate-950 shadow-xs font-black"
                              : "border-2 border-slate-300 bg-white hover:border-amber-400"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>

                      <div className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(idx, item, Math.max(1, (item.quantity || 1) - 1))}
                          className="p-1.5 rounded-full bg-white border border-slate-300 text-slate-900 active:scale-90 cursor-pointer shadow-2xs hover:bg-slate-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-black w-6 text-center text-slate-900">{item.quantity || 1}</span>
                        <button
                          type="button"
                          onClick={() => handleItemQtyChange(idx, item, (item.quantity || 1) + 1)}
                          className="p-1.5 rounded-full bg-white border border-slate-300 text-slate-900 active:scale-90 cursor-pointer shadow-2xs hover:bg-slate-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProduct(item.product);
                          setIsCartOpen(false);
                        }}
                        className="cursor-pointer"
                      >
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="w-16 h-16 rounded-2xl object-cover border border-slate-200 hover:opacity-90 transition-opacity"
                        />
                      </button>
                    </div>

                    <div className="flex-1 px-3">
                      <div className="flex items-start justify-between gap-1">
                        <h4
                          onClick={() => {
                            setSelectedProduct(item.product);
                            setIsCartOpen(false);
                          }}
                          className="text-[12px] font-black text-slate-900 line-clamp-1 cursor-pointer hover:text-amber-600 transition-colors"
                        >
                          {item.product.name}
                        </h4>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${
                          isSelected ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-500"
                        }`}>
                          {isSelected ? "A pagar" : "Omitido"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">${item.product.price.toFixed(2)} c/u</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] font-black text-amber-600">Subtotal ${(item.product.price * (item.quantity || 1)).toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleItemRemove(idx, item)}
                          className="p-1.5 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-100 active:scale-90 cursor-pointer transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Cart Bottom Checkout Summary - Fijo en el pie de página */}
        {cart.length > 0 && (
          <div
            id="android-cart-footer-summary"
            className="fixed bottom-0 inset-x-0 z-40 bg-white/98 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
            style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))" }}
          >
            <div className="max-w-md mx-auto w-full">
              <div className="flex items-center justify-between text-sm font-black text-slate-900 mb-2.5">
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-bold">Total a pagar</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {selectedCartItems.length} de {cart.length} {cart.length === 1 ? "producto" : "productos"} seleccionados
                  </span>
                </div>
                <span className="text-base text-amber-600 font-black">${cartTotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                disabled={selectedCartIndices.length === 0}
                onClick={() => {
                  setIsCartOpen(false);
                  setShowCheckoutPage(true);
                }}
                className={`w-full py-3.5 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center justify-center space-x-2 ${
                  selectedCartIndices.length === 0
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 hover:brightness-110 active:scale-[0.98] cursor-pointer"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {selectedCartIndices.length === 0
                    ? "Selecciona productos para pagar"
                    : `Completar Compra (${selectedCartItems.length}) - $${cartTotal.toFixed(2)}`}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (selectedProduct) {
    return (
      <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none relative">
        {/* Cabecera 100% transparente fija */}
        <header
          id="android-detail-fixed-header"
          className="fixed top-0 inset-x-0 z-50 bg-transparent pointer-events-none"
          style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
        >
          <div className="max-w-md mx-auto w-full px-3.5 py-2.5 flex items-center justify-between pointer-events-none">
            {/* Botón de regreso - 100% transparente, sin fondo negro */}
            <button
              type="button"
              id="android-detail-back-btn"
              onClick={() => {
                setSelectedProduct(null);
                clearDirectProduct?.();
                onClearInitialProduct?.();
                onBackToCatalog?.();
              }}
              className="pointer-events-auto p-2 bg-transparent text-white active:scale-90 transition-transform flex items-center justify-center cursor-pointer border-0 shadow-none outline-none group"
              title="Volver a la tienda"
            >
              <ArrowRight className="w-6 h-6 rotate-180 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] group-hover:scale-110 transition-transform" />
            </button>

            <div className="flex-1" />

            {/* Botón Guardar producto en publicaciones */}
            <button
              type="button"
              id="android-detail-save-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSave && selectedProduct) {
                  onToggleSave(selectedProduct.id);
                }
              }}
              className="pointer-events-auto relative p-2 bg-transparent text-white active:scale-90 transition-transform flex items-center justify-center cursor-pointer border-0 shadow-none outline-none group mr-1"
              title={(savedReelIds || []).includes(selectedProduct.id) ? "Guardado en publicaciones" : "Guardar en publicaciones"}
              aria-label="Guardar producto en publicaciones"
            >
              <Bookmark
                className={`w-6 h-6 transition-all duration-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] ${
                  (savedReelIds || []).includes(selectedProduct.id)
                    ? "fill-amber-400 text-amber-400 scale-105"
                    : "text-white group-hover:text-amber-200"
                }`}
              />
            </button>

            {/* Icono del carrito - 100% transparente, sin fondo negro con ondas expansivas */}
            <button
              type="button"
              id="android-detail-cart-btn"
              onClick={() => setIsCartOpen(true)}
              className="pointer-events-auto relative p-2 bg-transparent text-white active:scale-90 transition-transform flex items-center justify-center cursor-pointer border-0 shadow-none outline-none group"
              title="Ver carrito"
            >
              <ShoppingBag
                className={`w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] group-hover:scale-110 transition-all duration-300 ${
                  isCartShockwave ? "scale-115 !text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" : ""
                }`}
              />
              {(cart.length > 0 || isCartShockwave) && (
                <span
                  key={`detail-cart-counter-${shockwaveKey}`}
                  className={`absolute top-0.5 right-0.5 bg-amber-500 text-slate-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                    isCartShockwave
                      ? "scale-125 ring-2 ring-amber-300 bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]"
                      : "scale-100"
                  }`}
                >
                  {Math.max(1, cart.reduce((s, i) => s + (i.quantity || 1), 0))}

                  {/* Onda expansiva emitida desde el contador del carrito */}
                  {isCartShockwave && (
                    <span className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <span className="absolute inset-0 rounded-full bg-amber-400 animate-cart-shockwave" />
                      <span className="absolute inset-0 rounded-full border-2 border-amber-300 animate-cart-shockwave-2" />
                      <span className="absolute inset-0 rounded-full border border-amber-200 animate-cart-shockwave-3" />
                    </span>
                  )}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto pb-28">
          {/* Main Media Viewer - Horizontal Scroll Gallery Slider */}
          <div className="w-full h-[340px] sm:h-[420px] overflow-hidden border-b border-slate-200/80 bg-white relative group/gallery shadow-xs">
            <div
              ref={gallerySliderRef}
              onScroll={handleGalleryScroll}
              className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-x pan-y",
              }}
            >
              {productGalleryMedia.map((mediaUrl, idx) => {
                const isVideo = checkIsVideo(mediaUrl);
                return (
                  <div
                    key={idx}
                    className="w-full h-full flex-shrink-0 snap-center relative flex items-center justify-center bg-black overflow-hidden group/vid"
                  >
                    {isVideo && mediaUrl.includes(".m3u8") ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        <AndroidVideoPlayer
                          hlsUrl={mediaUrl}
                          poster={selectedProduct.imageUrl || selectedProduct.images?.[0]}
                          autoPlay={false}
                          loop={true}
                          muted={isGalleryVideoMuted}
                          isCurrent={true}
                          className="w-full h-full object-contain bg-black"
                        />
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

            {/* Image Counter Badge in Bottom-Left Corner */}
            {productGalleryMedia.length > 0 && (
              <div
                className="absolute bottom-3 left-3 z-20 px-2 py-0.5 text-white font-mono text-xs font-bold tracking-wider flex items-center space-x-1 pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                id="android-detail-image-counter"
              >
                <span className="text-amber-400 font-extrabold">{detailGalleryIndex + 1}</span>
                <span className="text-white/80">/</span>
                <span className="text-white">{productGalleryMedia.length}</span>
              </div>
            )}

            {/* Audio Toggle Button for Video */}
            {checkIsVideo(productGalleryMedia[detailGalleryIndex]) && (
              <button
                type="button"
                id="android-gallery-video-mute-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGalleryVideoMuted((prev) => {
                    const nextMuted = !prev;
                    const currentVideo = galleryVideoRefs.current[detailGalleryIndex];
                    if (currentVideo) {
                      currentVideo.muted = nextMuted;
                    }
                    return nextMuted;
                  });
                }}
                className="absolute bottom-3 right-3 z-20 p-2 text-white hover:opacity-80 active:scale-95 transition-all cursor-pointer flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                title={isGalleryVideoMuted ? "Activar audio" : "Silenciar audio"}
              >
                {isGalleryVideoMuted ? (
                  <VolumeX className="w-5 h-5 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                ) : (
                  <Volume2 className="w-5 h-5 text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                )}
              </button>
            )}
          </div>

          {/* Media Thumbnails list (photos and videos) */}
          {productGalleryMedia.length > 1 && (
            <div
              ref={thumbnailTrackRef}
              className="flex space-x-2 overflow-x-auto py-2 px-3 no-scrollbar scroll-smooth bg-white border-b border-slate-100"
            >
              {productGalleryMedia.map((url, idx) => {
                const isVideo = checkIsVideo(url);
                const isSelected = detailGalleryIndex === idx;
                return (
                  <button
                    key={`thumb-${idx}`}
                    ref={(el) => {
                      thumbnailItemRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => scrollToGalleryIndex(idx)}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 relative cursor-pointer transition-all ${
                      isSelected ? "border-amber-500 scale-105 shadow-xs" : "border-slate-200 opacity-70 hover:opacity-100"
                    }`}
                  >
                    {isVideo ? (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                        <img
                          src={selectedProduct.imageUrl || selectedProduct.images?.[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"}
                          className="w-full h-full object-cover opacity-75"
                          referrerPolicy="no-referrer"
                          alt=""
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

          {/* Security Badges */}
          <div className="bg-slate-50 rounded-xl p-3 mx-3 sm:mx-4 mt-3 border border-slate-100 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500 font-semibold">
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

          {/* Product Details Section */}
          <div className="px-3 sm:px-4 py-3 space-y-3">
            {/* Seller Header clickable */}
            <div
              onClick={() => {
                if (selectedProduct.sellerId && onCreatorClick) {
                  onCreatorClick(selectedProduct.sellerId);
                }
              }}
              className="inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full text-xs font-bold text-slate-800 cursor-pointer transition-colors"
            >
              <img
                src={getSellerInfo(selectedProduct.sellerId).avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                alt="Creator"
                referrerPolicy="no-referrer"
                className="w-5 h-5 rounded-full object-cover"
              />
              <span>Tienda de @{getSellerInfo(selectedProduct.sellerId).name.toLowerCase().replace(/\s+/g, "")}</span>
              <span className="text-[10px] text-amber-600 font-medium ml-1">Ver perfil →</span>
            </div>

            {/* Product Title */}
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 leading-tight">
              {selectedProduct.name}
            </h1>

            {/* Rating Stars & Price Section */}
            <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex-wrap">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <div className="flex items-center space-x-1.5">
                  <div className="flex items-center text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {selectedProduct.rating || 4.9} (Verificado)
                  </span>
                </div>

                {/* Views Badge */}
                <div
                  className="flex items-center space-x-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/80"
                  title="Visualizaciones en la página de detalle"
                >
                  <Eye className="w-3.5 h-3.5 text-sky-600" />
                  <span>{selectedProduct.views ?? 0} visualizaciones</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-black font-mono text-slate-950 tracking-tight" id="android-product-detail-price">
                  ${selectedProduct.price.toFixed(2)}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    selectedProduct.stock > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                      : "bg-rose-50 text-rose-700 border-rose-200/80"
                  }`}
                >
                  {selectedProduct.stock > 0 ? "En Stock" : "Agotado"}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {selectedProduct.description}
            </p>

            {/* Product Variants Selection */}
            {((selectedProduct.variants && selectedProduct.variants.length > 0) || (selectedProduct.variantList && selectedProduct.variantList.length > 0)) && (() => {
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
              const hasOptionGroups = effectiveVariantGroups.length > 0;

              return (
                <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-3" id="android-product-options-section">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>Selecciona tus opciones:</span>
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200/60 lowercase">
                        (requerido)
                      </span>
                    </p>
                  </div>

                  {optionsValidationError && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2 shadow-xs">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{optionsValidationError}</span>
                    </div>
                  )}

                  {hasOptionGroups ? (
                    effectiveVariantGroups.map((v, idx) => {
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
                          <div key={idx} className="space-y-1.5 text-left">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                              <span className="text-slate-600">{v.name}:</span>
                              {selectedColorVal ? (
                                <span className="text-amber-600 font-extrabold capitalize bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                                  {selectedColorVal}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-semibold">
                                  Selecciona un {v.name.toLowerCase()}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 px-0.5 no-scrollbar scroll-smooth snap-x">
                              {v.options.map((opt, oIdx) => {
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
                                      setSelectedVariants({ ...selectedVariants, [v.name]: opt });
                                      setOptionsValidationError(null);
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
                                    className={`group snap-start flex items-center justify-center p-0 overflow-hidden rounded-xl border transition-all cursor-pointer w-14 h-14 shrink-0 relative ${
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

                      const selectedOptVal = selectedVariants[v.name];
                      return (
                        <div key={idx} className="space-y-1.5 text-left">
                          <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                            <span className="text-slate-600">{v.name}:</span>
                            {selectedOptVal ? (
                              <span className="text-slate-900 font-extrabold bg-slate-100 px-2 py-0.5 rounded-md">
                                {selectedOptVal}
                              </span>
                            ) : (
                              <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-semibold">
                                Selecciona una {v.name.toLowerCase()}
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
                                  onClick={() => {
                                    setSelectedVariants({ ...selectedVariants, [v.name]: opt });
                                    setOptionsValidationError(null);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
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
                    <div className="space-y-1.5 text-left">
                      <div className="flex items-center space-x-1.5 text-[11px] font-bold">
                        <span className="text-slate-600">Color:</span>
                        {(selectedVariants["Color"] || (uniqueSwatches.find(s => s.imageUrl === selectedProductMediaUrl)?.name)) ? (
                          <span className="text-amber-600 font-extrabold capitalize bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                            {selectedVariants["Color"] || (uniqueSwatches.find(s => s.imageUrl === selectedProductMediaUrl)?.name)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded font-semibold">
                            Selecciona un color
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-0.5 px-0.5 no-scrollbar scroll-smooth snap-x">
                        {uniqueSwatches.map((swatch, sIdx) => {
                          const isSelected = selectedProductMediaUrl === swatch.imageUrl || selectedVariants["Color"] === swatch.name;
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              title={swatch.name}
                              onClick={() => {
                                setSelectedProductMediaUrl(swatch.imageUrl);
                                setSelectedVariants(prev => ({ ...prev, Color: swatch.name }));
                                setOptionsValidationError(null);
                              }}
                              className={`group snap-start flex items-center justify-center p-0 overflow-hidden rounded-xl border transition-all cursor-pointer w-14 h-14 shrink-0 relative ${
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

            {/* Shipping Information Banner */}
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-100 p-3 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-700 font-bold">
                <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Envío a tu País:</span>
              </div>
              <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>GRATIS</span>
              </span>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div
          className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2 px-3 sm:px-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: "max(0.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.35rem))" }}
        >
          <div className="max-w-md mx-auto w-full flex items-center justify-center min-h-[38px]">
            {(() => {
              const missingOpts = getMissingOptions(selectedProduct, selectedVariants);
              const hasMissingOpts = missingOpts.length > 0;

              return (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProduct.stock <= 0) return;

                    const currentMissing = getMissingOptions(selectedProduct, selectedVariants);
                    if (currentMissing.length > 0) {
                      setOptionsValidationError(`Por favor selecciona tu ${currentMissing.join(" y ")} antes de añadir al carrito.`);
                      document.getElementById("android-product-options-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      return;
                    }

                    const variantStr = Object.entries(selectedVariants)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");

                    const activeImageUrl = selectedProductMediaUrl || selectedProduct.imageUrl;

                    const customizedProduct: Product = {
                      ...selectedProduct,
                      imageUrl: activeImageUrl,
                      name: variantStr ? `${selectedProduct.name} (${variantStr})` : selectedProduct.name,
                    };

                    onAddToCart(customizedProduct, 1, selectedVariants);
                    triggerCartShockwave();
                    setIsAddedSuccess(true);
                    if (addedSuccessTimerRef.current) clearTimeout(addedSuccessTimerRef.current);
                    addedSuccessTimerRef.current = setTimeout(() => {
                      setIsAddedSuccess(false);
                    }, 2400);
                  }}
                  disabled={selectedProduct.stock <= 0}
                  className={`w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 text-center ${
                    selectedProduct.stock <= 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : hasMissingOpts
                      ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-500/20"
                      : isAddedSuccess
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 scale-[1.01]"
                      : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25"
                  }`}
                  id="android-add-to-cart-detail-btn"
                >
                  {selectedProduct.stock <= 0 ? (
                    <span>Agotado</span>
                  ) : hasMissingOpts ? (
                    <>
                      <AlertCircle className="w-4 h-4 shrink-0 text-slate-950" />
                      <span className="whitespace-nowrap">
                        {missingOpts.length === 1 ? `Elegir ${missingOpts[0]}` : "Elegir opciones"}
                      </span>
                    </>
                  ) : isAddedSuccess ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 shrink-0 text-white animate-bounce" />
                      <span className="whitespace-nowrap font-black">¡Añadido con éxito!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 shrink-0 text-slate-950" />
                      <span className="whitespace-nowrap">Añadir al Carrito • ${selectedProduct.price.toFixed(2)}</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col font-sans select-none pb-24" id="android-shop-view">
      {/* Top Android Sticky Bar: Header + Collapsible Category Carousel */}
      <div className="sticky top-0 z-30 bg-white shadow-xs">
        {/* Integrated Search and Cart Header */}
        <div
          id="android-shop-search-header"
          className="px-3 pb-2.5 flex items-center gap-2 bg-white"
          style={{
            paddingTop: "max(14px, calc(env(safe-area-inset-top, 0px) + 10px))",
          }}
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-9 pr-7 py-2 bg-slate-100 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-slate-900 active:scale-95 transition-transform shrink-0"
            aria-label="Carrito de compras"
          >
            <ShoppingBag
              className={`w-5 h-5 transition-all duration-300 ${
                isCartShockwave ? "text-amber-600 scale-110 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" : "text-amber-500"
              }`}
            />
            {(cart.length > 0 || isCartShockwave) && (
              <span
                key={`main-cart-counter-${shockwaveKey}`}
                className={`absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center shadow transition-all duration-300 ${
                  isCartShockwave
                    ? "scale-125 ring-2 ring-amber-300 bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.95)]"
                    : "scale-100"
                }`}
              >
                {Math.max(1, cart.reduce((s, i) => s + (i.quantity || 1), 0))}

                {/* Onda expansiva emitida desde el contador del carrito */}
                {isCartShockwave && (
                  <span className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-amber-400 animate-cart-shockwave" />
                    <span className="absolute inset-0 rounded-full border-2 border-amber-300 animate-cart-shockwave-2" />
                    <span className="absolute inset-0 rounded-full border border-amber-200 animate-cart-shockwave-3" />
                  </span>
                )}
              </span>
            )}
          </button>
        </div>

        {/* Category Carousel with Images (Collapsible on scroll) */}
        <div
          id="android-category-carousel-container"
          style={{ overflowAnchor: "none" }}
          className={`w-full bg-white overflow-hidden transition-all duration-300 ease-out border-b will-change-[max-height,opacity] ${
            isCategoryVisible
              ? "max-h-20 opacity-100 border-slate-100 pointer-events-auto"
              : "max-h-0 opacity-0 pointer-events-none border-transparent"
          }`}
        >
          <div className="py-1 px-2 flex items-center gap-1.5" id="android-category-carousel-inner">
            {activeCategory !== "Todos" && activeCategory !== "todos" && (
              <button
                type="button"
                onClick={() => setActiveCategory("Todos")}
                className="shrink-0 z-10 flex items-center space-x-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-full text-[8.5px] font-bold border border-amber-500/30 active:scale-95 transition-all shadow-xs"
                title="Restablecer filtro a Todos"
              >
                <span className="truncate max-w-[55px]">
                  {categoriesList.find((c) => c.name.toLowerCase() === activeCategory.toLowerCase() || c.id === activeCategory)?.name || activeCategory}
                </span>
                <X className="w-2.5 h-2.5 shrink-0" />
              </button>
            )}
            <div
              ref={categoryTrackRef}
              onMouseDown={handleCategoryMouseDown}
              onMouseLeave={handleCategoryMouseLeave}
              onMouseUp={handleCategoryMouseUp}
              onMouseMove={handleCategoryMouseMove}
              onMouseEnter={() => setIsCategoryHovered(true)}
              onWheel={handleCategoryWheel}
              onTouchStart={handleCategoryTouchStart}
              onTouchEnd={handleCategoryTouchEnd}
              onTouchCancel={handleCategoryTouchEnd}
              className={`flex-1 flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5 select-none ${
                isCategoryDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {infiniteCategories.map((cat, idx) => {
                const isSelected =
                  activeCategory.toLowerCase() === cat.name.toLowerCase() ||
                  activeCategory.toLowerCase() === cat.id.toLowerCase();
                return (
                  <button
                    key={`${cat.id || cat.name}-${idx}`}
                    type="button"
                    onClick={() => {
                      if (!categoryHasMovedRef.current) {
                        setActiveCategory(cat.name);
                      }
                    }}
                    className="flex flex-col items-center shrink-0 outline-none group focus:outline-none cursor-pointer select-none active:scale-95 transition-transform w-[42px]"
                  >
                    <div
                      className={`w-7 h-7 rounded-full overflow-hidden border-[1.5px] transition-all relative flex items-center justify-center bg-slate-50 ${
                        isSelected
                          ? "border-amber-500 ring-2 ring-amber-500/25 scale-105 shadow-xs"
                          : "border-slate-200 group-hover:border-slate-300"
                      }`}
                    >
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-200 group-hover:scale-110"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80";
                        }}
                      />
                    </div>
                    <span
                      className={`text-[8px] leading-tight text-center truncate w-full mt-0.5 transition-colors ${
                        isSelected
                          ? "text-amber-600 font-bold"
                          : "text-slate-600 font-medium group-hover:text-slate-900"
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
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
          displayedProducts.map((p, pIdx) => {
            const isSaved = (savedReelIds || []).includes(p.id);
            return (
              <div
                key={`${p._renderKey || p.id}-${pIdx}`}
                onClick={() => {
                  setSelectedProduct(p);
                  onSelectProduct?.(p);
                }}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between active:scale-[0.98] transition-transform cursor-pointer shadow-sm hover:border-amber-300"
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
                    id={`android-save-product-btn-${p.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave?.(p.id);
                    }}
                    className={`p-1.5 rounded-lg active:scale-90 transition-all font-bold cursor-pointer flex items-center justify-center ${
                      isSaved
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                    }`}
                    title={isSaved ? "Guardado en publicaciones" : "Guardar en publicaciones"}
                    aria-label={isSaved ? "Quitar de publicaciones guardadas" : "Guardar en publicaciones"}
                  >
                    <Bookmark
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isSaved ? "fill-slate-950 stroke-slate-950 scale-105" : "stroke-[2.2]"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Infinite Scroll Loader & Sentinel */}
      {filteredProducts.length > 0 && (
        <div ref={infiniteLoaderRef} className="w-full py-5 flex flex-col items-center justify-center">
          {isLoadingMore ? (
            <div className="flex items-center space-x-2 bg-slate-100/95 border border-slate-200 px-4 py-2 rounded-full shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span className="text-[11px] font-semibold text-slate-600">Cargando más productos...</span>
            </div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
          )}
        </div>
      )}

    </div>
  );
}
