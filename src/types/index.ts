export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number;
  unit: string;
  stock: number;
  minStock: number;
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  category: Category;
  images: ProductImage[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
  productCount?: number;
}

export type SortOption = "newest" | "price_asc" | "price_desc" | "name";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  unit: string;
  quantity: number;
  stock: number;
}

export interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "id" | "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export type OrderStatus =
  | "pending"
  | "waiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded";

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerDiscord?: string;
  customerIGN?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export type UserRole = "CUSTOMER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  discord?: string;
}

export interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}
