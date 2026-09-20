import React from "react";
import { Play, ShoppingBag, User as UserIcon, MessageSquare, Sparkles, ShieldCheck } from "lucide-react";
import { User, NavigationTab } from "../../types";
import { navigateTo } from "../../router";

export interface WebSidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  currentUser: User;
  totalUnreads: number;
  selectedCreatorProfileId: string | null;
  setSelectedCreatorProfileId: (creatorId: string | null) => void;
  refreshReels: () => void;
}

export default function WebSidebar({
  activeTab,
  setActiveTab,
  currentUser,
  totalUnreads,
  selectedCreatorProfileId,
  setSelectedCreatorProfileId,
  refreshReels
}: WebSidebarProps) {
  const isDarkNavActive = activeTab === 'reels';

  return (
    <>
    <aside
      className={`hidden md:flex flex-col justify-between w-60 lg:w-64 fixed left-0 top-0 bottom-0 z-40 border-r p-4 select-none transition-colors duration-200 ${
        isDarkNavActive
          ? "bg-slate-950/95 border-slate-800/80 text-white backdrop-blur-md"
          : "bg-white/95 border-slate-200 text-slate-900 backdrop-blur-md"
      }`}
      id="desktop-web-sidebar"
    >
      <div>
        {/* Brand / Logo */}
        <div
          className="flex items-center space-x-2.5 px-3 py-3 mb-6 cursor-pointer group"
          onClick={() => { refreshReels(); setActiveTab('reels'); navigateTo('/'); }}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-all">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display font-black text-xl tracking-tight leading-none bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
              Mall
            </h1>
            <span className={`text-[10px] font-mono tracking-widest uppercase block mt-0.5 ${
              isDarkNavActive ? "text-slate-400" : "text-slate-500"
            }`}>
              Web Platform
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="space-y-1.5" id="web-sidebar-navigation">
          {/* 1. Reels */}
          <button
            onClick={() => { refreshReels(); setActiveTab('reels'); navigateTo('/'); }}
            className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'reels'
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : isDarkNavActive
                ? "text-slate-400 hover:text-white hover:bg-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="web-nav-reels"
          >
            <Play strokeWidth={2.6} className={`w-5 h-5 ${activeTab === 'reels' ? "fill-slate-950" : ""}`} />
            <span className="font-black tracking-wide">Reels & Videos</span>
          </button>

          {/* 2. Tienda */}
          <button
            onClick={() => { setActiveTab('shop'); navigateTo('/shop'); }}
            className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'shop'
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : isDarkNavActive
                ? "text-slate-400 hover:text-white hover:bg-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="web-nav-shop"
          >
            <ShoppingBag strokeWidth={2.6} className={`w-5 h-5 ${activeTab === 'shop' ? "fill-slate-950" : ""}`} />
            <span className="font-black tracking-wide">Tienda Oficial</span>
          </button>

          {/* 3. Mensajes */}
          <button
            onClick={() => { setActiveTab('messages'); navigateTo('/messages'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'messages'
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : isDarkNavActive
                ? "text-slate-400 hover:text-white hover:bg-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="web-nav-messages"
          >
            <div className="flex items-center space-x-3.5">
              <MessageSquare strokeWidth={2.6} className={`w-5 h-5 ${activeTab === 'messages' ? "fill-slate-950" : ""}`} />
              <span className="font-black tracking-wide">Mensajes</span>
            </div>
            {totalUnreads > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
                activeTab === 'messages' ? "bg-slate-950 text-amber-400" : "bg-rose-500 text-white"
              }`}>
                {totalUnreads}
              </span>
            )}
          </button>

          {/* 4. Perfil */}
          <button
            onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); navigateTo('/profile'); }}
            className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'profile' && selectedCreatorProfileId === null
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : isDarkNavActive
                ? "text-slate-400 hover:text-white hover:bg-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="web-nav-profile"
          >
            <UserIcon strokeWidth={2.6} className="w-5 h-5" />
            <span className="font-black tracking-wide">
              {currentUser.username === "invitado" ? "Registro / Cuenta" : "Dashboard / Perfil"}
            </span>
          </button>

          {/* 5. Panel de Administración */}
          <button
            onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('admin'); navigateTo('/admin'); }}
            className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl font-black text-xs transition-all cursor-pointer ${
              activeTab === 'admin'
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                : isDarkNavActive
                ? "text-slate-400 hover:text-white hover:bg-slate-900"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="web-nav-admin"
          >
            <ShieldCheck strokeWidth={2.6} className={`w-5 h-5 ${activeTab === 'admin' ? "text-slate-950" : ""}`} />
            <span className="font-black tracking-wide">Panel Admin</span>
          </button>
        </nav>
      </div>

      {/* Desktop Web Footer Profile Card */}
      <div className={`pt-4 border-t ${isDarkNavActive ? "border-slate-800/80" : "border-slate-200"}`}>
        <div
          onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); navigateTo('/profile'); }}
          className={`flex items-center space-x-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
            isDarkNavActive
              ? "bg-slate-900/80 hover:bg-slate-900 border-slate-800/80"
              : "bg-slate-50 hover:bg-slate-100 border-slate-200"
          }`}
        >
          <img
            src={currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border border-amber-500/40 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-bold truncate group-hover:text-amber-500 transition-colors ${
              isDarkNavActive ? "text-white" : "text-slate-900"
            }`}>
              {currentUser.name}
            </p>
            <p className={`text-[10px] truncate font-mono ${
              isDarkNavActive ? "text-slate-400" : "text-slate-500"
            }`}>
              @{currentUser.username || "invitado"}
            </p>
          </div>
        </div>
      </div>
    </aside>

    {/* Mobile Web Bottom Navigation Bar */}
    <nav
      className={`flex md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t px-4 items-center justify-around select-none backdrop-blur-lg ${
        isDarkNavActive
          ? "bg-slate-950/95 border-slate-800/80 text-white"
          : "bg-white/95 border-slate-200 text-slate-900"
      }`}
      id="mobile-web-bottom-nav"
    >
      <button
        onClick={() => { refreshReels(); setActiveTab('reels'); navigateTo('/'); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'reels' ? "text-amber-500" : isDarkNavActive ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <Play strokeWidth={2.4} className={`w-5 h-5 ${activeTab === 'reels' ? "fill-amber-500" : ""}`} />
        <span className="text-[10px] font-bold mt-1">Reels</span>
      </button>

      <button
        onClick={() => { setActiveTab('shop'); navigateTo('/shop'); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'shop' ? "text-amber-500" : isDarkNavActive ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <ShoppingBag strokeWidth={2.4} className={`w-5 h-5 ${activeTab === 'shop' ? "fill-amber-500" : ""}`} />
        <span className="text-[10px] font-bold mt-1">Tienda</span>
      </button>

      <button
        onClick={() => { setActiveTab('messages'); navigateTo('/messages'); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
          activeTab === 'messages' ? "text-amber-500" : isDarkNavActive ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <div className="relative">
          <MessageSquare strokeWidth={2.4} className={`w-5 h-5 ${activeTab === 'messages' ? "fill-amber-500" : ""}`} />
          {totalUnreads > 0 && (
            <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {totalUnreads > 9 ? "9+" : totalUnreads}
            </span>
          )}
        </div>
        <span className="text-[10px] font-bold mt-1">Mensajes</span>
      </button>

      <button
        onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); navigateTo('/profile'); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'profile' ? "text-amber-500" : isDarkNavActive ? "text-slate-400" : "text-slate-500"
        }`}
      >
        <img
          src={currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
          alt={currentUser.name}
          referrerPolicy="no-referrer"
          className={`w-6 h-6 rounded-full object-cover border ${
            activeTab === 'profile' ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-400/40"
          }`}
        />
        <span className="text-[10px] font-bold mt-1">Perfil</span>
      </button>

      <button
        onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('admin'); navigateTo('/admin'); }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          activeTab === 'admin' ? "text-amber-500" : isDarkNavActive ? "text-slate-400" : "text-slate-500"
        }`}
        id="mobile-nav-admin"
      >
        <ShieldCheck strokeWidth={2.4} className={`w-5 h-5 ${activeTab === 'admin' ? "text-amber-500" : ""}`} />
        <span className="text-[10px] font-bold mt-1">Admin</span>
      </button>
    </nav>
    </>
  );
}
