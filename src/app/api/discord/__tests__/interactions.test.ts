/**
 * Tests for Discord Interactions Handler
 * POST /api/discord/interactions
 *
 * Uses jest.mock() with inline factory (no external variable references)
 * to avoid ts-jest hoisting issues.
 */

// ── Mocks (no external variable references in factories) ────────────────────

// Polyfill Response for jsdom
if (typeof (globalThis as any).Response === "undefined") {
  (globalThis as any).Response = class MockResponse {
    public status: number;
    public ok: boolean;
    private _bodyStr: string;
    constructor(body?: any, init?: any) {
      this._bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      this.status = init?.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
    }
    async json() { return JSON.parse(this._bodyStr); }
    async text() { return String(this._bodyStr); }
  };
}

// Mock next/server — use jest.requireActual to get a usable mock
jest.mock("next/server", () => {
  const Response = (globalThis as any).Response;
  const fn = function (body: any, init?: any) {
    return new Response(body, init);
  } as any;
  fn.json = function (data: any, init?: any) {
    return new Response(JSON.stringify(data), { status: init?.status || 200, headers: { "Content-Type": "application/json" } });
  };
  return { NextResponse: fn, NextRequest: jest.fn() };
});

// Get shared mock functions from module-scoped variables
const mocks = {
  verifyKey: jest.fn().mockResolvedValue(true),
  adminAcceptPayment: jest.fn(),
  adminRejectPayment: jest.fn(),
  adminCancelOrder: jest.fn(),
  adminForceCancelOrder: jest.fn(),
  sendBuyerNotification: jest.fn().mockResolvedValue(true),
};

jest.mock("discord-interactions", () => ({
  verifyKey: mocks.verifyKey,
  InteractionType: { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3, APPLICATION_COMMAND_AUTOCOMPLETE: 4, MODAL_SUBMIT: 5 },
  InteractionResponseType: { PONG: 1, CHANNEL_MESSAGE_WITH_SOURCE: 4, DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5, DEFERRED_UPDATE_MESSAGE: 6, UPDATE_MESSAGE: 7 },
}));

jest.mock("@/lib/payment/payment-service", () => ({
  adminAcceptPayment: mocks.adminAcceptPayment,
  adminRejectPayment: mocks.adminRejectPayment,
  adminCancelOrder: mocks.adminCancelOrder,
  adminForceCancelOrder: mocks.adminForceCancelOrder,
}));

jest.mock("@/lib/discord/bot", () => ({
  sendBuyerNotification: mocks.sendBuyerNotification,
}));

jest.mock("@/lib/payment/order-logger", () => ({ logOrderStatusChange: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/payment/constants", () => ({ isValidTransition: jest.fn().mockReturnValue(true), PAYMENT_EXPIRY_MS: 86400000, PAYMENT_ACCOUNTS: [], MANUAL_PAYMENT_METHODS: [] }));
jest.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis() } }));

// ── Imports ─────────────────────────────────────────────────────────────────

import { POST } from "../interactions/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

const APP_ID = "123456789";
const TOKEN = "valid_token_ABCDEF12345";

function req(body: any, headers: Record<string, string> = {}, textThrows = false): any {
  return {
    text: jest.fn().mockImplementation(() => textThrows ? Promise.reject(new Error("fail")) : Promise.resolve(JSON.stringify(body))),
    headers: { get: jest.fn((n: string) => headers[n] ?? null) },
  };
}

function btn(customId: string, overrides: Record<string, any> = {}): any {
  return {
    type: 3, id: "interact_1", application_id: APP_ID, token: TOKEN,
    data: { custom_id: customId },
    member: { user: { id: "admin_1", username: "Admin" } },
    message: { id: "msg_1", embeds: [{ title: "Test", color: 0xf59e0b, fields: [], footer: { text: "LEIZ" } }] },
    ...overrides,
  };
}

