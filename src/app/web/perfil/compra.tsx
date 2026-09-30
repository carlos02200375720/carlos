import React, { useState } from "react";
import {
  ShoppingBag,
  RefreshCw,
  Truck,
  Search,
  X,
  Clock,
  CheckCircle2,
  Package,
  AlertCircle,
  Calendar,
  Check,
  Copy,
  PackageSearch,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { motion } from "motion/react";
import { Order } from "../../../types";

export interface CompraPerfilProps {
  userOrders: Order[];
  userSales?: Order[];
  ordersLoading?: boolean;
  onRefreshOrders: () => void;
  onNavigateToSales?: () => void;
  onSelectTrackingOrder: (order: Order) => void;
}

export function CompraPerfilView({
  userOrders,
  userSales = [],
  ordersLoading = false,
  onRefreshOrders,
  onNavigateToSales,
  onSelectTrackingOrder,
}: CompraPerfilProps) {
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("all");
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  const handleCopyTrackingNumber = (
    trackingNum: string,
    orderId: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (!trackingNum) return;
    navigator.clipboard.writeText(trackingNum);
    setCopiedTrackingId(orderId);
    setTimeout(() => setCopiedTrackingId(null), 2500);
  };

  return (
    <motion.div
      key="admin-orders"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
      id="profile-compra-view"
    >
      {/* Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="font-display font-extrabold text-base text-slate-900 flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <span>Historial de Mis Compras</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rastrea los envíos de tus compras en tiempo real y consulta los detalles de tus pedidos.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshOrders}
            disabled={ordersLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            title="Actualizar compras"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                ordersLoading ? "animate-spin text-amber-500" : ""
              }`}
            />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Notification/Banner redirecting to sales in Products tab if user has sales */}
      {userSales.length > 0 && onNavigateToSales && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-emerald-800">
            <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">
              ¿Deseas gestionar las ventas de tus productos? Ahora están en la pestaña{" "}
              <strong>Productos &gt; Ventas Entrantes</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToSales}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Ir a Ventas ({userSales.length})
          </button>
        </div>
      )}

      {/* Quick Stats Summary Banner */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">
            Total Compras
          </p>
          <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
            {userOrders.length}
          </p>
        </div>
        <div className="text-center border-x border-amber-200/60">
          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">
            En Tránsito
          </p>
          <p className="text-sm font-black text-amber-600 mt-0.5 font-mono">
            {
              userOrders.filter(
                (o) => o.status === "shipped" || o.status === "processing"
              ).length
            }
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">
            Total Invertido
          </p>
          <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
            ${userOrders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={orderSearchQuery}
            onChange={(e) => setOrderSearchQuery(e.target.value)}
            placeholder="Buscar por referencia, producto, vendedor o guía de rastreo..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
          {orderSearchQuery && (
            <button
              type="button"
              onClick={() => setOrderSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select
          value={orderStatusFilter}
          onChange={(e) => setOrderStatusFilter(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="all">Todos los estados</option>
          <option value="processing">🟡 En preparación</option>
          <option value="shipped">🚚 En camino / Despachado</option>
          <option value="delivered">🟢 Entregado</option>
          <option value="cancelled">🔴 Cancelado</option>
        </select>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {(() => {
          const filtered = userOrders.filter((order) => {
            if (
              orderStatusFilter !== "all" &&
              order.status !== orderStatusFilter
            ) {
              return false;
            }
            if (!orderSearchQuery.trim()) return true;
            const q = orderSearchQuery.toLowerCase();
            const matchesId = order.id?.toLowerCase().includes(q);
            const matchesTracking = order.trackingNumber
              ?.toLowerCase()
              .includes(q);
            const matchesCarrier = order.carrier?.toLowerCase().includes(q);
            const matchesAddress = order.shippingAddress
              ?.toLowerCase()
              .includes(q);
            const matchesItem = order.items?.some(
              (it) =>
                it.name?.toLowerCase().includes(q) ||
                it.sellerName?.toLowerCase().includes(q)
            );
            return (
              matchesId ||
              matchesTracking ||
              matchesCarrier ||
              matchesAddress ||
              matchesItem
            );
          });

          if (filtered.length === 0) {
            return (
              <div className="border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/40">
                <ShoppingBag className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                <p className="text-sm font-extrabold text-slate-700">
                  No se encontraron compras registradas
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {orderSearchQuery || orderStatusFilter !== "all"
                    ? "Intenta modificar el término de búsqueda o quitar los filtros de estado."
                    : "Cuando compres productos en la plataforma, aparecerán aquí con su código de guía y rastreo en vivo."}
                </p>
                {(orderSearchQuery || orderStatusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderSearchQuery("");
                      setOrderStatusFilter("all");
                    }}
                    className="mt-3 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            );
          }

          return filtered.map((order, index) => {
            const isShipped = order.status === "shipped";
            const isDelivered = order.status === "delivered";
            const isProcessing = order.status === "processing" || !order.status;
            const isCancelled = order.status === "cancelled";

            const stepProgress = isDelivered
              ? 4
              : isShipped
              ? 3
              : isProcessing
              ? 2
              : 1;

            return (
              <div
                key={`${order.id}-${index}`}
                className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs transition-all hover:border-slate-300 flex flex-col space-y-4"
                id={`order-card-${order.id}`}
              >
                {/* Order Card Top: Reference, Date, Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      Ref: {order.id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(order.createdAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {isDelivered && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Entregado</span>
                      </span>
                    )}
                    {isShipped && (
                      <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <Truck className="w-3 h-3 text-blue-600 animate-pulse" />
                        <span>En Camino / Despachado</span>
                      </span>
                    )}
                    {isProcessing && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <Package className="w-3 h-3 text-amber-600" />
                        <span>En Preparación</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>Cancelado</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Tracking Progress Stepper (4 Steps) */}
                {!isCancelled && (
                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center space-x-1">
                        <Truck className="w-3 h-3 text-amber-500" />
                        <span>Progreso del Envío</span>
                      </span>
                      {order.estimatedDelivery && (
                        <span className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-amber-500" />
                          <span>
                            Entrega estimada: {order.estimatedDelivery}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="relative flex items-center justify-between mt-3 mb-2 px-3">
                      {/* Background Connecting Line */}
                      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
                      {/* Active Progress Line */}
                      <div
                        className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-amber-500 transition-all duration-500 z-0"
                        style={{
                          width:
                            stepProgress === 1
                              ? "0%"
                              : stepProgress === 2
                              ? "33%"
                              : stepProgress === 3
                              ? "66%"
                              : "100%",
                        }}
                      />

                      {/* Step 1: Pago Aprobado */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            stepProgress >= 1
                              ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 mt-1">
                          Confirmado
                        </span>
                      </div>

                      {/* Step 2: En Preparación */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            stepProgress >= 2
                              ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {stepProgress > 2 ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            "2"
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 mt-1">
                          Preparando
                        </span>
                      </div>

                      {/* Step 3: En Camino */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            stepProgress >= 3
                              ? "bg-amber-500 text-slate-950 ring-4 ring-amber-100"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {stepProgress > 3 ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            "3"
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 mt-1">
                          En Camino
                        </span>
                      </div>

                      {/* Step 4: Entregado */}
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            stepProgress === 4
                              ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {stepProgress === 4 ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            "4"
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-600 mt-1">
                          Entregado
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prominent Tracking Information Banner */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50/70 via-slate-50 to-amber-50/40 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1">
                        <Truck className="w-3 h-3" />
                        <span>{order.carrier || "Paquetería Express"}</span>
                      </span>
                      <span className="text-[11px] font-extrabold text-slate-700">
                        Guía de Seguimiento:
                      </span>
                    </div>

                    {order.trackingNumber ? (
                      <div className="flex items-center space-x-2 pt-0.5">
                        <span className="font-mono font-black text-sm text-slate-900 tracking-wide bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                          {order.trackingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) =>
                            handleCopyTrackingNumber(
                              order.trackingNumber!,
                              order.id,
                              e
                            )
                          }
                          className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors cursor-pointer text-xs flex items-center space-x-1"
                          title="Copiar número de guía"
                        >
                          {copiedTrackingId === order.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] font-black text-emerald-700">
                                ¡Copiado!
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">
                                Copiar
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 font-semibold pt-0.5">
                        ⚠️ Pendiente de generar número de guía por el vendedor.
                      </p>
                    )}

                    {order.sellerNotes && (
                      <p className="text-[11px] text-slate-500 italic pt-0.5">
                        Nota: "{order.sellerNotes}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectTrackingOrder(order)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <PackageSearch className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ver Rastreo en Vivo</span>
                    </button>

                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition-colors flex items-center justify-center space-x-1"
                      >
                        <span>Web del transportista</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Items Purchased Details */}
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                    Artículos en este pedido ({order.items.length})
                  </span>
                  <div className="divide-y divide-slate-100">
                    {order.items.map((item, itIdx) => (
                      <div
                        key={itIdx}
                        className="py-2 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <img
                            src={
                              item.imageUrl ||
                              "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"
                            }
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {item.sellerName && (
                                <span>Vendedor: {item.sellerName} • </span>
                              )}
                              <span className="font-mono">
                                Cantidad: {item.quantity}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold font-mono text-slate-900">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                          {item.quantity > 1 && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              ${item.price.toFixed(2)} c/u
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer: Address and Total Summary */}
                <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      Dirección: {order.shippingAddress}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4">
                    {order.shippingCost !== undefined &&
                      order.shippingCost > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Envío:{" "}
                          <span className="font-mono font-bold">
                            ${order.shippingCost.toFixed(2)}
                          </span>
                        </span>
                      )}
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1.5">
                        Total Pagado:
                      </span>
                      <span className="text-sm font-black font-mono text-slate-900">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </motion.div>
  );
}

export { CompraPerfilView as Compra };
export default CompraPerfilView;
