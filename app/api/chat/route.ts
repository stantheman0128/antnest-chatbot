import { NextRequest, NextResponse } from "next/server";
import { matchIntent } from "@/lib/intent-matcher";
import { generateAIResponse } from "@/lib/ai-client";

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Tier 1: Template matching — only for clear, simple FAQ queries
    const templateResult = matchIntent(message);
    if (templateResult.matched) {
      return NextResponse.json({
        response: templateResult.response,
        source: "template",
        intent: templateResult.intent,
      });
    }

    // Tier 2: AI fallback for more complex or personalized questions
    const aiResponse = await generateAIResponse(
      message,
      history || []
    );
    return NextResponse.json({
      response: aiResponse,
      source: "ai",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        response:
          "抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com",
        source: "error",
      },
      { status: 500 }
    );
  }
}
