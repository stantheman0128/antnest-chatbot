import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/data-service";

export async function GET() {
  const slots = await getAvailableSlots();
  return NextResponse.json(slots);
}
