/**
 * Seed script: imports existing static data into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedProducts() {
  console.log("Seeding products...");

  const cardsPath = path.join(process.cwd(), "data", "product-cards.json");
  const cards = JSON.parse(fs.readFileSync(cardsPath, "utf-8"));

  const promptPath = path.join(process.cwd(), "data", "system-prompt.md");
  const prompt = fs.readFileSync(promptPath, "utf-8");

  const products: any[] = Object.entries(cards).map(([id, card]: [string, any], i) => {
    // Extract detailed description from system prompt
    const regex = new RegExp(
      `<product id="${id}">[\\s\\S]*?</product>`,
      "i"
    );
    const match = prompt.match(regex);
    const detailedDesc = match
      ? match[0]
          .replace(`<product id="${id}">`, "")
          .replace("</product>", "")
          .trim()
      : null;

    const isAlcohol = card.badges?.some((b: string) => b.includes("酒精") && !b.includes("無"));

    return {
      id,
      name: card.name,
      price: card.price,
      original_price: card.originalPrice || null,
      description: card.description,
      detailed_description: detailedDesc,
      image_url: card.image,
      store_url: card.url,
      badges: card.badges || [],
      is_active: true,
      sort_order: i,
      temperature_zone: id === "snowflake-cookies" ? "常溫" : "冷凍",
      alcohol_free: !isAlcohol,
    };
  });

  // Also add the spoon product
  const spoonMatch = prompt.match(
    /<product id="spoon">[\s\S]*?<\/product>/i
  );
  if (spoonMatch) {
    products.push({
      id: "spoon",
      name: "鏟子湯匙（加購專區）",
      price: "NT$10",
      original_price: null,
      description: "不鏽鋼鏟子湯匙，方便食用提拉米蘇與蛋糕類商品",
      detailed_description: spoonMatch[0]
        .replace('<product id="spoon">', "")
        .replace("</product>", "")
        .trim(),
      image_url: "",
      store_url: "https://antnest.cyberbiz.co/products/spoon",
      badges: [],
      is_active: true,
      sort_order: products.length,
      temperature_zone: null,
      alcohol_free: true,
    });
  }

  const { error } = await supabase
    .from("products")
    .upsert(products, { onConflict: "id" });

  if (error) {
    console.error("Products seed error:", error);
  } else {
    console.log(`  Seeded ${products.length} products`);
  }
}

async function seedConfig() {
  console.log("Seeding system config...");

  const promptPath = path.join(process.cwd(), "data", "system-prompt.md");
  const content = fs.readFileSync(promptPath, "utf-8");

  const sections = [
    "identity",
    "mission",
    "format",
    "out_of_scope_reply",
    "shipping",
    "pickup",
    "payment",
    "refund_policy",
    "membership",
    "brand_story",
    "contact",
    "ordering_process",
    "reminders",
    "price_reference",
  ];

  // Special handling for rules (has nested tags)
  const rulesMatch = content.match(
    /<rules priority="由高到低">([\s\S]*?)<\/rules>/i
  );

  const configs: { key: string; value: string }[] = [];

  for (const section of sections) {
    const regex = new RegExp(`<${section}[^>]*>([\\s\\S]*?)</${section}>`, "i");
    const match = content.match(regex);
    if (match) {
      configs.push({ key: section, value: match[1].trim() });
    }
  }

  if (rulesMatch) {
    configs.push({ key: "rules", value: rulesMatch[1].trim() });
  }

  const { error } = await supabase
    .from("system_config")
    .upsert(configs, { onConflict: "key" });

  if (error) {
    console.error("Config seed error:", error);
  } else {
    console.log(`  Seeded ${configs.length} config sections`);
  }
}

async function main() {
  console.log("Starting seed...\n");
  await seedProducts();
  await seedConfig();
  console.log("\nSeed complete!");
}

main().catch(console.error);
