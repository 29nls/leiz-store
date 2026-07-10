"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RefreshCw } from "@/components/ui/icons";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-void">
      <div className="mx-auto max-w-md px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-error/10 border border-error/20 mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-error" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Something went wrong</h1>
        <p className="text-text-secondary mb-8 text-sm leading-relaxed">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="btn-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" />
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}