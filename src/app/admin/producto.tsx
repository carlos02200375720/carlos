import React, { useState, useMemo } from "react";
import {
  Search,
  ExternalLink,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product } from "../../types";
import { apiFetch } from "../../config";

export interface ProductoAdminProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  onProductClick: (product: Product) => void;
  onStatusMessage?: (msg: { type: "success" | "error" | "info"; text: string } | null) => void;
  onRequestDeleteProduct?: (target: { type: "product"; id: string; name: string }) => void;
}

export default function ProductoAdminView({
  products,
  setProducts,
  onProductClick,
  onStatusMessage,
  onRequestDeleteProduct,
}: ProductoAdminProps) {
  const [productSearch, setProductSearch] = useState("");
  const [localDeletingProduct, setLocalDeletingProduct] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notify = (msg: { type: "success" | "error" | "info"; text: string }) => {
    if (onStatusMessage) {
      onStatusMessage(msg);
      setTimeout(() => onStatusMessage(null), 4000);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.sellerName && p.sellerName.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const confirmLocalDeleteProduct = async () => {
    if (!localDeletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/api/products/${localDeletingProduct.id}`, { method: "DELETE" });
      if (res) {
        setProducts((prev) => prev.filter((p) => p.id !== localDeletingProduct.id));
        notify({
          type: "success",
          text: `Producto "${localDeletingProduct.name}" eliminado del catálogo.`,
        });
      }
    } catch (err: any) {
      console.error("Error deleting product in admin:", err);
      notify({
        type: "error",
        text: err.message || "Error al procesar la eliminación",
      });
    } finally {
      setIsDeleting(false);
      setLocalDeletingProduct(null);
    }
  };

  return (
    <div
      className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5"
      id="admin-tab-content-products"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Catálogo de Productos</h2>
          <p className="text-xs text-slate-500">
            Supervisa artículos disponibles en la tienda oficial, existencias y precios.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="Buscar por nombre o vendedor..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No hay productos que coincidan con la búsqueda.
          </div>
        ) : (
          filteredProducts.map((prod, pIdx) => (
            <div
              key={`${prod.id}-${pIdx}`}
              className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="p-4 flex space-x-3">
                <img
                  src={prod.imageUrl}
                  alt={prod.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{prod.name}</h4>
                  <p className="text-[11px] font-mono font-black text-emerald-600">
                    ${Number(prod.price).toFixed(2)} USD
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Vendedor:{" "}
                    <span className="font-semibold text-slate-600">
                      {prod.sellerName || "Oficial"}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-white px-4 py-2.5 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => onProductClick(prod)}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center space-x-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Producto</span>
                </button>
                <button
                  onClick={() => {
                    if (onRequestDeleteProduct) {
                      onRequestDeleteProduct({
                        type: "product",
                        id: prod.id,
                        name: prod.name,
                      });
                    } else {
                      setLocalDeletingProduct({
                        id: prod.id,
                        name: prod.name,
                      });
                    }
                  }}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                  title="Eliminar producto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fallback Confirmation Modal when used standalone */}
      <AnimatePresence>
        {localDeletingProduct && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-900"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">¿Confirmar eliminación?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Estás a punto de eliminar de forma permanente el producto{" "}
                  <span className="font-bold text-slate-900">"{localDeletingProduct.name}"</span>.
                  Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setLocalDeletingProduct(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmLocalDeleteProduct}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeleting ? "Eliminando..." : "Eliminar Definitivamente"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
