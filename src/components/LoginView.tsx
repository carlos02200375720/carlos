import React, { useState, useEffect } from "react";
import { User as UserIcon, ShieldCheck, UserPlus, ArrowRight, Sparkles, Check, Play, ShoppingBag, MessageSquare, Radio } from "lucide-react";
import { User } from "../types";
import { apiFetch } from "../config";

interface LoginViewProps {
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

export default function LoginView({ onLoginSuccess, onRefreshUsers, users }: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">(() => {
    const saved = localStorage.getItem("authTab") as "login" | "register";
    return saved || "login";
  });
  
  // Login State
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register State
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regBio, setRegBio] = useState("");
  const [regAvatar, setRegAvatar] = useState("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80");
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
      setLoginError("Por favor ingresa tu nombre de usuario.");
      return;
    }

    const cleanUsername = usernameToUse.trim().toLowerCase().replace("@", "");
    setIsLoggingIn(true);

    try {
      const response = await apiFetch("/api/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername: cleanUsername, password: passwordToUse }),
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loggedInUsername", cleanUsername);
        localStorage.setItem("loggedInPassword", passwordToUse || "");
        localStorage.setItem("currentUserData", JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setLoginError(data.error || "El usuario no existe. Intenta registrándote primero o verifica tu contraseña.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setLoginError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setRegisterError("");

    if (!regName.trim() || !regUsername.trim()) {
      setRegisterError("El nombre completo y nombre de usuario son obligatorios.");
      return;
    }

    if (!regEmail.trim()) {
      setRegisterError("El correo electrónico es obligatorio.");
      return;
    }

    if (!regPassword.trim()) {
      setRegisterError("La contraseña es obligatoria.");
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase().replace(/\s+/g, "").replace("@", "");
    if (cleanUsername === "invitado" || cleanUsername === "current_user") {
      setRegisterError("Nombre de usuario reservado. Elige otro.");
      return;
    }

    setIsRegistering(true);

    try {
      const response = await apiFetch("/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName.trim(),
          username: cleanUsername,
          email: regEmail.trim(),
          bio: regBio.trim() || "Creador en la plataforma",
          avatar: regAvatar,
          coverPhoto: regCoverPhoto,
          password: regPassword.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Automatically log in using the returned user session
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("loggedInUsername", cleanUsername);
        localStorage.setItem("loggedInPassword", regPassword.trim());
        localStorage.setItem("currentUserData", JSON.stringify(data.user));
        onRefreshUsers();
        onLoginSuccess(data.user);
      } else {
        setRegisterError(data.error || "Error al registrar el usuario.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setRegisterError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsRegistering(false);
    }
  };

  // Filter out system placeholders or the special 'current_user' shell from the display list
  const displayUsers = users.filter(u => u.id !== "current_user" && u.username !== "invitado");

  return (
    <div className="w-full min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 md:p-8 relative overflow-hidden" id="auth-root-view">
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-rose-500/5 to-slate-950 opacity-90 z-0" />
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl z-0" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-rose-500/10 blur-3xl z-0" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-4xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 min-h-[580px]">
        
        {/* Left Side: Brand Promo Panel */}
        <div className="md:w-5/12 bg-slate-950 p-8 flex flex-col justify-between text-white relative overflow-hidden shrink-0 border-b md:border-b-0 md:border-r border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-rose-500/5 to-slate-950 opacity-80 z-0" />
          
          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center space-x-2.5 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1.5 rounded-full w-fit">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400">Plataforma Social</span>
            </div>
            
            <h1 className="font-display font-black text-2xl mt-6 leading-tight tracking-tight text-white">
              Sintoniza, Chatea, <span className="text-amber-400">Vende</span>
            </h1>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              Únete a la nueva era del comercio interactivo. Comparte reels de tus productos, interactúa en vivo y gestiona tu propio catálogo.
            </p>
          </div>

          {/* Benefits Bullet Points */}
          <div className="space-y-4 my-8 md:my-0 relative z-10">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 shrink-0 border border-amber-500/25">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Reels de Compra Directa</h4>
                <p className="text-[10px] text-slate-400 leading-normal">Vincula tus productos en videos interactivos y vende con un clic.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 shrink-0 border border-amber-500/25">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Catálogo Completo</h4>
                <p className="text-[10px] text-slate-400 leading-normal">Publica en múltiples categorías con soporte multimedia.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 shrink-0 border border-amber-500/25">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Mensajería en Vivo</h4>
                <p className="text-[10px] text-slate-400 leading-normal">Chatea en tiempo real con compradores y otros creadores.</p>
              </div>
            </div>
          </div>


        </div>

        {/* Right Side: Authentication Forms */}
        <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
          <div>
            {/* Tab Swapping Header */}
            <div className="flex border-b border-slate-800 pb-3 mb-6">
              <button
                onClick={() => { setActiveTab("login"); localStorage.setItem("authTab", "login"); setLoginError(""); }}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all mr-2 flex items-center space-x-2 ${
                  activeTab === "login"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
                id="btn-tab-login"
              >
                <span>Iniciar Sesión</span>
              </button>
              <button
                onClick={() => { setActiveTab("register"); localStorage.setItem("authTab", "register"); setRegisterError(""); }}
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
                  activeTab === "register"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
                id="btn-tab-register"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Crear Cuenta</span>
              </button>
            </div>

            {/* TAB CONTENT: LOGIN */}
            {activeTab === "login" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Bienvenido de vuelta</h2>
                  <p className="text-xs text-slate-400 mt-1">Ingresa tu nombre de usuario para acceder a tu perfil y ventas.</p>
                </div>

                <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nombre de usuario</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                      <input
                        type="text"
                        placeholder="tunombre"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl pl-8 pr-4 py-3 text-xs border border-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        id="login-username-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Contraseña</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-3 text-xs border border-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                      id="login-password-input"
                      required
                    />
                  </div>

                  {loginError && (
                    <div className="text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl font-medium">
                      ⚠️ {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/10"
                    id="login-submit-btn"
                  >
                    {isLoggingIn ? (
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Quick login option with existing accounts */}
                {displayUsers.length > 0 && (
                  <div className="pt-4 border-t border-slate-800/60">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cuentas creadas en este servidor:</span>
                    <span className="block text-[9px] text-slate-500 mb-2.5">Haz clic para seleccionar un usuario, luego escribe su contraseña arriba.</span>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                      {displayUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setUsernameInput(user.username);
                            setPasswordInput("");
                            setLoginError("");
                          }}
                          className="flex items-center space-x-2.5 p-2 bg-slate-950/40 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all cursor-pointer"
                        >
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-800"
                          />
                          <div className="min-w-0">
                            <h4 className="text-[11px] font-bold text-slate-200 truncate leading-tight">{user.name}</h4>
                            <p className="text-[9px] text-slate-500 truncate">@{user.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: REGISTER */}
            {activeTab === "register" && (
              <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                <div>
                  <h2 className="text-lg font-extrabold text-white tracking-tight">Comienza como Creador</h2>
                  <p className="text-xs text-slate-400 mt-1">Regístrate para publicar productos, subir reels y chatear.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs border border-slate-800 focus:outline-none focus:border-amber-500"
                      id="reg-name-input"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Correo Electrónico (Obligatorio)</label>
                    <input
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs border border-slate-800 focus:outline-none focus:border-amber-500"
                      id="reg-email-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre de usuario (Único)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">@</span>
                      <input
                        type="text"
                        placeholder="juanperez"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl pl-8 pr-4 py-2.5 text-xs border border-slate-800 focus:outline-none focus:border-amber-500"
                        id="reg-username-input"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contraseña de Perfil</label>
                    <input
                      type="password"
                      placeholder="Crea una contraseña segura"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs border border-slate-800 focus:outline-none focus:border-amber-500"
                      id="reg-password-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Biografía de Ventas</label>
                    <textarea
                      placeholder="Cuéntanos qué vendes o qué tipo de contenido creas..."
                      rows={2}
                      value={regBio}
                      onChange={(e) => setRegBio(e.target.value)}
                      className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 rounded-xl px-4 py-2.5 text-xs border border-slate-800 focus:outline-none focus:border-amber-500 resize-none"
                      id="reg-bio-input"
                    />
                  </div>

                  {/* Cover Photo Picker */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Banner de Perfil</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_COVERS.map((cover, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRegCoverPhoto(cover)}
                          className={`relative h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            regCoverPhoto === cover ? "border-amber-500 scale-102" : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <img src={cover} alt="Preset cover" className="w-full h-full object-cover" />
                          {regCoverPhoto === cover && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {registerError && (
                    <div className="text-[11px] text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl font-medium">
                      ⚠️ {registerError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-800 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg"
                    id="register-submit-btn"
                  >
                    {isRegistering ? (
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
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
