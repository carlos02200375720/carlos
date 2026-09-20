import React from "react";
import { Play, ShoppingBag, User as UserIcon, MessageSquare } from "lucide-react";
import { User, Reel, Product, CartItem, Order, ChatMessage } from "../../types";
import ReelsView from "./ReelsView";
import ShopView from "./ShopView";
import SocialPanel from "./SocialPanel";
import ProfileView from "./ProfileView";
import AndroidLoginView from "./LoginView";
import { motion, AnimatePresence } from "motion/react";
import { safeStorage } from "../../utils/safeStorage";
import { navigateTo } from "../../router";

export interface AndroidAppProps {
  activeTab: 'reels' | 'shop' | 'messages' | 'profile';
  setActiveTab: React.Dispatch<React.SetStateAction<'reels' | 'shop' | 'messages' | 'profile'>>;
  users: User[];
  reels: Reel[];
  products: Product[];
  cart: CartItem[];
  currentUser: User;
  directSelectedProduct: Product | null;
  setDirectSelectedProduct: (product: Product | null) => void;
  selectedCreatorProfileId: string | null;
  setSelectedCreatorProfileId: (creatorId: string | null) => void;
  isProductDetailOpen: boolean;
  setIsProductDetailOpen: (open: boolean) => void;
  shopInitialStep: 'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou';
  setShopInitialStep: (step: 'catalog' | 'detail' | 'checkout' | 'payment' | 'thankyou') => void;
  shopInitialSelectedIndices: number[];
  setShopInitialSelectedIndices: (indices: number[]) => void;
  activeChatUser: User | null;
  setActiveChatUser: (user: User | null) => void;
  privateMessages: ChatMessage[];
  unreadCounts: Record<string, number>;
  savedReelIds: string[];
  isLiveViewerOpen: boolean;
  totalUnreads: number;
  handleAddToCart: (product: Product, quantity?: number, selectedOptions?: Record<string, string>, selectedVariantVid?: string) => void;
  handleRemoveFromCart: (productId: string, idx?: number) => void;
  handleUpdateCartQuantity: (productId: string, qty: number, idx?: number) => void;
  handleCheckoutCart: (
    address: string,
    shippingCost: number,
    onComplete: (newOrder: Order) => void,
    itemsToCheckout?: CartItem[]
  ) => void;
  handleCreatorProfileLink: (creatorId: string) => void;
  handleProductDetailsLink: (product: Product) => void;
  handleReelLink: (reelId: string) => void;
  handleLikeReel: (reelId: string) => void;
  handleAddComment: (reelId: string, text: string) => void;
  handleToggleSaveReel: (reelId: string) => void;
  handleToggleFollowUser: (creatorId: string) => void;
  handleSendPrivateMessage: (text: string) => void;
  handleClearUnreads: (userId: string) => void;
  refreshReels: () => void;
  refreshProducts?: () => void;
  refreshAllData: () => void;
  isInitialLoading?: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  isLoggedIn?: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogout: () => void;
  setGuestInteractionAlert: (alert: string | null) => void;
  openPrivateChatDirectly: (targetUser: User) => void;
  socket: WebSocket | null;
}

