export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  isOnline: boolean;
  followers: number;
  following: number;
  savedReelIds?: string[];
  coverPhoto?: string;
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
  thumbnailUrl: string;
  description: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  likes: number;
  comments: Comment[];
  shares: number;
  views: number;
  productId?: string; // Tagged product
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
  sellerId: string;
  rating: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl: string;
  }[];
  total: number;
  shippingAddress: string;
  paymentStatus: 'paid' | 'pending';
  createdAt: string;
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
