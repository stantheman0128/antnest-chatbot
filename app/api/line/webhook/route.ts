import { NextRequest, NextResponse } from "next/server";
import { Client, WebhookEvent, TextMessage, FlexMessage } from "@line/bot-sdk";
import { generateAIResponse } from "@/lib/ai-client";
import { buildProductCarousel } from "@/lib/flex-message";

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

    const events: WebhookEvent[] = JSON.parse(body).events;

    await Promise.all(
      events.map(async (event) => {
        if (event.type !== "message" || event.message.type !== "text") {
          return;
        }

        const userMessage = event.message.text;
        console.log("LINE message received:", userMessage);

        const aiResponse = await generateAIResponse(userMessage, []);

        // Build messages array: text + optional product cards
        const messages: (TextMessage | FlexMessage)[] = [
          { type: "text", text: aiResponse.text },
        ];

        // Add product carousel if AI mentioned specific products
        if (aiResponse.productIds.length > 0) {
          const carousel = buildProductCarousel(aiResponse.productIds);
          if (carousel) {
            messages.push(carousel);
          }
        }

        console.log(
          "LINE: AI response sent",
          aiResponse.productIds.length > 0
            ? `with ${aiResponse.productIds.length} product cards`
            : "(text only)"
        );

        await getLineClient().replyMessage(event.replyToken, messages);
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
