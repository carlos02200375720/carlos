import React, { useState, useEffect } from "react";
import { User as UserIcon, ShieldCheck, UserPlus, ArrowRight, Sparkles, Check, Play, ShoppingBag, MessageSquare, AlertCircle, Loader2 } from "lucide-react";
import { User } from "../../types";
import { androidApiFetch } from "./api";
import { sessionState } from "../../utils/sessionState";

export interface AndroidLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onRefreshUsers: () => void;
  users: User[];
}

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
];

const PRESET_COVERS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80",
];

export default function AndroidLoginView({ onLoginSuccess, onRefreshUsers, users }: AndroidLoginViewProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">(() => {
    return "login";
  });

  // Login form state
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register form state
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState(PRESET_AVATARS[0]);
  const [regCoverPhoto, setRegCoverPhoto] = useState(PRESET_COVERS[0]);
  const [registerError, setRegisterError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    onRefreshUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent, targetUsername?: string, targetPassword?: string) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;
    setLoginError("");

    const usernameToUse = targetUsername || usernameInput;
    const passwordToUse = targetPassword !== undefined ? targetPassword : passwordInput;

    if (!usernameToUse.trim()) {
      setLoginError("Por favor, ingresa tu usuario.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await androidApiFetch("/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: usernameToUse.trim(),
          password: passwordToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || "No se pudo iniciar sesión en Android.");
        setIsLoggingIn(false);
      } else if (data.success && data.user) {
        sessionState.setAuthenticated(true);
        sessionState.setUsername(data.user.username);
        if (passwordToUse) 
        sessionState.setUser(data.user);
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setLoginError("Error de conexión al servidor de Android.");
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setRegisterError("");

    if (!regName.trim() || !regUsername.trim()) {
      setRegisterError("Nombre y usuario son obligatorios.");
      return;
    }

    if (!regEmail.trim() || !regEmail.includes("@")) {
      setRegisterError("Ingresa un correo electrónico válido.");
      return;
    }

    if (!regPassword.trim()) {
      setRegisterError("Por favor define una contraseña.");
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase().replace(/\s+/g, "").replace(/^@/, "");
    if (cleanUsername === "invitado" || cleanUsername === "current_user" || cleanUsername === "usuario_actual") {
      setRegisterError("Nombre de usuario reservado. Elige otro.");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await androidApiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          targetUsername: cleanUsername,
          password: regPassword.trim(),
          name: regName.trim(),
          email: regEmail.trim(),
          bio: regBio.trim() || "Creador en la plataforma",
          avatar: regAvatar,
          coverPhoto: regCoverPhoto,
          isNewRegistration: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setRegisterError(data.error || "Error al crear la cuenta en Android.");
        setIsRegistering(false);
      } else if (data.success && data.user) {
        sessionState.setAuthenticated(true);
        sessionState.setUsername(data.user.username);
        sessionState.setUser(data.user);
        onRefreshUsers();
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setRegisterError("Error de conexión al servidor de Android.");
    } finally {
      setIsRegistering(false);
    }
  };

  const registeredUsers = users.filter((u) => u.id !== "current_user" && u.username !== "invitado" && !u.isGuest);

  return (
    <div
      className="w-full min-h-screen bg-white text-slate-900 flex flex-col px-3 pt-3 pb-24 font-sans select-none overflow-x-hidden no-scrollbar"
      id="android-login-view"
      style={{
        paddingTop: "max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))",
      }}
    >
      <div className="max-w-md mx-auto w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden flex flex-col">
        {/* Top Brand Promo Header (matching Web LoginView style) */}
        <div className="bg-slate-50 p-5 flex flex-col justify-between text-slate-900 relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-amber-100/20 to-white opacity-90 z-0" />

          <div className="relative z-10">
            <div className="flex items-center space-x-2 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-700">
                Plataforma Social
              </span>
            </div>

            <h1 className="font-display font-black text-xl mt-3.5 leading-tight tracking-tight text-slate-900">
              Sintoniza, Chatea, <span className="text-amber-500">Vende</span>
            </h1>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Únete a la nueva era del comercio interactivo. Comparte reels de tus productos, interactúa en vivo y gestiona tu propio catálogo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 relative z-10">
            <div className="flex items-center space-x-1.5 bg-white/90 border border-slate-200/80 rounded-xl p-2">
              <div className="p-1 bg-amber-500/15 rounded-lg text-amber-600 shrink-0 border border-amber-500/25">
                <Play className="w-3 h-3 fill-current" />
              </div>
              <span className="text-[10px] font-bold text-slate-800 leading-tight">Reels de Compra</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-white/90 border border-slate-200/80 rounded-xl p-2">
              <div className="p-1 bg-amber-500/15 rounded-lg text-amber-600 shrink-0 border border-amber-500/25">
                <ShoppingBag className="w-3 h-3" />
              </div>
              <span className="text-[10px] font-bold text-slate-800 leading-tight">Catálogo Propio</span>
            </div>
            <div className="flex items-center space-x-1.5 bg-white/90 border border-slate-200/80 rounded-xl p-2">
              <div className="p-1 bg-amber-500/15 rounded-lg text-amber-600 shrink-0 border border-amber-500/25">
                <MessageSquare className="w-3 h-3" />
              </div>
              <span className="text-[10px] font-bold text-slate-800 leading-tight">Chat en Vivo</span>
            </div>
          </div>
        </div>

        {/* Forms Section */}
        <div className="p-5 bg-white flex-1 flex flex-col justify-between">
          <div>
            {/* Tab Swapping Header */}
            <div className="flex border-b border-slate-200 pb-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setLoginError("");
                }}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all mr-2 flex items-center space-x-2 cursor-pointer ${
                  activeTab === "login"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>Iniciar Sesión</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("register");
                  setRegisterError("");
                }}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center space-x-2 cursor-pointer ${
                  activeTab === "register"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Crear Cuenta</span>
              </button>
            </div>

            {activeTab === "login" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Bienvenido de vuelta</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Ingresa tu nombre de usuario para acceder a tu perfil y ventas.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Nombre de usuario
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                      <input
                        type="text"
                        placeholder="tunombre"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl pl-8 pr-4 py-3 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    />
                  </div>

                  {loginError && (
                    <div className="flex items-center space-x-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-amber-500/15 active:scale-[0.98]"
                  >
                    {isLoggingIn ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick Switch Profiles */}
                {registeredUsers.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cuentas creadas en este servidor:
                    </span>
                    <span className="block text-[9px] text-slate-400 mb-2.5">
                      Haz clic para seleccionar un usuario, luego escribe su contraseña arriba.
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                      {registeredUsers.map((u, uIdx) => (
                        <button
                          key={`${u.id}-${uIdx}`}
                          type="button"
                          onClick={() => {
                            setUsernameInput(u.username);
                            setPasswordInput("");
                            setLoginError("");
                          }}
                          className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition-all cursor-pointer"
                        >
                          <img
                            src={u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-[11px] font-bold text-slate-900 truncate leading-tight">{u.name}</h4>
                            <p className="text-[9px] text-amber-600 font-semibold truncate">@{u.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 pb-2">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Comienza como Creador</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Regístrate para publicar productos, subir reels y chatear.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Correo Electrónico (Obligatorio)
                    </label>
                    <input
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Nombre de usuario (Único)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">@</span>
                      <input
                        type="text"
                        placeholder="juanperez"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl pl-8 pr-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Contraseña de Perfil
                    </label>
                    <input
                      type="password"
                      placeholder="Crea una contraseña segura"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Biografía de Ventas
                    </label>
                    <textarea
                      placeholder="Cuéntanos qué vendes o qué tipo de contenido creas..."
                      rows={2}
                      value={regBio}
                      onChange={(e) => setRegBio(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 resize-none transition-colors"
                    />
                  </div>

                  {/* Avatar Preset Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Avatar Predeterminado
                    </label>
                    <div className="flex space-x-2.5">
                      {PRESET_AVATARS.map((av, idx) => (
                        <img
                          key={idx}
                          src={av}
                          alt={`Avatar ${idx}`}
                          onClick={() => setRegAvatar(av)}
                          className={`w-10 h-10 rounded-full object-cover cursor-pointer border-2 transition-all ${
                            regAvatar === av ? "border-amber-500 scale-105 shadow-xs" : "border-slate-200 opacity-70"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Cover Photo Picker */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Banner de Perfil
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_COVERS.map((cover, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRegCoverPhoto(cover)}
                          className={`relative h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            regCoverPhoto === cover ? "border-amber-500 scale-102" : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <img src={cover} alt="Preset cover" className="w-full h-full object-cover" />
                          {regCoverPhoto === cover && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {registerError && (
                    <div className="flex items-center space-x-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{registerError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md shadow-amber-500/15 active:scale-[0.98]"
                  >
                    {isRegistering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Registrar y Entrar</span>
                        <Sparkles className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
