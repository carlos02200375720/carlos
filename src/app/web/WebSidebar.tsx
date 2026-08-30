import React from "react";
import { Play, ShoppingBag, User as UserIcon, MessageSquare, Sparkles } from "lucide-react";
import { User } from "../../types";

export interface WebSidebarProps {
  activeTab: 'reels' | 'shop' | 'messages' | 'profile';
  setActiveTab: (tab: 'reels' | 'shop' | 'messages' | 'profile') => void;
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
          onClick={() => { refreshReels(); setActiveTab('reels'); }}
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
            onClick={() => { refreshReels(); setActiveTab('reels'); }}
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
            onClick={() => setActiveTab('shop')}
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
            onClick={() => setActiveTab('messages')}
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
            onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); }}
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
        </nav>
      </div>

      {/* Desktop Web Footer Profile Card */}
      <div className={`pt-4 border-t ${isDarkNavActive ? "border-slate-800/80" : "border-slate-200"}`}>
        <div
          onClick={() => { setSelectedCreatorProfileId(null); setActiveTab('profile'); }}
          className={`flex items-center space-x-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${
            isDarkNavActive
              ? "bg-slate-900/80 hover:bg-slate-900 border-slate-800/80"
              : "bg-slate-50 hover:bg-slate-100 border-slate-200"
          }`}
        >
          <img
            src={currentUser.avatar}
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
  );
}
