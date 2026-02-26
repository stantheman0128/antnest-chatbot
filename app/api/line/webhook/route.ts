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

// Extend Vercel function timeout (free plan: max 60s)
export const maxDuration = 30;

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

/**
 * Show loading animation in LINE chat (the "typing..." bubble)
 * Duration: 5-60 seconds, automatically dismissed when reply is sent
 */
async function showLoadingAnimation(userId: string) {
  try {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: 30,
      }),
    });
  } catch (error) {
    // Non-critical, don't fail the whole request
    console.error("Loading animation error:", error);
  }
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

  const carousel = buildProductCarousel(getAllProductIds());
  const messages: Message[] = [welcomeText];
  if (carousel) messages.push(carousel);

  return messages;
}

async function handleTextMessage(
  event: WebhookEvent & {
    type: "message";
    message: { type: "text"; text: string };
    source: { userId?: string };
  }
) {
  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log("LINE message received:", userMessage);

  // Show loading animation while AI is thinking
  if (userId) {
    showLoadingAnimation(userId);
  }

  const aiResponse = await generateAIResponse(userMessage, []);
  const hasProducts = aiResponse.productIds.length > 0;

  const textMsg: TextMessage = {
    type: "text",
    text: aiResponse.text,
    quickReply: getQuickReply(hasProducts),
  };

  const messages: Message[] = [textMsg];

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
        if (event.type === "follow") {
          await handleFollowEvent(event as any);
          return;
        }

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
