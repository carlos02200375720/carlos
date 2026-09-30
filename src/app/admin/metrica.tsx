import React, { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Eye,
  Heart,
  MessageSquare,
  Bookmark,
  ShoppingBag,
  Users,
  Video,
  Truck,
  CheckCircle2,
  Package,
  ExternalLink,
  Award,
  Activity,
} from "lucide-react";
import { User, Reel, Product, Order } from "../../types";

export interface MetricaAdminProps {
  users: User[];
  reels: Reel[];
  products: Product[];
  orders: Order[];
  onCreatorClick?: (creatorId: string) => void;
  onProductClick?: (product: Product) => void;
  onReelClick?: (reelId: string) => void;
}

type MetricSection = "all" | "ventas" | "reels" | "creadores";

export default function MetricaAdminView({
  users,
  reels,
  products,
  orders,
  onCreatorClick,
  onProductClick,
  onReelClick,
}: MetricaAdminProps) {
  const [activeSection, setActiveSection] = useState<MetricSection>("all");

  // --- 1. E-Commerce & Revenue Metrics ---
  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [orders]
  );

  const totalShippingRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + (Number(o.shippingCost) || 0), 0),
    [orders]
  );

  const avgOrderValue = useMemo(
    () => (orders.length > 0 ? totalRevenue / orders.length : 0),
    [orders.length, totalRevenue]
  );

  const totalItemsSold = useMemo(
    () =>
      orders.reduce(
        (sum, o) =>
          sum +
          (Array.isArray(o.items)
            ? o.items.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0)
            : 0),
        0
      ),
    [orders]
  );

  const orderStatusBreakdown = useMemo(() => {
    const counts = {
      delivered: 0,
      shipped: 0,
      processing: 0,
      pending: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      const st = (o.status || "pending") as keyof typeof counts;
      if (counts[st] !== undefined) {
        counts[st] += 1;
      } else {
        counts.pending += 1;
      }
    });
    return counts;
  }, [orders]);

  // --- 2. Reels & Content Engagement Metrics ---
  const totalReelViews = useMemo(
    () => reels.reduce((sum, r) => sum + (Number(r.views) || 0), 0),
    [reels]
  );

  const totalReelLikes = useMemo(
    () => reels.reduce((sum, r) => sum + (Number(r.likes) || 0), 0),
    [reels]
  );

  const totalReelComments = useMemo(
    () =>
      reels.reduce(
        (sum, r) => sum + (Array.isArray(r.comments) ? r.comments.length : 0),
        0
      ),
    [reels]
  );

  const totalReelSaves = useMemo(
    () => reels.reduce((sum, r) => sum + (Number(r.saves) || 0), 0),
    [reels]
  );

  const engagementRate = useMemo(() => {
    if (totalReelViews <= 0) return 0;
    const interactions = totalReelLikes + totalReelComments + totalReelSaves;
    return Math.min(100, (interactions / totalReelViews) * 100);
  }, [totalReelViews, totalReelLikes, totalReelComments, totalReelSaves]);

  // --- 3. Catalog & Community Metrics ---
  const totalProductViews = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p.views) || 0), 0),
    [products]
  );

  const totalInventoryUnits = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0),
    [products]
  );

  const totalInventoryValue = useMemo(
    () =>
      products.reduce(
        (sum, p) => sum + (Number(p.price) || 0) * (Number(p.stock) || 0),
        0
      ),
    [products]
  );

  const onlineUsersCount = useMemo(
    () => users.filter((u) => u.isOnline).length,
    [users]
  );

  const activeSellersCount = useMemo(
    () => users.filter((u) => u.canSell || u.isAdmin || u.role === "superadmin").length,
    [users]
  );

  // --- 4. Rankings ---
  const topReels = useMemo(() => {
    return [...reels]
      .sort((a, b) => {
        const scoreB = (Number(b.views) || 0) + (Number(b.likes) || 0) * 3;
        const scoreA = (Number(a.views) || 0) + (Number(a.likes) || 0) * 3;
        return scoreB - scoreA;
      })
      .slice(0, 6);
  }, [reels]);

  const topProducts = useMemo(() => {
    const salesByProduct: Record<string, { units: number; revenue: number }> = {};
    orders.forEach((order) => {
      if (!Array.isArray(order.items)) return;
      order.items.forEach((item) => {
        const pid = item.productId || item.name;
        if (!pid) return;
        if (!salesByProduct[pid]) {
          salesByProduct[pid] = { units: 0, revenue: 0 };
        }
        const qty = Number(item.quantity) || 1;
        salesByProduct[pid].units += qty;
        salesByProduct[pid].revenue += (Number(item.price) || 0) * qty;
      });
    });

    return products
      .map((prod) => {
        const stats = salesByProduct[prod.id] || salesByProduct[prod.name] || {
          units: 0,
          revenue: 0,
        };
        return {
          product: prod,
          unitsSold: stats.units,
          revenue: stats.revenue,
          views: Number(prod.views) || 0,
        };
      })
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
        return b.views - a.views;
      })
      .slice(0, 6);
  }, [products, orders]);

  const topCreators = useMemo(() => {
    return users
      .map((u) => {
        const userReels = reels.filter(
          (r) =>
            r.creatorId === u.id ||
            (r.creatorUsername &&
              u.username &&
              r.creatorUsername.toLowerCase() === u.username.toLowerCase())
        );
        const userProducts = products.filter(
          (p) =>
            p.sellerId === u.id ||
            (p.sellerUsername &&
              u.username &&
              p.sellerUsername.toLowerCase() === u.username.toLowerCase())
        );
        const creatorViews = userReels.reduce(
          (acc, r) => acc + (Number(r.views) || 0),
          0
        );
        const creatorLikes = userReels.reduce(
          (acc, r) => acc + (Number(r.likes) || 0),
          0
        );
        return {
          user: u,
          reelsCount: userReels.length,
          productsCount: userProducts.length,
          totalViews: creatorViews,
          totalLikes: creatorLikes,
          followers: Number(u.followers) || 0,
        };
      })
      .sort((a, b) => {
        const scoreB = b.totalViews + b.followers * 5 + b.reelsCount * 10;
        const scoreA = a.totalViews + a.followers * 5 + a.reelsCount * 10;
        return scoreB - scoreA;
      })
      .slice(0, 6);
  }, [users, reels, products]);

  return (
    <div className="space-y-6 select-none" id="admin-tab-content-metrica">
      {/* Header & Section Filter */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-[11px] font-black uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
            <span>Analítica en Tiempo Real</span>
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Métricas y Rendimiento de la Plataforma
          </h2>
          <p className="text-xs text-slate-500">
            Indicadores clave de ingresos, conversión de tienda, interacción en reels y crecimiento de creadores.
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl self-start md:self-center overflow-x-auto max-w-full">
          {[
            { id: "all", label: "Vista Global" },
            { id: "ventas", label: "Ventas & Tienda" },
            { id: "reels", label: "Engagement Reels" },
            { id: "creadores", label: "Creadores" },
          ].map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id as MetricSection)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeSection === sec.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ingresos Totales */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Ingresos Totales</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-display font-black text-slate-900">
              ${totalRevenue.toFixed(2)} <span className="text-xs font-mono text-slate-400">USD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Ticket promedio:{" "}
              <span className="font-bold text-emerald-600">${avgOrderValue.toFixed(2)}</span> •{" "}
              {totalItemsSold} uds. vendidas
            </p>
          </div>
        </div>

        {/* KPI 2: Alcance y Engagement */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Interacción en Reels</span>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-display font-black text-slate-900">
              {totalReelViews.toLocaleString()}{" "}
              <span className="text-xs font-mono text-slate-400">vistas</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Engagement:{" "}
              <span className="font-bold text-rose-600">{engagementRate.toFixed(1)}%</span> •{" "}
              {totalReelLikes} likes • {totalReelComments} coment.
            </p>
          </div>
        </div>

        {/* KPI 3: Catálogo e Inventario */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Valor de Inventario</span>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-display font-black text-slate-900">
              ${totalInventoryValue.toFixed(2)}{" "}
              <span className="text-xs font-mono text-slate-400">USD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="font-bold text-indigo-600">{totalInventoryUnits}</span> unidades en
              stock • {totalProductViews} vistas
            </p>
          </div>
        </div>

        {/* KPI 4: Comunidad Activa */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Comunidad y Vendedores</span>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-display font-black text-slate-900">
              {users.length}{" "}
              <span className="text-xs font-mono text-slate-400">cuentas</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              <span className="font-bold text-emerald-600">{onlineUsersCount} en línea</span> •{" "}
              {activeSellersCount} con permiso de venta
            </p>
          </div>
        </div>
      </div>

      {/* Section: Ventas & Estado Logístico */}
      {(activeSection === "all" || activeSection === "ventas") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Funnel de Órdenes */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Distribución de Pedidos ({orders.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Envíos: ${totalShippingRevenue.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3.5">
              {[
                {
                  key: "delivered",
                  label: "Entregados",
                  count: orderStatusBreakdown.delivered,
                  color: "bg-emerald-500",
                  textColor: "text-emerald-700",
                },
                {
                  key: "shipped",
                  label: "En Tránsito / Enviados",
                  count: orderStatusBreakdown.shipped,
                  color: "bg-blue-500",
                  textColor: "text-blue-700",
                },
                {
                  key: "processing",
                  label: "En Preparación",
                  count: orderStatusBreakdown.processing,
                  color: "bg-amber-500",
                  textColor: "text-amber-700",
                },
                {
                  key: "pending",
                  label: "Pendientes",
                  count: orderStatusBreakdown.pending,
                  color: "bg-slate-400",
                  textColor: "text-slate-700",
                },
                {
                  key: "cancelled",
                  label: "Cancelados",
                  count: orderStatusBreakdown.cancelled,
                  color: "bg-rose-500",
                  textColor: "text-rose-700",
                },
              ].map((item) => {
                const pct =
                  orders.length > 0 ? Math.round((item.count / orders.length) * 100) : 0;
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700">{item.label}</span>
                      <span className={`font-mono font-bold ${item.textColor}`}>
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Productos por Rendimiento */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Productos con Mayor Rendimiento
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Top {topProducts.length} del catálogo
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No hay productos registrados en el catálogo.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topProducts.map((item, idx) => (
                  <div
                    key={`${item.product.id}-${idx}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="w-5 text-xs font-mono font-black text-slate-400">
                        #{idx + 1}
                      </span>
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Precio:{" "}
                          <span className="font-mono font-bold text-slate-800">
                            ${Number(item.product.price).toFixed(2)}
                          </span>{" "}
                          • Stock: {item.product.stock}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-mono font-black text-emerald-600">
                          {item.unitsSold} vendidos (${item.revenue.toFixed(2)})
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {item.views} vistas en tienda
                        </p>
                      </div>
                      {onProductClick && (
                        <button
                          type="button"
                          onClick={() => onProductClick(item.product)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Ver producto"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section: Rendimiento de Reels */}
      {(activeSection === "all" || activeSection === "reels") && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Video className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900">
                Reels con Mayor Alcance e Interacción
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                {totalReelViews} vistas
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                {totalReelLikes} likes
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                {totalReelComments} comentarios
              </span>
              <span className="flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                {totalReelSaves} guardados
              </span>
            </div>
          </div>

          {topReels.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              No hay reels publicados actualmente.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topReels.map((reel, idx) => (
                <div
                  key={`${reel.id}-${idx}`}
                  className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 font-mono font-black text-[10px]">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {reel.creatorName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">
                        {reel.type || "video"}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-800 line-clamp-1">
                      {reel.title || reel.description || "Publicación sin título"}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] font-mono text-slate-600">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center gap-1" title="Vistas">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <b>{reel.views || 0}</b>
                      </span>
                      <span className="flex items-center gap-1" title="Me gusta">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <b>{reel.likes || 0}</b>
                      </span>
                      <span className="flex items-center gap-1" title="Comentarios">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                        <b>{Array.isArray(reel.comments) ? reel.comments.length : 0}</b>
                      </span>
                    </div>

                    {onReelClick && (
                      <button
                        type="button"
                        onClick={() => onReelClick(reel.id)}
                        className="text-xs font-sans font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                      >
                        Ver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section: Ranking de Creadores y Vendedores */}
      {(activeSection === "all" || activeSection === "creadores") && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-black text-slate-900">
                Creadores y Vendedores Destacados
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Por alcance, catálogo y seguidores
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topCreators.map((item, idx) => (
              <div
                key={`${item.user.id}-${idx}`}
                onClick={() => onCreatorClick?.(item.user.id)}
                className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-slate-50/40 hover:bg-amber-50/20 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={
                      item.user.avatar ||
                      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                    }
                    alt={item.user.name}
                    className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-600">
                      {item.user.name}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      @{item.user.username}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      <b>{item.followers}</b> seg. • <b>{item.reelsCount}</b> reels •{" "}
                      <b>{item.productsCount}</b> prod.
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-xs font-mono font-black text-slate-900 block">
                    {item.totalViews}
                  </span>
                  <span className="text-[10px] text-slate-400 block">vistas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
