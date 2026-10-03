import { Request, Response } from "express";
import mongoose from "mongoose";
import { MongoOrder, MongoUser, MongoCart } from "../models";
import { Order } from "../../types";
import { generateId } from "../utils/helpers";
import { getUsers } from "./userController";
import {
  orders,
  setOrders,
  products,
  activeOriginalUserId,
  setActiveOriginalUserId,
  cartMemoryStore,
  broadcastToAll,
  memoryUsers,
} from "../services/state";

/**
 * POST /api/orders
 * Create purchase order (checkout)
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  const { items, shippingAddress, shippingCost, userId, buyerName, buyerUsername, buyerAvatar, buyerEmail } = req.body;
  if (!items || !items.length) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  let total = 0;
  const orderItems: any[] = [];
  const dbUsers = await getUsers();
  const userMap = new Map<string, any>();
  dbUsers.forEach((u: any) => userMap.set(u.id, u));

  // Verify stock and calculate total
  for (const item of items) {
    const product = products.find((p) => p.id === item.product.id);
    if (!product) {
      res.status(400).json({ error: `Product ${item.product.name} not found` });
      return;
    }

    if (product.stock < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for product: ${product.name}` });
      return;
    }

    product.stock -= item.quantity;
    total += product.price * item.quantity;

    const sellerUser = userMap.get(product.sellerId);
    orderItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      imageUrl: product.imageUrl,
      sellerId: product.sellerId || "current_user",
      sellerName: sellerUser ? sellerUser.name : product.sellerName || "Vendedor",
      sellerUsername: sellerUser ? sellerUser.username : undefined,
      carrier: item.selectedCarrier || product.selectedCarrier || "DHL Express",
    });
  }

  total += Number(shippingCost) || 0;

  const assignedCarrier = orderItems[0]?.carrier || "";
  const nowIso = new Date().toISOString();
  const estimatedDate = new Date(Date.now() + 4 * 86400000).toISOString().split("T")[0];

  const buyerUser = userMap.get(userId || activeOriginalUserId);

  let assignedBuyerId = userId || (activeOriginalUserId !== "user_guest" ? activeOriginalUserId : "current_user");
  let assignedBuyerName = buyerName || (buyerUser ? buyerUser.name : "Cliente");
  let assignedBuyerUsername = buyerUsername || (buyerUser ? buyerUser.username : undefined);
  let assignedBuyerAvatar = buyerAvatar || (buyerUser ? buyerUser.avatar : undefined);
  let assignedBuyerEmail = buyerEmail || (buyerUser ? buyerUser.email : undefined);

  let autoCreatedUserSummary: any = null;

  const cleanNameForUsername = (rawName?: string, fallbackEmail?: string): string => {
    const validName =
      rawName &&
      rawName.trim() &&
      rawName.trim().toLowerCase() !== "invitado" &&
      rawName.trim().toLowerCase() !== "cliente"
        ? rawName.trim()
        : fallbackEmail
        ? fallbackEmail.split("@")[0]
        : "cliente";
    const normalized = validName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");
    return normalized || "cliente";
  };

  const cleanBuyerEmail = buyerEmail ? String(buyerEmail).trim().toLowerCase() : "";
  const derivedUsername = cleanNameForUsername(buyerName, cleanBuyerEmail);

  const isRequesterGuest =
    (!userId || userId === "current_user" || userId === "user_guest" || userId === "invitado") &&
    (!buyerUsername || buyerUsername === "invitado" || buyerUsername === "guest");

  if (!isRequesterGuest) {
    // Buyer is already logged into a registered account — never show auto-created account message
    let loggedInUser: any = buyerUser;
    if (!loggedInUser && mongoose.connection.readyState === 1) {
      const orLookup: any[] = [];
      if (userId && userId !== "current_user") orLookup.push({ id: userId });
      if (buyerUsername && buyerUsername !== "invitado") orLookup.push({ username: String(buyerUsername).toLowerCase() });
      if (cleanBuyerEmail) orLookup.push({ email: cleanBuyerEmail });
      if (orLookup.length > 0) {
        loggedInUser = await MongoUser.findOne({ $or: orLookup, id: { $ne: "current_user" } }).catch(() => null);
      }
    }
    if (loggedInUser) {
      assignedBuyerId = loggedInUser.id;
      assignedBuyerUsername = loggedInUser.username || assignedBuyerUsername;
      assignedBuyerName = buyerName?.trim() || loggedInUser.name || assignedBuyerName;
      assignedBuyerEmail = cleanBuyerEmail || loggedInUser.email || assignedBuyerEmail;
      assignedBuyerAvatar = loggedInUser.avatar || assignedBuyerAvatar;
    }
    autoCreatedUserSummary = null;
  } else if ((cleanBuyerEmail && cleanBuyerEmail.includes("@")) || (buyerName && String(buyerName).trim())) {
    let existingUser: any = null;
    if (mongoose.connection.readyState === 1) {
      await MongoUser.deleteMany({ id: "current_user" }).catch(() => {});
      const escapedEmail = cleanBuyerEmail ? cleanBuyerEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
      const escapedUsername = derivedUsername.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const orConditions: any[] = [
        { username: derivedUsername },
        { username: { $regex: new RegExp(`^${escapedUsername}$`, "i") } },
      ];
      if (cleanBuyerEmail) {
        orConditions.unshift(
          { email: cleanBuyerEmail },
          { username: cleanBuyerEmail },
          { email: { $regex: new RegExp(`^${escapedEmail}$`, "i") } },
          { username: { $regex: new RegExp(`^${escapedEmail}$`, "i") } }
        );
      }
      existingUser = await MongoUser.findOne({
        $or: orConditions,
        id: { $ne: "current_user" },
      });
    }
    if (!existingUser) {
      existingUser = memoryUsers.find(
        (u) =>
          (cleanBuyerEmail && u.email && u.email.toLowerCase() === cleanBuyerEmail) ||
          (cleanBuyerEmail && u.username && u.username.toLowerCase() === cleanBuyerEmail) ||
          (u.username && u.username.toLowerCase() === derivedUsername)
      );
    }

    if (existingUser) {
      // User ALREADY has an account in the database: link order & session, but created = false (do not show new-user message)
      const cleanExistingUsername =
        existingUser.username && !existingUser.username.includes("@")
          ? existingUser.username
          : derivedUsername;
      const cleanExistingName =
        existingUser.name && !existingUser.name.includes("@")
          ? existingUser.name
          : buyerName && String(buyerName).trim() && String(buyerName).trim().toLowerCase() !== "invitado"
          ? String(buyerName).trim()
          : cleanExistingUsername;

      existingUser.username = cleanExistingUsername;
      existingUser.name = cleanExistingName;
      if (cleanBuyerEmail && !existingUser.email) {
        existingUser.email = cleanBuyerEmail;
      }
      if (!existingUser.password) {
        existingUser.password = "123";
      }

      if (mongoose.connection.readyState === 1) {
        await MongoUser.updateOne(
          { id: existingUser.id },
          {
            $set: {
              username: cleanExistingUsername,
              name: cleanExistingName,
              email: existingUser.email || cleanBuyerEmail,
              password: existingUser.password || "123",
            },
          }
        ).catch(() => {});
      }

      assignedBuyerId = existingUser.id;
      assignedBuyerUsername = cleanExistingUsername;
      assignedBuyerName = cleanExistingName;
      assignedBuyerEmail = existingUser.email || cleanBuyerEmail;
      assignedBuyerAvatar = existingUser.avatar || assignedBuyerAvatar;

      const existingObj = existingUser.toObject ? existingUser.toObject() : existingUser;
      const syncedUser = {
        ...existingObj,
        id: existingUser.id,
        originalId: existingUser.id,
        username: cleanExistingUsername,
        name: cleanExistingName,
        email: assignedBuyerEmail,
        password: existingUser.password || "123",
        isGuest: false,
      };
      const memIdx = memoryUsers.findIndex(
        (u) => u.id === existingUser.id || u.username?.toLowerCase() === cleanExistingUsername.toLowerCase()
      );
      if (memIdx >= 0) {
        memoryUsers[memIdx] = syncedUser;
      } else {
        memoryUsers.push(syncedUser);
      }

      setActiveOriginalUserId(existingUser.id);
      autoCreatedUserSummary = {
        created: false,
        email: assignedBuyerEmail,
        username: cleanExistingUsername,
        name: cleanExistingName,
        tempPassword: existingUser.password || "123",
        user: {
          ...syncedUser,
          id: "current_user",
          originalId: existingUser.id,
          isGuest: false,
        },
        message:
          "Tu pedido ha sido vinculado automáticamente a tu perfil registrado.",
      };
    } else {
      const chosenUsername = derivedUsername;
      const newUserId = "user_" + generateId();
      const resolvedFullName =
        buyerName && String(buyerName).trim() && String(buyerName).trim().toLowerCase() !== "invitado"
          ? String(buyerName).trim()
          : chosenUsername;
      const createdUserDoc = {
        id: newUserId,
        originalId: newUserId,
        username: chosenUsername,
        name: resolvedFullName,
        email: cleanBuyerEmail || `${chosenUsername}@mallsocial.app`,
        password: "123",
        bio: "Cliente en la plataforma",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
        coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
        isOnline: true,
        followers: 0,
        following: 0,
        followingUserIds: [],
        savedReelIds: [],
        isGuest: false,
        privacyPolicy: "",
      };

      const memIdx = memoryUsers.findIndex(
        (u) => u.id === newUserId || u.username.toLowerCase() === chosenUsername.toLowerCase()
      );
      if (memIdx >= 0) {
        memoryUsers[memIdx] = createdUserDoc;
      } else {
        memoryUsers.push(createdUserDoc);
      }

      if (mongoose.connection.readyState === 1) {
        try {
          await MongoUser.findOneAndUpdate(
            { $or: [{ email: createdUserDoc.email }, { username: chosenUsername }] },
            { $set: createdUserDoc },
            { upsert: true, new: true }
          );
          console.log(`👤 Automatically created profile for guest buyer: @${chosenUsername} (${createdUserDoc.email}) with password "123"`);
        } catch (createErr) {
          console.error("Error creating auto-user in Mongo:", createErr);
        }
      }

      setActiveOriginalUserId(newUserId);

      assignedBuyerId = newUserId;
      assignedBuyerUsername = chosenUsername;
      assignedBuyerName = createdUserDoc.name;
      assignedBuyerEmail = createdUserDoc.email;

      autoCreatedUserSummary = {
        created: true,
        email: createdUserDoc.email,
        username: chosenUsername,
        name: createdUserDoc.name,
        tempPassword: "123",
        user: {
          ...createdUserDoc,
          id: "current_user",
          originalId: newUserId,
          isGuest: false,
        },
        message:
          "Hemos creado tu perfil en la app con tu nombre completo como usuario y contraseña por defecto 123.",
      };
    }
  }

  const newOrder: Order = {
    id: "ord_" + generateId(),
    buyerId: assignedBuyerId,
    buyerName: assignedBuyerName,
    buyerUsername: assignedBuyerUsername,
    buyerAvatar: assignedBuyerAvatar,
    buyerEmail: assignedBuyerEmail,
    items: orderItems,
    total: Math.round((total + Number.EPSILON) * 100) / 100,
    shippingCost: Number(shippingCost) || 0,
    shippingAddress: shippingAddress || "Dirección de Entrega Principal",
    paymentStatus: "paid",
    status: "processing",
    trackingNumber: "",
    carrier: assignedCarrier,
    trackingUrl: "",
    estimatedDelivery: estimatedDate,
    sellerNotes: "Pedido recibido. El vendedor preparará el paquete y registrará el número de guía de paquetería.",
    autoCreatedUser: autoCreatedUserSummary,
    statusHistory: [
      {
        status: "pending",
        label: "Pago aprobado y orden confirmada",
        timestamp: nowIso,
        note: "Transacción aprobada de manera segura.",
      },
      {
        status: "processing",
        label: "En preparación por el vendedor",
        timestamp: nowIso,
        note: assignedCarrier
          ? `Preparando despacho con paquetería ${assignedCarrier}.`
          : "El vendedor está preparando el empaque de los artículos.",
        carrier: assignedCarrier,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  setOrders([newOrder, ...orders]);

  if (mongoose.connection.readyState === 1) {
    try {
      const mongoOrder = new MongoOrder(newOrder);
      await mongoOrder.save();
      console.log(`💾 Saved order ${newOrder.id} to MongoDB Atlas`);
    } catch (dbErr) {
      console.error("❌ Failed to save order to MongoDB Atlas:", dbErr);
    }
  }

  if (userId) {
    cartMemoryStore.set(userId, []);
    if (mongoose.connection.readyState === 1) {
      try {
        await MongoCart.findOneAndUpdate({ userId }, { items: [], updatedAt: new Date() });
      } catch (err) {
        console.error("Failed to clear cart on order:", err);
      }
    }
  }

  broadcastToAll({
    type: "stock_updated",
    products: products.map((p) => ({ id: p.id, stock: p.stock })),
  });

  broadcastToAll({
    type: "order_created",
    order: newOrder,
  });

  res.json(newOrder);
}

/**
 * GET /api/orders
 * Fetch orders with optional query parameters
 */
