import fs from "fs";
import path from "path";
import { FlexBubble, FlexCarousel, FlexMessage } from "@line/bot-sdk";

interface ProductCard {
  name: string;
  price: string;
  image: string;
  url: string;
  tags: string[];
}

type ProductCards = Record<string, ProductCard>;

let productCards: ProductCards | null = null;

function loadProductCards(): ProductCards {
  if (productCards) return productCards;
  const filePath = path.join(process.cwd(), "data", "product-cards.json");
  productCards = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return productCards!;
}

function buildBubble(product: ProductCard): FlexBubble {
  return {
    type: "bubble",
    size: "micro",
    hero: {
      type: "image",
      url: product.image,
      size: "full",
      aspectRatio: "4:3",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: product.name,
          weight: "bold",
          size: "sm",
          wrap: true,
        },
        {
          type: "text",
          text: product.price,
          color: "#8B5E3C",
          size: "sm",
          margin: "sm",
        },
      ],
      spacing: "sm",
      paddingAll: "12px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "立即選購",
            uri: product.url,
          },
          style: "primary",
          color: "#8B5E3C",
          height: "sm",
        },
      ],
      paddingAll: "12px",
    },
  };
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

  // LINE carousel max 12 bubbles
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
