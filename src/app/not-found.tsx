import Link from "next/link";
import { ArrowLeft, Package } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-void">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface border border-border mx-auto mb-6">
          <Package className="h-10 w-10 text-text-secondary/30" />
        </div>
        <h1 className="text-6xl font-bold text-text-primary mb-2">404</h1>
        <p className="text-text-secondary mb-8 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn-primary">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>
    </main>
  );
}