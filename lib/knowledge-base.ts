import fs from "fs";
import path from "path";

/**
 * Load and return the system prompt from data/system-prompt.md
 * This serves as the comprehensive knowledge base for the AI assistant
 */
export function getSystemPrompt(): string {
  try {
    const promptPath = path.join(
      process.cwd(),
      "data",
      "system-prompt.md"
    );
    const content = fs.readFileSync(promptPath, "utf-8");
    return content;
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    // Fallback prompt if file cannot be loaded
    return `你是螞蟻窩甜點的客服助理「小蟻」🐜，用親切友善的繁體中文回答顧客問題。

只根據提供的信息回答問題，不編造或猜測不確定的內容。如果問題超出範圍，禮貌地告知顧客聯繫真人客服。

聯絡方式：
📞 電話：0906367231
📧 Email：evaboxbox@gmail.com
💬 LINE 官方帳號：https://lin.ee/0Mdsdci`;
  }
}
