import React, { useState, useEffect } from "react";
import { User as UserIcon, ShieldCheck, UserPlus, ArrowRight, Sparkles, Check, Play, ShoppingBag, MessageSquare, AlertCircle, Loader2, Mail } from "lucide-react";
import { User } from "../../types";
import { androidApiFetch } from "./api";
import { sessionState } from "../../utils/sessionState";

export interface AndroidLoginViewProps {
  onLoginSuccess: (user: User) => void;
  onRefreshUsers: () => void;
  users: User[];
  currentUser?: User | null;
  initialTab?: "login" | "register";
  restrictionNotice?: string;
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

export default function AndroidLoginView({
  onLoginSuccess,
  onRefreshUsers,
  users,
  currentUser,
  initialTab,
  restrictionNotice
}: AndroidLoginViewProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">(() => {
    if (initialTab) return initialTab;
    if (currentUser?.isGuest || currentUser?.username === "invitado") return "register";
    return "login";
  });

  // Login form state: strictly Correo Electrónico and Contraseña
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register form state: strictly Nombre Completo, Correo, Contraseña
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const assignedUsername =
    (currentUser?.username && currentUser.username !== "invitado" && currentUser.username !== "current_user" && currentUser.username !== "usuario_actual")
      ? currentUser.username
      : (sessionState.getUser()?.username && sessionState.getUser()?.username !== "invitado" && sessionState.getUser()?.username !== "current_user")
      ? sessionState.getUser()!.username
      : "";

  useEffect(() => {
    onRefreshUsers();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;
    setLoginError("");

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setLoginError("Por favor, ingresa tu correo electrónico.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setLoginError("Por favor, ingresa un correo electrónico válido.");
      return;
    }

    if (!passwordInput.trim()) {
      setLoginError("Por favor, ingresa tu contraseña.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await androidApiFetch("/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: cleanEmail,
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || "El correo o contraseña no son correctos.");
        setIsLoggingIn(false);
      } else if (data.success && data.user) {
        sessionState.setAuthenticated(true);
        sessionState.setUsername(data.user.username);
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

    if (!regName.trim()) {
      setRegisterError("El nombre completo es obligatorio.");
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

    setIsRegistering(true);
    try {
      const res = await androidApiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: assignedUsername || undefined,
          targetUsername: assignedUsername || undefined,
          password: regPassword.trim(),
          name: regName.trim(),
          email: regEmail.trim(),
          bio: "Miembro de la comunidad",
          avatar: PRESET_AVATARS[0],
          coverPhoto: PRESET_COVERS[0],
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
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Iniciar Sesión</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Ingresa con tu correo electrónico y la contraseña que configuraste al momento del registro.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl pl-11 pr-4 py-3 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Tu contraseña registrada"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-3 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                      required
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
              </div>
            ) : (
              <div className="space-y-4 pb-2">
                {restrictionNotice && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start space-x-2.5 text-amber-950">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Acceso a Perfil Restringido</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                        {restrictionNotice}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Crea tu Cuenta</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Regístrate para acceder a tu perfil, publicaciones guardadas, compras e interacciones.
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
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Crea una contraseña segura"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs border border-slate-200 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>

                  {assignedUsername ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 font-medium">Nombre de usuario asignado:</span>
                      <span className="font-mono font-bold text-amber-600 text-xs">@{assignedUsername}</span>
                    </div>
                  ) : null}
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Podrás personalizar tu nombre de usuario, biografía y foto de perfil en la página de Configuración cuando quieras.
                  </p>

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
                        <span>Crear Cuenta y Continuar</span>
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
