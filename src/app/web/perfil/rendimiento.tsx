import React from "react";
import { BarChart3, Eye, Heart, MessageCircle } from "lucide-react";
import { motion } from "motion/react";
import { Reel, Product } from "../../../types";

export interface RendimientoPerfilViewProps {
  userReels?: Reel[];
  userProducts?: Product[];
}

export default function RendimientoPerfilView({
  userReels = [],
  userProducts = [],
}: RendimientoPerfilViewProps) {
  return (
    <motion.div
      key="admin-performance"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2">
        <BarChart3 className="w-4 h-4 text-amber-500" />
        <span>Rendimiento de Mis Publicaciones (Views / Likes)</span>
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Views count */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Visualizaciones
            </span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">
              14,750
            </span>
          </div>
        </div>

        {/* Likes count */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Likes Recibidos
            </span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">
              4,457
            </span>
          </div>
        </div>

        {/* Comments count */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center space-x-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Comentarios
            </span>
            <span className="text-lg font-extrabold text-slate-900 font-mono">
              92
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export { RendimientoPerfilView as Rendimiento };
