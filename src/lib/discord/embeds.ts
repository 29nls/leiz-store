/**
 * Discord Embed Builders
 * Rich embed messages for seller notifications and buyer DMs
 */

interface OrderItem {
  name?: string;
  quantity?: number;
  price?: number;
  total?: number;
  productName?: string;
  product?: { name?: string };
  product_name?: string;
  productId?: string;
  product_id?: string;
}

interface OrderData {
  id: string;
  order_number?: string;
  orderNumber?: string;
  customer_name?: string;
  customerName?: string;
  customer_email?: string | null;
  customerEmail?: string | null;
  customer_phone?: string | null;
  customerPhone?: string | null;
  buyer_discord_id?: string | null;
  customer_discord?: string | null;
  customerDiscord?: string | null;
  customer_ign?: string | null;
  customerIGN?: string | null;
  customer_notes?: string | null;
  total: number;
  payment_method?: string | null;
  paymentMethod?: string | null;
  status: string;
  confirmed_at?: string | null;
  created_at: string;
  items?: OrderItem[];
  order_item?: OrderItem[];
  orderItem?: OrderItem[];
}

/**
 * Build the seller notification embed object for Discord
 */
export function buildSellerEmbed(order: OrderData) {
  const rawItems = order.items || order.orderItem || order.order_item || [];
  const items = rawItems
    .map((item) => {
      const itemName =
        item.name ||
        (item as any).productName ||
        (item as any).product?.name ||
        (item as any).product_name ||
        (item as any).productId ||
        (item as any).product_id ||
        "Unknown Product";
      const quantity = item.quantity ?? 1;
      const price = Number(item.price ?? item.total ?? 0);
      const formattedPrice = Number.isFinite(price)
        ? `Rp${price.toLocaleString("id-ID")}`
        : "Rp0";
      return `• \`${itemName}\` × ${quantity} — ${formattedPrice}`;
    })
    .join("\n") || "—";

  const discordId = order.buyer_discord_id || order.customer_discord || order.customerDiscord || "—";
  const paymentMethod = (order.payment_method || order.paymentMethod)?.toUpperCase().replace("_", " ") || "—";
  const customerName = order.customer_name || order.customerName || "—";
  const customerIgn = order.customer_ign || order.customerIGN || "—";
  const orderNumber = order.order_number || (order as any).orderNumber || "—";

  return {
    embeds: [
      {
        title: "🛒 **KONFIRMASI TRANSFER BARU**",
        color: 0xf59e0b,
        fields: [
          { name: "━━━━━━━━━━━━━━━━━", value: "**📋 INFORMASI ORDER**", inline: false },
          { name: "Order", value: `\`${orderNumber}\``, inline: true },
          { name: "Status", value: `\`${order.status}\``, inline: true },
          { name: "Waktu", value: order.confirmed_at
            ? new Date(order.confirmed_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
            : new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }), inline: false },

          { name: "━━━━━━━━━━━━━━━━━", value: "**👤 DATA PEMBELI**", inline: false },
          { name: "Nama", value: customerName, inline: true },
          { name: "Email", value: order.customer_email || order.customerEmail || "—", inline: true },
          { name: "WA", value: order.customer_phone || order.customerPhone || "—", inline: true },
          { name: "Discord", value: discordId, inline: true },
          { name: "IGN", value: customerIgn || "—", inline: true },

          { name: "━━━━━━━━━━━━━━━━━", value: "**💳 PEMBAYARAN**", inline: false },
          { name: "Total", value: `Rp${Number(order.total).toLocaleString("id-ID")}`, inline: true },
          { name: "Metode", value: paymentMethod, inline: true },
          { name: "Catatan", value: order.customer_notes || "—", inline: false },

          { name: "━━━━━━━━━━━━━━━━━", value: "**📦 PRODUK**", inline: false },
          { name: "Items", value: items, inline: false },
        ],
        footer: { text: "LEIZ STORE • Payment Verification • " + new Date().toLocaleDateString("id-ID") },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Build the buyer notification embed for DM
 */
export function buildBuyerEmbed(orderNumber: string, message: string) {
  return {
    embeds: [
      {
        title: "📦 **UPDATE PESANAN**",
        color: 0x7c3aed,
        description: message,
        fields: [
          { name: "━━━━━━━━━━━━━━━━━", value: "**📋 INFORMASI ORDER**", inline: false },
          { name: "Order", value: `\`${orderNumber}\``, inline: true },
        ],
        footer: { text: "LEIZ STORE • " + new Date().toLocaleDateString("id-ID") },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Build action button components for Discord message
 */
export function buildAdminButtons(orderId: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "✅ Pembayaran sudah masuk",
          custom_id: `payment_accept_${orderId}`,
        },
        {
          type: 2,
          style: 4,
          label: "❌ Pembayaran belum masuk",
          custom_id: `payment_reject_${orderId}`,
        },
      ],
    },
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: "🚫 Cancel order",
          custom_id: `payment_cancel_${orderId}`,
        },
        {
          type: 2,
          style: 4,
          label: "⛔ Cancel order paksa",
          custom_id: `payment_force_cancel_${orderId}`,
        },
      ],
    },
  ];
}
