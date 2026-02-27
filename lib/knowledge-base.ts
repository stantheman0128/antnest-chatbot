import fs from "fs";
import path from "path";
import { getActiveProducts, getConfigMap, ProductCard } from "./data-service";

/**
 * Build the system prompt dynamically from Supabase data.
 * Falls back to static file if DB is unavailable.
 */
export async function getSystemPrompt(): Promise<string> {
  try {
    const [configMap, products] = await Promise.all([
      getConfigMap(),
      getActiveProducts(),
    ]);

    // If we have DB config, assemble dynamically
    if (configMap.size > 0) {
      return assemblePrompt(configMap, products);
    }
  } catch (e) {
    console.error("Failed to build dynamic system prompt:", e);
  }

  // Fallback to static file
  return getStaticSystemPrompt();
}

function assemblePrompt(
  config: Map<string, string>,
  products: ProductCard[]
): string {
  const get = (key: string) => config.get(key) || "";

  // Build <products> section from DB products
  const productsXml = products
    .map(
      (p) =>
        `<product id="${p.id}">\n${p.detailedDescription || `名稱：${p.name}\n價格：${p.price}\n特色：${p.description}`}\n</product>`
    )
    .join("\n\n");

  // Build price reference from products
  const priceRef = products
    .map((p, i) => `${i + 1}. ${p.name} ${p.price}`)
    .join("\n");

  const sections = [
    wrap("identity", get("identity")),
    wrap("mission", get("mission")),
    get("rules") ? `<rules priority="由高到低">\n${get("rules")}\n</rules>` : "",
    wrap("format", get("format")),
    wrap("out_of_scope_reply", get("out_of_scope_reply")),
    "<knowledge_base>",
    `<products>\n${productsXml}\n</products>`,
    `<price_reference>\n${get("price_reference") || priceRef}\n</price_reference>`,
    wrap("shipping", get("shipping")),
    wrap("pickup", get("pickup")),
    wrap("payment", get("payment")),
    wrap("refund_policy", get("refund_policy")),
    wrap("membership", get("membership")),
    wrap("brand_story", get("brand_story")),
    wrap("contact", get("contact")),
    wrap("ordering_process", get("ordering_process")),
    "</knowledge_base>",
    wrap("reminders", get("reminders")),
  ];

  return sections.filter(Boolean).join("\n\n");
}

function wrap(tag: string, content: string): string {
  if (!content) return "";
  return `<${tag}>\n${content}\n</${tag}>`;
}

function getStaticSystemPrompt(): string {
  try {
    const promptPath = path.join(process.cwd(), "data", "system-prompt.md");
    return fs.readFileSync(promptPath, "utf-8");
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    return `你是螞蟻窩甜點的客服助理「小螞蟻」🐜，用親切友善的繁體中文回答顧客問題。

只根據提供的信息回答問題，不編造或猜測不確定的內容。如果問題超出範圍，禮貌地告知顧客聯繫真人客服。

聯絡方式：
📞 電話：0906367231
📧 Email：evaboxbox@gmail.com
💬 LINE 官方帳號：https://lin.ee/0Mdsdci`;
  }
}
