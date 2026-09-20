import React from "react";
import { User, Reel, Product, CartItem, Order, ChatMessage, NavigationTab } from "../../types";
import WebSidebar from "./WebSidebar";
import ReelsView from "./ReelsView";
import ShopView from "./ShopView";
import SocialPanel from "./SocialPanel";
import ProfileView from "./ProfileView";
import AdminView from "./AdminView";
import { motion, AnimatePresence } from "motion/react";
import { safeStorage } from "../../utils/safeStorage";
import { navigateTo } from "../../router";
import { isSuperAdmin } from "../../config";

export interface WebAppProps {
  activeTab: NavigationTab;
  setActiveTab: React.Dispatch<React.SetStateAction<NavigationTab>>;
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
  targetReelId?: string | null;
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
  refreshAllData: () => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setReels: React.Dispatch<React.SetStateAction<Reel[]>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogout: () => void;
  setGuestInteractionAlert: (alert: string | null) => void;
  openPrivateChatDirectly: (targetUser: User) => void;
  socket: WebSocket | null;
  activePlatform?: 'android' | 'web';
  onSwitchPlatform?: (target: 'android' | 'web') => void;
}

export default function WebApp({
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
  refreshAllData,
  setCurrentUser,
  setUsers,
  setReels,
  setProducts,
  setIsLoggedIn,
  handleLogout,
  setGuestInteractionAlert,
  openPrivateChatDirectly,
  socket,
  activePlatform,
  onSwitchPlatform,
  targetReelId,
}: WebAppProps) {
  const isDarkNavActive = activeTab === 'reels';

  return (
    <div className="w-full flex-1 flex relative" id="web-app-layout">
      {/* Desktop Responsive Left Navigation Sidebar */}
      <WebSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        totalUnreads={totalUnreads}
        selectedCreatorProfileId={selectedCreatorProfileId}
        setSelectedCreatorProfileId={setSelectedCreatorProfileId}
        refreshReels={refreshReels}
      />

      {/* Main Web Views Canvas */}
      <main
        className={`flex-1 w-full md:pl-60 lg:pl-64 ${activeTab === 'reels' ? 'h-screen overflow-hidden' : 'min-h-screen pb-16 md:pb-0'} ${isDarkNavActive ? "bg-slate-950" : "bg-white"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${activeTab === 'reels' ? 'h-full flex flex-col' : ''}`}
          >
            {activeTab === 'reels' && (
              <ReelsView
                reels={reels}
                currentUser={currentUser}
                cart={cart}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onNavigateToShop={() => {
                  setActiveTab('shop');
                  navigateTo('/shop');
                }}
                onNavigateToCheckout={(selectedIndices) => {
                  setShopInitialStep('checkout');
                  setShopInitialSelectedIndices(selectedIndices || []);
                  setActiveTab('shop');
                  navigateTo('/checkout');
                }}
                onProductClick={handleProductDetailsLink}
                onCreatorClick={handleCreatorProfileLink}
                onLikeReel={handleLikeReel}
                onAddComment={handleAddComment}
                savedReelIds={savedReelIds}
                onToggleSaveReel={handleToggleSaveReel}
                onToggleFollowUser={handleToggleFollowUser}
                onGuestInteraction={(action) => {
                  setGuestInteractionAlert(`Para ${action} en este reel, por favor inicia sesión o crea una cuenta de creador.`);
                }}
                initialReelId={targetReelId}
                onActiveReelChange={(reelId) => {
                  navigateTo(`/reel/${encodeURIComponent(reelId)}`);
                }}
              />
            )}

            {activeTab === 'shop' && (
              <ShopView
                products={products}
                cart={cart}
                users={users}
                currentUser={currentUser}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onCheckout={handleCheckoutCart}
                onCreatorClick={handleCreatorProfileLink}
                selectedProductDirectly={directSelectedProduct}
                clearDirectProduct={() => setDirectSelectedProduct(null)}
                onNavigateToHistory={() => { setSelectedCreatorProfileId(currentUser.id); setActiveTab('profile'); navigateTo('/profile'); }}
                onToggleDetailView={setIsProductDetailOpen}
                initialStep={shopInitialStep}
                initialSelectedCartIndices={shopInitialSelectedIndices}
                onClearInitialStep={() => {
                  setShopInitialStep('catalog');
                  setShopInitialSelectedIndices([]);
                }}
                onProductSelect={(prod) => {
                  setDirectSelectedProduct(prod);
                  navigateTo(`/product/${encodeURIComponent(prod.id)}`);
                }}
                onBackToCatalog={() => {
                  setDirectSelectedProduct(null);
                  navigateTo('/shop');
                }}
                onStepChange={(step) => {
                  if (step === 'checkout') {
                    navigateTo('/checkout');
                  } else if (step === 'catalog') {
                    navigateTo('/shop');
                  }
                }}
              />
            )}

            {activeTab === 'profile' && (
              <div className="w-full pb-6" id="web-profile-container">
                <ProfileView
                  currentUser={currentUser}
                  selectedCreatorId={selectedCreatorProfileId}
                  users={users}
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
                  onLogout={handleLogout}
                  socket={socket}
                />
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

            {activeTab === 'admin' && isSuperAdmin(currentUser) && (
              <div className="w-full pb-10" id="web-admin-container">
                <AdminView
                  currentUser={currentUser}
                  users={users}
                  reels={reels}
                  products={products}
                  onRefreshAll={refreshAllData}
                  onCreatorClick={(creatorId) => {
                    handleCreatorProfileLink(creatorId);
                  }}
                  onProductClick={handleProductDetailsLink}
                  onReelClick={handleReelLink}
                  onNavigateToTab={(tab) => {
                    setSelectedCreatorProfileId(null);
                    setActiveTab(tab);
                  }}
                  setUsers={setUsers}
                  setReels={setReels}
                  setProducts={setProducts}
                  activePlatform={activePlatform}
                  onSwitchPlatform={onSwitchPlatform}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
