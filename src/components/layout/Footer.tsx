"use client";

import { MessageCircle, Mail } from "@/components/ui/icons";

const paymentMethods = ["QRIS", "DANA", "OVO", "GoPay", "Transfer"];

export default function Footer() {
  return (
    <footer style={{ position: "relative", background: "#1A1B20", borderTop: "1px solid rgba(211,188,142,0.10)" }}>

      {/* Gold ornament top */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(211,188,142,0.22) 30%, rgba(211,188,142,0.22) 70%, transparent)" }}
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">

        {/* Main content - Contact + Payment only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12" style={{ padding: "40px 0" }}>

          {/* Contact */}
          <div>
            <div style={{ marginBottom: "12px" }}>
              <a
                href="#"
                style={{ 
                  fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "#a1a1aa",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
              >
                <MessageCircle size={14} style={{ color: "#a1a1aa", flexShrink: 0 }} />
                Discord Server
              </a>
            </div>
            <div>
              <a
                href="mailto:support@leizstore.com"
                style={{ 
                  fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "#a1a1aa",
                  textDecoration: "none",
                  transition: "color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#e5e5e5")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#a1a1aa")}
              >
                <Mail size={14} style={{ color: "#a1a1aa", flexShrink: 0 }} />
                support@leizstore.com
              </a>
            </div>
          </div>

          {/* Payment */}
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {paymentMethods.map((m) => (
                <span
                  key={m}
                  style={{ 
                    padding: "6px 12px", 
                    borderRadius: "6px", 
                    background: "rgba(255,255,255,0.03)", 
                    border: "1px solid rgba(255,255,255,0.07)", 
                    fontSize: "12px", 
                    fontFamily: "Helvetica, Arial, system-ui, sans-serif", 
                    color: "#a1a1aa" 
                  }}
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
}
