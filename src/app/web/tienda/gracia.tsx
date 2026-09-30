import React from "react";
import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Order, User } from "../../../types";

export interface GraciaTiendaViewProps {
  completedOrder: Order | null;
  onLoginSuccess?: (user: User) => void;
  onContinueShopping: () => void;
  onViewOrderHistory: () => void;
}

export function GraciaTiendaView({
  completedOrder,
  onLoginSuccess,
  onContinueShopping,
  onViewOrderHistory,
}: GraciaTiendaViewProps) {
  return (
    <div className="w-full px-2 sm:px-4 py-2 pb-20 md:pb-6">
      <motion.div
        key="thankyou"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-lg mx-auto bg-white p-4 sm:p-6 rounded-2xl text-center"
      >
        <CheckCircle2 className="w-14 h-14 sm:w-16 sm:h-16 text-emerald-500 mx-auto animate-bounce" />
        <h2 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 mt-3">
          ¡Muchas Gracias por su Compra!
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          El vendedor ha verificado la transacción correctamente.
        </p>

        {/* Resumen de Productos Comprados */}
        {completedOrder?.items && completedOrder.items.length > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 mt-5 text-left">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              Productos Comprados (
              {completedOrder.items.reduce((sum, item) => sum + item.quantity, 0)})
            </span>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {completedOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border border-slate-100 shadow-2xs"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-md object-cover shrink-0 bg-slate-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>
                        Cant:{" "}
                        <strong className="text-slate-800 font-semibold">{item.quantity}</strong>
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalle de Pedido y Dirección Completa */}
        {completedOrder && (
          <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 mt-3 text-left space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Código de Pedido:</span>
              <span className="font-mono font-bold text-slate-800">{completedOrder.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Fecha:</span>
              <span className="font-mono text-slate-700">
                {new Date(completedOrder.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="border-b border-slate-200/60 pb-2.5">
              <span className="text-slate-500 font-medium block mb-1">
                Dirección de Envío Completa:
              </span>
              <p className="text-slate-800 font-medium text-xs leading-relaxed break-words whitespace-normal">
                {completedOrder.shippingAddress}
              </p>
            </div>
            <div className="flex justify-between text-sm font-bold pt-0.5">
              <span>Total Cargado:</span>
              <span className="text-emerald-600 font-mono text-base">
                ${completedOrder.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Auto-Created User Profile Card for Guest Checkout */}
        {completedOrder?.autoCreatedUser && completedOrder.autoCreatedUser.created && (
          <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-slate-50 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 mt-4 text-left shadow-sm">
            <div className="flex items-center space-x-2 text-amber-600 font-extrabold text-xs uppercase tracking-wider mb-2">
              <span className="text-base">🎉</span>
              <span>¡Cuenta Creada Automáticamente!</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Como eres un comprador nuevo, registramos automáticamente tu perfil con tu correo{" "}
              <strong className="text-slate-900 font-bold">
                {completedOrder.autoCreatedUser.email}
              </strong>
              .
            </p>
            <div className="bg-white rounded-xl p-3 border border-amber-200/60 my-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Usuario asignado:</span>
                <span className="font-bold text-slate-900 font-mono">
                  @{completedOrder.autoCreatedUser.username}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Contraseña enviada a tu correo:</span>
                <span className="font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200 font-mono text-sm tracking-wider">
                  {completedOrder.autoCreatedUser.tempPassword}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-slate-600 leading-relaxed mb-3.5">
              <p className="font-bold text-slate-800 mb-0.5">🔒 Notificación de Seguridad:</p>
              Te enviamos los datos de acceso a tu correo. Te recomendamos iniciar sesión para
              hacer el seguimiento de tus pedidos y actualizar tu contraseña por una más segura en
              tu perfil.
            </div>
            {completedOrder.autoCreatedUser.user && (
              <button
                type="button"
                onClick={() => {
                  if (onLoginSuccess && completedOrder.autoCreatedUser?.user) {
                    onLoginSuccess(completedOrder.autoCreatedUser.user);
                  }
                }}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow transition-all flex items-center justify-center space-x-2 cursor-pointer"
                id="activate-auto-user-btn"
              >
                <span>Iniciar Sesión con esta Cuenta Ahora</span>
              </button>
            )}
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pt-1.5 pb-[1px] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] mt-0 flex space-x-3 md:static md:z-auto md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:shadow-none md:mt-6">
          <button
            onClick={onContinueShopping}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Seguir Comprando
          </button>
          <button
            type="button"
            id="thankyou-order-history-btn"
            onClick={onViewOrderHistory}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Historial de Pedidos
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export const Gracia = GraciaTiendaView;
export default GraciaTiendaView;
