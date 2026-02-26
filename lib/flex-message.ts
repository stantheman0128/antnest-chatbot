import fs from "fs";
import path from "path";
import { FlexBubble, FlexCarousel, FlexMessage } from "@line/bot-sdk";

interface ProductCard {
  name: string;
  price: string;
  originalPrice: string | null;
  description: string;
  image: string;
  url: string;
  badges: string[];
}

type ProductCards = Record<string, ProductCard>;

let productCards: ProductCards | null = null;

function loadProductCards(): ProductCards {
  if (productCards) return productCards;
  const filePath = path.join(process.cwd(), "data", "product-cards.json");
  productCards = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return productCards!;
}

const BRAND_COLOR = "#8B5E3C";
const BRAND_LIGHT = "#F5E6D3";
const GRAY = "#999999";

function buildBubble(product: ProductCard): FlexBubble {
  // Badge row
  const badgeContents = product.badges.map((badge) => ({
    type: "text" as const,
    text: badge,
    size: "xxs" as const,
    color: BRAND_COLOR,
    flex: 0,
  }));

  // Price section with optional original price
  const priceContents: any[] = [
    {
      type: "text",
      text: product.price,
      size: "lg",
      color: BRAND_COLOR,
      weight: "bold",
      flex: 0,
    },
  ];

  if (product.originalPrice) {
    priceContents.push({
      type: "text",
      text: product.originalPrice,
      size: "sm",
      color: GRAY,
      decoration: "line-through",
      flex: 0,
      margin: "sm",
    });
  }

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "image",
      url: product.image,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
      action: {
        type: "uri",
        label: "查看商品",
        uri: product.url,
      },
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        // Product name
        {
          type: "text",
          text: product.name,
          weight: "bold",
          size: "md",
          wrap: true,
          color: "#333333",
        },
        // Badges
        {
          type: "box",
          layout: "horizontal",
          contents: badgeContents,
          spacing: "sm",
          margin: "sm",
        },
        // Description
        {
          type: "text",
          text: product.description,
          size: "xs",
          color: "#666666",
          wrap: true,
          margin: "md",
        },
        // Price row
        {
          type: "box",
          layout: "horizontal",
          contents: priceContents,
          margin: "lg",
          alignItems: "center",
        },
      ],
      spacing: "none",
      paddingAll: "16px",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "立即選購 🛒",
            uri: product.url,
          },
          style: "primary",
          color: BRAND_COLOR,
          height: "sm",
        },
      ],
      paddingAll: "12px",
    },
  } as FlexBubble;
}

/**
 * Build a Flex Message carousel from product IDs
 */
export function buildProductCarousel(
  productIds: string[]
): FlexMessage | null {
  const cards = loadProductCards();
  const bubbles: FlexBubble[] = [];

  for (const id of productIds) {
    const product = cards[id];
    if (product) {
      bubbles.push(buildBubble(product));
    }
  }

  if (bubbles.length === 0) return null;

  const carousel: FlexCarousel = {
    type: "carousel",
    contents: bubbles.slice(0, 12),
  };

  return {
    type: "flex",
    altText: "螞蟻窩甜點商品卡片",
    contents: carousel,
  };
}

/**
 * Get all product IDs
 */
export function getAllProductIds(): string[] {
  return Object.keys(loadProductCards());
}
