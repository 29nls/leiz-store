/**
 * Optimized Icon Bundle
 * 
 * Only imports icons that are actually used in the app
 * Reduces lucide-react bundle size significantly
 * 
 * Instead of: import { ShoppingCart } from 'lucide-react'
 * Use: import { ShoppingCart } from '@/components/ui/icons'
 */

// Navigation & UI
export {
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Search,
  User,
  LogOut,
  LogIn,
  SlidersHorizontal,
} from 'lucide-react';

// Shopping & Commerce
export {
  ShoppingCart,
  ShoppingBag,
  Package,
  CreditCard,
  Ticket,
  Coins,
  Gem,
  DollarSign,
} from 'lucide-react';

// Status & Indicators
export {
  Check,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  XCircle,
  Clock,
  Zap,
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Brain,
  Crown,
} from 'lucide-react';

// Product & Inventory
export {
  Backpack,
  Plus,
  Minus,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
} from 'lucide-react';

// Social & Communication
export {
  Mail,
  MessageCircle,
  MessageSquare,
  Bell,
  Heart,
  Star,
  Share2,
  Send,
} from 'lucide-react';

// Admin & Dashboard
export {
  LayoutDashboard,
  Users,
  Settings,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
  FileText,
  Download,
  Upload,
  Filter,
  RefreshCw,
} from 'lucide-react';

// Security & Protection
export {
  ShieldCheck,
  Lock,
  Unlock,
  Key,
  Shield,
} from 'lucide-react';

// Media & Files
export {
  Image as ImageIcon,
  File,
  Folder,
  FolderOpen,
  Save,
  FileCheck,
} from 'lucide-react';

// Other Common Icons
export {
  Home,
  Layers,
  Globe,
  MapPin,
  Phone,
  Smartphone,
  Palette,
  Boxes,
  Store,
} from 'lucide-react';

/**
 * Icon Component Props
 */
export interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/**
 * Default icon size
 */
export const DEFAULT_ICON_SIZE = 20;
export const SMALL_ICON_SIZE = 16;
export const LARGE_ICON_SIZE = 24;

/**
 * Icon presets for consistent sizing
 */
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Helper to get icon size
 */
export function getIconSize(size?: keyof typeof iconSizes | number): number {
  if (typeof size === 'number') return size;
  if (size && size in iconSizes) return iconSizes[size];
  return DEFAULT_ICON_SIZE;
}
