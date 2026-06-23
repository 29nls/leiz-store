import { NextRequest } from "next/server";
import { settingRepository } from "@/lib/repositories";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const group = request.nextUrl.searchParams.get("group");

    if (group) {
      const settings = await settingRepository.getMany(group);
      return Response.json(successResponse(settings));
    }

    const groups = ["general", "payment", "social", "contact", "notification", "content"];
    const allSettings: Record<string, Record<string, string>> = {};
    for (const g of groups) {
      allSettings[g] = await settingRepository.getMap(g);
    }
    return Response.json(successResponse(allSettings));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, type, group } = body;

    if (!key || value === undefined) {
      return Response.json(
        errorResponse(new Error("key and value are required") as any),
        { status: 400 }
      );
    }

    const setting = await settingRepository.set(key, value, type, group);
    return Response.json(successResponse(setting));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: Array<{ key: string; value: string; type?: string; group?: string }> =
      body.settings || [body];

    // Whitelist allowed setting keys to prevent injection of critical system keys
    const ALLOWED_KEY_PREFIXES = ["store_", "payment_", "discord_", "whatsapp_", "email_", "telegram_", "announcement_", "currency_", "tax_", "min_", "social_", "contact_"];
    const BLOCKED_KEYS = ["__proto__", "constructor", "prototype"];

    const validatedUpdates = updates.filter((s) => {
      if (BLOCKED_KEYS.includes(s.key)) return false;
      return ALLOWED_KEY_PREFIXES.some((prefix) => s.key.startsWith(prefix));
    });

    const results = await Promise.all(
      validatedUpdates.map((s) => settingRepository.set(s.key, s.value, s.type, s.group))
    );

    return Response.json(successResponse(results));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
