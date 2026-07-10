"use client";

import Link from "next/link";
import { MessageCircle, Mail } from "@/components/ui/icons";

const paymentMethods = ["Bank Jago", "GoPay", "DANA", "SeaBank"];

const legalLinks = [
  { href: "/terms",  label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/faq",    label: "FAQ" },
];

export default function Footer() {
  return (
    <footer className="relative bg-surface border-t border-border">

      {/* Ornament top */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px dn-divider"
      />

      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">

        {/* Main content - Contact + Payment + Legal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 py-10">

          {/* Contact */}
          <div>
            <div className="mb-3">
              <a
                href="#"
                className="flex items-center gap-2 text-sm font-normal text-text-secondary hover:text-text-primary transition-colors duration-200 no-underline"
              >
                <MessageCircle size={14} className="text-text-secondary flex-shrink-0" />
                Discord Server
              </a>
            </div>
            <div>
              <a
                href="mailto:support@leizstore.com"
                className="flex items-center gap-2 text-sm font-normal text-text-secondary hover:text-text-primary transition-colors duration-200 no-underline"
              >
                <Mail size={14} className="text-text-secondary flex-shrink-0" />
                support@leizstore.com
              </a>
            </div>
          </div>

          {/* Payment */}
          <div>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-surface-raised text-text-secondary text-xs"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-3">
            {legalLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-normal text-text-secondary hover:text-text-primary transition-colors duration-200 no-underline"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
}
