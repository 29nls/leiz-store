/**
 * Database Module - Supabase Backend
 * Replaces JSON file-based storage with Supabase PostgreSQL
 */

import { prisma } from "@/lib/supabase-db";

export { prisma };
export default prisma;