export default function AndroidApp({
  activeTab,
  setActiveTab,
  users,
  reels,
  products,
  cart,
  currentUser,
  directSelectedProduct,
  setDirectSelectedProduct,
  selectedCreatorProfileId,
  setSelectedCreatorProfileId,
  isProductDetailOpen,
  setIsProductDetailOpen,
  shopInitialStep,
  setShopInitialStep,
  shopInitialSelectedIndices,
  setShopInitialSelectedIndices,
  activeChatUser,
  setActiveChatUser,
  privateMessages,
  unreadCounts,
  savedReelIds,
  isLiveViewerOpen,
  totalUnreads,
  handleAddToCart,
  handleRemoveFromCart,
  handleUpdateCartQuantity,
  handleCheckoutCart,
  handleCreatorProfileLink,
  handleProductDetailsLink,
  handleReelLink,
  handleLikeReel,
  handleAddComment,
  handleToggleSaveReel,
  handleToggleFollowUser,
  handleSendPrivateMessage,
  handleClearUnreads,
  refreshReels,
  refreshProducts,
  refreshAllData,
  isInitialLoading,
  setCurrentUser,
  setUsers,
  isLoggedIn,
  setIsLoggedIn,
  handleLogout,
  setGuestInteractionAlert,
  openPrivateChatDirectly,
  socket,
}: AndroidAppProps) {
  const isUserLoggedIn = (isLoggedIn && !currentUser.isGuest && currentUser.username !== "invitado" && currentUser.id !== "guest") || (!currentUser.isGuest && Boolean(currentUser.username) && currentUser.username !== "invitado" && currentUser.id !== "guest");
  const isDarkNavActive = activeTab === 'reels';
  const [navBarHeight, setNavBarHeight] = React.useState(56);
  const [cartDrawerRequest, setCartDrawerRequest] = React.useState(0);
  const [isCartPageOpen, setIsCartPageOpen] = React.useState(false);

  React.useEffect(() => {
    const updateNavHeight = () => {
      const nav = document.getElementById("android-bottom-nav-bar");
      if (nav) {
        setNavBarHeight(nav.offsetHeight || nav.getBoundingClientRect().height || 56);
      }
    };
    updateNavHeight();
    window.addEventListener("resize", updateNavHeight);
    const nav = document.getElementById("android-bottom-nav-bar");
    let ro: ResizeObserver | null = null;
    if (nav) {
      ro = new ResizeObserver(updateNavHeight);
      ro.observe(nav);
    }
    return () => {
      window.removeEventListener("resize", updateNavHeight);
      ro?.disconnect();
    };
  }, [activeTab]);

  const handleDeleteReel = async (reelId: string) => {
    try {
      const res = await fetch(`/api/android/reels/${reelId}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetch(`/api/reels/${reelId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error("Error deleting reel:", err);
    } finally {
      refreshReels();
      refreshAllData();
    }
  };

  return (
    <div
      className="w-full flex-1 flex flex-col relative no-scrollbar"
      id="android-app-layout"
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        fontFamily: 'Roboto, system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Main Content Router */}
      <main
        className={`flex-1 w-full no-scrollbar ${isDarkNavActive ? "bg-slate-950" : "bg-white"}`}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          marginBottom: (activeTab === 'messages' && activeChatUser) || isLiveViewerOpen || activeTab === 'reels'
            ? 0
            : undefined
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${activeTab === 'reels' ? 'h-full' : ''}`}
          >
            {activeTab === 'reels' && (
              <ReelsView
                reels={reels}
                currentUser={currentUser}
                users={users}
                products={products}
                bottomNavHeight={navBarHeight}
                cart={cart}
                isLoading={isInitialLoading}
                onRefreshReels={refreshReels}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onNavigateToShop={() => setActiveTab('shop')}
                onNavigateToCheckout={(selectedIndices) => {
                  setShopInitialStep('checkout');
                  setShopInitialSelectedIndices(selectedIndices || []);
                  setActiveTab('shop');
                }}
                onProductClick={handleProductDetailsLink}
                onCreatorClick={handleCreatorProfileLink}
                onLikeReel={handleLikeReel}
                onAddComment={handleAddComment}
                savedReelIds={savedReelIds}
                onToggleSaveReel={handleToggleSaveReel}
                onToggleFollowUser={handleToggleFollowUser}
                onGuestInteraction={(action) => {
                  setGuestInteractionAlert(`Para ${action} en este reel, por favor inicia sesión.`);
                }}
              />
            )}

            {activeTab === 'shop' && (
              <ShopView
                products={products}
                cart={cart}
                users={users}
                currentUser={currentUser}
                isLoading={isInitialLoading}
                onRefreshProducts={refreshProducts || refreshAllData}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onCheckout={handleCheckoutCart}
                onCreatorClick={handleCreatorProfileLink}
                selectedProductDirectly={directSelectedProduct}
                clearDirectProduct={() => setDirectSelectedProduct(null)}
                onNavigateToHistory={() => {
                  if (!isUserLoggedIn) {
                    setSelectedCreatorProfileId(null);
                  } else {
                    setSelectedCreatorProfileId(currentUser.id);
                  }
                  setActiveTab('profile');
                }}
                onToggleDetailView={setIsProductDetailOpen}
                onToggleCart={setIsCartPageOpen}
                initialStep={shopInitialStep}
                initialSelectedCartIndices={shopInitialSelectedIndices}
                onClearInitialStep={() => {
                  setShopInitialStep('catalog');
                  setShopInitialSelectedIndices([]);
                }}
                onSelectProduct={(p) => {
                  setDirectSelectedProduct(p);
                  navigateTo(`/product/${encodeURIComponent(p.id)}`);
                }}
                onBackToCatalog={() => {
                  setDirectSelectedProduct(null);
                  navigateTo('/shop');
                }}
                cartDrawerRequest={cartDrawerRequest}
                savedReelIds={savedReelIds}
                onToggleSave={handleToggleSaveReel}
              />
            )}

            {activeTab === 'profile' && (
              <div
                className="w-full bg-white min-h-screen"
                id="android-profile-container"
                style={{
                  paddingBottom: `${navBarHeight + 6}px`
                }}
              >
                {(!isUserLoggedIn && !selectedCreatorProfileId) ? (
                  <AndroidLoginView
                    users={users}
                    onRefreshUsers={refreshAllData}
                    onLoginSuccess={(loggedUser) => {
                      setCurrentUser(loggedUser);
                      setIsLoggedIn(true);
                      safeStorage.setItem("isLoggedIn", "true");
                      safeStorage.setItem("loggedInUsername", loggedUser.username);
                      safeStorage.setItem("currentUserData", JSON.stringify(loggedUser));
                      refreshAllData();
                      setSelectedCreatorProfileId(null);
                      setActiveTab('profile');
                    }}
                  />
                ) : (
                  <ProfileView
                    currentUser={currentUser}
                    selectedCreatorId={selectedCreatorProfileId}
                    users={users}
                    reels={reels}
                    products={products}
                    savedReelIds={savedReelIds}
                    onToggleSaveReel={handleToggleSaveReel}
                    onBackToSelf={() => setSelectedCreatorProfileId(null)}
                    onOpenDirectChat={openPrivateChatDirectly}
                    onSelectProduct={handleProductDetailsLink}
                    onSelectReel={handleReelLink}
                    onToggleFollowUser={handleToggleFollowUser}
                    onProfileUpdate={(updatedUser) => {
                      setCurrentUser(updatedUser);
                      safeStorage.setItem("currentUserData", JSON.stringify(updatedUser));
                      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                      if (updatedUser.username && updatedUser.username !== "invitado" && !updatedUser.isGuest) {
                        setIsLoggedIn(true);
                        safeStorage.setItem("isLoggedIn", "true");
                        safeStorage.setItem("loggedInUsername", updatedUser.username);
                        setSelectedCreatorProfileId(null);
                        setActiveTab('profile');
                      }
                    }}
                    onRefreshUsers={refreshAllData}
                    onPublishSuccess={refreshAllData}
                    onDeleteReel={handleDeleteReel}
                    onLogout={handleLogout}
                    socket={socket}
                  />
                )}
              </div>
            )}

            {activeTab === 'messages' && (
              <SocialPanel
                users={users}
                currentUser={currentUser}
                messages={privateMessages}
                activeChatUser={activeChatUser}
                onSelectChatUser={setActiveChatUser}
                onSendPrivateMessage={handleSendPrivateMessage}
                unreadCounts={unreadCounts}
                clearUnreads={handleClearUnreads}
                onClose={() => setActiveTab('reels')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Android Material Design Navigation Bar */}
      {!(activeTab === 'messages' && activeChatUser) && !isLiveViewerOpen && !isProductDetailOpen && !(activeTab === 'shop' && isCartPageOpen) && (
        <div
          id="android-bottom-nav-bar"
          className={`fixed bottom-0 inset-x-0 pt-1 px-1 z-30 transition-colors shadow-[0_-2px_10px_rgba(0,0,0,0.15)] ${
            activeTab === 'shop' || activeTab === 'profile' || activeTab === 'messages'
               ? "bg-white text-slate-900 border-t border-slate-100"
               : "bg-black text-white border-t border-white/5"
          }`}
          style={{
            paddingBottom: 'max(0.2rem, calc(env(safe-area-inset-bottom, 0px) + 0.15rem))'
          }}
        >
          <div className="max-w-md mx-auto grid grid-cols-4 items-center">
            
            {/* Tab 1: Reels */}
            <button
              onClick={() => { refreshReels(); setActiveTab('reels'); }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:bg-amber-500/10 cursor-pointer ${
                activeTab === 'reels'
                  ? "text-amber-500 scale-105"
                  : "text-slate-400 hover:text-white"
              }`}
              id="android-nav-reels"
            >
              <Play className={`w-5 h-5 transition-all ${activeTab === 'reels' ? "fill-amber-500 stroke-amber-500" : ""}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">Reels</span>
            </button>

            {/* Tab 2: Shop */}
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:bg-amber-500/10 cursor-pointer relative ${
                activeTab === 'shop'
                  ? "text-amber-600 scale-105"
                  : activeTab === 'reels' ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-800"
              }`}
              id="android-nav-shop"
            >
              <ShoppingBag className={`w-5 h-5 transition-all ${activeTab === 'shop' ? "fill-amber-600 stroke-amber-600" : ""}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">Tienda</span>
            </button>

            {/* Tab 3: Messages */}
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:bg-amber-500/10 cursor-pointer relative ${
                activeTab === 'messages'
                  ? "text-amber-600 scale-105"
                  : activeTab === 'reels' ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-800"
              }`}
              id="android-nav-messages"
            >
              <MessageSquare className={`w-5 h-5 transition-all ${activeTab === 'messages' ? "fill-amber-600 stroke-amber-600" : ""}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">Mensajes</span>
              {totalUnreads > 0 && (
                <span className="absolute top-0.5 right-2 w-4 h-4 bg-rose-500 text-white font-mono font-bold text-[9px] rounded-full flex items-center justify-center border border-black animate-pulse shadow-sm">
                  {totalUnreads}
                </span>
              )}
            </button>

            {/* Tab 4: Profile */}
            <button
              onClick={() => {
                setSelectedCreatorProfileId(null);
                setActiveTab('profile');
              }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all active:bg-amber-500/10 cursor-pointer ${
                activeTab === 'profile'
                  ? "text-amber-600 scale-105"
                  : activeTab === 'reels' ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-800"
              }`}
              id="android-nav-profile"
            >
              <UserIcon className={`w-5 h-5 transition-all ${activeTab === 'profile' ? "fill-amber-600 stroke-amber-600" : ""}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">
                Perfil
              </span>
            </button>

          </div>
        </div>
      )}
    </div>
  );
}
