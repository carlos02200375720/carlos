import React, { useState } from "react";
import { Lock, UserPlus, LogIn, X, AlertCircle, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { User } from "../../../types";
import { androidApiFetch } from "../api";
import { motion, AnimatePresence } from "motion/react";
import { safeStorage } from "../../../utils/safeStorage";

interface AndroidAuthModalProps {
  isOpen: boolean;
  actionDescription?: string;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export function AndroidAuthModal({
  isOpen,
  actionDescription = "interactuar en la aplicación",
  onClose,
  onLoginSuccess,
}: AndroidAuthModalProps) {
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

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!regName.trim() || !regUsername.trim()) {
      setRegError("El nombre y usuario son requeridos.");
      return;
    }

    if (!regEmail.trim() || !regEmail.includes("@")) {
      setRegError("Ingresa un correo electrónico válido.");
      return;
    }

    if (!regPassword.trim()) {
      setRegError("Por favor define una contraseña.");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await androidApiFetch("/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: regUsername.trim(),
          password: regPassword,
          name: regName.trim(),
          email: regEmail.trim(),
          isNewRegistration: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setRegError(data.error || "No se pudo crear la cuenta en Android.");
        setIsRegistering(false);
      } else if (data.success && data.user) {
        safeStorage.setItem("isLoggedIn", "true");
        safeStorage.setItem("loggedInUsername", data.user.username);
        safeStorage.setItem("loggedInPassword", regPassword);
        safeStorage.setItem("currentUserData", JSON.stringify(data.user));
        setSuccessMessage("¡Cuenta creada con éxito!");
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setRegError("Error de conexión al servidor de Android.");
      setIsRegistering(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginInput.trim()) {
      setLoginError("Ingresa tu nombre de usuario.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await androidApiFetch("/users/current/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUsername: loginInput.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || "Credenciales incorrectas.");
        setIsLoggingIn(false);
      } else if (data.success && data.user) {
        safeStorage.setItem("isLoggedIn", "true");
        safeStorage.setItem("loggedInUsername", data.user.username);
        if (loginPassword) safeStorage.setItem("loggedInPassword", loginPassword);
        safeStorage.setItem("currentUserData", JSON.stringify(data.user));
        setSuccessMessage("¡Bienvenido!");
        setTimeout(() => {
          onLoginSuccess(data.user);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setLoginError("Error de conexión con el servidor.");
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="android-auth-modal">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-amber-500 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Android Session</span>
        </div>

        <h3 className="text-xl font-bold text-white mb-1">
          {activeTab === "register" ? "Crear Cuenta" : "Iniciar Sesión"}
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Regístrate o accede para {actionDescription}.
        </p>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-800 rounded-xl mb-5">
          <button
            onClick={() => { setActiveTab("register"); setRegError(""); setLoginError(""); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "register" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400"
            }`}
          >
            Registrarse
          </button>
          <button
            onClick={() => { setActiveTab("login"); setRegError(""); setLoginError(""); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "login" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400"
            }`}
          >
            Entrar
          </button>
        </div>

        {successMessage && (
          <div className="flex items-center space-x-2 p-3 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {activeTab === "register" ? (
          <form onSubmit={handleRegister} className="space-y-3">
            {regError && (
              <div className="flex items-center space-x-2 p-2.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}
            <div>
              <input
                type="text"
                placeholder="Nombre completo"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Nombre de usuario (@usuario)"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <input
                type="email"
                placeholder="Correo electrónico"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Contraseña"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isRegistering}
              className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              {isRegistering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Completar Registro</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            {loginError && (
              <div className="flex items-center space-x-2 p-2.5 bg-rose-500/20 text-rose-300 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <div>
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Contraseña (opcional si no configurada)"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-sm shadow-md hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar a mi Cuenta</span>
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
