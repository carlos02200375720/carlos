import React, { useState, useEffect, useMemo } from "react";
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
  Filter,
  Calendar,
  ShoppingCart,
  CreditCard,
  ArrowDown,
  Globe,
  Sparkles,
  Clock,
  Search,
  Key,
} from "lucide-react";
import { User, Reel, Product, Order } from "../../types";
import {
  fetchFunnelAnalytics,
  FunnelAnalyticsData,
  getLocalFunnelCounts,
} from "../../utils/analyticsTracker";
import { navigateTo } from "../../router";

export interface MetricaAdminProps {
  users: User[];
  reels: Reel[];
  products: Product[];
  orders: Order[];
  onCreatorClick?: (creatorId: string) => void;
  onProductClick?: (product: Product) => void;
  onReelClick?: (reelId: string) => void;
}

type MetricSection = "all" | "embudo" | "ventas" | "reels" | "creadores";
type FunnelTimePeriod = "day" | "week" | "month" | "year" | "all";

export default function MetricaAdminView({
  users,
  reels,
  products,
  orders,
  onCreatorClick,
  onProductClick,
  onReelClick,
}: MetricaAdminProps) {
  const [activeSection, setActiveSection] = useState<MetricSection>(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.toLowerCase();
      if (path.includes("embudo")) return "embudo";
    }
    return "all";
  });

  const [selectedFunnelPeriod, setSelectedFunnelPeriod] = useState<FunnelTimePeriod>("year");
  const [funnelApiData, setFunnelApiData] = useState<FunnelAnalyticsData | null>(null);
  const [localRefreshTick, setLocalRefreshTick] = useState(0);
  const [tokenSearchFilter, setTokenSearchFilter] = useState("");
  const [tokenLayerFilter, setTokenLayerFilter] = useState<number | "all">("all");

  useEffect(() => {
    let mounted = true;
    const loadFunnel = async () => {
      const data = await fetchFunnelAnalytics();
      if (mounted && data) {
        setFunnelApiData(data);
      }
    };
    loadFunnel();

    const handleLocalUpdate = () => {
      setLocalRefreshTick((t) => t + 1);
      loadFunnel();
    };

    window.addEventListener("funnel-analytics-updated", handleLocalUpdate);
    return () => {
      mounted = false;
      window.removeEventListener("funnel-analytics-updated", handleLocalUpdate);
    };
  }, []);

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

  // --- 4. Sales Funnel (Embudo de Venta) & Page Visits Computation (100% Real Data: Visits + Unique Users) ---
  const computedFunnelData = useMemo(() => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const localDay = getLocalFunnelCounts(ONE_DAY);
    const localWeek = getLocalFunnelCounts(ONE_DAY * 7);
    const localMonth = getLocalFunnelCounts(ONE_DAY * 30);
    const localYear = getLocalFunnelCounts(ONE_DAY * 365);

    if (funnelApiData) {
      return {
        pageVisits: {
          day: funnelApiData.pageVisits.day,
          week: funnelApiData.pageVisits.week,
          month: funnelApiData.pageVisits.month,
          year: funnelApiData.pageVisits.year,
        },
        pageUsers: {
          day: funnelApiData.pageUsers?.day ?? localDay.allUsers,
          week: funnelApiData.pageUsers?.week ?? localWeek.allUsers,
          month: funnelApiData.pageUsers?.month ?? localMonth.allUsers,
          year: funnelApiData.pageUsers?.year ?? localYear.allUsers,
        },
        funnelByPeriod: funnelApiData.funnelByPeriod,
      };
    }

    const now = Date.now();
    const getRealOrdersStatsInWindow = (windowMs: number) => {
      const matched = orders.filter((o) => {
        if (!o.createdAt) return windowMs >= ONE_DAY * 365;
        const createdMs = new Date(o.createdAt).getTime();
        if (Number.isNaN(createdMs)) return windowMs >= ONE_DAY * 365;
        return now - createdMs <= windowMs;
      });
      const buyers = new Set<string>();
      matched.forEach((o, idx) => {
        buyers.add(
          String(
            (o as any).userId || o.buyerUsername || o.buyerName || o.id || `b_${idx}`
          ).toLowerCase()
        );
      });
      return { visits: matched.length, users: buyers.size };
    };

    const buildRealPeriod = (
      windowMs: number,
      localCounts: ReturnType<typeof getLocalFunnelCounts>
    ) => {
      const ordStats = getRealOrdersStatsInWindow(windowMs);
      return {
        capa1_tienda: localCounts.tienda,
        capa2_producto_id: localCounts.producto_id,
        capa3_carrito: localCounts.carrito,
        capa4_verificacion: localCounts.verificacion,
        capa5_gracia: Math.max(localCounts.gracia, ordStats.visits),
        users: {
          capa1_tienda: localCounts.users.tienda,
          capa2_producto_id: localCounts.users.producto_id,
          capa3_carrito: localCounts.users.carrito,
          capa4_verificacion: localCounts.users.verificacion,
          capa5_gracia: Math.max(localCounts.users.gracia, ordStats.users),
        },
      };
    };

    return {
      pageVisits: {
        day: localDay.allVisits,
        week: localWeek.allVisits,
        month: localMonth.allVisits,
        year: localYear.allVisits,
      },
      pageUsers: {
        day: localDay.allUsers,
        week: localWeek.allUsers,
        month: localMonth.allUsers,
        year: localYear.allUsers,
      },
      funnelByPeriod: {
        day: buildRealPeriod(ONE_DAY, localDay),
        week: buildRealPeriod(ONE_DAY * 7, localWeek),
        month: buildRealPeriod(ONE_DAY * 30, localMonth),
        year: buildRealPeriod(ONE_DAY * 365, localYear),
        all: buildRealPeriod(ONE_DAY * 365 * 50, localYear),
      },
    };
  }, [funnelApiData, orders, localRefreshTick]);

  const activeFunnelMetrics =
    computedFunnelData.funnelByPeriod[selectedFunnelPeriod] ||
    computedFunnelData.funnelByPeriod.year;

  const funnelLayers = useMemo(() => {
    const rawC1 = activeFunnelMetrics.capa1_tienda;
    const c1 = Math.max(1, rawC1);
    const c2 = activeFunnelMetrics.capa2_producto_id;
    const c3 = activeFunnelMetrics.capa3_carrito;
    const c4 = activeFunnelMetrics.capa4_verificacion;
    const c5 = activeFunnelMetrics.capa5_gracia;

    const u1 = activeFunnelMetrics.users?.capa1_tienda ?? rawC1;
    const u1Base = Math.max(1, u1);
    const u2 = activeFunnelMetrics.users?.capa2_producto_id ?? c2;
    const u3 = activeFunnelMetrics.users?.capa3_carrito ?? c3;
    const u4 = activeFunnelMetrics.users?.capa4_verificacion ?? c4;
    const u5 = activeFunnelMetrics.users?.capa5_gracia ?? c5;

    return [
      {
        layerNumber: 1,
        badge: "CAPA 1",
        title: "Visitantes en la Tienda",
        routeDisplay: "dominio/tienda",
        targetPath: "/tienda",
        description: "Visitas totales y usuarios únicos que entraron a dominio/tienda",
        count: rawC1,
        usersCount: u1,
        unitLabel: "visitas",
        usersUnitLabel: "usuarios",
        pctOfTop: rawC1 > 0 ? 100 : 0,
        usersPctOfTop: u1 > 0 ? 100 : 0,
        stepConversionPct: rawC1 > 0 ? 100 : 0,
        usersStepConversionPct: u1 > 0 ? 100 : 0,
        widthClass: "w-full",
        bgGradient: "from-indigo-600/10 via-indigo-500/5 to-white",
        borderColor: "border-indigo-200 hover:border-indigo-400",
        badgeClass: "bg-indigo-600 text-white",
        routeBadgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
        barColor: "bg-indigo-600",
        numberColor: "text-indigo-700",
        icon: ShoppingBag,
      },
      {
        layerNumber: 2,
        badge: "CAPA 2",
        title: "Visitas a Detalle del Producto",
        routeDisplay: "dominio/tienda/id del producto",
        targetPath: products[0] ? `/tienda/${products[0].id}` : "/tienda",
        description: "Visitas totales y usuarios únicos en dominio/tienda/id del producto",
        count: c2,
        usersCount: u2,
        unitLabel: "visitas",
        usersUnitLabel: "usuarios",
        pctOfTop: rawC1 > 0 ? Math.min(100, Math.round((c2 / c1) * 100)) : 0,
        usersPctOfTop: u1 > 0 ? Math.min(100, Math.round((u2 / u1Base) * 100)) : 0,
        stepConversionPct: rawC1 > 0 ? Math.min(100, Math.round((c2 / c1) * 100)) : 0,
        usersStepConversionPct: u1 > 0 ? Math.min(100, Math.round((u2 / u1Base) * 100)) : 0,
        widthClass: "w-full md:w-[92%]",
        bgGradient: "from-violet-600/10 via-violet-500/5 to-white",
        borderColor: "border-violet-200 hover:border-violet-400",
        badgeClass: "bg-violet-600 text-white",
        routeBadgeClass: "bg-violet-50 text-violet-700 border-violet-200",
        barColor: "bg-violet-600",
        numberColor: "text-violet-700",
        icon: Eye,
      },
      {
        layerNumber: 3,
        badge: "CAPA 3",
        title: "Personas que Visitaron el Carrito",
        routeDisplay: "dominio/tienda/carrito",
        targetPath: "/tienda/carrito",
        description: "Visitas totales y usuarios únicos en dominio/tienda/carrito",
        count: c3,
        usersCount: u3,
        unitLabel: "visitas",
        usersUnitLabel: "usuarios",
        pctOfTop: rawC1 > 0 ? Math.min(100, Math.round((c3 / c1) * 100)) : 0,
        usersPctOfTop: u1 > 0 ? Math.min(100, Math.round((u3 / u1Base) * 100)) : 0,
        stepConversionPct: c2 > 0 ? Math.min(100, Math.round((c3 / c2) * 100)) : 0,
        usersStepConversionPct: u2 > 0 ? Math.min(100, Math.round((u3 / u2) * 100)) : 0,
        widthClass: "w-full md:w-[84%]",
        bgGradient: "from-amber-500/15 via-amber-500/5 to-white",
        borderColor: "border-amber-200 hover:border-amber-400",
        badgeClass: "bg-amber-500 text-slate-950",
        routeBadgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        barColor: "bg-amber-500",
        numberColor: "text-amber-600",
        icon: ShoppingCart,
      },
      {
        layerNumber: 4,
        badge: "CAPA 4",
        title: "Visitas a Página de Verificación",
        routeDisplay: "dominio/tienda/verificación",
        targetPath: "/tienda/verificacion",
        description: "Visitas totales y usuarios únicos en dominio/tienda/verificación",
        count: c4,
        usersCount: u4,
        unitLabel: "visitas",
        usersUnitLabel: "usuarios",
        pctOfTop: rawC1 > 0 ? Math.min(100, Math.round((c4 / c1) * 100)) : 0,
        usersPctOfTop: u1 > 0 ? Math.min(100, Math.round((u4 / u1Base) * 100)) : 0,
        stepConversionPct: c3 > 0 ? Math.min(100, Math.round((c4 / c3) * 100)) : 0,
        usersStepConversionPct: u3 > 0 ? Math.min(100, Math.round((u4 / u3) * 100)) : 0,
        widthClass: "w-full md:w-[76%]",
        bgGradient: "from-cyan-600/10 via-cyan-500/5 to-white",
        borderColor: "border-cyan-200 hover:border-cyan-400",
        badgeClass: "bg-cyan-600 text-white",
        routeBadgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
        barColor: "bg-cyan-600",
        numberColor: "text-cyan-700",
        icon: CreditCard,
      },
      {
        layerNumber: 5,
        badge: "CAPA 5",
        title: "Personas que Compraron (Página de Gracias)",
        routeDisplay: "dominio/tienda/gracia",
        targetPath: "/tienda/gracia",
        description: "Compras totales y compradores únicos que llegaron a dominio/tienda/gracia",
        count: c5,
        usersCount: u5,
        unitLabel: "visitas",
        usersUnitLabel: "usuarios",
        pctOfTop: rawC1 > 0 ? Math.min(100, Math.round((c5 / c1) * 100)) : 0,
        usersPctOfTop: u1 > 0 ? Math.min(100, Math.round((u5 / u1Base) * 100)) : 0,
        stepConversionPct: c4 > 0 ? Math.min(100, Math.round((c5 / c4) * 100)) : 0,
        usersStepConversionPct: u4 > 0 ? Math.min(100, Math.round((u5 / u4) * 100)) : 0,
        widthClass: "w-full md:w-[68%]",
        bgGradient: "from-emerald-600/15 via-emerald-500/5 to-white",
        borderColor: "border-emerald-300 hover:border-emerald-500",
        badgeClass: "bg-emerald-600 text-white",
        routeBadgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
        barColor: "bg-emerald-600",
        numberColor: "text-emerald-700",
        icon: CheckCircle2,
      },
    ];
  }, [activeFunnelMetrics, products]);

  // --- 5. Rankings ---
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

  const periodLabels: Record<FunnelTimePeriod, string> = {
    day: "Hoy (Por Día)",
    week: "Esta Semana (7 Días)",
    month: "Este Mes (30 Días)",
    year: "Este Año (365 Días)",
    all: "Histórico Total",
  };

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
            Embudo de ventas por capas, tráfico por período, ingresos, reels y crecimiento de creadores.
          </p>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl self-start md:self-center overflow-x-auto max-w-full">
          {[
            { id: "all", label: "Vista Global" },
            { id: "embudo", label: "Embudo de Ventas" },
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
              id={`metrica-section-btn-${sec.id}`}
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

      {/* NEW SECTION: Embudo de Venta (Sales Funnel) */}
      {(activeSection === "all" || activeSection === "embudo") && (
        <div
          className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6"
          id="admin-sales-funnel-section"
        >
          {/* Funnel Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 text-[11px] font-black uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sesión: Embudo de Venta (5 Capas)</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                Embudo de Conversión de Tienda y Visitas a la Página
              </h3>
              <p className="text-xs text-slate-500">
                Seguimiento completo desde que el visitante entra a{" "}
                <span className="font-mono font-bold text-slate-700">dominio/tienda</span> hasta que
                completa su compra en{" "}
                <span className="font-mono font-bold text-emerald-700">dominio/tienda/gracia</span>.
              </p>
            </div>

            {/* Period Filter Pills for the Funnel Layers */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl self-start lg:self-center overflow-x-auto max-w-full">
              {(
                [
                  { id: "day", label: "Día" },
                  { id: "week", label: "Semana" },
                  { id: "month", label: "Mes" },
                  { id: "year", label: "Año" },
                  { id: "all", label: "Total" },
                ] as { id: FunnelTimePeriod; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedFunnelPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFunnelPeriod === p.id
                      ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* TOP OF FUNNEL: Visitas de la Página por Día, Semana, Mes, Año */}
          <div className="space-y-2.5" id="funnel-top-visits-summary">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-600" />
                <span>Visitas Totales de la Página (Por Día, Semana, Mes y Año)</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Mostrando embudo: <b className="text-slate-700">{periodLabels[selectedFunnelPeriod]}</b>
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                {
                  id: "day" as FunnelTimePeriod,
                  title: "Tráfico por Día",
                  subtitle: "Últimas 24 horas (Hoy)",
                  badge: "DÍA",
                  count: computedFunnelData.pageVisits.day,
                  usersCount: computedFunnelData.pageUsers.day,
                  accent: "border-sky-200 bg-sky-50/40 hover:border-sky-400",
                  activeRing: "ring-2 ring-sky-500 border-sky-500 bg-sky-50/80",
                  badgeColor: "bg-sky-500/15 text-sky-700",
                  numColor: "text-sky-900",
                },
                {
                  id: "week" as FunnelTimePeriod,
                  title: "Tráfico por Semana",
                  subtitle: "Últimos 7 días",
                  badge: "SEMANA",
                  count: computedFunnelData.pageVisits.week,
                  usersCount: computedFunnelData.pageUsers.week,
                  accent: "border-indigo-200 bg-indigo-50/40 hover:border-indigo-400",
                  activeRing: "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/80",
                  badgeColor: "bg-indigo-500/15 text-indigo-700",
                  numColor: "text-indigo-900",
                },
                {
                  id: "month" as FunnelTimePeriod,
                  title: "Tráfico por Mes",
                  subtitle: "Últimos 30 días",
                  badge: "MES",
                  count: computedFunnelData.pageVisits.month,
                  usersCount: computedFunnelData.pageUsers.month,
                  accent: "border-amber-200 bg-amber-50/40 hover:border-amber-400",
                  activeRing: "ring-2 ring-amber-500 border-amber-500 bg-amber-50/80",
                  badgeColor: "bg-amber-500/20 text-amber-800",
                  numColor: "text-amber-900",
                },
                {
                  id: "year" as FunnelTimePeriod,
                  title: "Tráfico por Año",
                  subtitle: "Últimos 365 días",
                  badge: "AÑO",
                  count: computedFunnelData.pageVisits.year,
                  usersCount: computedFunnelData.pageUsers.year,
                  accent: "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400",
                  activeRing: "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/80",
                  badgeColor: "bg-emerald-500/15 text-emerald-800",
                  numColor: "text-emerald-900",
                },
              ].map((card) => {
                const isSelected = selectedFunnelPeriod === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedFunnelPeriod(card.id)}
                    className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                      isSelected ? card.activeRing : card.accent
                    }`}
                    id={`funnel-visits-card-${card.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-700">
                        {card.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase ${card.badgeColor}`}
                      >
                        {card.badge}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-xl sm:text-2xl font-display font-black ${card.numColor}`}
                          >
                            {card.count.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                            visitas
                          </span>
                        </div>
                      </div>
                      <div className="h-6 w-px bg-slate-200/80" />
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-xl sm:text-2xl font-display font-black text-slate-800">
                            {card.usersCount.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                            usuarios
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{card.subtitle}</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-LAYER VISUAL SALES FUNNEL */}
          <div className="pt-2 space-y-1.5" id="sales-funnel-layers-container">
            {funnelLayers.map((layer, index) => {
              const Icon = layer.icon;
              return (
                <React.Fragment key={layer.layerNumber}>
                  {/* Connector Arrow Between Funnel Layers */}
                  {index > 0 && (
                    <div className="flex items-center justify-center py-0.5">
                      <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600">
                        <ArrowDown className="w-3 h-3 text-slate-500" />
                        <span>
                          Avance Capa {layer.layerNumber}:{" "}
                          <b className="text-slate-900">{layer.stepConversionPct}%</b> visitas •{" "}
                          <b className="text-indigo-700">{layer.usersStepConversionPct}%</b> usuarios
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Funnel Layer Card */}
                  <div
                    className={`${layer.widthClass} mx-auto rounded-2xl border ${layer.borderColor} bg-gradient-to-r ${layer.bgGradient} p-4 sm:p-5 transition-all shadow-2xs relative overflow-hidden`}
                    id={`funnel-layer-${layer.layerNumber}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      {/* Left: Layer Badge, Title, Route & Description */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono font-black uppercase tracking-wider ${layer.badgeClass}`}
                          >
                            {layer.badge}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${layer.routeBadgeClass}`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{layer.routeDisplay}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => navigateTo(layer.targetPath)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            title={`Ir a ${layer.routeDisplay}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        <h4 className="text-sm sm:text-base font-black text-slate-900">
                          {layer.title}
                        </h4>
                        <p className="text-xs text-slate-600">{layer.description}</p>
                      </div>

                      {/* Right: Dual Counter (Por Visita & Por Usuario) */}
                      <div className="flex items-center gap-3 sm:gap-4 shrink-0 border-t sm:border-t-0 border-slate-200/60 pt-2.5 sm:pt-0">
                        {/* Counter 1: Por Visita */}
                        <div className="bg-white/90 border border-slate-200/80 rounded-xl px-3.5 py-2 text-right shadow-2xs">
                          <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-slate-400 block">
                            Por Visita
                          </span>
                          <div className="flex items-baseline justify-end gap-1 mt-0.5">
                            <span
                              className={`text-xl sm:text-2xl font-display font-black ${layer.numberColor}`}
                            >
                              {layer.count.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                              {layer.unitLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 block">
                            {layer.pctOfTop}% de visitas
                          </span>
                        </div>

                        {/* Counter 2: Por Usuario Único */}
                        <div className="bg-slate-900 text-white rounded-xl px-3.5 py-2 text-right shadow-2xs">
                          <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-amber-400 flex items-center justify-end gap-1">
                            <Users className="w-3 h-3 text-amber-400" />
                            <span>Por Usuario</span>
                          </span>
                          <div className="flex items-baseline justify-end gap-1 mt-0.5">
                            <span className="text-xl sm:text-2xl font-display font-black text-white">
                              {layer.usersCount.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-300 uppercase">
                              {layer.usersUnitLabel}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-400 block">
                            {layer.usersPctOfTop}% de usuarios
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Visual Funnel Progress Bar */}
                    <div className="mt-3 w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${layer.barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(6, layer.pctOfTop)}%` }}
                      />
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Bottom Summary Bar of Funnel Conversion */}
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">
                  Conversión Tienda → Producto (Capa 1 → 2)
                </p>
                <p className="text-xs text-slate-400">Interés en catálogo</p>
              </div>
              <span className="text-lg font-display font-black text-violet-700">
                {funnelLayers[1]?.stepConversionPct || 0}%
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500">
                  Conversión Carrito → Verificación (Capa 3 → 4)
                </p>
                <p className="text-xs text-slate-400">Intención de pago</p>
              </div>
              <span className="text-lg font-display font-black text-cyan-700">
                {funnelLayers[3]?.stepConversionPct || 0}%
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-emerald-800">
                  Conversión Final a Compra (Capa 1 → 5)
                </p>
                <p className="text-xs text-emerald-600">Llegaron a dominio/tienda/gracia</p>
              </div>
              <span className="text-lg font-display font-black text-emerald-700">
                {funnelLayers[4]?.pctOfTop || 0}%
              </span>
            </div>
          </div>

          {/* REAL-TIME TOKEN CLIENT TRACKING TABLE: Seguimiento en Vivo por Token */}
          <div className="pt-5 border-t border-slate-100 space-y-4" id="funnel-token-client-tracker">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>Monitoreo en Tiempo Real de Clientes por Token</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Identificador persistente único de cada usuario. Permite saber en qué etapa del embudo está el cliente y asegura que su carrito nunca se borre al refrescar la página.
                </p>
              </div>

              {/* Quick Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tokenSearchFilter}
                  onChange={(e) => setTokenSearchFilter(e.target.value)}
                  placeholder="Buscar por token o ruta..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Filter Pills by Funnel Layer */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
              <button
                type="button"
                onClick={() => setTokenLayerFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  tokenLayerFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900"
                }`}
              >
                Todas las Capas ({funnelApiData?.activeClients?.length || 0})
              </button>
              {[
                { layer: 1, label: "Capa 1: Tienda", color: "text-indigo-700 bg-indigo-50" },
                { layer: 2, label: "Capa 2: Producto", color: "text-violet-700 bg-violet-50" },
                { layer: 3, label: "Capa 3: Carrito", color: "text-amber-800 bg-amber-50" },
                { layer: 4, label: "Capa 4: Verificación", color: "text-cyan-800 bg-cyan-50" },
                { layer: 5, label: "Capa 5: Compra", color: "text-emerald-800 bg-emerald-50" },
              ].map((pill) => {
                const count = (funnelApiData?.activeClients || []).filter(
                  (c) => c.stageLayer === pill.layer
                ).length;
                return (
                  <button
                    key={pill.layer}
                    type="button"
                    onClick={() => setTokenLayerFilter(pill.layer)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap border ${
                      tokenLayerFilter === pill.layer
                        ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xs"
                        : `${pill.color} border-transparent hover:border-slate-300`
                    }`}
                  >
                    {pill.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Client List or Empty State */}
            {(!funnelApiData?.activeClients || funnelApiData.activeClients.length === 0) ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-400 bg-slate-50/50">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">Registrando interacciones por token...</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  A medida que los usuarios naveguen por la tienda, verán aquí su token y la etapa exacta del embudo en tiempo real.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/30">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Token del Cliente</th>
                      <th className="py-2.5 px-3">Etapa Actual del Embudo</th>
                      <th className="py-2.5 px-3">Estado del Carrito</th>
                      <th className="py-2.5 px-3">Última Ruta Visitada</th>
                      <th className="py-2.5 px-3 text-right">Última Actividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(funnelApiData.activeClients || [])
                      .filter((c) => {
                        if (tokenLayerFilter !== "all" && c.stageLayer !== tokenLayerFilter) return false;
                        if (!tokenSearchFilter) return true;
                        const q = tokenSearchFilter.toLowerCase().trim();
                        return (
                          c.token.toLowerCase().includes(q) ||
                          (c.userId && c.userId.toLowerCase().includes(q)) ||
                          (c.stageName && c.stageName.toLowerCase().includes(q)) ||
                          (c.lastPath && c.lastPath.toLowerCase().includes(q))
                        );
                      })
                      .map((client) => {
                        const isRecent = Date.now() - client.lastSeen < 60000;
                        const layerBadgeClass =
                          client.stageLayer === 1
                            ? "bg-indigo-100 text-indigo-800 border-indigo-200"
                            : client.stageLayer === 2
                            ? "bg-violet-100 text-violet-800 border-violet-200"
                            : client.stageLayer === 3
                            ? "bg-amber-100 text-amber-900 border-amber-300 font-black"
                            : client.stageLayer === 4
                            ? "bg-cyan-100 text-cyan-800 border-cyan-200"
                            : client.stageLayer === 5
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-black"
                            : "bg-slate-100 text-slate-700 border-slate-200";

                        const timeDiff = Math.max(0, Math.floor((Date.now() - client.lastSeen) / 1000));
                        const timeStr =
                          timeDiff < 60
                            ? `Hace ${timeDiff}s`
                            : timeDiff < 3600
                            ? `Hace ${Math.floor(timeDiff / 60)} min`
                            : `Hace ${Math.floor(timeDiff / 3600)} h`;

                        return (
                          <tr key={client.token} className="hover:bg-slate-50 transition-colors">
                            {/* Token */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-2">
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isRecent ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                                  }`}
                                  title={isRecent ? "Activo ahora" : "Visto recientemente"}
                                />
                                <div className="min-w-0">
                                  <span
                                    className="font-mono text-[11px] font-bold text-slate-800 truncate block max-w-[150px] sm:max-w-[200px]"
                                    title={client.token}
                                  >
                                    {client.token}
                                  </span>
                                  {client.userId && client.userId !== client.token && (
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      Usuario: @{client.userId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Funnel Stage */}
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10.5px] border ${layerBadgeClass}`}
                              >
                                {client.stageName}
                              </span>
                            </td>

                            {/* Cart Status */}
                            <td className="py-2.5 px-3">
                              {client.cartCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-mono font-bold text-[11px]">
                                  <ShoppingCart className="w-3 h-3 text-amber-600" />
                                  <span>{client.cartCount} {client.cartCount === 1 ? "producto" : "productos"}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Sin productos</span>
                              )}
                            </td>

                            {/* Last Path */}
                            <td className="py-2.5 px-3">
                              <span
                                className="font-mono text-[11px] text-slate-600 truncate block max-w-[180px]"
                                title={client.lastPath}
                              >
                                {client.lastPath || "/tienda"}
                              </span>
                            </td>

                            {/* Last Activity */}
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono text-[11px] text-slate-500">
                                {timeStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
