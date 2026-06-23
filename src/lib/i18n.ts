/**
 * Multi-Language (i18n) Support
 * Supports Indonesian (id) and English (en)
 */

export type Locale = "id" | "en";

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

// ─── English Translations ───────────────────────────────────

const en: TranslationDictionary = {
  common: {
    appName: "LEIZ STORE",
    loading: "Loading...",
    error: "An error occurred",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    back: "Back",
    next: "Next",
    previous: "Previous",
    confirm: "Confirm",
    yes: "Yes",
    no: "No",
    all: "All",
    none: "None",
    of: "of",
    total: "Total",
    subtotal: "Subtotal",
    tax: "Tax",
    discount: "Discount",
    free: "Free",
  },
  nav: {
    home: "Home",
    products: "Products",
    bestSellers: "Best Sellers",
    newArrivals: "New Arrivals",
    wishlist: "Wishlist",
    cart: "Cart",
    checkout: "Checkout",
    login: "Login",
    register: "Register",
    logout: "Logout",
    admin: "Admin Dashboard",
    profile: "Profile",
  },
  home: {
    heroTitle: "Premium Game Materials Marketplace",
    heroSubtitle: "Your trusted source for game currencies, accounts, skins, and more. Instant delivery, secure payments, and 24/7 support.",
    browseProducts: "Browse Products",
    bestSellers: "Best Sellers",
    featuredProducts: "Featured Products",
    viewAll: "View All",
    categories: "Browse Categories",
    categoriesSubtitle: "Find exactly what you need",
    testimonials: "What Our Customers Say",
    testimonialsSubtitle: "Real reviews from real gamers",
    cta: "Ready to Level Up?",
    ctaSubtitle: "Join thousands of gamers who trust LEIZ STORE for their gaming needs.",
    shopNow: "Shop Now",
  },
  products: {
    title: "Products",
    subtitle: "Browse our complete catalog",
    addToCart: "Add to Cart",
    outOfStock: "Out of Stock",
    inStock: "In Stock",
    lowStock: "Low Stock",
    noProducts: "No products found",
    tryFilters: "Try adjusting your filters",
    sortBy: "Sort by",
    priceRange: "Price Range",
    category: "Category",
    allCategories: "All Categories",
    stock: "Stock",
    comparePrice: "Compare Price",
    description: "Description",
    relatedProducts: "Related Products",
  },
  cart: {
    title: "Shopping Cart",
    empty: "Your cart is empty",
    browseProducts: "Browse Products",
    clear: "Clear",
    proceedToCheckout: "Proceed to Checkout",
    quantity: "Quantity",
    remove: "Remove",
  },
  checkout: {
    title: "Checkout",
    customerInfo: "Customer Information",
    orderReview: "Order Review",
    payment: "Payment",
    confirmation: "Confirmation",
    name: "Name",
    email: "Email",
    discord: "Discord Username",
    ign: "In-Game Name",
    notes: "Notes",
    selectPayment: "Select Payment Method",
    paymentInstructions: "Payment Instructions",
    transferTo: "Transfer the exact amount to the account below:",
    orderConfirmed: "Order Confirmed!",
    orderConfirmedMsg: "Thank you for your order. We've sent the details to your Discord. Please complete the payment and send proof on our Discord server.",
    continueShopping: "Continue Shopping",
  },
  admin: {
    dashboard: "Dashboard",
    products: "Products",
    categories: "Categories",
    orders: "Orders",
    customers: "Customers",
    settings: "Settings",
    analytics: "Analytics",
    activityLogs: "Activity Logs",
    backToStore: "Back to Store",
    welcomeBack: "Welcome back, Admin",
    totalRevenue: "Total Revenue",
    totalOrders: "Total Orders",
    totalProducts: "Total Products",
    lowStockAlert: "Low Stock Alert",
    recentOrders: "Recent Orders",
    viewAll: "View All",
    export: "Export",
    addProduct: "Add Product",
  },
  product: {
    new: "NEW",
    hot: "HOT",
    limited: "LIMITED",
    bestSeller: "BEST SELLER",
    outOfStock: "OUT OF STOCK",
  },
  auth: {
    loginTitle: "Login to your account",
    registerTitle: "Create an account",
    email: "Email address",
    password: "Password",
    confirmPassword: "Confirm Password",
    name: "Full name",
    forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    loginButton: "Login",
    registerButton: "Register",
  },
  footer: {
    quickLinks: "Quick Links",
    support: "Support",
    contactUs: "Contact Us",
    allProducts: "All Products",
    faq: "FAQ",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    discordServer: "Discord Server",
    joinCommunity: "Join Our Community",
    allRightsReserved: "All rights reserved.",
  },
};

