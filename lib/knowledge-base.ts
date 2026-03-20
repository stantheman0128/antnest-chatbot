import fs from "fs";
import path from "path";
import { getActiveProducts, getConfigMap, getActiveExamples, ProductCard, ConversationExample } from "./data-service";

/**
 * Build the system prompt dynamically from Supabase data.
 * Falls back to static file if DB is unavailable.
 */
export async function getSystemPrompt(): Promise<string> {
  try {
    const [configMap, products, examples] = await Promise.all([
      getConfigMap(),
      getActiveProducts(),
      getActiveExamples(),
    ]);

    // If we have DB config, assemble dynamically
    if (configMap.size > 0) {
      return assemblePrompt(configMap, products, examples);
    }
  } catch (e) {
    console.error("Failed to build dynamic system prompt:", e);
  }

  // Fallback to static file
  return getStaticSystemPrompt();
}

function assemblePrompt(
  config: Map<string, string>,
  products: ProductCard[],
  examples: ConversationExample[] = []
): string {
  const get = (key: string) => config.get(key) || "";

  // Build <products> section from DB products (with variant info and stock status)
  const productsXml = products
    .map((p) => {
      if (p.detailedDescription) {
        return `<product id="${p.id}">\n${p.detailedDescription}\n</product>`;
      }
      // Determine product-level stock status
      const allSoldOut = p.variants.length > 0 && p.variants.every((v) => !v.available);
      const stockLabel = allSoldOut ? "\n庫存狀態：⚠️ 全品項已售完" : "";

      let body = `名稱：${p.name}\n價格：${p.price}\n特色：${p.description}${stockLabel}`;
      if (p.variants.length > 0) {
        const variantLines = p.variants.map((v) => {
          const name = v.option1 || v.title;
          const avail = v.available ? "（有庫存）" : "（已售完）";
          return `- ${name} NT$${v.price} ${avail}`;
        });
        body += `\n口味：\n${variantLines.join("\n")}`;
      }
      return `<product id="${p.id}">\n${body}\n</product>`;
    })
    .join("\n\n");

  // Build price reference from products (with variants)
  const priceRef = products
    .map((p, i) => {
      if (p.variants.length > 1) {
        const lines = p.variants.map((v) => `   - ${v.option1 || v.title} NT$${v.price}`);
        return `${i + 1}. ${p.name}\n${lines.join("\n")}`;
      }
      return `${i + 1}. ${p.name} ${p.price}`;
    })
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
    buildExamplesSection(examples),
  ];

  return sections.filter(Boolean).join("\n\n");
}

function buildExamplesSection(examples: ConversationExample[]): string {
  if (examples.length === 0) return "";
  const body = examples
    .map(
      (e, i) =>
        `[範例${i + 1}]\n顧客說：「${e.customerMessage}」\n你應該回：「${e.correctResponse}」${e.note ? `\n（備註：${e.note}）` : ""}`
    )
    .join("\n\n");
  return `<correction_examples>\n以下是真實對話的修正範例，請嚴格遵守：\n\n${body}\n</correction_examples>`;
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
