import { Metadata } from "next";
import "@/app/globals.css";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "Admin Panel - Leiz Store",
  description: "Leiz Store Admin Panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}