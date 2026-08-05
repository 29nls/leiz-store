/**
 * Admin Validators
 * Zod schemas for server-side validation of admin panel requests.
 * Konsisten dengan payload yang dikirim `src/app/admin/**` (camelCase),
 * namun tetap toleran terhadap string numerik / boolean string dari klien lain.
 */

import { z } from "zod";

// ─── Shared field definitions ────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

/** Terima boolean asli ATAU string "true"/"false"; output berupa boolean. */
const booleanInput = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

/** Terima number atau numeric string; tolak negatif/NaN/desimal (sesuai konteks). */
const numberInput = (max = 9999999999) =>
  z.coerce.number().min(0, "Harus angka positif").max(max, "Nilai terlalu besar");

const integerInput = (max = 999999999) =>
  z.coerce
    .number()
    .int("Harus bilangan bulat")
    .min(0, "Harus bilangan bulat positif")
    .max(max, "Nilai terlalu besar");

const productImageSchema = z.object({
  url: z.string().min(1, "URL gambar wajib diisi").max(2000),
  alt: z.string().max(200).optional(),
  sortOrder: integerInput().optional(),
});

// ─── Product ─────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(200, "Maksimal 200 karakter"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug wajib diisi")
    .max(100, "Slug terlalu panjang")
    .regex(SLUG_RE, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  description: z.string().max(5000, "Deskripsi terlalu panjang").optional(),
  price: numberInput().describe("Harga (IDR)"),
  comparePrice: numberInput().optional(),
  unit: z.string().trim().max(50, "Unit terlalu panjang").optional(),
  stock: integerInput().optional(),
  minStock: integerInput().optional(),
  badge: z.string().trim().max(50, "Badge terlalu panjang").optional(),
  isActive: booleanInput.optional(),
  isFeatured: booleanInput.optional(),
  categoryId: z.string().min(1, "Kategori wajib dipilih").max(100),
  images: z.array(productImageSchema).max(20, "Maksimal 20 gambar").optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/** Update produk: semua field opsional (mis. toggle `{ isActive: false }`). */
export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── Category ────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi").max(100, "Maksimal 100 karakter"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug wajib diisi")
    .max(100, "Slug terlalu panjang")
    .regex(SLUG_RE, "Slug hanya boleh huruf kecil, angka, dan tanda hubung")
    .optional(),
  description: z.string().max(1000).nullable().optional(),
  icon: z.string().max(200).nullable().optional(),
  image: z.string().max(2000).nullable().optional(),
  sortOrder: integerInput().optional(),
  isActive: booleanInput.optional(),
  parentId: z.string().max(100).nullable().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ─── User ────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254, "Email terlalu panjang")
    .regex(EMAIL_RE, "Format email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter").max(200, "Password terlalu panjang"),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Maksimal 100 karakter"),
  role: z.enum(["ADMIN", "CUSTOMER"], "Role tidak valid").optional().default("ADMIN"),
  discord: z.string().max(100).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: z.string().trim().max(254).optional(), // diterima dari UI, tidak dipakai untuk update
    name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Maksimal 100 karakter").optional(),
    password: z
      .string()
      .min(6, "Password minimal 6 karakter")
      .max(200, "Password terlalu panjang")
      .optional(),
    role: z.enum(["ADMIN", "CUSTOMER"], "Role tidak valid").optional(),
    discord: z.string().max(100).nullable().optional(),
    phone: z.string().max(50).nullable().optional(),
    is_active: booleanInput.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field wajib diisi",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─── Setting ─────────────────────────────────────────────────

/** Key setting yang diizinkan. Tabel `setting` bersifat world-readable (RLS
 *  "Public read"), jadi key arbitrer dilarang agar secret tidak pernah bisa
 *  tersimpan lalu bocor publik (LOW-4). Tambahkan key baru di sini dan di
 *  `src/app/admin/settings/page.tsx` (DISPLAY_NAMES) secara beriringan. */
export const ALLOWED_SETTING_KEYS = [
  "store_name",
  "store_description",
  "currency",
  "tax_rate",
  "min_order_amount",
  "discord_link",
  "whatsapp_link",
  "email",
  "announcement",
] as const;

export type AllowedSettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

export const upsertSettingSchema = z
  .object({
    key: z.string().trim().min(1, "Key wajib diisi").max(100, "Key terlalu panjang"),
    value: z
      .union([z.string(), z.number(), z.boolean()])
      .transform((v) => String(v)),
    type: z.string().trim().max(50).optional().default("text"),
    group: z.string().trim().max(50).optional().default("general"),
  })
  .refine(
    (data) => ALLOWED_SETTING_KEYS.includes(data.key as AllowedSettingKey),
    { message: "Key setting tidak diizinkan", path: ["key"] }
  );

export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

// ─── Upload ──────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadFileSchema = z.object({
  file: z
    .instanceof(File, { message: "File wajib diunggah" })
    .refine((f) => f.size > 0, "File kosong")
    .refine(
      (f) => ALLOWED_IMAGE_TYPES.includes(f.type as (typeof ALLOWED_IMAGE_TYPES)[number]),
      "Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau AVIF"
    )
    .refine((f) => f.size <= MAX_UPLOAD_SIZE, "File terlalu besar. Maksimal 5MB"),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;

// ─── Helper ──────────────────────────────────────────────────

/** Ubah ZodError menjadi pesan satu-baris yang mudah dibaca ("field: pesan; field2: pesan2"). */
export function zodErrorMessages(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