export function getOrders(req: Request, res: Response): void {
  const { userId } = req.query;
  if (!userId || typeof userId !== "string") {
    res.json(orders);
    return;
  }

  const cleanId = userId.toLowerCase();
  const purchases = orders.filter(
    (o) =>
      o.buyerId === userId ||
      (o.buyerId && o.buyerId.toLowerCase() === cleanId) ||
      (o.buyerUsername && o.buyerUsername.toLowerCase() === cleanId) ||
      (o.buyerEmail && o.buyerEmail.toLowerCase() === cleanId) ||
      (userId === "current_user" && (o.buyerId === activeOriginalUserId || o.buyerId === "current_user" || !o.buyerId))
  );

  const sales = orders.filter((o) =>
    o.items.some(
      (it) =>
        it.sellerId === userId ||
        (it.sellerId && it.sellerId.toLowerCase() === cleanId) ||
        (it.sellerUsername && it.sellerUsername.toLowerCase() === cleanId) ||
        (userId === "current_user" && (it.sellerId === activeOriginalUserId || it.sellerId === "current_user" || !it.sellerId))
    )
  );

  res.json({ orders, purchases, sales });
}

/**
 * GET /api/orders/:id
 * Fetch a single order by ID
 */
export async function getOrderById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const cleanId = (id || "").trim();

  // Search memory orders first
  let order = orders.find((o) => o.id === cleanId || (o as any)._id === cleanId);

  // If not found in memory, search MongoDB Atlas
  if (!order && mongoose.connection.readyState === 1) {
    try {
      const queryOr: any[] = [{ id: cleanId }];
      if (mongoose.isValidObjectId(cleanId)) {
        queryOr.push({ _id: cleanId });
      }
      const dbOrder = await MongoOrder.findOne({ $or: queryOr }).lean();
      if (dbOrder) {
        order = dbOrder as any;
      }
    } catch (err) {
      console.error("Error fetching order by ID from Mongo:", err);
    }
  }

  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }

  res.json(order);
}

