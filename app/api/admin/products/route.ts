import { NextRequest, NextResponse } from "next/server";
import { getActiveProducts, getAllProducts, upsertProduct, deleteProduct } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const showAll = req.nextUrl.searchParams.get("all") === "true";
  const products = showAll ? await getAllProducts() : await getActiveProducts();
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  if (!body.id || !body.name || !body.price) {
    return NextResponse.json(
      { error: "id, name, price are required" },
      { status: 400 }
    );
  }

  const ok = await upsertProduct(body);
  if (!ok) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const ok = await deleteProduct(id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
