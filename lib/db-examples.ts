import { CacheEntry, cache, isCacheValid } from './db-cache';
import { getSupabase } from './supabase';

// ── Conversation Examples ──────────────────────────────

export interface ConversationExample {
  id: string;
  customerMessage: string;
  correctResponse: string;
  note: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

// ── DB Row Type ──────────────────────────────────────────

interface ConversationExampleRow {
  id: string;
  customer_message: string;
  correct_response: string;
  note: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
}

export async function getActiveExamples(): Promise<ConversationExample[]> {
  if (isCacheValid(cache.examples as CacheEntry<ConversationExample[]> | null))
    return (cache.examples as CacheEntry<ConversationExample[]>).data;

  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('conversation_examples')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (!error && data) {
        const examples = (data as ConversationExampleRow[]).map(mapDbExample);
        cache.examples = { data: examples, timestamp: Date.now() };
        return examples;
      }
      // Table might not exist yet — fail silently
      if (error?.code !== '42P01') {
        console.error('Supabase examples query error:', error);
      }
    } catch (e) {
      console.error('Supabase examples fetch error:', e);
    }
  }
  return [];
}

export async function getAllExamples(): Promise<ConversationExample[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('conversation_examples')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data) return (data as ConversationExampleRow[]).map(mapDbExample);
      if (error?.code !== '42P01') {
        console.error('Supabase all examples query error:', error);
      }
    } catch (e) {
      console.error('Supabase examples fetch error:', e);
    }
  }
  return [];
}

export async function upsertExample(
  example: Partial<ConversationExample> & { customerMessage: string; correctResponse: string },
): Promise<ConversationExample | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const row: Record<string, unknown> = {
    customer_message: example.customerMessage,
    correct_response: example.correctResponse,
    note: example.note || null,
    is_active: example.isActive ?? true,
    sort_order: example.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (example.id) row.id = example.id;

  const result = await sb
    .from('conversation_examples')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (result.error) {
    console.error('Supabase upsert example error:', result.error);
    return null;
  }

  cache.examples = null;
  cache.config = null; // system prompt includes examples
  return mapDbExample(result.data as ConversationExampleRow);
}

export async function deleteExample(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { error } = await sb.from('conversation_examples').delete().eq('id', id);

  if (error) {
    console.error('Supabase delete example error:', error);
    return false;
  }

  cache.examples = null;
  cache.config = null;
  return true;
}

function mapDbExample(row: ConversationExampleRow): ConversationExample {
  return {
    id: row.id,
    customerMessage: row.customer_message,
    correctResponse: row.correct_response,
    note: row.note || null,
    isActive: row.is_active,
    sortOrder: row.sort_order || 0,
    createdAt: row.created_at,
  };
}