function hdrs(): Record<string, string> {
  return { "x-signature-ed25519": "sig123", "x-signature-timestamp": "1700000000" };
}

function order(): any {
  return { id: "ord-1", order_number: "ORD-1", buyer_discord_id: "buyer_789", customer_name: "Test", total: 50000, status: "WAITING_CONFIRMATION", payment_method: "bank_transfer", confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Only clear call history — NOT implementations
  for (const key of Object.keys(mocks) as Array<keyof typeof mocks>) {
    mocks[key].mockClear();
  }
  (global.fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, text: jest.fn().mockResolvedValue("") });
  process.env.DISCORD_PUBLIC_KEY = "test_public_key";
});

afterEach(() => { delete process.env.DISCORD_PUBLIC_KEY; });

// ── Mock verification test ──────────────────────────────────────────────────

test("mock verifyKey works", async () => {
  const result = await mocks.verifyKey();
  expect(result).toBe(true);
});

// ── PING ────────────────────────────────────────────────────────────────────

describe("PING", () => {
  it("responds with PONG", async () => {
    const res = await POST(req({ type: 1 }, hdrs()) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe(1); // PONG
  });
});

// ── Signature ───────────────────────────────────────────────────────────────

describe("Signature", () => {
  it("401 if missing ed25519 header", async () => {
    const res = await POST(req({ type: 1 }, { "x-signature-timestamp": "t" }) as any);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Missing signature");
  });

  it("401 if missing timestamp header", async () => {
    const res = await POST(req({ type: 1 }, { "x-signature-ed25519": "s" }) as any);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Missing signature");
  });

  it("401 if signature invalid", async () => {
    mocks.verifyKey.mockResolvedValueOnce(false);
    const res = await POST(req({ type: 1 }, hdrs()) as any);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Invalid signature");
  });

  it("500 if DISCORD_PUBLIC_KEY not set", async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const res = await POST(req({ type: 1 }, hdrs()) as any);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Server misconfiguration");
  });

  it("401 if verifyKey throws", async () => {
    mocks.verifyKey.mockRejectedValueOnce(new Error("fail"));
    const res = await POST(req({ type: 1 }, hdrs()) as any);
    expect(res.status).toBe(401);
  });
});

// ── Body ────────────────────────────────────────────────────────────────────

describe("Body", () => {
  it("400 if not valid JSON", async () => {
    const r = { text: jest.fn().mockResolvedValue("not-json"), headers: { get: jest.fn(() => "x") } };
    const res = await POST(r as any);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Invalid JSON");
  });

  it("400 if text() throws", async () => {
    const res = await POST(req({ type: 1 }, hdrs(), true) as any);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("Bad request");
  });
});

// ── Custom ID ──────────────────────────────────────────────────────────────

