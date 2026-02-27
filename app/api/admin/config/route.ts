import { NextRequest, NextResponse } from "next/server";
import { getAllConfigs, getConfig, setConfig } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
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
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json(
      { error: "key and value are required" },
      { status: 400 }
    );
  }

  const ok = await setConfig(key, value);
  if (!ok) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
