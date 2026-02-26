import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  FlexMessage,
  Message,
} from "@line/bot-sdk";
import { generateAIResponse } from "@/lib/ai-client";
import { buildProductCarousel, getAllProductIds } from "@/lib/flex-message";
import { getQuickReply } from "@/lib/quick-replies";

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

function buildWelcomeMessages(): Message[] {
  const welcomeText: TextMessage = {
    type: "text",
    text:
      "歡迎來到螞蟻窩甜點！🐜\n\n" +
      "我是小蟻，你的甜點小幫手～\n" +
      "可以直接打字問我任何問題，\n" +
      "或點選下方按鈕快速開始！\n\n" +
      "先來看看我們有什麼好吃的吧 👇",
    quickReply: getQuickReply(false),
  };

  // Show all products carousel as welcome
  const carousel = buildProductCarousel(getAllProductIds());
  const messages: Message[] = [welcomeText];
  if (carousel) messages.push(carousel);

  return messages;
}

async function handleTextMessage(
  event: WebhookEvent & { type: "message"; message: { type: "text"; text: string } }
) {
  const userMessage = event.message.text;
  console.log("LINE message received:", userMessage);

  const aiResponse = await generateAIResponse(userMessage, []);
  const hasProducts = aiResponse.productIds.length > 0;

  // Text message with Quick Reply buttons
  const textMsg: TextMessage = {
    type: "text",
    text: aiResponse.text,
    quickReply: getQuickReply(hasProducts),
  };

  const messages: Message[] = [textMsg];

  // Add product carousel if AI mentioned products
  if (hasProducts) {
    const carousel = buildProductCarousel(aiResponse.productIds);
    if (carousel) messages.push(carousel);
  }

  console.log(
    "LINE: AI response sent",
    hasProducts
      ? `with ${aiResponse.productIds.length} product cards`
      : "(text only)"
  );

  await getLineClient().replyMessage(event.replyToken, messages);
}

async function handleFollowEvent(
  event: WebhookEvent & { type: "follow" }
) {
  console.log("LINE: New follower!");
  const messages = buildWelcomeMessages();
  await getLineClient().replyMessage(event.replyToken, messages);
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
        // Handle new follower
        if (event.type === "follow") {
          await handleFollowEvent(event as any);
          return;
        }

        // Handle text messages
        if (event.type === "message" && event.message.type === "text") {
          await handleTextMessage(event as any);
          return;
        }
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
