import React from "react";
import { ArrowLeft, ShoppingCart, Check, Trash2, Minus, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, CartItem } from "../../../types";

export interface CarritoTiendaViewProps {
  showCartDrawer: boolean;
  closeCartDrawer: () => void;
  cart: CartItem[];
  cartItemCount: number;
  selectedCartIndices: number[];
  isAllCartSelected: boolean;
  toggleSelectAllCart: () => void;
  toggleItemSelection: (index: number, e?: React.MouseEvent) => void;
  onRemoveFromCart: (productId: string, cartItemIndex?: number) => void;
  onUpdateCartQuantity: (productId: string, qty: number, cartItemIndex?: number) => void;
  onSelectProductFromCart: (product: Product) => void;
  selectedCartItems: CartItem[];
  cartSubtotal: number;
  cartShippingTotal: number;
  cartTotal: number;
  startCheckout: () => void;
}

export function CarritoTiendaView({
  showCartDrawer,
  closeCartDrawer,
  cart,
  cartItemCount,
  selectedCartIndices,
  isAllCartSelected,
  toggleSelectAllCart,
  toggleItemSelection,
  onRemoveFromCart,
  onUpdateCartQuantity,
  onSelectProductFromCart,
  selectedCartItems,
  cartSubtotal,
  cartShippingTotal,
  cartTotal,
  startCheckout,
}: CarritoTiendaViewProps) {
  return (
    <AnimatePresence>
      {showCartDrawer && (
        <>
          {/* Drawer Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={closeCartDrawer}
            className="fixed inset-0 bg-black z-50"
          />

          {/* Slider Drawer Element */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[100] border-l border-slate-200 flex flex-col justify-between"
          >
            {/* Drawer Header */}
            <div
              className="px-4 pb-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0"
              style={{
                paddingTop: "0.75rem",
              }}
            >
              <div className="flex items-center space-x-2">
                <button
                  onClick={closeCartDrawer}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
                  id="close-cart-drawer-btn"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center space-x-1.5">
                  <ShoppingCart className="w-4 h-4 text-amber-500" />
                  <span className="font-display font-bold text-sm text-slate-900">
                    Carrito ({cartItemCount})
                  </span>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSelectAllCart}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer bg-transparent border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-slate-700 active:scale-95"
                  id="select-all-cart-btn"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${
                      isAllCartSelected
                        ? "bg-amber-500 text-slate-950"
                        : selectedCartIndices.length > 0
                        ? "bg-amber-200 text-amber-900"
                        : "border border-slate-300 bg-white"
                    }`}
                  >
                    {isAllCartSelected ? (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    ) : selectedCartIndices.length > 0 ? (
                      <div className="w-1.5 h-1.5 bg-amber-900 rounded-xs" />
                    ) : null}
                  </div>
                  <span className="text-[10.5px]">
                    {isAllCartSelected ? "Quitar" : "Todo"} ({selectedCartIndices.length}/{cart.length})
                  </span>
                </button>
              )}
            </div>

            {/* Drawer Content */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-white no-scrollbar"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                  <ShoppingCart className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                  <p className="font-medium text-slate-600">Su carrito está vacío</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Explora productos recomendados por nuestros creadores.
                  </p>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const isSelected = selectedCartIndices.includes(idx);
                  const shippingFee =
                    item.selectedShippingCost !== undefined
                      ? item.selectedShippingCost
                      : item.product.shippingCost !== undefined
                      ? item.product.shippingCost
                      : 0;
                  const carrierName = item.selectedCarrier || item.product.selectedCarrier;

                  return (
                    <div
                      key={`${item.product.id}_${idx}`}
                      className={`flex items-stretch rounded-2xl border transition-all shadow-sm overflow-hidden h-28 shrink-0 relative ${
                        isSelected
                          ? "bg-amber-500/[0.04] border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/40"
                          : "bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-100"
                      }`}
                      id={`cart-item-${item.product.id}-${idx}`}
                    >
                      <div className="w-24 sm:w-28 shrink-0 relative bg-slate-200 h-full overflow-hidden">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                          onClick={() => onSelectProductFromCart(item.product)}
                        />
                      </div>
                      <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4
                              className="text-xs font-extrabold text-slate-900 truncate cursor-pointer hover:text-amber-600 transition-colors"
                              title={item.product.name}
                              onClick={() => onSelectProductFromCart(item.product)}
                            >
                              {item.product.name}
                            </h4>
                            <button
                              onClick={() => onRemoveFromCart(item.product.id, idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0 -mt-1 -mr-1"
                              title="Eliminar producto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-mono font-extrabold text-amber-600">
                              ${item.product.price.toFixed(2)}
                            </span>
                            <span className="text-[9px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded leading-tight">
                              Envío: {shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : "Gratis"}
                              {carrierName ? ` (${carrierName})` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Incrementor buttons & Selection in bottom-right */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() =>
                                onUpdateCartQuantity(
                                  item.product.id,
                                  Math.max(1, item.quantity - 1),
                                  idx
                                )
                              }
                              className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs transition-colors cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-extrabold text-slate-900 px-1">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                onUpdateCartQuantity(item.product.id, item.quantity + 1, idx)
                              }
                              disabled={item.quantity >= item.product.stock}
                              className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-bold flex items-center justify-center text-xs disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Selector in bottom-right corner */}
                          <button
                            type="button"
                            onClick={(e) => toggleItemSelection(idx, e)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                              isSelected
                                ? "bg-amber-500 border-amber-500 text-slate-950 shadow-sm shadow-amber-500/30 scale-105"
                                : "bg-white border-slate-300 hover:border-amber-400 text-transparent hover:text-slate-300"
                            }`}
                            title={
                              isSelected
                                ? "Deseleccionar producto para pago"
                                : "Seleccionar producto para pagar"
                            }
                            id={`select-item-checkbox-${idx}`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer summary */}
            {cart.length > 0 && (
              <div className="px-4 pt-2 pb-[1px] md:py-2 border-t border-slate-100 bg-white space-y-1.5 shrink-0">
                <div className="flex justify-between text-[11px] text-slate-500 font-medium leading-tight">
                  <span>
                    Subtotal ({selectedCartItems.length} de {cart.length} selec.):
                  </span>
                  <span className="font-mono text-slate-800 font-semibold">
                    ${cartSubtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium leading-tight">
                  <span>Costo de Envío:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {cartShippingTotal === 0 ? "GRATIS" : `$${cartShippingTotal.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-900 border-t border-slate-100 pt-1.5">
                  <span>Total a Pagar:</span>
                  <span className="font-mono text-slate-950 font-black text-sm">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={startCheckout}
                  disabled={selectedCartItems.length === 0}
                  className={`w-full font-extrabold py-2.5 sm:py-3 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer mt-1 shadow-md ${
                    selectedCartItems.length > 0
                      ? "bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 shadow-amber-500/20"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
                  id="checkout-btn"
                >
                  {selectedCartItems.length > 0 ? (
                    <>
                      <span>
                        Pagar ({selectedCartItems.length}{" "}
                        {selectedCartItems.length === 1 ? "producto" : "productos"})
                      </span>
                      <ArrowLeft className="w-4 h-4 rotate-180 text-slate-950" />
                    </>
                  ) : (
                    <span>Selecciona productos para pagar</span>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const Carrito = CarritoTiendaView;
export default CarritoTiendaView;
