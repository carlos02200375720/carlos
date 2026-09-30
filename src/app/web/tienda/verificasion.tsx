import React from "react";
import { Truck, CreditCard, ShoppingBag, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { CartItem } from "../../../types";

export const DEST_COUNTRIES = [
  { code: "US", name: "Estados Unidos 🇺🇸" },
  { code: "ES", name: "España 🇪🇸" },
  { code: "MX", name: "México 🇲🇽" },
  { code: "CO", name: "Colombia 🇨🇴" },
  { code: "CL", name: "Chile 🇨🇱" },
  { code: "AR", name: "Argentina 🇦🇷" },
  { code: "PE", name: "Perú 🇵🇪" },
  { code: "EC", name: "Ecuador 🇪🇨" },
  { code: "DO", name: "República Dominicana 🇩🇴" },
  { code: "GT", name: "Guatemala 🇬🇹" },
  { code: "VE", name: "Venezuela 🇻🇪" },
  { code: "FR", name: "Francia 🇫🇷" },
  { code: "DE", name: "Alemania 🇩🇪" },
  { code: "GB", name: "Reino Unido 🇬🇧" },
  { code: "CA", name: "Canadá 🇨🇦" },
  { code: "BR", name: "Brasil 🇧🇷" },
  { code: "IT", name: "Italia 🇮🇹" },
  { code: "PT", name: "Portugal 🇵🇹" },
  { code: "AU", name: "Australia 🇦🇺" },
];

export interface VerificasionTiendaViewProps {
  activeStep: "checkout" | "payment";
  name: string;
  setName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  country: string;
  setCountry: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  cardNumber: string;
  setCardNumber: (val: string) => void;
  expiry: string;
  setExpiry: (val: string) => void;
  cvv: string;
  setCvv: (val: string) => void;
  isFormValid: boolean;
  effectiveCheckoutItems: CartItem[];
  cartSubtotal: number;
  cartShippingTotal: number;
  cartTotal: number;
  executePayment: () => void;
}

export function VerificasionTiendaView({
  activeStep,
  name,
  setName,
  email,
  setEmail,
  phone,
  setPhone,
  address,
  setAddress,
  country,
  setCountry,
  city,
  setCity,
  cardNumber,
  setCardNumber,
  expiry,
  setExpiry,
  cvv,
  setCvv,
  isFormValid,
  effectiveCheckoutItems,
  cartSubtotal,
  cartShippingTotal,
  cartTotal,
  executePayment,
}: VerificasionTiendaViewProps) {
  if (activeStep === "payment") {
    return (
      <motion.div
        key="payment"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="h-[380px] flex flex-col items-center justify-center text-center"
      >
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <h3 className="font-display font-extrabold text-lg text-slate-900 mt-6 animate-pulse">
          Procesando Pago Seguro...
        </h3>
        <p className="text-xs text-slate-500 mt-2 max-w-sm">
          Conectando con la pasarela bancaria WebRTC. Por favor, no recargue ni cierre la pestaña.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="checkout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-5xl mx-auto px-2 sm:px-4 py-2 pb-24 md:pb-8"
    >
      {/* Left Column: Checkout Inputs (3 cols) */}
      <div className="md:col-span-3 space-y-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2 pb-2 border-b border-slate-100">
            <Truck className="w-4 h-4 text-amber-500" />
            <span>Información de Envío</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                placeholder="Ej: Carlos Gómez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Número de Teléfono
                </label>
                <input
                  type="tel"
                  placeholder="+34 612 345 678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Dirección de Entrega
              </label>
              <input
                type="text"
                placeholder="Calle, Número, Piso/Puerta"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  País
                </label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none cursor-pointer pr-8 transition-all"
                  >
                    {DEST_COUNTRIES.map((c, cIdx) => (
                      <option key={`${c.code}-${cIdx}`} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Santo Domingo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-semibold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <h3 className="font-display font-extrabold text-sm text-slate-900 mb-4 flex items-center space-x-2 pb-2 border-b border-slate-100">
            <CreditCard className="w-4 h-4 text-amber-500" />
            <span>Información de Tarjeta</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Número de Tarjeta
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 pl-10 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
                />
                <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Vencimiento
                </label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  CVV
                </label>
                <input
                  type="password"
                  placeholder="000"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 text-xs rounded-xl p-3 font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Order Summary (2 cols) */}
      <div
        className="md:col-span-2 bg-white text-slate-900 p-6 rounded-2xl flex flex-col justify-between border border-slate-200/90 shadow-xl shadow-slate-100/80 space-y-5 h-fit sticky top-20"
        id="checkout-order-summary"
      >
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-amber-500" />
              <h3 className="font-display font-extrabold text-sm text-slate-900">
                Resumen del Pedido
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {effectiveCheckoutItems.reduce((acc, i) => acc + i.quantity, 0)}{" "}
              {effectiveCheckoutItems.reduce((acc, i) => acc + i.quantity, 0) === 1
                ? "producto"
                : "productos"}
            </span>
          </div>

          <div
            className="space-y-3 max-h-[220px] overflow-y-auto pr-1 divide-y divide-slate-100 no-scrollbar"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {effectiveCheckoutItems.map((item, idx) => (
              <div
                key={`${item.product.id}-${idx}`}
                className="flex items-center justify-between text-xs pt-2.5 first:pt-0"
              >
                <div className="flex items-center space-x-3 truncate flex-1 pr-2">
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-cover rounded-lg border border-slate-100 shrink-0 bg-slate-50"
                  />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 text-xs block truncate">
                      {item.product.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Cant: {item.quantity} × ${item.product.price.toFixed(2)}
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-900 text-xs shrink-0">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 mt-5 pt-4 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal Productos</span>
              <span className="font-mono font-semibold">${cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 items-center">
              <span>Costo de Envío</span>
              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                {cartShippingTotal === 0 ? "GRATIS" : `$${cartShippingTotal.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200/80 pt-3 mt-2">
              <span>Total a Pagar</span>
              <span className="text-amber-600 font-mono text-lg">${cartTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Integrated Pay Button inside the Order Summary (fixed bottom on mobile, inline on desktop) */}
        <div className="flex flex-col space-y-3 pt-2">
          {!isFormValid && (
            <span className="text-[11px] text-rose-500 font-bold animate-pulse text-center bg-rose-50/70 border border-rose-100 py-1.5 px-2 rounded-lg">
              Por favor complete los datos de envío y pago
            </span>
          )}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 pt-1.5 pb-[1px] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:static md:z-auto md:bg-transparent md:backdrop-blur-none md:border-0 md:p-0 md:shadow-none">
            <button
              onClick={executePayment}
              className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-extrabold py-3.5 px-6 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-amber-500/25 border border-amber-400"
              id="pay-now-desktop-btn"
            >
              <ShieldCheck className="w-5 h-5 text-slate-950 shrink-0" />
              <span>Pagar (${cartTotal.toFixed(2)})</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-center">
          <p className="text-[11px] text-amber-900 font-semibold flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Pago 100% seguro con encriptación SSL 256-bit</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export const Verificasion = VerificasionTiendaView;
export const Verificacion = VerificasionTiendaView;
export const VerificacionTiendaView = VerificasionTiendaView;
export default VerificasionTiendaView;
