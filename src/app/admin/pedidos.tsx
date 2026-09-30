import React, { useState, useMemo } from "react";
import {
  Edit3,
  Truck,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Order } from "../../types";
import { apiFetch } from "../../config";

export interface PedidosAdminProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onStatusMessage?: (msg: { type: "success" | "error" | "info"; text: string } | null) => void;
  onRequestEditOrder?: (order: Order) => void;
}

export default function PedidosAdminView({
  orders,
  setOrders,
  onStatusMessage,
  onRequestEditOrder,
}: PedidosAdminProps) {
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [localEditingOrder, setLocalEditingOrder] = useState<Order | null>(null);
  const [orderNewStatus, setOrderNewStatus] = useState<string>("processing");
  const [orderNewCarrier, setOrderNewCarrier] = useState<string>("");
  const [orderNewTracking, setOrderNewTracking] = useState<string>("");
  const [orderNewNotes, setOrderNewNotes] = useState<string>("");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  const notify = (msg: { type: "success" | "error" | "info"; text: string }) => {
    if (onStatusMessage) {
      onStatusMessage(msg);
      setTimeout(() => onStatusMessage(null), 4000);
    }
  };

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === "all") return orders;
    return orders.filter((o) => o.status === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const handleSaveLocalOrderUpdate = async () => {
    if (!localEditingOrder) return;
    setIsUpdatingOrder(true);
    try {
      const payload = {
        status: orderNewStatus,
        carrier: orderNewCarrier,
        trackingNumber: orderNewTracking,
        sellerNotes: orderNewNotes,
      };
      const res = await apiFetch(`/api/orders/${localEditingOrder.id}/update-tracking`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data: any = await res.json().catch(() => ({}));

      if (data && data.order) {
        setOrders((prev) => prev.map((o) => (o.id === localEditingOrder.id ? data.order : o)));
        notify({
          type: "success",
          text: `Pedido ${localEditingOrder.id} actualizado correctamente a "${orderNewStatus}".`,
        });
      }
      setLocalEditingOrder(null);
    } catch (err: any) {
      console.error("Error updating order:", err);
      notify({
        type: "error",
        text: err.message || "Error al actualizar pedido",
      });
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
      id="admin-tab-content-orders"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Control de Pedidos y Logística</h2>
          <p className="text-xs text-slate-500">
            Historial completo de órdenes realizadas en la tienda y gestión de envíos.
          </p>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
          {["all", "pending", "processing", "shipped", "delivered"].map((st, sIdx) => (
            <button
              key={`${st}-${sIdx}`}
              onClick={() => setOrderStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orderStatusFilter === st
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {st === "all" ? "Todos" : st}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No hay pedidos en la categoría seleccionada.
          </div>
        ) : (
          filteredOrders.map((order, oIdx) => (
            <div
              key={`${order.id || "order"}-${oIdx}`}
              className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white hover:border-slate-300 transition-all flex flex-col space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="font-mono font-bold text-xs text-slate-900">
                    Pedido #{order.id}
                  </span>
                  <span className="text-slate-400 text-[11px] ml-2">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      order.status === "delivered"
                        ? "bg-emerald-100 text-emerald-800"
                        : order.status === "shipped"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {order.status}
                  </span>
                  <button
                    onClick={() => {
                      if (onRequestEditOrder) {
                        onRequestEditOrder(order);
                      } else {
                        setLocalEditingOrder(order);
                        setOrderNewStatus(order.status || "processing");
                        setOrderNewCarrier(order.carrier || "");
                        setOrderNewTracking(order.trackingNumber || "");
                        setOrderNewNotes(order.sellerNotes || "");
                      }
                    }}
                    className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Actualizar Envío</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Buyer Details */}
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase font-mono">
                    Comprador
                  </p>
                  <p className="font-bold text-slate-900 mt-1">{order.buyerName || "Cliente"}</p>
                  <p className="font-mono text-slate-500 text-[11px]">
                    @{order.buyerUsername || "anon"}
                  </p>
                  <p className="text-slate-500 text-[11px]">{order.buyerEmail}</p>
                </div>

                {/* Shipping Address */}
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase font-mono">
                    Dirección y Envío
                  </p>
                  <p className="text-slate-700 mt-1 line-clamp-2">
                    {order.shippingAddress || "Dirección predeterminada"}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                    Paquetería:{" "}
                    <span className="font-bold text-slate-800">
                      {order.carrier || "Sin asignar"}
                    </span>
                  </p>
                  {order.trackingNumber && (
                    <p className="text-[11px] font-mono text-indigo-600 font-bold">
                      Guía: {order.trackingNumber}
                    </p>
                  )}
                </div>

                {/* Total & Items */}
                <div>
                  <p className="font-bold text-slate-400 text-[10px] uppercase font-mono">
                    Resumen de Pago
                  </p>
                  <p className="text-base font-black text-emerald-600 mt-1">
                    ${Number(order.total).toFixed(2)} USD
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {order.items?.length || 0} producto(s) en total
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fallback Modal for Updating Order Tracking & Status when used standalone */}
      <AnimatePresence>
        {localEditingOrder && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-amber-500" />
                  <h3 className="text-base font-black text-slate-900">
                    Actualizar Pedido #{localEditingOrder.id}
                  </h3>
                </div>
                <button
                  onClick={() => setLocalEditingOrder(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Estado del Pedido</label>
                  <select
                    value={orderNewStatus}
                    onChange={(e) => setOrderNewStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  >
                    <option value="pending">Pendiente de preparación</option>
                    <option value="processing">En preparación por el vendedor</option>
                    <option value="shipped">Despachado / En tránsito</option>
                    <option value="delivered">Entregado al comprador</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Empresa de Paquetería / Courier
                  </label>
                  <input
                    type="text"
                    value={orderNewCarrier}
                    onChange={(e) => setOrderNewCarrier(e.target.value)}
                    placeholder="Ej. DHL Express, FedEx, Estafeta, etc."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Número de Guía / Código de Rastreo
                  </label>
                  <input
                    type="text"
                    value={orderNewTracking}
                    onChange={(e) => setOrderNewTracking(e.target.value)}
                    placeholder="Ej. DHL-984729184"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Notas para el Comprador
                  </label>
                  <textarea
                    value={orderNewNotes}
                    onChange={(e) => setOrderNewNotes(e.target.value)}
                    rows={2}
                    placeholder="Indicaciones adicionales de entrega..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setLocalEditingOrder(null)}
                  disabled={isUpdatingOrder}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLocalOrderUpdate}
                  disabled={isUpdatingOrder}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5"
                >
                  {isUpdatingOrder ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isUpdatingOrder ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
