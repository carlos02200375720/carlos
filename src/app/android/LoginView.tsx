import React, { useState, useEffect } from "react";
import { User as UserIcon, ShieldCheck, UserPlus, ArrowRight, Sparkles, Check, Smartphone, LogIn, Lock, AlertCircle, Loader2 } from "lucide-react";
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
          bio: regBio.trim(),
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
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setRegisterError("Error de conexión al servidor de Android.");
      setIsRegistering(false);
    }
  };

  const registeredUsers = users.filter((u) => u.username !== "invitado" && !u.isGuest);

  return (
    <div className="w-full min-h-screen bg-white text-slate-900 flex flex-col p-4 font-sans select-none pb-24" id="android-login-view">
      {/* Top Android Header */}
      <div className="w-full flex items-center justify-between py-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5 text-amber-500" />
          <span className="font-bold text-sm text-slate-900">MallSocial · Android</span>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
          Iniciar Sesión
        </span>
      </div>

      <div className="max-w-md mx-auto w-full flex-1 flex flex-col justify-center py-6">
        {/* Android Material Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-6">
          <button
            onClick={() => { setActiveTab("login");  setLoginError(""); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "login" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => { setActiveTab("register");  setRegisterError(""); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === "register" ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {activeTab === "login" ? (
          <div className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Usuario</label>
                <input
                  type="text"
                  placeholder="Tu nombre de usuario"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña</label>
                <input
                  type="password"
                  placeholder="Tu contraseña"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-sm shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Acceder a Android</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Switch Profiles on Android */}
            {registeredUsers.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-3">Cuentas disponibles en este servidor:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {registeredUsers.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleLogin(null as any, u.username, "")}
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center space-x-3">
                        <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-amber-500/50" />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-amber-600 font-semibold">@{u.username}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {registerError && (
              <div className="flex items-center space-x-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{registerError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre Completo</label>
              <input
                type="text"
                placeholder="Ej. Ana Martínez"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre de Usuario</label>
              <input
                type="text"
                placeholder="Ej. anam"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Correo Electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                placeholder="Crea una contraseña"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Biografía</label>
              <input
                type="text"
                placeholder="Tu descripción corta"
                value={regBio}
                onChange={(e) => setRegBio(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Avatar Preset Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Avatar predeterminado</label>
              <div className="flex space-x-3">
                {PRESET_AVATARS.map((av, idx) => (
                  <img
                    key={idx}
                    src={av}
                    alt={`Avatar ${idx}`}
                    onClick={() => setRegAvatar(av)}
                    className={`w-12 h-12 rounded-full object-cover cursor-pointer border-2 transition-all ${
                      regAvatar === av ? "border-amber-500 scale-105 shadow-sm" : "border-slate-200 opacity-60"
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className="w-full mt-4 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-2xl text-sm shadow-md hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isRegistering ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Registrar Cuenta en Android</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