// ─── Indonesian Translations ────────────────────────────────

const id: TranslationDictionary = {
  common: {
    appName: "LEIZ STORE",
    loading: "Memuat...",
    error: "Terjadi kesalahan",
    save: "Simpan",
    cancel: "Batal",
    delete: "Hapus",
    edit: "Edit",
    create: "Buat",
    search: "Cari",
    filter: "Filter",
    sort: "Urutkan",
    back: "Kembali",
    next: "Selanjutnya",
    previous: "Sebelumnya",
    confirm: "Konfirmasi",
    yes: "Ya",
    no: "Tidak",
    all: "Semua",
    none: "Tidak ada",
    of: "dari",
    total: "Total",
    subtotal: "Subtotal",
    tax: "Pajak",
    discount: "Diskon",
    free: "Gratis",
  },
  nav: {
    home: "Beranda",
    products: "Produk",
    bestSellers: "Terlaris",
    newArrivals: "Baru",
    wishlist: "Wishlist",
    cart: "Keranjang",
    checkout: "Checkout",
    login: "Masuk",
    register: "Daftar",
    logout: "Keluar",
    admin: "Dashboard Admin",
    profile: "Profil",
  },
  home: {
    heroTitle: "Marketplace Material Game Premium",
    heroSubtitle: "Sumber terpercaya untuk mata uang game, akun, skin, dan lainnya. Pengiriman instan, pembayaran aman, dan dukungan 24/7.",
    browseProducts: "Jelajahi Produk",
    bestSellers: "Terlaris",
    featuredProducts: "Produk Unggulan",
    viewAll: "Lihat Semua",
    categories: "Jelajahi Kategori",
    categoriesSubtitle: "Temukan yang Anda butuhkan",
    testimonials: "Apa Kata Pelanggan Kami",
    testimonialsSubtitle: "Ulasan nyata dari gamer nyata",
    cta: "Siap Upgrade?",
    ctaSubtitle: "Bergabung dengan ribuan gamer yang mempercayai LEIZ STORE untuk kebutuhan gaming mereka.",
    shopNow: "Belanja Sekarang",
  },
  products: {
    title: "Produk",
    subtitle: "Jelajahi katalog lengkap kami",
    addToCart: "Tambah ke Keranjang",
    outOfStock: "Stok Habis",
    inStock: "Tersedia",
    lowStock: "Stok Rendah",
    noProducts: "Produk tidak ditemukan",
    tryFilters: "Coba sesuaikan filter Anda",
    sortBy: "Urutkan",
    priceRange: "Range Harga",
    category: "Kategori",
    allCategories: "Semua Kategori",
    stock: "Stok",
    comparePrice: "Harga Perbandingan",
    description: "Deskripsi",
    relatedProducts: "Produk Terkait",
  },
  cart: {
    title: "Keranjang Belanja",
    empty: "Keranjang Anda kosong",
    browseProducts: "Jelajahi Produk",
    clear: "Kosongkan",
    proceedToCheckout: "Lanjut ke Checkout",
    quantity: "Jumlah",
    remove: "Hapus",
  },
  checkout: {
    title: "Checkout",
    customerInfo: "Informasi Pelanggan",
    orderReview: "Review Pesanan",
    payment: "Pembayaran",
    confirmation: "Konfirmasi",
    name: "Nama",
    email: "Email",
    discord: "Username Discord",
    ign: "Nama In-Game",
    notes: "Catatan",
    selectPayment: "Pilih Metode Pembayaran",
    paymentInstructions: "Instruksi Pembayaran",
    transferTo: "Transfer jumlah tepat ke akun di bawah:",
    orderConfirmed: "Pesanan Terkonfirmasi!",
    orderConfirmedMsg: "Terima kasih atas pesanan Anda. Kami sudah mengirim detailnya ke Discord Anda. Silakan selesaikan pembayaran dan kirim bukti di server Discord kami.",
    continueShopping: "Lanjut Belanja",
  },
  admin: {
    dashboard: "Dashboard",
    products: "Produk",
    categories: "Kategori",
    orders: "Pesanan",
    customers: "Pelanggan",
    settings: "Pengaturan",
    analytics: "Analitik",
    activityLogs: "Log Aktivitas",
    backToStore: "Kembali ke Toko",
    welcomeBack: "Selamat datang kembali, Admin",
    totalRevenue: "Total Pendapatan",
    totalOrders: "Total Pesanan",
    totalProducts: "Total Produk",
    lowStockAlert: "Peringatan Stok Rendah",
    recentOrders: "Pesanan Terbaru",
    viewAll: "Lihat Semua",
    export: "Ekspor",
    addProduct: "Tambah Produk",
  },
  product: {
    new: "BARU",
    hot: "HOT",
    limited: "TERBATAS",
    bestSeller: "TERLARIS",
    outOfStock: "STOK HABIS",
  },
  auth: {
    loginTitle: "Masuk ke akun Anda",
    registerTitle: "Buat akun baru",
    email: "Alamat email",
    password: "Kata sandi",
    confirmPassword: "Konfirmasi kata sandi",
    name: "Nama lengkap",
    forgotPassword: "Lupa kata sandi?",
    noAccount: "Belum punya akun?",
    hasAccount: "Sudah punya akun?",
    loginButton: "Masuk",
    registerButton: "Daftar",
  },
  footer: {
    quickLinks: "Tautan Cepat",
    support: "Dukungan",
    contactUs: "Hubungi Kami",
    allProducts: "Semua Produk",
    faq: "FAQ",
    terms: "Syarat Layanan",
    privacy: "Kebijakan Privasi",
    discordServer: "Server Discord",
    joinCommunity: "Gabung Komunitas Kami",
    allRightsReserved: "Hak cipta dilindungi.",
  },
};

