import { FlexBubble, FlexCarousel, FlexMessage } from "@line/bot-sdk";
import { getActiveProducts, ProductCard } from "./data-service";

const BRAND_COLOR = "#8B5E3C";
const GRAY = "#999999";

function buildBubble(product: ProductCard): FlexBubble {
  // Floating badge overlays on the hero image
  const badgeOverlays: any[] = product.badges.map((badge, i) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: badge,
        size: "xs",
        color: "#FFFFFF",
        flex: 0,
        weight: "bold",
      },
    ],
    position: "absolute",
    offsetTop: `${8 + i * 30}px`,
    offsetStart: "8px",
    backgroundColor: i === 0 ? "#D2691ECC" : "#00000088",
    cornerRadius: "xl",
    paddingAll: "5px",
    paddingStart: "11px",
    paddingEnd: "11px",
  }));

  // Price with optional strikethrough original price using spans
  const priceContent: any = product.originalPrice
    ? {
        type: "text",
        contents: [
          {
            type: "span",
            text: product.price,
            size: "lg",
            weight: "bold",
            color: BRAND_COLOR,
          },
          {
            type: "span",
            text: "  ",
          },
          {
            type: "span",
            text: product.originalPrice,
            size: "sm",
            color: GRAY,
            decoration: "line-through",
          },
        ],
      }
    : {
        type: "text",
        text: product.price,
        size: "lg",
        color: BRAND_COLOR,
        weight: "bold",
      };

  return {
    type: "bubble",
    size: "kilo",
    hero: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "image",
          url: product.imageUrl,
          size: "full",
          aspectRatio: "20:13",
          aspectMode: "cover",
          action: {
            type: "uri",
            label: "查看商品",
            uri: product.storeUrl,
          },
        },
        // Badge overlays
        ...badgeOverlays,
      ],
      paddingAll: "0px",
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
        // Description
        {
          type: "text",
          text: product.description,
          size: "xs",
          color: "#666666",
          wrap: true,
          margin: "sm",
        },
        // Price row with spans
        {
          type: "box",
          layout: "horizontal",
          contents: [priceContent],
          margin: "lg",
          alignItems: "center",
        },
      ],
      spacing: "none",
      paddingAll: "16px",
      cornerRadius: "none",
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
            uri: product.storeUrl,
          },
          style: "primary",
          color: BRAND_COLOR,
          height: "sm",
        },
      ],
      paddingAll: "12px",
      background: {
        type: "linearGradient",
        angle: "0deg",
        startColor: "#F5E6D310",
        endColor: "#F5E6D360",
      },
    },
    styles: {
      hero: {
        separator: false,
      },
    },
  } as FlexBubble;
}

/**
 * Build a Flex Message carousel from product IDs.
 * Now reads from DB via data-service.
 */
export async function buildProductCarousel(
  productIds: string[]
): Promise<FlexMessage | null> {
  const allProducts = await getActiveProducts();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const bubbles: FlexBubble[] = [];
  for (const id of productIds) {
    const product = productMap.get(id);
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
 * Get all active product IDs
 */
export async function getAllProductIds(): Promise<string[]> {
  const products = await getActiveProducts();
  return products.map((p) => p.id);
}
