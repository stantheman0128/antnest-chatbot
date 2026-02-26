import { NextRequest, NextResponse } from "next/server";
import { Client, WebhookEvent, TextMessage } from "@line/bot-sdk";
import { matchIntent } from "@/lib/intent-matcher";
import { generateAIResponse } from "@/lib/ai-client";

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // LINE SDK will verify signature
    const events: WebhookEvent[] = JSON.parse(body).events;

    await Promise.all(
      events.map(async (event) => {
        if (event.type !== "message" || event.message.type !== "text") {
          return;
        }

        const userMessage = event.message.text;
        console.log("LINE message received:", userMessage);

        // Tier 1: Template matching
        const templateResult = matchIntent(userMessage);

        let replyText: string;

        if (templateResult.matched) {
          replyText = templateResult.response!;
          console.log("LINE: Template match -", templateResult.intent);
        } else {
          // Tier 2: AI response
          replyText = await generateAIResponse(userMessage, []);
          console.log("LINE: AI response");
        }

        // Reply to user
        await getLineClient().replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        } as TextMessage);
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