// ─── Translation Registry ───────────────────────────────────

const translations: Record<Locale, TranslationDictionary> = { en, id };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, locale?: Locale): string {
  const lang = locale || currentLocale;
  const keys = key.split(".");
  let result: string | TranslationDictionary | undefined = translations[lang];

  for (const k of keys) {
    if (typeof result === "string") return result;
    result = result?.[k];
  }

  if (typeof result === "string") return result;

  // Fallback to English
  let fallback: string | TranslationDictionary | undefined = translations.en;
  for (const k of keys) {
    if (typeof fallback === "string") return fallback;
    fallback = fallback?.[k];
  }

  return typeof fallback === "string" ? fallback : key;
}

/**
 * Get all translations for a namespace
 */
export function getTranslations(
  namespace: string,
  locale?: Locale
): Record<string, string> {
  const lang = locale || currentLocale;
  const dict = translations[lang];
  const namespaceObj = dict[namespace];

  if (!namespaceObj || typeof namespaceObj === "string") return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(namespaceObj)) {
    result[key] = typeof value === "string" ? value : key;
  }
  return result;
}

/**
 * Detect locale from Accept-Language header or localStorage
 */
export function detectLocale(acceptLanguage?: string): Locale {
  if (acceptLanguage) {
    const primary = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
    if (primary === "id") return "id";
  }
  return "en";
}

/**
 * Locale display names
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia",
};
