import React, { useState } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  X,
  Search,
  ExternalLink,
  Edit3,
  RefreshCw,
  Clock,
  AlertCircle,
  MapPin,
  Calendar,
  Check,
  Copy,
  PackageSearch,
  Loader2,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Order } from "../../../types";
import { apiFetch } from "../../../config";

export interface VentaPerfilProps {
  userSales: Order[];
  ordersLoading?: boolean;
  onRefreshOrders: () => void;
  onUpdateSales: React.Dispatch<React.SetStateAction<Order[]>>;
  onUpdateOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  onSelectTrackingOrder: (order: Order) => void;
}

export function VentaPerfilView({
  userSales,
  ordersLoading = false,
  onRefreshOrders,
  onUpdateSales,
  onUpdateOrders,
  onSelectTrackingOrder,
}: VentaPerfilProps) {
  // Incoming sales filter & search states
  const [salesSearchQuery, setSalesSearchQuery] = useState("");
  const [salesStatusFilter, setSalesStatusFilter] = useState<string>("all");
  const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

  // Seller editing tracking / fulfillment modal states
  const [editingTrackingOrder, setEditingTrackingOrder] = useState<Order | null>(null);
  const [editTrackingNumber, setEditTrackingNumber] = useState("");
  const [editCarrier, setEditCarrier] = useState("DHL Express");
  const [editOrderStatus, setEditOrderStatus] = useState<
    "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  >("processing");
  const [editEstimatedDelivery, setEditEstimatedDelivery] = useState("");
  const [editTrackingUrl, setEditTrackingUrl] = useState("");
  const [editSellerNotes, setEditSellerNotes] = useState("");
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [trackingSuccessMessage, setTrackingSuccessMessage] = useState<string | null>(null);

  // Copy tracking number to clipboard with feedback
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

  // Open seller tracking / fulfillment editor modal
  const openEditTrackingModal = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackingOrder(order);
    setEditTrackingNumber(order.trackingNumber || "");
    setEditCarrier(order.carrier || "");
    setEditOrderStatus((order.status as any) || "processing");
    setEditEstimatedDelivery(order.estimatedDelivery || "");
    setEditTrackingUrl(order.trackingUrl || "");
    setEditSellerNotes(order.sellerNotes || "");
    setTrackingSuccessMessage(null);
  };

  // Submit tracking update by seller
  const handleSaveTrackingUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrackingOrder) return;

    try {
      setIsUpdatingTracking(true);
      const res = await apiFetch(`/api/orders/${editingTrackingOrder.id}/update-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: editTrackingNumber,
          carrier: editCarrier,
          status: editOrderStatus,
          trackingUrl: editTrackingUrl,
          estimatedDelivery: editEstimatedDelivery,
          sellerNotes: editSellerNotes,
        }),
      });

      const data = await res.json();
      if (data.success && data.order) {
        const updated: Order = data.order;
        onUpdateSales((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        onUpdateOrders?.((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setTrackingSuccessMessage("¡Guía de rastreo y estado actualizados exitosamente!");
        setTimeout(() => {
          setTrackingSuccessMessage(null);
          setEditingTrackingOrder(null);
        }, 1200);
      }
    } catch (err) {
      console.error("Error saving tracking update:", err);
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  return (
    <>
      {/* Panel de Ventas Entrantes */}
      <div className="space-y-4" id="admin-incoming-sales-panel">
        {/* Header with refresh button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-150 p-3.5 rounded-2xl">
          <div>
            <h4 className="font-display font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <Truck className="w-4.5 h-4.5 text-emerald-600" />
              <span>Gestión de Ventas Entrantes & Despachos</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Supervisa las ventas de tus productos, asigna transportadoras y guías de rastreo a tus compradores.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={onRefreshOrders}
              disabled={ordersLoading}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-60 shadow-2xs"
              title="Actualizar ventas"
              id="btn-refresh-sales"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${ordersLoading ? "animate-spin text-emerald-600" : ""}`}
              />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Summary Banner */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-xl">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">
              Total Ventas
            </p>
            <p className="text-sm font-black text-slate-900 mt-0.5 font-mono">
              {userSales.length}
            </p>
          </div>
          <div className="text-center border-x border-emerald-200/70">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">
              Por Despachar
            </p>
            <p className="text-sm font-black text-amber-600 mt-0.5 font-mono">
              {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">
              Ingresos Totales
            </p>
            <p className="text-sm font-black text-emerald-700 mt-0.5 font-mono">
              ${userSales.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Search and Status Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={salesSearchQuery}
              onChange={(e) => setSalesSearchQuery(e.target.value)}
              placeholder="Buscar por referencia, cliente, dirección, producto o guía..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
            />
            {salesSearchQuery && (
              <button
                type="button"
                onClick={() => setSalesSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={salesStatusFilter}
            onChange={(e) => setSalesStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="processing">🟡 En preparación</option>
            <option value="shipped">🚚 En camino / Despachado</option>
            <option value="delivered">🟢 Entregado</option>
            <option value="cancelled">🔴 Cancelado</option>
          </select>
        </div>

        {/* Incoming Sales List */}
        <div className="space-y-4">
          {(() => {
            const filtered = userSales.filter((order) => {
              if (salesStatusFilter !== "all" && order.status !== salesStatusFilter) {
                return false;
              }
              if (!salesSearchQuery.trim()) return true;
              const q = salesSearchQuery.toLowerCase();
              const matchesId = order.id?.toLowerCase().includes(q);
              const matchesTracking = order.trackingNumber?.toLowerCase().includes(q);
              const matchesCarrier = order.carrier?.toLowerCase().includes(q);
              const matchesAddress = order.shippingAddress?.toLowerCase().includes(q);
              const matchesBuyer =
                order.buyerName?.toLowerCase().includes(q) ||
                order.buyerUsername?.toLowerCase().includes(q);
              const matchesItem = order.items?.some((it) => it.name?.toLowerCase().includes(q));
              return (
                matchesId ||
                matchesTracking ||
                matchesCarrier ||
                matchesAddress ||
                matchesBuyer ||
                matchesItem
              );
            });

            if (filtered.length === 0) {
              return (
                <div className="border border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center text-slate-400 bg-slate-50/40">
                  <Truck className="w-12 h-12 stroke-1 text-slate-300 mb-2" />
                  <p className="text-sm font-extrabold text-slate-700">
                    No se encontraron ventas registradas
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {salesSearchQuery || salesStatusFilter !== "all"
                      ? "Intenta modificar el término de búsqueda o quitar los filtros de estado."
                      : "Cuando otros usuarios compren productos de tu negocio, aquí podrás gestionar sus envíos y asignar guías de seguimiento."}
                  </p>
                  {(salesSearchQuery || salesStatusFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSalesSearchQuery("");
                        setSalesStatusFilter("all");
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

              const stepProgress = isDelivered ? 4 : isShipped ? 3 : isProcessing ? 2 : 1;

              return (
                <div
                  key={order.id || `sale-${index}`}
                  className="border border-slate-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs transition-all hover:border-slate-300 flex flex-col space-y-4"
                  id={`admin-sale-card-${order.id}`}
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
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Fecha no disponible"}
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
                          <Clock className="w-3 h-3 text-amber-600" />
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

                  {/* Buyer metadata */}
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          order.buyerAvatar ||
                          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80"
                        }
                        alt={order.buyerName || "Cliente"}
                        className="w-9 h-9 rounded-full object-cover border border-emerald-200"
                      />
                      <div>
                        <p className="font-extrabold text-slate-900">
                          Cliente: {order.buyerName || "Cliente"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {order.buyerUsername
                            ? `@${order.buyerUsername}`
                            : order.buyerEmail || "Cliente registrado"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-600 text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium line-clamp-1">{order.shippingAddress}</span>
                    </div>
                  </div>

                  {/* Tracking Progress Stepper (4 Steps) */}
                  {!isCancelled && (
                    <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center space-x-1">
                          <Truck className="w-3 h-3 text-amber-500" />
                          <span>Progreso del Despacho</span>
                        </span>
                        {order.estimatedDelivery && (
                          <span className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-amber-500" />
                            <span>Entrega estimada: {order.estimatedDelivery}</span>
                          </span>
                        )}
                      </div>

                      <div className="relative flex items-center justify-between mt-3 mb-2 px-3">
                        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
                        <div
                          className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 transition-all duration-500 z-0"
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

                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stepProgress >= 1
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <span className="text-[9px] font-bold text-slate-600 mt-1">
                            Confirmado
                          </span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stepProgress >= 2
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {stepProgress > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-600 mt-1">
                            Preparando
                          </span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stepProgress >= 3
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {stepProgress > 3 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-600 mt-1">
                            En Camino
                          </span>
                        </div>

                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              stepProgress === 4
                                ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {stepProgress === 4 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
                          </div>
                          <span className="text-[9px] font-bold text-slate-600 mt-1">
                            Entregado
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Prominent Tracking Information Banner */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-emerald-50/40 border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="bg-emerald-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1">
                          <Truck className="w-3 h-3" />
                          <span>{order.carrier || "Transportadora"}</span>
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
                              handleCopyTrackingNumber(order.trackingNumber!, order.id, e)
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
                                <span className="text-[10px] font-bold">Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-700 font-semibold pt-0.5">
                          ⚠️ Pendiente de generar número de guía para el comprador.
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
                        onClick={(e) => openEditTrackingModal(order, e)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                        id={`btn-manage-tracking-sales-${order.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Gestionar Guía & Envío</span>
                      </button>

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

                  {/* Items Sold Details */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                      Artículos vendidos en este pedido ({order.items.length})
                    </span>
                    <div className="divide-y divide-slate-100">
                      {order.items.map((item, itIdx) => (
                        <div key={itIdx} className="py-2 flex items-center justify-between gap-3">
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
                                <span className="font-mono">Cantidad: {item.quantity}</span>
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
                        Dirección de entrega: {order.shippingAddress}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end space-x-4">
                      {order.shippingCost !== undefined && order.shippingCost > 0 && (
                        <span className="text-[11px] text-slate-500">
                          Envío:{" "}
                          <span className="font-mono font-bold">
                            ${order.shippingCost.toFixed(2)}
                          </span>
                        </span>
                      )}
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1.5">
                          Ingreso Venta:
                        </span>
                        <span className="text-sm font-black font-mono text-emerald-700">
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
      </div>

      {/* Seller Edit Tracking Number & Fulfillment Modal */}
      <AnimatePresence>
        {editingTrackingOrder && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
            onClick={() => {
              if (!isUpdatingTracking) setEditingTrackingOrder(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
              id="modal-edit-tracking"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm text-slate-900">
                      Gestionar Envío & Guía de Rastreo
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pedido:{" "}
                      <span className="font-mono font-bold text-slate-800">
                        {editingTrackingOrder.id}
                      </span>
                      {editingTrackingOrder.buyerName &&
                        ` • Cliente: ${editingTrackingOrder.buyerName}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUpdatingTracking}
                  onClick={() => setEditingTrackingOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveTrackingUpdate} className="flex-1 overflow-y-auto p-5 space-y-4">
                {trackingSuccessMessage && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{trackingSuccessMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <span>Empresa de Paquetería / Courier *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editCarrier}
                      onChange={(e) => setEditCarrier(e.target.value)}
                      placeholder="Ej: DHL Express, FedEx, Correos de España, Estafeta, etc."
                      list="carrier-suggestions"
                      className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      id="input-edit-carrier"
                    />
                    <datalist id="carrier-suggestions">
                      <option value="DHL Express" />
                      <option value="FedEx" />
                      <option value="UPS" />
                      <option value="Correos de España" />
                      <option value="Estafeta" />
                      <option value="Servientrega" />
                      <option value="Envia" />
                      <option value="Paquetería Express Local" />
                    </datalist>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Escribe manualmente el nombre de cualquier empresa de paquetería o servicio de envío.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Número de Seguimiento (Guía de Rastreo) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={editTrackingNumber}
                      onChange={(e) => setEditTrackingNumber(e.target.value)}
                      placeholder="Escribe manualmente el número o código de guía..."
                      className="w-full text-xs font-mono font-bold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-900 uppercase"
                      id="input-edit-tracking-number"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Introduce el código de guía emitido por tu paquetería para que el comprador pueda rastrearlo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Estado Actual del Pedido *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("processing")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "processing"
                          ? "bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Package className="w-4 h-4 text-amber-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">En preparación</p>
                        <p className="text-[10px] font-normal text-slate-400">Empacando productos</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("shipped")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "shipped"
                          ? "bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Truck className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">En camino / Enviado</p>
                        <p className="text-[10px] font-normal text-slate-400">
                          Entregado a paquetería
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("delivered")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "delivered"
                          ? "bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">Entregado</p>
                        <p className="text-[10px] font-normal text-slate-400">
                          Recibido por el cliente
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditOrderStatus("cancelled")}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
                        editOrderStatus === "cancelled"
                          ? "bg-rose-50 border-rose-400 text-rose-900 ring-2 ring-rose-500/20"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="text-left">
                        <p className="leading-tight">Cancelado</p>
                        <p className="text-[10px] font-normal text-slate-400">Orden anulada</p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Fecha Estimada de Entrega</span>
                  </label>
                  <input
                    type="date"
                    value={editEstimatedDelivery}
                    onChange={(e) => setEditEstimatedDelivery(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Enlace Web de Rastreo (Opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={editTrackingUrl}
                    onChange={(e) => setEditTrackingUrl(e.target.value)}
                    placeholder="https://www.dhl.com o url del courier..."
                    className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Mensaje / Nota de Despacho para el Comprador
                  </label>
                  <textarea
                    rows={3}
                    value={editSellerNotes}
                    onChange={(e) => setEditSellerNotes(e.target.value)}
                    placeholder="Ej: Paquete despachado con embalaje reforzado y precinto de seguridad desde nuestra sede central..."
                    className="w-full text-xs font-medium p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Esta nota se agregará a la cronología de eventos que verá el cliente al rastrear el paquete.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                  <button
                    type="button"
                    disabled={isUpdatingTracking}
                    onClick={() => setEditingTrackingOrder(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isUpdatingTracking || !editTrackingNumber.trim()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    id="btn-submit-save-tracking"
                  >
                    {isUpdatingTracking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Guardar y Notificar al Comprador</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default VentaPerfilView;
export { VentaPerfilView as Venta };
