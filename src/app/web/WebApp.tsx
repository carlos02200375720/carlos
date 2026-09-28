import React from "react";
import { User, Reel, Product, CartItem, Order, ChatMessage, NavigationTab } from "../../types";
import WebSidebar from "./WebSidebar";
import Inicio from "./Inicio";
import Tienda from "./Tienda";
import SocialPanel from "./SocialPanel";
import Perfil from "./Perfil";
import AdminView from "./AdminView";
import { motion, AnimatePresence } from "motion/react";
import { sessionState } from "../../utils/sessionState";
import { navigateTo, getProfilePath, getProductPath, getInicioPath } from "../../router";
import { isSuperAdmin } from "../../superAdmin";

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
  shopInitialStep: 'catalog' | 'detail' | 'cart' | 'checkout' | 'payment' | 'thankyou';
  setShopInitialStep: (step: 'catalog' | 'detail' | 'cart' | 'checkout' | 'payment' | 'thankyou') => void;
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
    itemsToCheckout?: CartItem[],
    buyerInfo?: { buyerName?: string; buyerEmail?: string; buyerPhone?: string }
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
  const isHomeActive = activeTab === 'inicio' || activeTab === 'reels';
  const isDarkNavActive = isHomeActive;
  const [profileInitialSubTab, setProfileInitialSubTab] = React.useState<"publish" | "publications" | "products" | "saved" | "orders" | "performance" | "edit" | undefined>(undefined);

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
        hideMobileHamburger={
          activeTab === 'shop' &&
          (isProductDetailOpen ||
            Boolean(directSelectedProduct) ||
            shopInitialStep === 'detail' ||
            shopInitialStep === 'checkout' ||
            shopInitialStep === 'payment')
        }
      />

      {/* Main Web Views Canvas */}
      <main
        className={`flex-1 w-full md:pl-60 lg:pl-64 ${isHomeActive ? 'h-screen overflow-hidden' : 'min-h-screen pb-0'} ${isDarkNavActive ? "bg-slate-950" : "bg-white"}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isHomeActive ? 'inicio' : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`w-full ${isHomeActive ? 'h-full flex flex-col' : ''}`}
          >
            {isHomeActive && (
              <Inicio
                reels={reels}
                currentUser={currentUser}
                cart={cart}
                totalUnreads={totalUnreads}
                onRefreshReels={refreshReels}
                onNavigateToTab={(tab) => {
                  setSelectedCreatorProfileId(null);
                  setActiveTab(tab);
                  if (tab === 'profile') {
                    navigateTo(getProfilePath(currentUser));
                  } else if (tab === 'inicio' || tab === 'reels') {
                    refreshReels();
                    navigateTo('/inicio');
                  } else if (tab === 'shop') {
                    navigateTo('/tienda');
                  } else if (tab === 'messages') {
                    navigateTo('/messages');
                  } else if (tab === 'admin') {
                    navigateTo('/admin');
                  }
                }}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onNavigateToShop={() => {
                  setActiveTab('shop');
                  navigateTo('/tienda');
                }}
                onNavigateToCheckout={(selectedIndices) => {
                  setShopInitialStep('checkout');
                  setShopInitialSelectedIndices(selectedIndices || []);
                  setActiveTab('shop');
                  navigateTo('/tienda/verificacion');
                }}
                onProductClick={handleProductDetailsLink}
                onCreatorClick={handleCreatorProfileLink}
                onLikeReel={handleLikeReel}
                onAddComment={handleAddComment}
                savedReelIds={savedReelIds}
                onToggleSaveReel={handleToggleSaveReel}
                onToggleFollowUser={handleToggleFollowUser}
                onGuestInteraction={(action) => {
                  setGuestInteractionAlert(`Para ${action} en esta publicación, por favor inicia sesión o crea una cuenta de creador.`);
                }}
                initialReelId={targetReelId}
                onActiveReelChange={(reelId) => {
                  const activeReel = reels.find((r) => r.id === reelId);
                  navigateTo(getInicioPath(activeReel || reelId), { replace: true });
                }}
              />
            )}

            {activeTab === 'shop' && (
              <Tienda
                products={products}
                cart={cart}
                users={users}
                currentUser={currentUser}
                savedReelIds={savedReelIds}
                onToggleSave={handleToggleSaveReel}
                onGuestInteraction={(action) => {
                  setGuestInteractionAlert(`Para ${action}, por favor inicia sesión o regístrate en la app.`);
                }}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                onUpdateCartQuantity={handleUpdateCartQuantity}
                onCheckout={handleCheckoutCart}
                onCreatorClick={handleCreatorProfileLink}
                selectedProductDirectly={directSelectedProduct}
                clearDirectProduct={() => setDirectSelectedProduct(null)}
                onNavigateToHistory={() => {
                  setSelectedCreatorProfileId(null);
                  setProfileInitialSubTab('orders');
                  setActiveTab('profile');
                  navigateTo(getProfilePath(currentUser));
                }}
                onLoginSuccess={(loggedUser) => {
                  const normalizedUser: User = {
                    ...loggedUser,
                    id: "current_user",
                    originalId: loggedUser.originalId || loggedUser.id,
                    isGuest: false,
                  };
                  setCurrentUser(normalizedUser);
                  setIsLoggedIn(true);
                  sessionState.setAuthenticated(true);
                  sessionState.setUsername(normalizedUser.username);
                  sessionState.setUser(normalizedUser);
                  setSelectedCreatorProfileId(null);
                  setProfileInitialSubTab('orders');
                  setActiveTab('profile');
                  navigateTo(getProfilePath(normalizedUser));
                }}
                onToggleDetailView={setIsProductDetailOpen}
                initialStep={shopInitialStep}
                initialSelectedCartIndices={shopInitialSelectedIndices}
                onClearInitialStep={() => {
                  setShopInitialStep('catalog');
                  setShopInitialSelectedIndices([]);
                }}
                onProductSelect={(prod) => {
                  setDirectSelectedProduct(prod);
                  navigateTo(getProductPath(prod));
                }}
                onBackToCatalog={() => {
                  setDirectSelectedProduct(null);
                  setIsProductDetailOpen(false);
                  setShopInitialStep('catalog');
                  navigateTo('/tienda');
                }}
                onStepChange={(step) => {
                  setShopInitialStep(step);
                  if (step === 'checkout') {
                    navigateTo('/tienda/verificacion');
                  } else if (step === 'cart') {
                    navigateTo('/tienda/carrito');
                  } else if (step === 'thankyou') {
                    navigateTo('/tienda/gracia');
                  } else if (step === 'catalog') {
                    setDirectSelectedProduct(null);
                    setIsProductDetailOpen(false);
                    navigateTo('/tienda');
                  }
                }}
              />
            )}

            {activeTab === 'profile' && (
              <div className="w-full pb-6" id="web-profile-container">
                <Perfil
                  currentUser={currentUser}
                  selectedCreatorId={selectedCreatorProfileId}
                  users={users}
                  products={products}
                  savedReelIds={savedReelIds}
                  onToggleSave={handleToggleSaveReel}
                  initialSubTab={profileInitialSubTab}
                  onClearInitialSubTab={() => setProfileInitialSubTab(undefined)}
                  onBackToSelf={() => {
                    setSelectedCreatorProfileId(null);
                    navigateTo(getProfilePath(currentUser));
                  }}
                  onOpenDirectChat={openPrivateChatDirectly}
                  onSelectProduct={handleProductDetailsLink}
                  onSelectReel={handleReelLink}
                  onToggleFollowUser={handleToggleFollowUser}
                  onProfileUpdate={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    sessionState.setUser(updatedUser);
                    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
                    if (updatedUser.username && updatedUser.username !== "invitado" && !updatedUser.isGuest) {
                      setIsLoggedIn(true);
                      sessionState.setAuthenticated(true);
                      sessionState.setUsername(updatedUser.username);
                      setSelectedCreatorProfileId(null);
                      setActiveTab('profile');
                      navigateTo(getProfilePath(updatedUser));
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
                onClose={() => {
                  setActiveTab('inicio');
                  navigateTo('/inicio');
                }}
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
                    if (tab === 'profile') {
                      navigateTo(getProfilePath(currentUser));
                    } else if (tab === 'inicio' || tab === 'reels') {
                      navigateTo('/inicio');
                    } else if (tab === 'shop') {
                      navigateTo('/tienda');
                    } else if (tab === 'messages') {
                      navigateTo('/messages');
                    } else if (tab === 'admin') {
                      navigateTo('/admin');
                    }
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
