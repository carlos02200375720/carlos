import React, { useState, useEffect, useRef } from "react";
import { ShoppingCart, Star, Heart, ArrowLeft, Trash2, Plus, Minus, CreditCard, CheckCircle2, ShoppingBag, ShieldCheck, Truck, Search, X, Video, Globe, PackageCheck, Loader2, AlertCircle, ChevronLeft, ChevronRight, Play, Volume2, VolumeX, Check } from "lucide-react";
import { Product, CartItem, Order, User } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { apiFetch } from "../config";
import { NativeVideoPlayer } from "./VideoPlayer";

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
  onCheckout: (address: string, shippingCost: number, onComplete: (newOrder: Order) => void, itemsToCheckout?: CartItem[]) => void;
  onCreatorClick: (creatorId: string) => void;
  selectedProductDirectly: Product | null;
  clearDirectProduct: () => void;
  onNavigateToHistory: () => void;
  onToggleDetailView?: (isOpen: boolean) => void;
  initialStep?: 'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou';
  initialSelectedCartIndices?: number[];
  onClearInitialStep?: () => void;
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
  onToggleDetailView,
  initialStep,
  initialSelectedCartIndices,
  onClearInitialStep
}: ShopViewProps) {
  // Navigation states: 'catalog' | 'detail' | 'cart' | 'checkout' | 'payment' | 'thankyou'
  const [activeStep, setActiveStep] = useState<'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou'>('catalog');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductMediaUrl, setSelectedProductMediaUrl] = useState<string>("");
  const [selectedVariants, setSelectedVariants] = useState<{[key: string]: string}>({});
  const [optionsValidationError, setOptionsValidationError] = useState<string | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
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
    const speed = 0.5; // gentle, smooth continuous scroll speed

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
    };
  }, [isCategoryDragging, isCategoryHovered]);

  // Main Product Gallery horizontal scroll & drag helpers
  const gallerySliderRef = useRef<HTMLDivElement>(null);
  const galleryVideoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailItemRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});
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

  // Sync thumbnail container scroll with active gallery index
  useEffect(() => {
    const thumbEl = thumbnailItemRefs.current[activeGalleryIndex];
    if (thumbEl && thumbnailTrackRef.current) {
      const container = thumbnailTrackRef.current;
      const thumbLeft = thumbEl.offsetLeft;
      const thumbWidth = thumbEl.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScroll = thumbLeft - (containerWidth / 2) + (thumbWidth / 2);
      container.scrollTo({
        left: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeGalleryIndex]);

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
      // Pause infinite auto-scroll temporarily on wheel scroll
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

      const res = await apiFetch(`/api/cj/freight-options?vid=${encodeURIComponent(vidToUse)}&pid=${encodeURIComponent(pidToUse)}&destCountry=${encodeURIComponent(countryCode)}`);
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

  // Scroll Header Auto-Hide / Auto-Show states: Hide header only after passing the first 2 product cards
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Calculate dynamic threshold based on first 2 product cards (approx height on mobile/desktop)
      // On mobile grid (2 columns), first 2 cards are row 1 (~240-280px tall)
      let hideThreshold = 220;
      const secondProductCard = document.getElementById("prod-card-1") || document.querySelector("[id^='prod-card-']");
      if (secondProductCard) {
        const rect = secondProductCard.getBoundingClientRect();
        const cardBottom = rect.bottom + window.scrollY;
        if (cardBottom > 100) {
          hideThreshold = Math.max(180, cardBottom - 80);
        }
      }

      // Avoid triggering on tiny adjustments
      if (Math.abs(currentScrollY - lastScrollY.current) < 6) {
        return;
      }

      // Only hide header when user has scrolled DOWN past the first 2 product cards
      if (currentScrollY <= hideThreshold) {
        // While within or above the first 2 cards, always show header
        setShowHeader(true);
      } else if (currentScrollY > lastScrollY.current) {
        // Scrolled down and past first 2 product cards: hide header
        setShowHeader(false);
      } else {
        // Scrolling up: show header
        setShowHeader(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Notify parent component about detail view to hide app bottom navigation bar
  useEffect(() => {
    if (onToggleDetailView) {
      onToggleDetailView(activeStep === 'detail');
    }
    if (activeStep === 'detail') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [activeStep, onToggleDetailView]);

  // Helper to validate required product options (color, size, style, etc.)
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
      const hasSwatches = product.variantList.some(item => item.imageUrl || item.color || item.name);
      if (hasSwatches && !selected["Color"] && !selected["Opción"]) {
        missing.push("Color");
      }
    }

    return missing;
  };

  // Sync direct product clicks from reels
  useEffect(() => {
    if (selectedProductDirectly) {
      setSelectedProduct(selectedProductDirectly);
      setSelectedProductMediaUrl(selectedProductDirectly.imageUrl);
      setSelectedVariants({});
      setOptionsValidationError(null);
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
    setOptionsValidationError(null);
    setSelectedShippingOption(null);
    setActiveGalleryIndex(0);
    setIsGalleryVideoPlaying(true);
    setIsGalleryVideoMuted(true);
    if (gallerySliderRef.current) {
      gallerySliderRef.current.scrollLeft = 0;
    }
    setActiveStep('detail');
  };

  // Cart selection state
  const [selectedCartIndices, setSelectedCartIndices] = useState<number[]>([]);

  // Respond to initialStep or initialSelectedCartIndices from external navigation (e.g., from ReelsView)
  useEffect(() => {
    if (initialStep && initialStep !== 'catalog') {
      setActiveStep(initialStep);
      if (initialSelectedCartIndices && initialSelectedCartIndices.length > 0) {
        setSelectedCartIndices(initialSelectedCartIndices);
      }
      onClearInitialStep?.();
    }
  }, [initialStep, initialSelectedCartIndices, onClearInitialStep]);

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

  const cartSubtotal = effectiveCheckoutItems.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const cartShippingTotal = effectiveCheckoutItems.reduce((acc, item) => {
    const shippingFee = item.selectedShippingCost !== undefined 
      ? item.selectedShippingCost 
      : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
    return acc + shippingFee * item.quantity;
  }, 0);
  const cartTotal = cartSubtotal + cartShippingTotal;
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const selectedItemCount = selectedCartItems.reduce((acc, item) => acc + item.quantity, 0);

  const startCheckout = () => {
    if (effectiveCheckoutItems.length === 0) return;
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
      const totalShippingCost = effectiveCheckoutItems.reduce((acc, item) => {
        const shippingFee = item.selectedShippingCost !== undefined 
          ? item.selectedShippingCost 
          : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
        return acc + ((shippingFee || 0) * item.quantity);
      }, 0);
      onCheckout(fullShippingAddress, totalShippingCost, (newOrder) => {
        setCompletedOrder(newOrder);
        setActiveStep('thankyou');
      }, effectiveCheckoutItems);
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

  // Reset infinite scroll count when filter/search changes
  useEffect(() => {
    setDisplayCount(12);
  }, [selectedCategory, searchQuery]);

  // Infinite Scroll Trigger via IntersectionObserver and window scroll listener
  useEffect(() => {
    if (activeStep !== 'catalog') return;

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

  // Compute displayed products for continuous infinite exploration
  const displayedProducts = React.useMemo(() => {
    if (filteredProducts.length === 0) return [];
    const result: Product[] = [];
    for (let i = 0; i < displayCount; i++) {
      result.push(filteredProducts[i % filteredProducts.length]);
    }
    return result;
  }, [filteredProducts, displayCount]);

  return (
    <div className="w-full min-h-screen bg-white relative flex flex-col no-scrollbar" id="shop-panel" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {/* 1. Detail Page Transparent Fixed Header */}
      {activeStep === 'detail' ? (
        <header
          className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-3 sm:px-5 pb-2.5 sm:pb-3 bg-transparent border-0 pointer-events-none transition-all duration-200"
          style={{
            paddingTop: "max(2rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))",
          }}
          id="product-detail-transparent-header"
        >
          {/* Botón de Regreso */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setActiveStep('catalog')}
              className="w-10 h-10 rounded-full bg-transparent text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] flex items-center justify-center hover:scale-105 transition-all active:scale-95 pointer-events-auto cursor-pointer"
              aria-label="Regresar al catálogo"
              id="detail-back-button"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Carrito */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowCartDrawer(true)}
              className="relative w-10 h-10 rounded-full bg-transparent text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] flex items-center justify-center hover:scale-105 transition-all active:scale-95 pointer-events-auto cursor-pointer"
              id="detail-cart-trigger-btn"
              aria-label="Ver carrito"
            >
              <ShoppingCart className="w-6 h-6 text-white" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-extrabold font-mono text-[9px] sm:text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-xs">
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
            paddingTop: "max(2.25rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))"
          }}
        >
          {/* Top Bar: Navigation / Search / Cart */}
          <div className="px-3 sm:px-5 pb-2.5 sm:pb-3 flex items-center justify-between gap-3 w-full">
            <div className="flex items-center space-x-2 shrink-0">
              {activeStep !== 'catalog' && (
                <button
                  onClick={() => {
                    if (activeStep === 'checkout') setActiveStep('catalog');
                    else if (activeStep === 'thankyou') setActiveStep('catalog');
                  }}
                  className="p-1 sm:p-1.5 rounded-full hover:bg-slate-200 text-slate-600 transition-all cursor-pointer flex items-center justify-center pointer-events-auto"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs font-bold text-slate-700 ml-1">Regresar</span>
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
          </div>

          {/* Sticky Category Carousel directly anchored below search bar */}
          {activeStep === 'catalog' && (
            <div className="w-full relative group/categories border-t border-slate-50/80 pt-0.5 pb-1">
              {selectedCategory !== "todos" && (
                <div className="flex items-center justify-end mb-0.5 px-3 sm:px-5">
                  <button 
                    onClick={() => setSelectedCategory("todos")} 
                    className="text-[9.5px] font-bold text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                  >
                    Limpiar filtro ({CATEGORIES.find(c => c.id === selectedCategory)?.name})
                  </button>
                </div>
              )}
              
              {/* Scrollable track with infinite auto-scroll, drag-to-scroll, wheel scroll and touch pan */}
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
                className={`flex items-center space-x-2.5 sm:space-x-3.5 overflow-x-auto pb-0.5 pt-0.5 px-3 sm:px-5 select-none no-scrollbar ${isCategoryDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x',
                  height: '56px'
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
                      style={{ width: '52px' }}
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-[1.5px] transition-all relative flex items-center justify-center bg-white ${isSelected ? "border-amber-500 ring-2 ring-amber-500/20 scale-105 shadow-xs" : "border-slate-100 group-hover:border-slate-300"}`}>
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>
                      <span className={`text-[8.5px] sm:text-[9.5px] leading-tight text-center font-bold tracking-tight line-clamp-1 w-full transition-colors ${isSelected ? "text-amber-600 font-extrabold" : "text-slate-500 group-hover:text-slate-800"}`}>
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
          {/* 1. CATALOG STEP */}
          {activeStep === 'catalog' && (
            <div
              className="flex flex-col space-y-4 p-3 sm:p-5 pt-3 pb-28 sm:pb-24"
              style={{
                paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))'
              }}
            >

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

          {/* 2. DETAIL STEP */}
          {activeStep === 'detail' && selectedProduct && (
            <>
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-0 md:p-6"
                style={{
                  paddingBottom: "max(4.75rem, calc(4rem + env(safe-area-inset-bottom, 0px)))"
                }}
              >
                {/* Image & Showcase */}
                <div className="space-y-4">
                  {/* Main Media Viewer - Horizontal Scroll Gallery Slider */}
                  <div className="w-full h-[360px] sm:h-[440px] md:h-[500px] rounded-none md:rounded-2xl overflow-hidden border-b md:border border-slate-200/80 bg-white relative group/gallery shadow-xs">
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
                                <NativeVideoPlayer
                                  ref={(handle) => {
                                    galleryVideoRefs.current[idx] = handle ? handle.getVideoElement() : null;
                                  }}
                                  src={mediaUrl}
                                  poster={selectedProduct.imageUrl || selectedProduct.images?.[0]}
                                  autoPlay={idx === activeGalleryIndex}
                                  loop
                                  muted={isGalleryVideoMuted}
                                  preload="auto"
                                  isCurrent={idx === activeGalleryIndex}
                                  isFeedMode={false}
                                  title={selectedProduct.name}
                                  onPlay={() => setIsGalleryVideoPlaying(true)}
                                  onPause={() => setIsGalleryVideoPlaying(false)}
                                  defaultAspectRatio="fit"
                                  className="w-full h-full"
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

                    {/* Image Counter Badge in Bottom-Right Corner */}
                    {productGalleryMedia.length > 0 && (
                      <div
                        className="absolute bottom-3 right-3 z-20 px-2 py-0.5 text-white font-mono text-xs font-bold tracking-wider flex items-center space-x-1 pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        id="detail-image-counter"
                      >
                        <span className="text-amber-400 font-extrabold">{activeGalleryIndex + 1}</span>
                        <span className="text-white/80">/</span>
                        <span className="text-white">{productGalleryMedia.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Media Thumbnails list (including photos and videos) */}
                  <div className="px-4 md:px-0 space-y-4">
                    {productGalleryMedia.length > 1 && (
                      <div
                        ref={thumbnailTrackRef}
                        className="flex space-x-2 overflow-x-auto py-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden scroll-smooth"
                      >
                        {productGalleryMedia.map((url, idx) => {
                          const isVideo = checkIsVideo(url);
                          const isSelected = activeGalleryIndex === idx;
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
                                    src={selectedProduct.imageUrl || selectedProduct.images?.[0]}
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

                    <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-slate-900 mt-4 leading-tight">{selectedProduct.name}</h1>
                    
                    {/* Rating Stars & Price Section */}
                    <div className="flex items-center justify-between gap-3 mt-3 flex-wrap bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center space-x-1.5">
                        <div className="flex items-center text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-amber-400" />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-700">{selectedProduct.rating} (Verificado)</span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950 tracking-tight" id="product-detail-price">
                          ${selectedProduct.price.toFixed(2)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          selectedProduct.stock > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                            : "bg-rose-50 text-rose-700 border-rose-200/80"
                        }`}>
                          {selectedProduct.stock > 0 ? `En Stock` : "Agotado"}
                        </span>
                      </div>
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
                        <div className="mt-6 space-y-4 border-t border-slate-100 pt-4" id="product-options-section">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-extrabold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                              <span>Selecciona tus opciones:</span>
                              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200/60 lowercase">
                                (requerido)
                              </span>
                            </p>
                          </div>

                          {/* Options Validation Error Notice */}
                          {optionsValidationError && (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2.5 animate-bounce shadow-xs">
                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>{optionsValidationError}</span>
                            </div>
                          )}

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
                              <div className="flex items-center gap-2.5 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x">
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
              <div 
                className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-1.5 sm:py-2 px-3 sm:px-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
                style={{ paddingBottom: 'max(0.4rem, calc(env(safe-area-inset-bottom, 0px) + 0.25rem))' }}
              >
                <div className="max-w-md mx-auto w-full flex items-center justify-center min-h-[38px]">
                  {(() => {
                    const missingOpts = getMissingOptions(selectedProduct, selectedVariants);
                    const hasMissingOpts = missingOpts.length > 0;

                    return (
                      <button
                        onClick={() => {
                          if (selectedProduct.stock > 0) {
                            const currentMissing = getMissingOptions(selectedProduct, selectedVariants);
                            if (currentMissing.length > 0) {
                              setOptionsValidationError(`Por favor selecciona tu ${currentMissing.join(" y ")} antes de añadir al carrito.`);
                              document.getElementById("product-options-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                              return;
                            }

                            // Check if shipping option is selected for destination country
                            if (!selectedShippingOption) {
                              setShowShippingModal(true);
                              fetchCjFreightOptions(shippingCountry, selectedProduct.cjVid || selectedProduct.cjPid);
                              return;
                            }

                            const variantStr = Object.entries(selectedVariants)
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
                        className={`w-full py-2.5 sm:py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 text-center ${
                          selectedProduct.stock <= 0
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : hasMissingOpts
                            ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-500/20"
                            : !selectedShippingOption
                            ? "bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-amber-500/20"
                            : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/25"
                        }`}
                        id="add-to-cart-detail-btn"
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
                        ) : !selectedShippingOption ? (
                          <>
                            <Truck className="w-4 h-4 shrink-0 text-slate-950" />
                            <span className="whitespace-nowrap">Calcular envío</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4 shrink-0 text-slate-950" />
                            <span className="whitespace-nowrap">Añadir al Carrito</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
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
              className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-5xl mx-auto px-2 sm:px-4 py-2"
              style={{
                paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px) + 5px)'
              }}
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
                      {effectiveCheckoutItems.reduce((acc, i) => acc + i.quantity, 0)} {effectiveCheckoutItems.reduce((acc, i) => acc + i.quantity, 0) === 1 ? 'producto' : 'productos'}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-100 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {effectiveCheckoutItems.map((item, idx) => (
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
              <div 
                className="fixed bottom-0 inset-x-0 z-40 bg-white border-0 pt-2 px-4 sm:px-6 shadow-none"
                style={{ paddingBottom: 'calc(0.4rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <div className="max-w-md mx-auto flex flex-col items-center justify-center">
                  {!isFormValid && (
                    <span className="text-[10px] text-rose-500 font-bold mb-1 animate-pulse text-center">
                      Por favor complete todos los datos
                    </span>
                  )}
                  <button
                    onClick={executePayment}
                    className="w-full sm:w-auto min-w-[240px] bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold px-8 py-3 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/25 border border-amber-400"
                    id="pay-now-btn"
                  >
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Pagar (${cartTotal.toFixed(2)})</span>
                  </button>
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
              <div 
                className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0"
                style={{
                  paddingTop: "max(2rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))"
                }}
              >
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCartDrawer(false)}
                    className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
                    id="close-cart-drawer-btn"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center space-x-1.5">
                    <ShoppingCart className="w-4 h-4 text-amber-500" />
                    <span className="font-display font-bold text-sm text-slate-900">Carrito ({cartItemCount})</span>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllCart}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-transparent border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-slate-700 active:scale-95"
                    id="select-all-cart-btn"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                        isAllCartSelected
                          ? "bg-amber-500 text-slate-950"
                          : selectedCartIndices.length > 0
                          ? "bg-amber-200 text-amber-900"
                          : "border border-slate-300 bg-white"
                      }`}
                    >
                      {isAllCartSelected ? (
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      ) : selectedCartIndices.length > 0 ? (
                        <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" />
                      ) : null}
                    </div>
                    <span className="text-[10.5px]">
                      {isAllCartSelected ? "Quitar" : "Todo"} ({selectedCartIndices.length}/{cart.length})
                    </span>
                  </button>
                )}
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                    <ShoppingCart className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                    <p className="font-medium text-slate-600">Su carrito está vacío</p>
                    <p className="text-xs text-slate-400 mt-1">Explora productos recomendados por nuestros creadores.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => {
                    const isSelected = selectedCartIndices.includes(idx);
                    const shippingFee = item.selectedShippingCost !== undefined 
                      ? item.selectedShippingCost 
                      : (item.product.shippingCost !== undefined ? item.product.shippingCost : 0);
                    const carrierName = item.selectedCarrier || item.product.selectedCarrier;

                    return (
                      <div
                        key={`${item.product.id}_${idx}`}
                        className={`flex items-stretch rounded-2xl border transition-all shadow-sm overflow-hidden h-28 shrink-0 relative ${
                          isSelected
                            ? "bg-amber-500/[0.04] border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/40"
                            : "bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-100"
                        }`}
                        id={`cart-item-${item.product.id}-${idx}`}
                      >
                        <div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                            onClick={() => {
                              setShowCartDrawer(false);
                              setSelectedProduct(item.product);
                              setActiveStep('detail');
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between h-full">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4
                                className="text-xs font-extrabold text-slate-900 truncate cursor-pointer hover:text-amber-600 transition-colors"
                                title={item.product.name}
                                onClick={() => {
                                  setShowCartDrawer(false);
                                  setSelectedProduct(item.product);
                                  setActiveStep('detail');
                                }}
                              >
                                {item.product.name}
                              </h4>
                              <button
                                onClick={() => onRemoveFromCart(item.product.id, idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 -mt-1 -mr-1"
                                title="Eliminar producto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-mono font-extrabold text-amber-600">
                                ${item.product.price.toFixed(2)}
                              </span>
                              <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded leading-tight">
                                Envío: {shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : "Gratis"}
                                {carrierName ? ` (${carrierName})` : ""}
                              </span>
                            </div>
                          </div>
                          
                          {/* Incrementor buttons & Selection in bottom-right */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <button
                                onClick={() => onUpdateCartQuantity(item.product.id, Math.max(1, item.quantity - 1), idx)}
                                className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-xs font-mono font-extrabold text-slate-900 px-1">{item.quantity}</span>
                              <button
                                onClick={() => onUpdateCartQuantity(item.product.id, item.quantity + 1, idx)}
                                disabled={item.quantity >= item.product.stock}
                                className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Selector in bottom-right corner */}
                            <button
                              type="button"
                              onClick={(e) => toggleItemSelection(idx, e)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 scale-105"
                                  : "bg-white border-slate-300 hover:border-amber-400 text-transparent hover:text-slate-300"
                              }`}
                              title={isSelected ? "Deseleccionar producto para pago" : "Seleccionar producto para pagar"}
                              id={`select-item-checkbox-${idx}`}
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Drawer Footer summary */}
              {cart.length > 0 && (
                <div 
                  className="px-4 py-2 border-t border-slate-100 bg-white space-y-1.5 shrink-0"
                  style={{ 
                    paddingBottom: 'max(0.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.35rem))'
                  }}
                >
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium leading-tight">
                    <span>Subtotal ({selectedCartItems.length} de {cart.length} selec.):</span>
                    <span className="font-mono text-slate-800 font-semibold">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium leading-tight">
                    <span>Costo de Envío:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {cartShippingTotal === 0 ? "GRATIS" : `$${cartShippingTotal.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                    <span>Total a Pagar:</span>
                    <span className="font-mono text-slate-950 font-black text-sm">${cartTotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={startCheckout}
                    disabled={selectedCartItems.length === 0}
                    className={`w-full font-extrabold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1 shadow-md ${
                      selectedCartItems.length > 0
                        ? "bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-amber-500/20"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    }`}
                    id="checkout-btn"
                  >
                    {selectedCartItems.length > 0 ? (
                      <>
                        <span>Pagar ({selectedCartItems.length} {selectedCartItems.length === 1 ? 'producto' : 'productos'})</span>
                        <ArrowLeft className="w-4 h-4 rotate-180 text-slate-950" />
                      </>
                    ) : (
                      <span>Selecciona productos para pagar</span>
                    )}
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
              <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                            className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 sm:gap-3.5 w-full overflow-hidden ${
                              isSelected
                                ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30 shadow-md"
                                : "bg-white hover:bg-slate-50 border-slate-200 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                              <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-100 text-slate-600"}`}>
                                <Truck className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1 overflow-hidden">
                                <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                                  <span className="text-xs font-extrabold text-slate-900 truncate">
                                    {option.carrier}
                                  </span>
                                  {idx === 0 && (
                                    <span className="text-[9px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 whitespace-nowrap">
                                      Recomendado
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                                  ⏱️ Entrega: <span className="font-bold text-slate-800">{option.aging}</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5 truncate">
                                  📦 Almacén CN → {shippingCountry}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex flex-col items-end justify-center pl-1">
                              <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block whitespace-nowrap">
                                {option.shippingCost === 0 ? "GRATIS" : `$${option.shippingCost.toFixed(2)}`}
                              </span>
                              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 whitespace-nowrap text-center ${
                                isSelected ? "bg-amber-500 text-slate-950 font-black shadow-xs" : "bg-slate-100 text-slate-600"
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

              {/* Modal Footer with Safe-Area bottom inset */}
              <div 
                className="py-2 px-4 border-t border-slate-200 bg-slate-50/95 flex items-center justify-end shrink-0"
                style={{ paddingBottom: 'max(0.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.35rem))' }}
              >
                <button
                  onClick={() => {
                    if (selectedShippingOption && selectedProduct) {
                      selectedProduct.shippingCost = selectedShippingOption.shippingCost;

                      const variantStr = Object.entries(selectedVariants)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                      
                      const activeImageUrl = selectedProductMediaUrl || selectedProduct.imageUrl;

                      const customizedProduct: Product = {
                        ...selectedProduct,
                        imageUrl: activeImageUrl,
                        name: variantStr ? `${selectedProduct.name} (${variantStr})` : selectedProduct.name,
                        shippingCost: selectedShippingOption.shippingCost,
                        selectedCarrier: selectedShippingOption.carrier
                      };

                      onAddToCart(customizedProduct);
                      setShowShippingModal(false);
                      setShowCartDrawer(true);
                    } else {
                      setShowShippingModal(false);
                    }
                  }}
                  className={`w-full py-2.5 sm:py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center ${
                    selectedShippingOption
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                  }`}
                  id="apply-shipping-btn"
                >
                  {selectedShippingOption ? (
                    <>
                      <ShoppingCart className="w-4 h-4 shrink-0 text-slate-950" />
                      <span>Añadir al Carrito</span>
                    </>
                  ) : (
                    <span>Cerrar</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
