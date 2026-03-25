import { NextRequest, NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai-client";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const aiResponse = await generateAIResponse(message, history || []);
    return NextResponse.json({
      response: aiResponse.text,
      productIds: aiResponse.productSpecs.map((s) => s.id),
      source: "ai",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        response:
          "抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com",
        productIds: [],
        source: "error",
      },
      { status: 500 }
    );
  }
}
