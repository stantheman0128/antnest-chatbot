// Structured product description format (v2)
// Stored as JSON string in the existing detailed_description TEXT column.

export interface StructuredDescription {
  v: 2;
  intro: string;     // 商品特色
  specs: string;     // 規格說明
  storage: string;   // 保存方式
  shelfLife: string;  // 保存期限
  usage: string;     // 食用方式
}

export const EMPTY_STRUCTURED: StructuredDescription = {
  v: 2, intro: "", specs: "", storage: "", shelfLife: "", usage: "",
};

/** Parse the detailed_description value. Returns StructuredDescription if v2 JSON, null otherwise. */
export function parseDescription(raw: string | null): StructuredDescription | null {
  if (!raw || !raw.trimStart().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.v === 2) return parsed as StructuredDescription;
  } catch { /* not valid JSON */ }
  return null;
}

/** Serialize to JSON string for DB storage. Returns null if all fields empty. */
export function serializeDescription(desc: StructuredDescription): string | null {
  const hasContent = desc.intro || desc.specs || desc.storage || desc.shelfLife || desc.usage;
  if (!hasContent) return null;
  return JSON.stringify(desc);
}

/** Check whether a raw value is legacy plain text (not v2 JSON). */
export function isLegacyDescription(raw: string | null): boolean {
  if (!raw) return false;
  return !raw.trimStart().startsWith("{");
}

/** Render structured description into labeled text for the AI prompt. */
export function renderForPrompt(desc: StructuredDescription): string {
  const lines: string[] = [];
  if (desc.intro)     lines.push(`商品特色：${desc.intro}`);
  if (desc.specs)     lines.push(`規格說明：${desc.specs}`);
  if (desc.storage)   lines.push(`保存方式：${desc.storage}`);
  if (desc.shelfLife) lines.push(`保存期限：${desc.shelfLife}`);
  if (desc.usage)     lines.push(`食用方式：${desc.usage}`);
  return lines.join("\n");
}
