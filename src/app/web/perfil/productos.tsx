import React, { useState, useRef } from "react";
import {
  Package,
  Truck,
  Eye,
  CheckCircle2,
  X,
  Search,
  Layers,
  ExternalLink,
  Edit3,
  Trash2,
  RefreshCw,
  Clock,
  AlertCircle,
  MapPin,
  Calendar,
  Check,
  Copy,
  PackageSearch,
  Upload,
  Loader2,
  Plus,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, Product, Order } from "../../../types";
import { apiFetch } from "../../../config";
import VentaPerfilView from "./venta";

export interface ProductosPerfilProps {
  currentUser: User;
  userProducts: Product[];
  userSales: Order[];
  ordersLoading?: boolean;
  section?: "catalog" | "sales";
  onSectionChange?: (section: "catalog" | "sales") => void;
  onRefreshOrders: () => void;
  onSelectProduct: (product: Product) => void;
  onUpdateProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  onUpdateSales: React.Dispatch<React.SetStateAction<Order[]>>;
  onUpdateOrders?: React.Dispatch<React.SetStateAction<Order[]>>;
  onRefreshUsers?: () => void;
  onSelectTrackingOrder: (order: Order) => void;
}

export function ProductosPerfilView({
  currentUser,
  userProducts,
  userSales,
  ordersLoading = false,
  section,
  onSectionChange,
  onRefreshOrders,
  onSelectProduct,
  onUpdateProducts,
  onUpdateSales,
  onUpdateOrders,
  onRefreshUsers,
  onSelectTrackingOrder,
}: ProductosPerfilProps) {
  const [internalSection, setInternalSection] = useState<"catalog" | "sales">("catalog");
  const productManagementSection = section ?? internalSection;
  const setProductManagementSection = (next: "catalog" | "sales") => {
    setInternalSection(next);
    onSectionChange?.(next);
  };

  const totalProductViews = userProducts.reduce((acc, p) => acc + (p.views || 0), 0);

  // Catalog search & CRUD states
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [editProdForm, setEditProdForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    shippingCost: "",
    category: "Ropa Femenina",
    imageUrl: "",
    images: [] as string[],
  });
  const [newExtraImageUrl, setNewExtraImageUrl] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [isUploadingProdImage, setIsUploadingProdImage] = useState(false);
  const [productActionError, setProductActionError] = useState<string | null>(null);
  const [productActionSuccess, setProductActionSuccess] = useState<string | null>(null);
  const prodImageInputRef = useRef<HTMLInputElement>(null);
  const prodExtraImageInputRef = useRef<HTMLInputElement>(null);

  // Incoming sales states
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

  // Open product editor modal and pre-fill form
  const handleStartEditProduct = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(prod);
    setEditProdForm({
      name: prod.name || "",
      description: prod.description || "",
      price: prod.price !== undefined ? String(prod.price) : "0",
      stock: prod.stock !== undefined ? String(prod.stock) : "0",
      shippingCost: prod.shippingCost !== undefined ? String(prod.shippingCost) : "0",
      category: prod.category || "Ropa Femenina",
      imageUrl: prod.imageUrl || "",
      images: Array.isArray(prod.images)
        ? [...prod.images]
        : prod.imageUrl
        ? [prod.imageUrl]
        : [],
    });
    setNewExtraImageUrl("");
    setProductActionError(null);
  };

  // Upload image from file input (for main image or extra gallery images)
  const handleUploadProdImage = async (file: File, isExtra = false) => {
    try {
      setIsUploadingProdImage(true);
      setProductActionError(null);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("creatorId", currentUser.id);

      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.url) {
        if (isExtra) {
          setEditProdForm((prev) => ({
            ...prev,
            images: prev.images.includes(data.url) ? prev.images : [...prev.images, data.url],
          }));
        } else {
          setEditProdForm((prev) => ({ ...prev, imageUrl: data.url }));
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            const dataUrl = reader.result as string;
            if (isExtra) {
              setEditProdForm((prev) => ({ ...prev, images: [...prev.images, dataUrl] }));
            } else {
              setEditProdForm((prev) => ({ ...prev, imageUrl: dataUrl }));
            }
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      console.warn("Upload to GCS failed, falling back to FileReader DataURL:", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const dataUrl = reader.result as string;
          if (isExtra) {
            setEditProdForm((prev) => ({ ...prev, images: [...prev.images, dataUrl] }));
          } else {
            setEditProdForm((prev) => ({ ...prev, imageUrl: dataUrl }));
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingProdImage(false);
    }
  };

  // Save product changes to backend
  const handleSaveProductChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editProdForm.name.trim()) {
      setProductActionError("El nombre del producto es obligatorio.");
      return;
    }
    const numPrice = parseFloat(editProdForm.price);
    if (isNaN(numPrice) || numPrice < 0) {
      setProductActionError("Por favor ingresa un precio numérico válido (mayor o igual a 0).");
      return;
    }
    const numStock = parseInt(editProdForm.stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setProductActionError("El inventario/stock debe ser un número entero mayor o igual a 0.");
      return;
    }
    if (!editProdForm.imageUrl.trim()) {
      setProductActionError("La imagen principal del producto es obligatoria.");
      return;
    }

    try {
      setIsSavingProduct(true);
      setProductActionError(null);

      const payload = {
        name: editProdForm.name.trim(),
        description: editProdForm.description.trim(),
        price: numPrice,
        stock: numStock,
        shippingCost: Math.max(0, parseFloat(editProdForm.shippingCost) || 0),
        category: editProdForm.category.trim() || "General",
        imageUrl: editProdForm.imageUrl.trim(),
        images: editProdForm.images.filter((img) => img.trim().length > 0),
      };

      const res = await apiFetch(`/api/products/${editingProduct.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al actualizar el producto");
      }

      const updated = data.product;
      onUpdateProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      setProductActionSuccess(`¡Producto "${updated.name}" actualizado exitosamente!`);
      setTimeout(() => setProductActionSuccess(null), 4000);
      setEditingProduct(null);

      onRefreshUsers?.();
    } catch (err: any) {
      console.error("Error al actualizar producto:", err);
      setProductActionError(err.message || "Error al actualizar el producto.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Confirm delete product
  const handleConfirmDeleteProduct = async () => {
    if (!deletingProduct) return;

    try {
      setIsDeletingProduct(true);
      const res = await apiFetch(`/api/products/${deletingProduct.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Error al eliminar el producto");
      }

      onUpdateProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      setProductActionSuccess(`Producto "${deletingProduct.name}" eliminado correctamente.`);
      setTimeout(() => setProductActionSuccess(null), 4000);
      setDeletingProduct(null);

      onRefreshUsers?.();
    } catch (err: any) {
      console.error("Error al eliminar el producto:", err);
      setProductActionError(err.message || "Error de red al eliminar el producto.");
    } finally {
      setIsDeletingProduct(false);
    }
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
    <motion.div
      key="admin-products"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
      id="admin-products-management-panel"
    >
      {/* Sub-navigation Switcher: Mis Productos vs Ventas Entrantes */}
      <div className="flex items-center space-x-2 bg-slate-100/90 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setProductManagementSection("catalog")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            productManagementSection === "catalog"
              ? "bg-white text-slate-900 shadow-xs scale-[1.01]"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="tab-btn-admin-productos"
        >
          <Package className="w-4 h-4 text-amber-500" />
          <span>Mis Productos</span>
          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
            {userProducts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setProductManagementSection("sales");
            onRefreshOrders();
          }}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all cursor-pointer relative ${
            productManagementSection === "sales"
              ? "bg-white text-slate-900 shadow-xs scale-[1.01]"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="tab-btn-admin-ventas"
        >
          <Truck className="w-4 h-4 text-emerald-600" />
          <span>Ventas Entrantes</span>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
            {userSales.length}
          </span>
          {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length > 0 && (
            <span
              className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white leading-none shadow-2xs"
              title="Ventas pendientes por despachar"
            >
              {userSales.filter((o) => o.status === "processing" || !o.trackingNumber).length} por despachar
            </span>
          )}
        </button>
      </div>

      {productManagementSection === "catalog" ? (
        <>
          {/* Header & Quick Actions Bar */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5" id="products-summary-metrics">
              <Package className="w-5 h-5 text-amber-500 shrink-0" />
              <span className="bg-amber-100 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full border border-amber-200">
                {userProducts.length} {userProducts.length === 1 ? "producto" : "productos"}
              </span>
              <span
                className="bg-sky-100 text-sky-800 text-xs font-black px-2.5 py-1 rounded-full border border-sky-200 flex items-center space-x-1"
                title="Visualizaciones acumuladas en páginas de detalle"
                id="products-total-views-counter"
              >
                <Eye className="w-3.5 h-3.5 text-sky-600" />
                <span>
                  {totalProductViews} {totalProductViews === 1 ? "visualización" : "visualizaciones"}
                </span>
              </span>
            </div>

            <div className="flex items-center space-x-2"></div>
          </div>

          {/* Notice / Feedback Banner */}
          {productActionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{productActionSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setProductActionSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Search & Filter Bar if there are products */}
          {userProducts.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Buscar producto por nombre, categoría o descripción..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all font-medium text-slate-800"
              />
              {productSearchQuery && (
                <button
                  type="button"
                  onClick={() => setProductSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Product List / Empty States */}
          {userProducts.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-100">
                <Package className="w-7 h-7 text-amber-500" />
              </div>
              <h4 className="font-display font-extrabold text-sm text-slate-800">
                No tienes productos publicados todavía
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Agrega artículos a tu catálogo para que tus clientes puedan descubrirlos, comprarlos y agregarlos al carrito.
              </p>
            </div>
          ) : (
            (() => {
              const filtered = userProducts.filter((p) => {
                if (!productSearchQuery.trim()) return true;
                const q = productSearchQuery.toLowerCase();
                return (
                  p.name?.toLowerCase().includes(q) ||
                  p.category?.toLowerCase().includes(q) ||
                  p.description?.toLowerCase().includes(q)
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-600">
                      No se encontraron productos que coincidan con "{productSearchQuery}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setProductSearchQuery("")}
                      className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5" id="business-products-list">
                  {filtered.map((prod, prodIdx) => {
                    const isOutOfStock = prod.stock !== undefined && prod.stock <= 0;
                    return (
                      <div
                        key={`${prod.id}-${prodIdx}`}
                        id={`product-manage-card-${prod.id}`}
                        className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between hover:border-amber-400/80 hover:shadow-sm transition-all group relative"
                      >
                        <div>
                          {/* Top Row: Image & Primary Info */}
                          <div className="flex space-x-3">
                            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                              <img
                                src={
                                  prod.imageUrl ||
                                  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80"
                                }
                                alt={prod.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              {prod.images && prod.images.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs flex items-center space-x-0.5">
                                  <Layers className="w-2.5 h-2.5" />
                                  <span>{prod.images.length}</span>
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate block">
                                    {prod.category || "General"}
                                  </span>
                                  {isOutOfStock ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 shrink-0">
                                      Agotado
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                      Stock: {prod.stock ?? 1}
                                    </span>
                                  )}
                                </div>

                                <h4
                                  className="font-extrabold text-xs text-slate-900 line-clamp-1 mt-0.5"
                                  title={prod.name}
                                >
                                  {prod.name}
                                </h4>

                                <div className="flex items-center flex-wrap gap-2 mt-1">
                                  <span className="font-display font-black text-sm sm:text-base text-amber-600">
                                    $
                                    {Number(prod.price || 0).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </span>
                                  {prod.freeShipping && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200">
                                      <Truck className="w-3 h-3" />
                                      <span>Envío Gratis</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              {prod.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                                  {prod.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons Footer */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <button
                              type="button"
                              onClick={() => onSelectProduct(prod)}
                              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 transition-colors cursor-pointer py-1"
                              title="Ver vista pública del producto"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Ver en tienda</span>
                            </button>
                            <span
                              className="flex items-center space-x-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/80"
                              title="Visualizaciones en la página de detalle"
                            >
                              <Eye className="w-3 h-3 text-sky-600" />
                              <span>
                                {prod.views || 0} {prod.views === 1 ? "vista" : "vistas"}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={(e) => handleStartEditProduct(prod, e)}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                              title="Editar detalles del producto"
                              id={`btn-edit-product-${prod.id}`}
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProduct(prod);
                              }}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
                              title="Eliminar este producto"
                              id={`btn-delete-product-${prod.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </>
      ) : (
        <VentaPerfilView
          userSales={userSales}
          ordersLoading={ordersLoading}
          onRefreshOrders={onRefreshOrders}
          onUpdateSales={onUpdateSales}
          onUpdateOrders={onUpdateOrders}
          onSelectTrackingOrder={onSelectTrackingOrder}
        />
      )}

      {/* Hidden File Inputs for Product Images */}
      <input
        type="file"
        ref={prodImageInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadProdImage(file, false);
          }
          e.target.value = "";
        }}
      />
      <input
        type="file"
        ref={prodExtraImageInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadProdImage(file, true);
          }
          e.target.value = "";
        }}
      />

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            id="modal-edit-product-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto my-auto flex flex-col justify-between"
              id="modal-edit-product-content"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-5">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-extrabold text-base text-slate-900 leading-tight">
                        Editar Producto
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Modifica precio, fotos, inventario, descripción y detalles
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSavingProduct) {
                        setEditingProduct(null);
                      }
                    }}
                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Error Banner */}
                {productActionError && (
                  <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{productActionError}</span>
                  </div>
                )}

                {/* Form Fields */}
                <form onSubmit={handleSaveProductChanges} id="form-edit-product" className="space-y-4">
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Nombre del Producto *
                    </label>
                    <input
                      type="text"
                      value={editProdForm.name}
                      onChange={(e) => setEditProdForm({ ...editProdForm, name: e.target.value })}
                      placeholder="Ej: Zapatillas Urbanas Pro Max"
                      className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      required
                    />
                  </div>

                  {/* Two Columns: Price & Stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Precio ($ USD) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editProdForm.price}
                          onChange={(e) => setEditProdForm({ ...editProdForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full text-xs font-bold pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Stock / Inventario *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editProdForm.stock}
                        onChange={(e) => setEditProdForm({ ...editProdForm, stock: e.target.value })}
                        placeholder="10"
                        className="w-full text-xs font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Two Columns: Shipping & Category */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Costo de Envío ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editProdForm.shippingCost}
                          onChange={(e) =>
                            setEditProdForm({ ...editProdForm, shippingCost: e.target.value })
                          }
                          placeholder="0.00 (Gratis)"
                          className="w-full text-xs font-semibold pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Categoría
                      </label>
                      <select
                        value={editProdForm.category}
                        onChange={(e) => setEditProdForm({ ...editProdForm, category: e.target.value })}
                        className="w-full text-xs font-semibold px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800"
                      >
                        <option value="Ropa Femenina">Ropa Femenina</option>
                        <option value="Ropa Masculina">Ropa Masculina</option>
                        <option value="Calzado">Calzado</option>
                        <option value="Tecnología & Celulares">Tecnología & Celulares</option>
                        <option value="Belleza & Cuidado Personal">Belleza & Cuidado Personal</option>
                        <option value="Joyería & Relojes">Joyería & Relojes</option>
                        <option value="Hogar & Decoración">Hogar & Decoración</option>
                        <option value="Deportes & Fitness">Deportes & Fitness</option>
                        <option value="Juguetes & Bebés">Juguetes & Bebés</option>
                        <option value="General">General / Otros</option>
                      </select>
                    </div>
                  </div>

                  {/* Main Product Image */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                        Foto Principal del Producto *
                      </label>
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                        Portada
                      </span>
                    </div>

                    <div className="flex items-center space-x-3.5">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0">
                        {editProdForm.imageUrl ? (
                          <img
                            src={editProdForm.imageUrl}
                            alt="Preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                        {isUploadingProdImage && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <button
                          type="button"
                          disabled={isUploadingProdImage}
                          onClick={() => prodImageInputRef.current?.click()}
                          className="w-full px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            {isUploadingProdImage ? "Subiendo foto..." : "Subir desde tu dispositivo"}
                          </span>
                        </button>

                        <div className="relative">
                          <input
                            type="text"
                            value={editProdForm.imageUrl}
                            onChange={(e) =>
                              setEditProdForm({ ...editProdForm, imageUrl: e.target.value })
                            }
                            placeholder="O pega una URL de imagen (https://...)"
                            className="w-full text-[11px] font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Gallery Images */}
                  <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                        Galería de Fotos Adicionales ({editProdForm.images.length})
                      </label>
                      <button
                        type="button"
                        onClick={() => prodExtraImageInputRef.current?.click()}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Subir otra foto</span>
                      </button>
                    </div>

                    {editProdForm.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {editProdForm.images.map((imgUrl, idx) => (
                          <div
                            key={idx}
                            className="relative w-14 h-14 rounded-lg overflow-hidden bg-white border border-slate-200 group/img shrink-0"
                          >
                            <img
                              src={imgUrl}
                              alt={`Extra ${idx}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditProdForm((prev) => ({
                                  ...prev,
                                  images: prev.images.filter((_, i) => i !== idx),
                                }));
                              }}
                              className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors cursor-pointer"
                              title="Quitar foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        No hay fotos adicionales agregadas
                      </p>
                    )}

                    <div className="flex items-center space-x-2 pt-1">
                      <input
                        type="text"
                        value={newExtraImageUrl}
                        onChange={(e) => setNewExtraImageUrl(e.target.value)}
                        placeholder="O pega URL de foto adicional..."
                        className="flex-1 text-[11px] font-medium px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newExtraImageUrl.trim()) {
                            setEditProdForm((prev) => ({
                              ...prev,
                              images: prev.images.includes(newExtraImageUrl.trim())
                                ? prev.images
                                : [...prev.images, newExtraImageUrl.trim()],
                            }));
                            setNewExtraImageUrl("");
                          }
                        }}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Descripción del Producto
                    </label>
                    <textarea
                      value={editProdForm.description}
                      onChange={(e) =>
                        setEditProdForm({ ...editProdForm, description: e.target.value })
                      }
                      rows={3}
                      placeholder="Describe materiales, detalles, garantía, tallas, colores..."
                      className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none text-slate-800 resize-none leading-relaxed"
                    />
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
                    <button
                      type="button"
                      disabled={isSavingProduct}
                      onClick={() => setEditingProduct(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProduct ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Guardando cambios...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Guardar Cambios</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Product Confirmation Modal */}
        {deletingProduct && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            id="modal-delete-product-backdrop"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center"
              id="modal-delete-product-content"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="font-display font-extrabold text-base text-slate-900">
                ¿Eliminar este producto?
              </h3>

              <div className="my-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center space-x-3 text-left">
                <img
                  src={
                    deletingProduct.imageUrl ||
                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80"
                  }
                  alt={deletingProduct.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-lg object-cover bg-white border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 truncate">
                    {deletingProduct.name}
                  </p>
                  <p className="text-amber-600 font-bold text-xs mt-0.5">
                    ${Number(deletingProduct.price || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Esta acción retirará el producto de tu tienda, catálogo público y bases de datos. No se puede deshacer.
              </p>

              <div className="flex items-center justify-center space-x-2.5">
                <button
                  type="button"
                  disabled={isDeletingProduct}
                  onClick={() => setDeletingProduct(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingProduct}
                  onClick={handleConfirmDeleteProduct}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  id="btn-confirm-delete-product"
                >
                  {isDeletingProduct ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ProductosPerfilView;
