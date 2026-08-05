/**
 * Unit tests for admin panel Zod validators (src/lib/validators/admin.ts).
 */

import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  createUserSchema,
  updateUserSchema,
  upsertSettingSchema,
  uploadFileSchema,
  zodErrorMessages,
} from "@/lib/validators/admin";

describe("createProductSchema", () => {
  const validProduct = {
    name: "Pegasus Wing",
    slug: "pegasus-wing",
    price: 150000,
    categoryId: "cat_123",
  };

  it("accepts a valid product", () => {
    const result = createProductSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("rejects when name is missing", () => {
    const result = createProductSchema.safeParse({ ...validProduct, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid slug format", () => {
    const result = createProductSchema.safeParse({ ...validProduct, slug: "Pegasus Wing!" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = createProductSchema.safeParse({ ...validProduct, price: -5 });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings into numbers", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      price: "150000",
      stock: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(150000);
      expect(result.data.stock).toBe(10);
    }
  });

  it("coerces boolean strings into booleans", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      isActive: "false",
      isFeatured: "true",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
      expect(result.data.isFeatured).toBe(true);
    }
  });

  it("rejects non-integer stock", () => {
    const result = createProductSchema.safeParse({ ...validProduct, stock: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts nested image objects", () => {
    const result = createProductSchema.safeParse({
      ...validProduct,
      images: [{ url: "https://example.com/a.png", alt: "A", sortOrder: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("updateProductSchema", () => {
  it("accepts a partial update (toggle isActive)", () => {
    const result = updateProductSchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (partial schema)", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates fields when provided", () => {
    const result = updateProductSchema.safeParse({ slug: "Bad Slug!" });
    expect(result.success).toBe(false);
  });
});

describe("createCategorySchema", () => {
  const validCategory = { name: "Weapons" };

  it("accepts a valid category with auto-generated slug", () => {
    const result = createCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBeUndefined();
  });

  it("accepts an explicit valid slug", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, slug: "weapons" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid slug", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, slug: "Weapons!" });
    expect(result.success).toBe(false);
  });

  it("rejects when name is missing", () => {
    const result = createCategorySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts a partial update", () => {
    const result = updateCategorySchema.safeParse({ isActive: false });
    expect(result.success).toBe(true);
  });

  it("rejects invalid fields", () => {
    const result = updateCategorySchema.safeParse({ sortOrder: -1 });
    expect(result.success).toBe(false);
  });
});

describe("createUserSchema", () => {
  const validUser = {
    email: "admin@leiz.store",
    password: "secret123",
    name: "Leiz Admin",
  };

  it("accepts a valid user and defaults role to ADMIN", () => {
    const result = createUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("ADMIN");
  });

  it("rejects an invalid email", () => {
    const result = createUserSchema.safeParse({ ...validUser, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = createUserSchema.safeParse({ ...validUser, password: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown role", () => {
    const result = createUserSchema.safeParse({ ...validUser, role: "SUPERUSER" });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts a partial update", () => {
    const result = updateUserSchema.safeParse({ is_active: true });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body (nothing to update)", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an invalid role", () => {
    const result = updateUserSchema.safeParse({ role: "HACKER" });
    expect(result.success).toBe(false);
  });

  it("tolerates the email field sent by the UI during edit", () => {
    const result = updateUserSchema.safeParse({
      name: "New Name",
      email: "admin@leiz.store",
    });
    expect(result.success).toBe(true);
  });
});

describe("upsertSettingSchema", () => {
  it("accepts a string value", () => {
    const result = upsertSettingSchema.safeParse({ key: "store_name", value: "Leiz" });
    expect(result.success).toBe(true);
  });

  it("coerces non-string values to string (DB column is TEXT)", () => {
    const result = upsertSettingSchema.safeParse({ key: "max_stock", value: 42 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.value).toBe("42");
  });

  it("rejects when key is missing", () => {
    const result = upsertSettingSchema.safeParse({ value: "Leiz" });
    expect(result.success).toBe(false);
  });

  it("rejects when value is missing", () => {
    const result = upsertSettingSchema.safeParse({ key: "store_name" });
    expect(result.success).toBe(false);
  });
});

describe("uploadFileSchema", () => {
  function makeFile(name: string, type: string, size: number): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  it("accepts a valid image file", () => {
    const file = makeFile("photo.png", "image/png", 1024);
    const result = uploadFileSchema.safeParse({ file });
    expect(result.success).toBe(true);
  });

  it("rejects a null file", () => {
    const result = uploadFileSchema.safeParse({ file: null });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported file type", () => {
    const file = makeFile("doc.pdf", "application/pdf", 1024);
    const result = uploadFileSchema.safeParse({ file });
    expect(result.success).toBe(false);
  });

  it("rejects an empty file", () => {
    const file = makeFile("empty.png", "image/png", 0);
    const result = uploadFileSchema.safeParse({ file });
    expect(result.success).toBe(false);
  });

  it("rejects a file larger than 5MB", () => {
    const file = makeFile("big.png", "image/png", 5 * 1024 * 1024 + 1);
    const result = uploadFileSchema.safeParse({ file });
    expect(result.success).toBe(false);
  });
});

describe("zodErrorMessages", () => {
  it("joins issues into readable field: message pairs", () => {
    const parsed = createProductSchema.safeParse({ name: "", slug: "", price: -1 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = zodErrorMessages(parsed.error);
      expect(messages).toContain("name:");
      expect(messages).toContain("slug:");
      expect(messages).toContain("price:");
    }
  });

  it("uses 'body' as the path for root-level issues", () => {
    const parsed = createUserSchema.safeParse(null);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(zodErrorMessages(parsed.error)).toContain("body:");
    }
  });
});
