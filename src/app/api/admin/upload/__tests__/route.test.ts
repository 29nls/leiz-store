const mockListBuckets = jest.fn();
const mockCreateBucket = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

class MockResponse {
  status: number;
  private body: unknown;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status || 200;
  }

  async json() {
    return this.body;
  }
}

jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
      new MockResponse(data, init),
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  isAdminRequest: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/rate-limit", () => ({
  enforceAdminRateLimit: async () => null,
}));

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      listBuckets: (...args: unknown[]) => mockListBuckets(...args),
      createBucket: (...args: unknown[]) => mockCreateBucket(...args),
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

import { POST } from "@/app/api/admin/upload/route";

// The REAL magic-byte checker from payment-proof-storage is used (only
// @/lib/supabase is mocked), so these tests exercise the actual signatures.

// One valid image per MIME type in ALLOWED_IMAGE_TYPES (jpeg/png/webp/avif)
// so the "covers all four types" claim is exercised, not assumed.
const VALID_IMAGES: Array<{ name: string; type: string; bytes: Uint8Array<ArrayBuffer> }> = [
  { name: "photo.jpg", type: "image/jpeg", bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]) },
  {
    name: "photo.png",
    type: "image/png",
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  },
  {
    name: "photo.webp",
    type: "image/webp",
    bytes: Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 0, 0, 0, 0]),
  },
  {
    name: "photo.avif",
    type: "image/avif",
    bytes: Uint8Array.from([0, 0, 0, 0, ...Buffer.from("ftyp"), ...Buffer.from("avif"), 0, 0, 0, 0]),
  },
];

function htmlBytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(new TextEncoder().encode("<!DOCTYPE html><html><body>polyglot</body></html>"));
}

// jsdom's File is opaque (no arrayBuffer()/text()) even though Node's runtime
// File has them, so give the instance the bytes the route reads back. The file
// is still a genuine File instance and passes z.instanceof(File).
function makeUploadFile(bytes: Uint8Array<ArrayBuffer>, name: string, type: string): File {
  const file = new File([bytes], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    value: () =>
      Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });
  return file;
}

function uploadRequest(file: File): { formData: () => Promise<FormData>; headers: Headers } {
  const form = new FormData();
  form.set("file", file);
  return { formData: async () => form, headers: new Headers() };
}

describe("POST /api/admin/upload magic-byte validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListBuckets.mockResolvedValue({ data: [{ name: "product-images" }], error: null });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn.test/products/x.png" } });
  });

  it.each(VALID_IMAGES)("accepts a valid $type whose magic bytes match", async ({ name, type, bytes }) => {
    const response = await POST(uploadRequest(makeUploadFile(bytes, name, type)) as never);

    expect(response.status).toBe(200);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("rejects HTML content declared as an image and never touches storage", async () => {
    const file = makeUploadFile(htmlBytes(), "evil.png", "image/png");
    const response = await POST(uploadRequest(file) as never);

    expect(response.status).toBe(400);
    expect((await response.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockCreateBucket).not.toHaveBeenCalled();
  });

  it("rejects a real image declared with a mismatched type", async () => {
    const file = makeUploadFile(VALID_IMAGES[1].bytes, "photo.jpg", "image/jpeg");
    const response = await POST(uploadRequest(file) as never);

    expect(response.status).toBe(400);
    expect((await response.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
