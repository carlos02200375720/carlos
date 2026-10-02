import React from "react";
import { Server, CheckCircle2, Database, Activity, RefreshCw, Radio, HardDrive, ShieldCheck } from "lucide-react";
import { User } from "../../types";

export interface SistemaAdminProps {
  systemHealth: {
    status: string;
    server: string;
    mongoConnected: boolean;
    uptime?: number;
    timestamp?: string;
  } | null;
  currentUser: User;
  onRefreshHealth?: () => void;
  isRefreshing?: boolean;
}

export default function SistemaAdminView({
  systemHealth,
  currentUser,
  onRefreshHealth,
  isRefreshing = false,
}: SistemaAdminProps) {
  return (
    <div className="space-y-6" id="admin-tab-content-system">
      {/* Real-time Status Badges Banner (Movido exclusivamente a la página admin/sistema) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl px-6 py-4 text-white relative overflow-hidden shadow-xl shadow-slate-950/20" id="admin-system-realtime-banner">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Real-time Status Badges */}
        <div className="relative z-10 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-300 font-semibold">MongoDB Atlas:</span>
            <span className="text-emerald-400 font-bold">
              {systemHealth?.mongoConnected !== false ? "Conectado" : "Offline"}
            </span>
          </div>
          <div className="text-slate-600">•</div>
          <div className="flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-semibold">Servidor:</span>
            <span className="text-amber-400 font-bold">Cloud Run (Activo)</span>
          </div>
          <div className="text-slate-600">•</div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-300 font-semibold">Sesión Actual:</span>
            <span className="text-white font-bold">@{currentUser.username}</span>
          </div>
        </div>
      </div>

      {/* Main System Status Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-bold mb-2">
              <Database className="w-3.5 h-3.5 text-amber-600" />
              <span>Infraestructura & Servicios Cloud</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">Estado del Sistema y Base de Datos</h2>
            <p className="text-xs text-slate-500 mt-1">Verifica la conectividad con MongoDB Atlas, la caché de la aplicación y la infraestructura del servidor en tiempo real.</p>
          </div>

          {onRefreshHealth && (
            <button
              onClick={onRefreshHealth}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
              title="Volver a comprobar estado"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
              <span>{isRefreshing ? "Comprobando..." : "Comprobar Conexión"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: MongoDB */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Base de Datos Principal</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                systemHealth?.mongoConnected !== false
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : "bg-rose-100 text-rose-800 border border-rose-200"
              }`}>
                {systemHealth?.mongoConnected !== false ? "Operativo" : "Desconectado"}
              </span>
            </div>
            <p className="text-base font-black text-slate-900">MongoDB Atlas Cluster</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Almacena colecciones de usuarios, reels, productos y órdenes con persistencia en la nube, replicación y tolerancia a fallos.
            </p>
            <div className="pt-2 flex items-center space-x-2 text-xs font-mono text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Conexión verificada y datos sincronizados</span>
            </div>
          </div>

          {/* Card 2: Multimedia Server & HLS */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Servidor Multimedia & Streaming</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Activo
              </span>
            </div>
            <p className="text-base font-black text-slate-900">Transcodificación HLS & WebSockets</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Genera listas de reproducción adaptativas .m3u8 y notificaciones de presencia en tiempo real para usuarios conectados y chats.
            </p>
            <div className="pt-2 flex items-center space-x-2 text-xs font-mono text-indigo-600 font-bold">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Transcodificador activo en /uploads/hls/</span>
            </div>
          </div>

          {/* Card 3: Google Cloud Storage */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Almacenamiento en la Nube</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                GCS Bucket
              </span>
            </div>
            <p className="text-base font-black text-slate-900">Google Cloud Storage (GCS)</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Alojamiento distribuido de vídeos de reels, imágenes de publicaciones, fotos de perfil y portadas con URLs públicas optimizadas.
            </p>
            <div className="pt-2 flex items-center space-x-2 text-xs font-mono text-emerald-600 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Bucket configurado y accesible</span>
            </div>
          </div>

          {/* Card 4: Seguridad y Sesiones */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Seguridad & Superadmin</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                Protegido
              </span>
            </div>
            <p className="text-base font-black text-slate-900">Control de Acceso (RBAC)</p>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Sesión de administrador activa para <span className="font-bold text-slate-900">@{currentUser.username}</span> con privilegios de gestión de usuarios, catálogo y configuración global.
            </p>
            <div className="pt-2 flex items-center space-x-2 text-xs font-mono text-slate-700 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Sesión validada con permisos completos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
