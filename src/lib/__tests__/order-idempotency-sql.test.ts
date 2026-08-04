import fs from "node:fs";
import path from "node:path";

describe("order idempotency migration contract", () => {
  const migrationPath = path.join(process.cwd(), "scripts/migrations/008_order_idempotency.sql");
  const migration = fs.readFileSync(migrationPath, "utf8");

  it("defines the protected idempotency table and uniqueness boundary", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.order_idempotency");
    expect(migration).toContain("UNIQUE (scope, idempotency_key)");
    expect(migration).toContain("order_idempotency_key_format");
    expect(migration).toContain("order_idempotency_fingerprint_format");
    expect(migration).toContain("encrypted_payment_token TEXT NOT NULL");
    expect(migration).toContain("REVOKE ALL ON TABLE public.order_idempotency FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT ALL ON TABLE public.order_idempotency TO service_role");
  });

  it("replaces the old RPC and serializes keyed requests", () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.create_order_atomic(JSONB, JSONB, NUMERIC)");
    expect(migration).toContain("p_idempotency_key TEXT DEFAULT NULL");
    expect(migration).toContain("p_request_fingerprint TEXT DEFAULT NULL");
    expect(migration).toContain("p_encrypted_payment_token TEXT DEFAULT NULL");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("'replayed', true");
    expect(migration).toContain("Idempotency key has expired");
    expect(migration).toContain("Duplicate products are not allowed");
  });

  it("documents the live PostgreSQL concurrency requirement", () => {
    expect(migration).toContain("Serialize only requests sharing this logical key");
    expect(migration).toContain("Lock every requested product in deterministic order");
  });
});
