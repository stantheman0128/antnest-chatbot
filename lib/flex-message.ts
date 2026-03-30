import { FlexBubble, FlexCarousel, FlexComponent, FlexMessage } from '@line/bot-sdk';

import { ProductSpec } from './ai-client';
import { ProductCard, getActiveProducts } from './data-service';

const BRAND_COLOR = '#8B5E3C';
const GRAY = '#999999';

function buildBubble(product: ProductCard, variantName?: string): FlexBubble {
  // Check if product is sold out
  const allSoldOut = product.variants.length > 0 && product.variants.every((v) => !v.available);

  // Resolve image: use variant-specific photo if requested
  let heroImage = product.imageUrl;
  if (variantName && product.variants.length > 0) {
    const match = product.variants.find(
      (v) => v.title === variantName || v.option1 === variantName,
    );
    if (match?.imageUrl) heroImage = match.imageUrl;
  }

  // Floating badge overlays on the hero image
  const badgeOverlays = product.badges.map((badge, i) => ({
    type: 'box',
    layout: 'horizontal',
    contents: [
      {
        type: 'text',
        text: badge,
        size: 'xs',
        color: '#FFFFFF',
        flex: 0,
        weight: 'bold',
      },
    ],
    position: 'absolute',
    offsetTop: `${8 + i * 30}px`,
    offsetStart: '8px',
    backgroundColor: i === 0 ? '#D2691ECC' : '#00000088',
    cornerRadius: 'xl',
    paddingAll: '5px',
    paddingStart: '11px',
    paddingEnd: '11px',
  }));

  // Price with optional strikethrough original price using spans
  const priceContent: FlexComponent = product.originalPrice
    ? {
        type: 'text',
        contents: [
          {
            type: 'span',
            text: product.price,
            size: 'lg',
            weight: 'bold',
            color: BRAND_COLOR,
          },
          {
            type: 'span',
            text: '  ',
          },
          {
            type: 'span',
            text: product.originalPrice,
            size: 'sm',
            color: GRAY,
            decoration: 'line-through',
          },
        ],
      }
    : {
        type: 'text',
        text: product.price,
        size: 'lg',
        color: BRAND_COLOR,
        weight: 'bold',
      };

  // Build variant list for description
  let variantText = '';
  if (product.variants.length > 1) {
    const lines = product.variants.map((v) => {
      const name = v.option1 || v.title;
      const avail = v.available ? '' : '（已售完）';
      return `• ${name} NT$${v.price}${avail}`;
    });
    variantText = '\n\n口味：\n' + lines.join('\n');
  }

  const descriptionText = product.description + variantText;

  return {
    type: 'bubble',
    size: 'kilo',
    hero: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'image',
          url: heroImage,
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover',
          action: {
            type: 'uri',
            label: '查看商品',
            uri: product.storeUrl,
          },
        },
        // Badge overlays
        ...(badgeOverlays as FlexComponent[]),
        // Sold out overlay
        ...((allSoldOut
          ? [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: '⚠️ 已售完',
                    size: 'sm',
                    color: '#FFFFFF',
                    weight: 'bold',
                    flex: 0,
                  },
                ],
                position: 'absolute',
                offsetBottom: '8px',
                offsetEnd: '8px',
                backgroundColor: '#DC2626DD',
                cornerRadius: 'xl',
                paddingAll: '6px',
                paddingStart: '12px',
                paddingEnd: '12px',
              },
            ]
          : []) as FlexComponent[]),
      ],
      paddingAll: '0px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Product name
        {
          type: 'text',
          text: product.name,
          weight: 'bold',
          size: 'md',
          wrap: true,
          color: '#333333',
        },
        // Description + variants
        {
          type: 'text',
          text: descriptionText,
          size: 'xs',
          color: '#666666',
          wrap: true,
          margin: 'sm',
        },
        // Price row with spans
        {
          type: 'box',
          layout: 'horizontal',
          contents: [priceContent],
          margin: 'lg',
          alignItems: 'center',
        },
      ],
      spacing: 'none',
      paddingAll: '16px',
      cornerRadius: 'none',
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: allSoldOut ? '已售完 — 查看商品頁' : '立即選購 🛒',
            uri: product.storeUrl,
          },
          style: allSoldOut ? 'secondary' : 'primary',
          color: allSoldOut ? '#AAAAAA' : BRAND_COLOR,
          height: 'sm',
        },
      ],
      paddingAll: '12px',
      background: {
        type: 'linearGradient',
        angle: '0deg',
        startColor: '#F5E6D310',
        endColor: '#F5E6D360',
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
 * Build a Flex Message carousel from product specs.
 * Supports optional variantName per product for variant-specific photos.
 */
export async function buildProductCarousel(specs: ProductSpec[]): Promise<FlexMessage | null> {
  const allProducts = await getActiveProducts();
  const productMap = new Map(allProducts.map((p) => [p.id, p]));

  const bubbles: FlexBubble[] = [];
  for (const spec of specs) {
    const product = productMap.get(spec.id);
    if (product) {
      bubbles.push(buildBubble(product, spec.variantName));
    }
  }

  if (bubbles.length === 0) return null;

  const carousel: FlexCarousel = {
    type: 'carousel',
    contents: bubbles.slice(0, 12),
  };

  return {
    type: 'flex',
    altText: '螞蟻窩甜點商品卡片',
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
