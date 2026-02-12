import fs from "fs";
import path from "path";

interface FAQPair {
  intent: string;
  keywords: string[];
  response: string;
}

interface Product {
  id: string;
  name: string;
  prices: Array<{ size: string; price: number }>;
  originalPrice?: number | null;
  description: string;
  containsAlcohol: boolean;
  temperature: string;
  shippingMethod: string;
  keywords: string[];
}

interface MatchResult {
  matched: boolean;
  response?: string;
  intent?: string;
}

let faqPairs: FAQPair[] | null = null;
let products: Product[] | null = null;

/**
 * Load FAQ pairs from data/faq-pairs.json
 */
function loadFAQPairs(): FAQPair[] {
  if (faqPairs) return faqPairs;

  try {
    const faqPath = path.join(process.cwd(), "data", "faq-pairs.json");
    const content = fs.readFileSync(faqPath, "utf-8");
    faqPairs = JSON.parse(content);
    return faqPairs!;
  } catch (error) {
    console.error("Failed to load FAQ pairs:", error);
    return [];
  }
}

/**
 * Load products from data/products.json
 */
function loadProducts(): Product[] {
  if (products) return products;

  try {
    const productsPath = path.join(process.cwd(), "data", "products.json");
    const content = fs.readFileSync(productsPath, "utf-8");
    products = JSON.parse(content);
    return products!;
  } catch (error) {
    console.error("Failed to load products:", error);
    return [];
  }
}

/**
 * Check if message contains any keywords from a list
 */
function containsKeywords(message: string, keywords: string[]): number {
  let count = 0;
  const lowerMessage = message.toLowerCase();

  for (const keyword of keywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      count++;
    }
  }

  return count;
}

/**
 * Format product information for display
 */
function formatProductInfo(product: Product): string {
  const priceStr = product.prices
    .map((p) => `${p.size} NT$${p.price}`)
    .join(" / ");

  const discountStr = product.originalPrice
    ? `（原價 NT$${product.originalPrice}）`
    : "";

  const alcoholStr = product.containsAlcohol
    ? "（含酒精）"
    : "（無酒精✅）";

  return `\n📌 ${product.name} ${alcoholStr}\n價格：${priceStr}${discountStr}\n描述：${product.description}\n溫層：${product.temperature} | 運費：${product.shippingMethod}`;
}

/**
 * Match user message to intent and return appropriate response
 * Supports both generic FAQ matching and product-specific queries
 */
export function matchIntent(message: string): MatchResult {
  if (!message || typeof message !== "string") {
    return { matched: false };
  }

  const faqs = loadFAQPairs();
  const allProducts = loadProducts();

  // First, check if the message contains product keywords
  // This allows for product-specific queries like "提拉米蘇多少錢"
  let bestProductMatch: Product | null = null;
  let bestProductMatchCount = 0;

  for (const product of allProducts) {
    const matchCount = containsKeywords(message, product.keywords);
    if (matchCount > bestProductMatchCount) {
      bestProductMatchCount = matchCount;
      bestProductMatch = product;
    }
  }

  // Then, find the best matching FAQ intent
  let bestFAQMatch: FAQPair | null = null;
  let bestFAQMatchCount = 0;

  for (const faq of faqs) {
    const matchCount = containsKeywords(message, faq.keywords);
    if (matchCount > bestFAQMatchCount) {
      bestFAQMatchCount = matchCount;
      bestFAQMatch = faq;
    }
  }

  // If both product and FAQ match, use FAQ but include product info
  if (bestFAQMatch && bestFAQMatchCount > 0) {
    let response = bestFAQMatch.response;

    // For price-related queries with product match, append product info
    if (
      bestProductMatch &&
      bestProductMatchCount > 0 &&
      (bestFAQMatch.intent === "product_price" ||
        bestFAQMatch.intent === "product_list" ||
        bestFAQMatch.intent === "frozen_info")
    ) {
      response += formatProductInfo(bestProductMatch);
    }

    return {
      matched: true,
      response,
      intent: bestFAQMatch.intent,
    };
  }

  // If only product matches (but no FAQ intent), generate a basic response
  if (bestProductMatch && bestProductMatchCount > 0) {
    const response = `關於 ${bestProductMatch.name}：${formatProductInfo(bestProductMatch)}`;
    return {
      matched: true,
      response,
      intent: "product_info",
    };
  }

  // No match found
  return { matched: false };
}
