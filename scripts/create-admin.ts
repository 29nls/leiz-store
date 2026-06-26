/**
 * Admin User Setup Script
 * 
 * Creates an admin user in:
 * 1. Supabase Auth (auth.users) — for signing in via supabase.auth.signInWithPassword()
 * 2. public.user table — for RLS checks (public.is_admin() uses auth.email() → public.user.email)
 * 
 * Usage: npx tsx scripts/create-admin.ts
 * 
 * Prerequisites:
 * - .env.local must have NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   and SUPABASE_SERVICE_ROLE_KEY set
 * - The Supabase project must be running
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (answer) => resolve(answer));
  });
}

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    LEIZ STORE — Admin User Setup         ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing environment variables.");
    console.error("   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  // Create admin client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get admin credentials
  const email = await prompt("Admin email [admin@leizstore.com]: ") || "admin@leizstore.com";
  const password = await prompt("Admin password [min 6 chars]: ");
  const name = await prompt("Admin name [Admin]: ") || "Admin";

  if (!password || password.length < 6) {
    console.error("❌ Password must be at least 6 characters.");
    process.exit(1);
  }

  console.log(`\n📧 Creating admin user: ${email}\n`);

  try {
    // Step 1: Create user in Supabase Auth
    console.log("1️⃣  Creating user in Supabase Auth...");
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "ADMIN" },
    });

    if (authError) {
      // If user already exists, try to get them
      if (authError.message.includes("already exists")) {
        console.log("   ⚠️  User already exists in Auth, skipping...");
      } else {
        throw authError;
      }
    } else {
      console.log(`   ✅ Auth user created: ${authUser.user.id}`);
    }

    // Step 2: Create/update record in public.user table
    console.log("2️⃣  Creating record in public.user table...");
    const hashedPassword = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    // Check if user already exists in public.user
    const { data: existing } = await supabase
      .from("user")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing user to ADMIN role
      const { error: upError } = await supabase
        .from("user")
        .update({ role: "ADMIN", name, updated_at: new Date().toISOString() })
        .eq("email", email);

      if (upError) throw upError;
      console.log(`   ✅ User record updated to ADMIN role`);
    } else {
      // Create new user record
      const { error: insError } = await supabase.from("user").insert({
        id: generateId(),
        email,
        password: hashedPassword,
        name,
        role: "ADMIN",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insError) throw insError;
      console.log(`   ✅ User record created with ADMIN role`);
    }

    console.log("\n✅ Admin user setup complete!\n");
    console.log("You can now login at /admin with:");
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log("\nNote: Login uses Supabase Auth (signInWithPassword).");
    console.log("RLS policies check auth.email() against public.user.email for admin access.\n");

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
