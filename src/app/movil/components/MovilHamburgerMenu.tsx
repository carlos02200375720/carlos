import React from "react";
import { Play, ShoppingBag, MessageSquare, User as UserIcon, ShieldCheck, Sparkles, X, Menu } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, NavigationTab, isGuestUser } from "../../../types";
import { navigateTo, getProfilePath } from "../../../router";
import { isSuperAdmin } from "../../../superAdmin";

export interface MovilHamburgerMenuProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  currentUser: User;
  totalUnreads?: number;
  onNavigateToTab?: (tab: NavigationTab) => void;
  onRefreshReels?: () => void;
  onNavigateToShop?: () => void;
  onNavigateToProfile?: () => void;
}

export function MovilHamburgerButton({
  onOpen,
  totalUnreads = 0,
}: {
  onOpen: () => void;
  totalUnreads?: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative p-2.5 rounded-full bg-transparent text-white hover:bg-white/10 transition-colors cursor-pointer drop-shadow-md flex items-center justify-center pointer-events-auto"
      id="movil-inicio-hamburger-btn"
      title="Abrir menú de navegación móvil"
    >
      <Menu className="w-6 h-6 text-white drop-shadow-md" />
      {totalUnreads > 0 && (
        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-950" />
      )}
    </button>
  );
}

export function MovilHamburgerMenu({
  isOpen,
  onClose,
  currentUser,
  totalUnreads = 0,
  onNavigateToTab,
  onRefreshReels,
  onNavigateToShop,
  onNavigateToProfile,
}: MovilHamburgerMenuProps) {
  const handleSelectTab = (tab: NavigationTab) => {
    onClose();
    if (onNavigateToTab) {
      onNavigateToTab(tab);
      return;
    }
    if (tab === "inicio" || tab === "reels") {
      onRefreshReels?.();
      navigateTo("/inicio");
    } else if (tab === "shop") {
      if (onNavigateToShop) onNavigateToShop();
      else navigateTo("/tienda");
    } else if (tab === "messages") {
      navigateTo("/messages");
    } else if (tab === "profile") {
      if (onNavigateToProfile) onNavigateToProfile();
      else navigateTo(getProfilePath(currentUser));
    } else if (tab === "admin") {
      navigateTo("/admin/resumen");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[65] flex justify-start bg-black/25 backdrop-blur-[2px]"
          id="movil-hamburger-drawer-overlay"
          onClick={onClose}
          onWheel={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="w-72 max-w-[82vw] h-full bg-transparent backdrop-blur-md border-r border-white/15 flex flex-col justify-between p-4 shadow-2xl text-white select-none"
            id="movil-hamburger-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div
                className="flex items-center justify-between px-2 pb-4 mb-4 border-b border-white/15"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
              >
                <div
                  className="flex items-center space-x-2.5 cursor-pointer"
                  onClick={() => handleSelectTab("inicio")}
                >
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-lg tracking-tight leading-none bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent drop-shadow-sm">
                      Mall
                    </h2>
                    <span className="text-[10px] font-mono tracking-widest uppercase block mt-0.5 text-white/80 drop-shadow-xs">
                      Menú Móvil
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full bg-transparent hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                  id="close-movil-hamburger-drawer-btn"
                >
                  <X className="w-5 h-5 drop-shadow-sm" />
                </button>
              </div>

              <nav className="space-y-1.5" id="movil-hamburger-nav-links">
                <button
                  type="button"
                  onClick={() => handleSelectTab("inicio")}
                  className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-amber-500/90 text-slate-950 shadow-md shadow-amber-500/20"
                  id="movil-hamburger-nav-inicio"
                >
                  <Play strokeWidth={2.6} className="w-5 h-5 fill-slate-950" />
                  <span className="font-black tracking-wide">Inicio</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("shop")}
                  className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-transparent text-white hover:bg-white/15 drop-shadow-sm"
                  id="movil-hamburger-nav-shop"
                >
                  <ShoppingBag strokeWidth={2.6} className="w-5 h-5" />
                  <span className="font-black tracking-wide">Tienda</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("messages")}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-transparent text-white hover:bg-white/15 drop-shadow-sm"
                  id="movil-hamburger-nav-messages"
                >
                  <div className="flex items-center space-x-3.5">
                    <MessageSquare strokeWidth={2.6} className="w-5 h-5" />
                    <span className="font-black tracking-wide">Mensajes</span>
                  </div>
                  {totalUnreads > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white">
                      {totalUnreads > 9 ? "9+" : totalUnreads}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectTab("profile")}
                  className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-transparent text-white hover:bg-white/15 drop-shadow-sm"
                  id="movil-hamburger-nav-profile"
                >
                  <UserIcon strokeWidth={2.6} className="w-5 h-5" />
                  <span className="font-black tracking-wide">
                    {isGuestUser(currentUser) ? "Mi Perfil (Registrarse)" : "Perfil"}
                  </span>
                </button>

                {isSuperAdmin(currentUser) && (
                  <button
                    type="button"
                    onClick={() => handleSelectTab("admin")}
                    className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer bg-transparent text-white hover:bg-white/15 drop-shadow-sm"
                    id="movil-hamburger-nav-admin"
                  >
                    <ShieldCheck strokeWidth={2.6} className="w-5 h-5" />
                    <span className="font-black tracking-wide">Admin</span>
                  </button>
                )}
              </nav>
            </div>

            <div
              className="pt-4 border-t border-white/15"
              style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
            >
              <div
                onClick={() => handleSelectTab("profile")}
                className="flex items-center space-x-3 p-2.5 rounded-2xl border border-white/15 bg-transparent hover:bg-white/10 transition-all cursor-pointer group"
              >
                <img
                  src={currentUser?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                  alt={currentUser?.name || "Usuario"}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-amber-500/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate text-white group-hover:text-amber-400 transition-colors drop-shadow-xs">
                    {currentUser?.name || "Invitado"}
                  </p>
                  <p className="text-[10px] truncate font-mono text-white/75 drop-shadow-xs">
                    @{currentUser?.username || "invitado"}
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