/**
 * POST /api/orders/:id/update-tracking
 * Update tracking number, carrier, and order fulfillment status
 */
export async function updateTracking(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { trackingNumber, carrier, status, trackingUrl, estimatedDelivery, sellerNotes } = req.body;

  const orderIndex = orders.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }

  const currentOrder = orders[orderIndex];
  const nowIso = new Date().toISOString();

  const newStatus = status || currentOrder.status || "processing";
  const newTracking = (trackingNumber !== undefined ? trackingNumber : currentOrder.trackingNumber || "").trim();
  const newCarrier = (carrier !== undefined ? carrier : currentOrder.carrier || "").trim();
  const newTrackingUrl = (trackingUrl !== undefined ? trackingUrl : currentOrder.trackingUrl || "").trim();
  const newEstimated = (estimatedDelivery !== undefined ? estimatedDelivery : currentOrder.estimatedDelivery || "").trim();
  const newNotes = (sellerNotes !== undefined ? sellerNotes : currentOrder.sellerNotes || "").trim();

  let historyLabel = `Actualización de estado a ${newStatus}`;
  if (newStatus === "processing") {
    historyLabel = "En preparación por el vendedor";
  } else if (newStatus === "shipped") {
    historyLabel = `Despachado y en camino (${newCarrier || "Paquetería"})`;
  } else if (newStatus === "delivered") {
    historyLabel = "Pedido entregado con éxito al destinatario";
  } else if (newStatus === "cancelled") {
    historyLabel = "Pedido cancelado";
  }

  const historyEntry = {
    status: newStatus as any,
    label: historyLabel,
    timestamp: nowIso,
    note: newNotes || (newTracking ? `Guía de rastreo: ${newTracking}` : "Actualización realizada por el vendedor"),
    trackingNumber: newTracking,
    carrier: newCarrier,
  };

  const updatedHistory = [...(currentOrder.statusHistory || []), historyEntry];

  const updatedOrder: Order = {
    ...currentOrder,
    status: newStatus as any,
    trackingNumber: newTracking,
    carrier: newCarrier,
    trackingUrl: newTrackingUrl,
    estimatedDelivery: newEstimated,
    sellerNotes: newNotes,
    statusHistory: updatedHistory,
    updatedAt: nowIso,
  };

  orders[orderIndex] = updatedOrder;

  if (mongoose.connection.readyState === 1) {
    try {
      await MongoOrder.findOneAndUpdate(
        { id },
        {
          $set: {
            status: newStatus,
            trackingNumber: newTracking,
            carrier: newCarrier,
            trackingUrl: newTrackingUrl,
            estimatedDelivery: newEstimated,
            sellerNotes: newNotes,
            statusHistory: updatedHistory,
            updatedAt: nowIso,
          },
        },
        { returnDocument: "after", upsert: true }
      );
      console.log(`💾 Order ${id} tracking updated in MongoDB Atlas (Tracking: ${newTracking}, Status: ${newStatus})`);
    } catch (dbErr) {
      console.error("❌ Failed to update order tracking in MongoDB Atlas:", dbErr);
    }
  }

  broadcastToAll({
    type: "order_updated",
    order: updatedOrder,
  });

  res.json({ success: true, order: updatedOrder });
}
