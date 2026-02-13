import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt } from "./knowledge-base";

interface MessageHistory {
  role: string;
  content: string;
}

function getAIClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || apiKey === "your_google_ai_key_here") {
    throw new Error(
      "GOOGLE_AI_API_KEY not configured. Please:\n" +
      "1. Visit https://aistudio.google.com/apikey\n" +
      "2. Create a new API key\n" +
      "3. Add it to .env.local as: GOOGLE_AI_API_KEY=your_actual_key\n" +
      "4. Restart the development server"
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate AI response using Google Gemini 2.5 Flash-Lite
 * - Free tier: 1,000 requests/day
 * - Strong instruction following and Chinese comprehension
 * - Includes comprehensive knowledge base as system prompt
 */
export async function generateAIResponse(
  message: string,
  history: MessageHistory[] = []
): Promise<string> {
  try {
    const genAI = getAIClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: getSystemPrompt(),
    });

    // Convert history format to Gemini format
    const contents = history
      .filter((msg) => msg.role && msg.content)
      .map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

    // Add current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await model.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.5,
      },
    });

    const textContent = response.response.text();

    if (!textContent) {
      return "抱歉，我暫時無法回答你的問題。請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com";
    }

    return textContent;
  } catch (error) {
    console.error("AI generation error:", error);

    return "抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com";
  }
}
