import React from "react";
import { User, Reel, Product, CartItem, Order, ChatMessage } from "../../types";
import WebSidebar from "./WebSidebar";
import ReelsView from "../../components/ReelsView";
import ShopView from "../../components/ShopView";
import SocialPanel from "../../components/SocialPanel";
import ProfileView from "../../components/ProfileView";
import { motion, AnimatePresence } from "motion/react";

export interface WebAppProps {
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
  refreshAllData: () => void;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogout: () => void;
  setGuestInteractionAlert: (alert: string | null) => void;
  openPrivateChatDirectly: (targetUser: User) => void;
  socket: WebSocket | null;
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
  setIsLoggedIn,
  handleLogout,
  setGuestInteractionAlert,
  openPrivateChatDirectly,
  socket,
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
        className={`flex-1 w-full md:pl-60 lg:pl-64 min-h-screen ${isDarkNavActive ? "bg-slate-950" : "bg-white"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${activeTab === 'reels' ? 'h-full' : ''}`}
          >
            {activeTab === 'reels' && (
              <ReelsView
                reels={reels}
                currentUser={currentUser}
                cart={cart}
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
                  setGuestInteractionAlert(`Para ${action} en este reel, por favor inicia sesión o crea una cuenta de creador.`);
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
                onNavigateToHistory={() => { setSelectedCreatorProfileId(currentUser.id); setActiveTab('profile'); }}
                onToggleDetailView={setIsProductDetailOpen}
                initialStep={shopInitialStep}
                initialSelectedCartIndices={shopInitialSelectedIndices}
                onClearInitialStep={() => {
                  setShopInitialStep('catalog');
                  setShopInitialSelectedIndices([]);
                }}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                selectedCreatorId={selectedCreatorProfileId}
                users={users}
                onBackToSelf={() => setSelectedCreatorProfileId(null)}
                onOpenDirectChat={openPrivateChatDirectly}
                onSelectProduct={handleProductDetailsLink}
                onSelectReel={handleReelLink}
                onProfileUpdate={(updatedUser) => {
                  setCurrentUser(updatedUser);
                  localStorage.setItem("currentUserData", JSON.stringify(updatedUser));
                  setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                  if (updatedUser.username && updatedUser.username !== "invitado" && !updatedUser.isGuest) {
                    setIsLoggedIn(true);
                    localStorage.setItem("isLoggedIn", "true");
                    localStorage.setItem("loggedInUsername", updatedUser.username);
                    setSelectedCreatorProfileId(null);
                    setActiveTab('profile');
                  }
                }}
                onRefreshUsers={refreshAllData}
                onPublishSuccess={refreshAllData}
                onLogout={handleLogout}
                socket={socket}
              />
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
    </div>
  );
}
