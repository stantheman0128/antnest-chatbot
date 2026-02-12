import OpenAI from "openai";
import { getSystemPrompt } from "./knowledge-base";

interface MessageHistory {
  role: string;
  content: string;
}

function getAIClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1"
  });
}

/**
 * Generate AI response using Groq Llama 3.1 8B
 * Includes comprehensive knowledge base as system prompt
 */
export async function generateAIResponse(
  message: string,
  history: MessageHistory[] = []
): Promise<string> {
  try {
    const client = getAIClient();
    const systemPrompt = getSystemPrompt();

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history
        .filter((msg) => msg.role && msg.content)
        .map((msg) => ({
          role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.content,
        })),
      { role: "user", content: message },
    ];

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: 2048,
      temperature: 0.5,
    });

    const textContent = response.choices[0]?.message?.content;

    if (!textContent) {
      return "抱歉，我暫時無法回答你的問題。請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com";
    }

    return textContent;
  } catch (error) {
    console.error("AI generation error:", error);

    return "抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com";
  }
}
