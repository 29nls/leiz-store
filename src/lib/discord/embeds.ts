/**
 * Discord Embed Builders
 * Rich embed messages for seller notifications and buyer DMs
 */

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  buyer_discord_id?: string | null;
  customer_discord?: string | null;
  customer_ign?: string | null;
  customer_notes?: string | null;
  total: number;
  payment_method?: string | null;
  status: string;
  confirmed_at?: string | null;
  created_at: string;
  order_item?: Array<{ name: string; quantity: number; price: number }>;
  orderItem?: Array<{ name: string; quantity: number; price: number }>;
}

/**
 * Build the seller notification embed object for Discord
 */
export function buildSellerEmbed(order: OrderData) {
  const items = (order.order_item || [])
    .map((item) => `• ${item.name} x${item.quantity} — Rp${Number(item.price).toLocaleString("id-ID")}`)
    .join("\n") || "—";

  const discordId = order.buyer_discord_id || order.customer_discord || "—";
  const paymentMethod = order.payment_method?.toUpperCase().replace("_", " ") || "—";

  return {
    embeds: [
      {
        title: "🛒 Konfirmasi Transfer Baru",
        color: 0xf59e0b, // amber
        fields: [
          { name: "📋 Order", value: `\`${order.order_number}\``, inline: true },
          { name: "👤 Pembeli", value: order.customer_name, inline: true },
          { name: "🎮 Discord ID", value: discordId, inline: true },
          { name: "🎮 IGN", value: order.customer_ign || "—", inline: true },
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
