import { NextRequest, NextResponse } from "next/server";
import { getAllConfigs, getConfig, setConfig } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

// Max character limits per config key
const CONFIG_MAX_LENGTHS: Record<string, number> = {
  greeting: 500,
  next_order_announcement: 500,
  mission: 500,
  rules: 2000,
  format: 2000,
  out_of_scope_reply: 500,
  shipping: 1000,
  pickup: 1000,
  payment: 500,
  refund_policy: 1000,
  membership: 2000,
  brand_story: 2000,
  contact: 500,
  ordering_process: 1000,
  reminders: 1000,
  price_reference: 2000,
};

const DEFAULT_MAX_LENGTH = 2000;

// Suspicious patterns that might indicate prompt injection
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /忽略(以上|上面|之前|先前)(的)?(指令|規則|提示|設定)/g,
  /you\s+are\s+now\s+/gi,
  /override\s+(all\s+)?rules/gi,
  /system\s*prompt/gi,
  /new\s+instructions?:/gi,
];

function checkSuspiciousContent(value: string): string[] {
  const warnings: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(value)) {
      warnings.push(pattern.source);
    }
  }
  return warnings;
}

export async function GET(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const key = req.nextUrl.searchParams.get("key");
  if (key) {
    const value = await getConfig(key);
    return NextResponse.json({ key, value });
  }

  const configs = await getAllConfigs();
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    );
  }

  if (typeof value !== "string") {
    return NextResponse.json(
      { error: "value must be a string" },
      { status: 400 }
    );
  }

  // Check length limit
  const maxLength = CONFIG_MAX_LENGTHS[key] || DEFAULT_MAX_LENGTH;
  if (value.length > maxLength) {
    return NextResponse.json(
      { error: `值超過上限 ${maxLength} 字元（目前 ${value.length} 字）` },
      { status: 400 }
    );
  }

  // Check for suspicious content (warn but don't block)
  const warnings = checkSuspiciousContent(value);
  if (warnings.length > 0) {
    console.warn(`[CONFIG AUDIT] Suspicious content in key="${key}":`, warnings);
  }

  // Audit log: read previous value before overwriting
  const previousValue = await getConfig(key);
  if (previousValue !== null && previousValue !== value) {
    console.log(
      `[CONFIG AUDIT] key="${key}" changed at ${new Date().toISOString()}` +
      ` | prev_length=${previousValue.length} | new_length=${value.length}`
    );
  }

  const ok = await setConfig(key, value);
  if (!ok) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(warnings.length > 0 ? { warnings: ["內容包含可能的注入語句，請確認是否正確"] } : {}),
  });
}
