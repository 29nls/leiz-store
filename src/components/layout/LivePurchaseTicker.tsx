"use client";

import { ShoppingCart } from "@/components/ui/icons";

const liveFeed = [
  { name: "DragonSlayer88", item: "Balkov Pouch",   avatar: "DS" },
  { name: "InsanePro",      item: "Mount Coupon",   avatar: "IP" },
  { name: "NexusDN",        item: "Spirit Coupon",  avatar: "ND" },
  { name: "VoidBlade",      item: "Minotaur Pouch", avatar: "VB" },
  { name: "GuildMaster",    item: "LEIZ Bundle",    avatar: "GM" },
  { name: "ShadowRogue",    item: "Gold Currency",  avatar: "SR" },
  { name: "PhoenixDN",      item: "Pet Coupon",     avatar: "PD" },
  { name: "CrystalKnight",  item: "DNP",            avatar: "CK" },
];

export default function LivePurchaseTicker() {
  return (
    <div
      className="live-ticker-wrapper"
      style={{
        position: "fixed",
        bottom: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(1200px, calc(100vw - 24px))",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        className="live-ticker-container"
        style={{
          background: "rgba(34, 35, 41, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: "12px",
          border: "1px solid rgba(211, 188, 142, 0.18)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(211, 188, 142, 0.08) inset",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Gold accent top border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(211,188,142,0.35) 30%, rgba(211,188,142,0.35) 70%, transparent)",
          }}
          aria-hidden="true"
        />

        {/* Ticker content */}
        <div
          className="ticker-track-wrapper"
          style={{
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            className="ticker-track animate-live-ticker"
            style={{
              display: "flex",
              gap: "0px",
              padding: "10px 0",
            }}
          >
            {/* Duplicate items for infinite loop */}
            {[...liveFeed, ...liveFeed, ...liveFeed].map((feed, i) => (
              <div
                key={i}
                className="ticker-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  paddingLeft: "24px",
                  paddingRight: "24px",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {/* Cart Icon */}
                <ShoppingCart
                  size={13}
                  style={{ color: "#D3BC8E", flexShrink: 0, opacity: 0.7 }}
                />

                {/* Avatar */}
                <div
                  className="ticker-avatar"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    background: "rgba(124, 58, 237, 0.18)",
                    border: "1px solid rgba(124, 58, 237, 0.25)",
                    color: "#A78BFA",
                    fontSize: "7px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {feed.avatar}
                </div>

                {/* Purchase text */}
                <span
                  style={{
                    fontSize: "12px",
                    color: "#999999",
                    fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                  }}
                >
                  <span style={{ color: "#CCCCCC", fontWeight: 400 }}>
                    {feed.name}
                  </span>
                  {" just bought "}
                  <span style={{ color: "#D3BC8E", fontWeight: 500 }}>
                    {feed.item}
                  </span>
                </span>

                {/* Separator dot */}
                <span
                  style={{
                    color: "rgba(255, 255, 255, 0.10)",
                    fontSize: "14px",
                    marginLeft: "6px",
                  }}
                >
                  •
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile media query styles */}
      <style jsx>{`
        @media (max-width: 640px) {
          .live-ticker-wrapper {
            bottom: 8px !important;
            width: calc(100vw - 16px) !important;
          }
          .live-ticker-container {
            border-radius: 8px !important;
          }
          .ticker-track {
            padding: 8px 0 !important;
          }
          .ticker-item {
            padding-left: 16px !important;
            padding-right: 16px !important;
            gap: 6px !important;
          }
          .ticker-item span {
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
