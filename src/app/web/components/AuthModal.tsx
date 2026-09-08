import React, { useState } from "react";
import { Lock, UserPlus, LogIn, X, AlertCircle, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { User } from "../../../types";
import { apiFetch } from "../../../config";
import { motion, AnimatePresence } from "motion/react";
import { safeStorage } from "../../../utils/safeStorage";

interface AuthModalProps {
  isOpen: boolean;
  actionDescription?: string;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export function AuthModal({
  isOpen,
  actionDescription = "interactuar con las publicaciones",
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"register" | "login">("register");

  // Register state
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Login state
  const [loginInput, setLoginInput] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Success animation state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regName.trim() || !regUsername.trim()) {
      setRegError("El nombre completo y nombre de usuario son obligatorios.");
      return;
    }

    if (!regEmail.trim() || !regEmail.includes("@")) {
      setRegError("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (!regPassword.trim()) {
      setRegError("Por favor define una contraseña.");
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase().replace(/\s+/g, "").replace("@", "");
    if (cleanUsername === "invitado" || cleanUsername === "current_user") {
      setRegError("Nombre de usuario reservado. Elige otro.");
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
          email: regEmail.trim().toLowerCase(),
          bio: "Creador y explorador en la plataforma",
          password: regPassword.trim(),
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        safeStorage.setItem("isLoggedIn", "true");
        safeStorage.setItem("loggedInUsername", cleanUsername);
        safeStorage.setItem("loggedInPassword", regPassword.trim());
        safeStorage.setItem("currentUserData", JSON.stringify(data.user));

        setSuccessMessage(`¡Cuenta creada con éxito! Bienvenido, @${cleanUsername}`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 1000);
      } else {
        setRegError(data.error || "Ocurrió un error al crear la cuenta. Intenta con otro nombre de usuario.");
      }
    } catch (err) {
      console.error("Error al registrarse:", err);
      setRegError("Error de conexión al registrar. Inténtalo nuevamente.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginInput.trim()) {
      setLoginError("Ingresa tu nombre de usuario o correo.");
      return;
    }

    const cleanInput = loginInput.trim().toLowerCase().replace("@", "");
    setIsLoggingIn(true);

    try {
      const response = await apiFetch("/api/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUsername: cleanInput, password: loginPassword }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        safeStorage.setItem("isLoggedIn", "true");
        safeStorage.setItem("loggedInUsername", data.user.username);
        safeStorage.setItem("loggedInPassword", loginPassword || "");
        safeStorage.setItem("currentUserData", JSON.stringify(data.user));

        setSuccessMessage(`¡Bienvenido de vuelta, @${data.user.username}!`);
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 900);
      } else {
        setLoginError(data.error || "Usuario no encontrado o contraseña incorrecta.");
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setLoginError("Error de conexión al iniciar sesión.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      id="force-auth-modal"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl relative overflow-hidden text-left my-auto"
      >
        {/* Glow ambient effects */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer z-10"
          id="close-auth-modal-btn"
          aria-label="Cerrar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge & Title */}
        <div className="flex items-center space-x-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block">
              Registro Obligatorio
            </span>
            <h3 className="text-base sm:text-lg font-bold text-white font-display">
              Regístrate para interactuar
            </h3>
          </div>
        </div>

        <p className="text-slate-300 text-xs mt-1 mb-4 leading-relaxed">
          Para <strong className="text-amber-400 font-bold">{actionDescription}</strong> en las publicaciones y disfrutar de todas las funciones de la comunidad, debes registrar tu perfil.
        </p>

        {/* Success Banner */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center space-x-2.5 text-emerald-300 text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setRegError("");
              setLoginError("");
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "register"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
            id="tab-btn-register"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Crear Cuenta</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              setRegError("");
              setLoginError("");
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
              activeTab === "login"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "text-slate-400 hover:text-white"
            }`}
            id="tab-btn-login"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Iniciar Sesión</span>
          </button>
        </div>

        {/* Forms */}
        {activeTab === "register" ? (
          <form onSubmit={handleRegister} className="space-y-3">
            {regError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Nombre de Usuario
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">@</span>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="usuario"
                  className="w-full text-xs font-medium pl-8 pr-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Crea una contraseña segura"
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full mt-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              id="submit-register-btn"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creando tu cuenta...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Crear Cuenta y Comenzar a Interactuar</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            {loginError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-400 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Usuario o Correo Electrónico
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Tu usuario (@...) o correo"
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-950/60 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-white placeholder-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              id="submit-login-btn"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Iniciar Sesión y Continuar</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer Dismiss / Continue as Viewer */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1"
            id="dismiss-auth-modal-btn"
          >
            Continuar solo viendo contenido (sin interactuar)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
