import { NextRequest, NextResponse } from "next/server";
import { getAllExamples, upsertExample, deleteExample } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const examples = await getAllExamples();
  return NextResponse.json(examples);
}

export async function POST(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  if (!body.customerMessage || !body.correctResponse) {
    return NextResponse.json(
      { error: "customerMessage and correctResponse are required" },
      { status: 400 }
    );
  }

  const result = await upsertExample(body);
  if (!result) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const ok = await deleteExample(id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
