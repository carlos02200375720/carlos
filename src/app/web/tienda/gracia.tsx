import React, { useState, useEffect } from "react";
import { CheckCircle2, Truck, Copy, Check } from "lucide-react";
import { motion } from "motion/react";
import { Order, User } from "../../../types";
import { apiFetch } from "../../../config";

export interface GraciaTiendaViewProps {
  completedOrder: Order | null;
  orderId?: string;
  onLoginSuccess?: (user: User) => void;
  onContinueShopping: () => void;
  onViewOrderHistory: () => void;
}

export function GraciaTiendaView({
  completedOrder,
  orderId,
  onLoginSuccess,
  onContinueShopping,
  onViewOrderHistory,
}: GraciaTiendaViewProps) {
  const [activeOrder, setActiveOrder] = useState<Order | null>(completedOrder);
  const [isLoading, setIsLoading] = useState<boolean>(!completedOrder && Boolean(orderId));
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (completedOrder) {
      setActiveOrder(completedOrder);
      setIsLoading(false);
    }
  }, [completedOrder]);

  useEffect(() => {
    if (!completedOrder && orderId) {
      setIsLoading(true);
      apiFetch(`/api/orders/${encodeURIComponent(orderId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setActiveOrder(data);
          }
        })
        .catch((err) => console.warn("Error fetching order in GraciaView:", err))
        .finally(() => setIsLoading(false));
    }
  }, [orderId, completedOrder]);

  const itemsSubtotal = (activeOrder?.items || []).reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );

  const selectedShippingCost =
    activeOrder?.shippingCost !== undefined
      ? activeOrder.shippingCost
      : activeOrder
      ? Math.max(0, activeOrder.total - itemsSubtotal)
      : 0;

  const selectedCarrier =
    activeOrder?.carrier ||
    activeOrder?.items?.find((it) => it.carrier)?.carrier ||
    "";

  const handleCopyOrderId = () => {
    if (!activeOrder?.id) return;
    navigator.clipboard.writeText(activeOrder.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

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

        {isLoading && (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Cargando detalles de tu compra...</p>
          </div>
        )}

        {/* Resumen de Productos Comprados */}
        {activeOrder?.items && activeOrder.items.length > 0 && (
          <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 mt-5 text-left">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2.5">
              Productos Comprados (
              {activeOrder.items.reduce((sum, item) => sum + item.quantity, 0)})
            </span>
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {activeOrder.items.map((item, idx) => (
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
        {activeOrder && (
          <div className="bg-slate-50/80 rounded-xl p-3 sm:p-4 mt-3 text-left space-y-2.5 text-xs border border-slate-100">
            <div className="flex justify-between border-b border-slate-200/60 pb-2 items-center">
              <span className="text-slate-500 font-medium">Código de Compra:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-extrabold text-slate-900 bg-slate-200/70 px-2 py-0.5 rounded text-[11px]">
                  {activeOrder.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
                  title="Copiar código de pedido"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Fecha:</span>
              <span className="font-mono text-slate-700">
                {new Date(activeOrder.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="border-b border-slate-200/60 pb-2.5">
              <span className="text-slate-500 font-medium block mb-1">
                Dirección de Envío Completa:
              </span>
              <p className="text-slate-800 font-medium text-xs leading-relaxed break-words whitespace-normal">
                {activeOrder.shippingAddress}
              </p>
            </div>

            {/* Subtotal de los productos */}
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-slate-500 font-medium">Subtotal Productos:</span>
              <span className="font-mono font-bold text-slate-800">
                ${itemsSubtotal.toFixed(2)}
              </span>
            </div>

            {/* Precio del Envío Seleccionado */}
            <div className="flex justify-between border-b border-slate-200/60 pb-2 items-center" id="thankyou-shipping-cost-row">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-slate-700 font-bold">Precio del Envío Seleccionado:</span>
                {selectedCarrier && (
                  <span className="text-[10px] bg-amber-100/90 text-amber-900 font-black px-1.5 py-0.5 rounded border border-amber-300/60">
                    {selectedCarrier}
                  </span>
                )}
              </div>
              <span className="font-mono font-extrabold text-slate-900">
                {selectedShippingCost === 0 ? (
                  <span className="text-emerald-600 font-black">GRATIS ($0.00)</span>
                ) : (
                  `$${selectedShippingCost.toFixed(2)}`
                )}
              </span>
            </div>

            <div className="flex justify-between text-sm font-bold pt-1 items-center">
              <span className="text-slate-900">Total Cargado:</span>
              <span className="text-emerald-600 font-mono text-base font-black">
                ${activeOrder.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Auto-Created User Profile Card for Guest Checkout */}
        {activeOrder?.autoCreatedUser && activeOrder.autoCreatedUser.created && (
          <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-slate-50 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 mt-4 text-left shadow-sm">
            <div className="flex items-center space-x-2 text-amber-600 font-extrabold text-xs uppercase tracking-wider mb-2">
              <span className="text-base">🎉</span>
              <span>¡Cuenta Creada Automáticamente!</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Como eres un comprador nuevo, registramos automáticamente tu perfil con tu correo{" "}
              <strong className="text-slate-900 font-bold">
                {activeOrder.autoCreatedUser.email}
              </strong>
              .
            </p>
            <div className="bg-white rounded-xl p-3 border border-amber-200/60 my-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Usuario asignado:</span>
                <span className="font-bold text-slate-900 font-mono">
                  @{activeOrder.autoCreatedUser.username}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Contraseña enviada a tu correo:</span>
                <span className="font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200 font-mono text-sm tracking-wider">
                  {activeOrder.autoCreatedUser.tempPassword}
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-[11px] text-slate-600 leading-relaxed mb-3.5">
              <p className="font-bold text-slate-800 mb-0.5">🔒 Notificación de Seguridad:</p>
              Te enviamos los datos de acceso a tu correo. Te recomendamos iniciar sesión para
              hacer el seguimiento de tus pedidos y actualizar tu contraseña por una más segura en
              tu perfil.
            </div>
            {activeOrder.autoCreatedUser.user && (
              <button
                type="button"
                onClick={() => {
                  if (onLoginSuccess && activeOrder.autoCreatedUser?.user) {
                    onLoginSuccess(activeOrder.autoCreatedUser.user);
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