describe("Custom ID", () => {
  it("ephemeral error if missing", async () => {
    const res = await POST(req({ type: 3, application_id: APP_ID, token: TOKEN, data: {}, member: { user: { id: "a" } } }, hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(4);
    expect(b.data.flags).toBe(64);
    expect(b.data.content).toContain("kosong");
  });

  it("ephemeral error if unknown format", async () => {
    const res = await POST(req(btn("weird_id"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(4);
    expect(b.data.content).toContain("tidak dikenali");
  });

  it("falls back to interaction.user when member.user missing", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    const interaction = btn("payment_accept_ord-1", { user: { id: "direct_u", username: "Direct" } });
    delete interaction.member;
    const res = await POST(req(interaction, hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(b.data.content).toContain("<@direct_u>");
  });
});

// ── Actions ─────────────────────────────────────────────────────────────────

describe("Actions", () => {
  it("accept", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    const res = await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(mocks.adminAcceptPayment).toHaveBeenCalledWith("ord-1", "admin_1");
    expect(b.data.embeds[0].color).toBe(0x22c55e);
    expect(b.data.components).toEqual([]);
  });

  it("reject", async () => {
    mocks.adminRejectPayment.mockResolvedValueOnce({ success: true, order: order() });
    const res = await POST(req(btn("payment_reject_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(mocks.adminRejectPayment).toHaveBeenCalledWith("ord-1", "admin_1");
    expect(b.data.embeds[0].color).toBe(0xef4444);
    expect(b.data.embeds[0].footer.text).toBe("⚠️ Pembayaran ditandai belum masuk oleh Admin");
  });

  it("cancel", async () => {
    mocks.adminCancelOrder.mockResolvedValueOnce({ success: true, order: order() });
    const res = await POST(req(btn("payment_cancel_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(mocks.adminCancelOrder).toHaveBeenCalledWith("ord-1", "admin_1");
    expect(b.data.embeds[0].color).toBe(0xef4444);
    expect(b.data.embeds[0].footer.text).toBe("🚫 Order dibatalkan oleh Admin");
  });

  it("force_cancel", async () => {
    mocks.adminForceCancelOrder.mockResolvedValueOnce({ success: true, order: order() });
    const res = await POST(req(btn("payment_force_cancel_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(mocks.adminForceCancelOrder).toHaveBeenCalledWith("ord-1", "admin_1");
    expect(b.data.embeds[0].color).toBe(0xef4444);
    expect(b.data.embeds[0].footer.text).toBe("⛔ Order dibatalkan paksa oleh Admin");
  });

  it("handles DB failure", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: false, error: "Not found" });
    const res = await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(b.data.content).toContain("Gagal");
    expect(b.data.embeds[0].color).toBe(0xef4444);
  });

  it("handles DB throw", async () => {
    mocks.adminAcceptPayment.mockRejectedValueOnce(new Error("DB err"));
    const res = await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(7);
    expect(b.data.content).toContain("DB err");
  });
});

// ── Buyer DM ────────────────────────────────────────────────────────────────

describe("Buyer DM", () => {
  it("sends when buyer has discord_id", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    expect(mocks.sendBuyerNotification).toHaveBeenCalled();
  });

  it("skips if discord_id null", async () => {
    const o = { ...order(), buyer_discord_id: null };
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: o });
    await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    expect(mocks.sendBuyerNotification).not.toHaveBeenCalled();
  });

  it("skips if action failed", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: false, error: "fail" });
    await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    expect(mocks.sendBuyerNotification).not.toHaveBeenCalled();
  });
});

// ── Embed ───────────────────────────────────────────────────────────────────

describe("Embed", () => {
  it("preserves original fields", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    const res = await POST(req(btn("payment_accept_ord-1"), hdrs()) as any);
    const b = await res.json();
    expect(b.data.embeds[0].title).toBe("Test");
  });

  it("handles missing embed gracefully", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    const interaction = btn("payment_accept_ord-1");
    delete interaction.message.embeds;
    const res = await POST(req(interaction, hdrs()) as any);
    const b = await res.json();
    expect(b.data.embeds).toEqual([]);
  });

  it("handles missing message entirely", async () => {
    mocks.adminAcceptPayment.mockResolvedValueOnce({ success: true, order: order() });
    const interaction = btn("payment_accept_ord-1");
    delete interaction.message;
    const res = await POST(req(interaction, hdrs()) as any);
    const b = await res.json();
    expect(b.data.embeds).toEqual([]);
  });
});

// ── Unhandled type ──────────────────────────────────────────────────────────

describe("Unhandled type", () => {
  it("returns ephemeral for APPLICATION_COMMAND (type 2)", async () => {
    const res = await POST(req({ type: 2, application_id: APP_ID, token: TOKEN }, hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(4);
    expect(b.data.flags).toBe(64);
  });

  it("returns ephemeral for MODAL_SUBMIT (type 5)", async () => {
    const res = await POST(req({ type: 5, application_id: APP_ID, token: TOKEN }, hdrs()) as any);
    const b = await res.json();
    expect(b.type).toBe(4);
    expect(b.data.flags).toBe(64);
  });
});
