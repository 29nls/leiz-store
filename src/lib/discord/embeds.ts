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
  // Collect order items from any property name the data might arrive under
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
      return `• ${itemName} x${quantity} — ${formattedPrice}`;
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
        title: "🛒 Konfirmasi Transfer Baru",
        color: 0xf59e0b, // amber
        fields: [
          { name: "📋 Order", value: `\`${orderNumber}\``, inline: true },
          { name: "👤 Pembeli", value: customerName, inline: true },
          { name: "🎮 Discord ID", value: discordId, inline: true },
          { name: "🎮 IGN", value: customerIgn || "—", inline: true },
          { name: "💰 Total", value: `Rp${Number(order.total).toLocaleString("id-ID")}`, inline: true },
          { name: "💳 Metode", value: paymentMethod, inline: true },
          { name: "📝 Catatan", value: order.customer_notes || "—", inline: true },
          { name: "📊 Status", value: order.status, inline: true },
          { name: "📦 Produk", value: items, inline: false },
          {
            name: "⏰ Waktu Konfirmasi",
            value: order.confirmed_at
              ? new Date(order.confirmed_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
              : new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
            inline: false,
          },
        ],
        footer: { text: "LEIZ STORE — Payment Verification" },
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
        title: "📦 Update Pesanan — LEIZ STORE",
        color: 0x7c3aed, // primary purple
        description: message,
        fields: [
          { name: "📋 Order", value: `\`${orderNumber}\``, inline: true },
        ],
        footer: { text: "LEIZ STORE" },
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
      type: 1, // ActionRow
      components: [
        {
          type: 2, // Button
          style: 3, // Success (green)
          label: "✅ Pembayaran sudah masuk",
          custom_id: `payment_accept_${orderId}`,
        },
        {
          type: 2,
          style: 4, // Danger (red)
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
          style: 2, // Secondary (grey)
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
