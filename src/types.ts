export interface User {
  id: string;
  originalId?: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  isOnline: boolean;
  followers: number;
  following: number;
  followingUserIds?: string[];
  savedReelIds?: string[];
  coverPhoto?: string;
  isGuest?: boolean;
  password?: string;
  email?: string;
  privacyPolicy?: string;
}

export interface Comment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface Reel {
  id: string;
  videoUrl: string;
  hlsUrl?: string; // Adaptive HLS Master Playlist (.m3u8) URL for smooth streaming
  thumbnailUrl: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorUsername?: string;
  creatorAvatar: string;
  likes: number;
  likedBy?: string[];
  comments: Comment[];
  shares: number;
  saves?: number;
  views: number;
  productId?: string; // Tagged product
  type?: 'video' | 'image' | 'carousel';
  images?: string[]; // For carrousels or single images
}

export interface ProductVariantItem {
  id?: string;
  vid?: string;
  name: string;
  color?: string;
  size?: string;
  price?: number;
  imageUrl?: string;
  sku?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  sellerId: string;
  sellerName?: string;
  sellerAvatar?: string;
  rating: number;
  shippingCost?: number;
  selectedCarrier?: string;
  cjVid?: string;
  cjPid?: string;
  images?: string[]; // Multiple photos of products
  videos?: string[]; // Video of products
  variants?: {
    name: string; // e.g., "Talla" or "Color"
    options: string[]; // e.g., ["S", "M"], ["Negro", "Rojo"]
  }[];
  variantList?: ProductVariantItem[];
  category?: string;
  views?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedCarrier?: string;
  selectedShippingCost?: number;
  selectedCountry?: string;
}

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  sellerId?: string;
  sellerName?: string;
  sellerUsername?: string;
  carrier?: string;
}

export interface OrderStatusHistoryItem {
  status: OrderStatus;
  label: string;
  timestamp: string;
  note?: string;
  trackingNumber?: string;
  carrier?: string;
}

export interface AutoCreatedUserSummary {
  created: boolean;
  email: string;
  username: string;
  name: string;
  tempPassword: string;
  user?: User;
  message?: string;
}

export interface Order {
  id: string;
  buyerId?: string;
  buyerName?: string;
  buyerUsername?: string;
  buyerAvatar?: string;
  buyerEmail?: string;
  items: OrderItem[];
  total: number;
  shippingCost?: number;
  shippingAddress: string;
  paymentStatus: 'paid' | 'pending';
  status?: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  sellerNotes?: string;
  statusHistory?: OrderStatusHistoryItem[];
  autoCreatedUser?: AutoCreatedUserSummary;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export interface LiveSession {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  viewersCount: number;
  isLive: boolean;
  chatMessages: {
    id: string;
    username: string;
    avatar: string;
    text: string;
    createdAt: string;
  }[];
}
