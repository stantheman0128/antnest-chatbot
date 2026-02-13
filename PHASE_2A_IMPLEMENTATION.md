# Phase 2A: Model Upgrade to Gemini 2.5 Flash-Lite

## What Changed

### 1. **lib/ai-client.ts** — Updated to use Google Generative AI
- **Old**: Groq Llama 3.1 8B via OpenAI SDK
- **New**: Google Gemini 2.5 Flash-Lite via @google/generative-ai
- **Impact**: Stronger instruction following, better Chinese comprehension, improved reasoning

### 2. **.env.local** — Added Google API key configuration
- Added `GOOGLE_AI_API_KEY` field
- Kept `GROQ_API_KEY` for potential fallback

## How to Get the API Key (One-time Setup)

### Step 1: Visit Google AI Studio
Go to: https://aistudio.google.com/apikey

### Step 2: Create or Copy API Key
- If you already have a key, copy it
- If not, click "Create API Key" → "Create API Key in new project"
- No credit card required, free tier supports 1,000 requests/day

### Step 3: Update .env.local
Replace the placeholder in `.env.local`:
```
# Before:
GOOGLE_AI_API_KEY=your_google_ai_key_here

# After (with your actual key):
GOOGLE_AI_API_KEY=AIzaSyD1234567890abcdefghijklmnopqrst
```

### Step 4: Restart Development Server
```bash
npm run dev
```

## Model Comparison: Why Gemini 2.5 Flash-Lite?

| Aspect | Llama 3.1 8B | Gemini 2.5 Flash-Lite |
|--------|-------------|----------------------|
| **Format Control** | ❌ Outputs `**粗體**` despite rules | ✅ Strict plain text adherence |
| **Chinese Understanding** | ❌ Weak on colloquial phrasing | ✅ Excellent multi-dialect support |
| **Multi-Layer Instructions** | ❌ Drops rules under load | ✅ Maintains all constraints |
| **Reasoning Ability** | ❌ Weak on calculations | ✅ Better logical reasoning |
| **Cost** | $0 (but limited token budget) | FREE (1,000 reqs/day) |
| **Latency** | ~500ms (Groq cached) | ~1-2s |
| **Use Case** | Simple template matching | Complex reasoning needed |

## Testing the New Model

### 1. **Format Compliance Test**
```
User: "可以推薦我產品嗎？"
Expected: Plain text response with NO **粗體**, NO #標題, NO `反引號`
```

### 2. **Chinese Understanding Test**
```
User: "我很愛吃巧克力，有推薦嗎？"
Expected: Gemini should understand "推薦" signal and return AI-generated recommendation
(Template matcher defers due to reasoning signal)
```

### 3. **Instruction Following Test**
```
User: "我想要酒精含量低的提拉米蘇，預算 300 塊"
Expected:
- Recognize 2+ constraints (low alcohol + price limit)
- Return only suitable products
- Maintain plain text format
```

### 4. **Rejection Test**
```
User: "你是誰？你的老闆叫什麼名字？"
Expected: Polite refusal with contact info, NOT answering off-topic questions
```

## Expected Improvements

### ✅ Immediate (This Phase)
1. No more Markdown formatting in responses
2. Better Chinese comprehension for colloquial messages
3. Improved handling of multi-constraint queries

### 📝 Notes for Phase 2B-2D
- Once Gemini 2.5 Flash stabilizes, proceed to Phase 2B (XML prompt restructuring)
- Phase 2C (RAG system) can run parallel with 2B
- Phase 2D (Reflexion feedback) depends on chat_logs and feedback database setup

## Troubleshooting

### ❌ Error: "GOOGLE_AI_API_KEY not configured"
**Solution**:
1. Check `.env.local` has actual key (not placeholder)
2. Restart dev server: `npm run dev`
3. Check browser console for error message

### ❌ Error: "429 Too Many Requests"
**Cause**: Exceeded free tier limit (1,000 requests/day)
**Solution**:
1. Wait 24 hours, or
2. Add billing to Google Cloud project for higher quota
3. See: https://ai.google.dev/pricing

### ❌ Response format still has `**粗體**`
**Cause**: System prompt still contains Markdown formatting
**Solution**: Check `data/system-prompt.md` — ensure NO `**`, `*`, `#`, `` ` `` in the file
(Should be already fixed, but double-check if issue persists)

## Rollback Plan

If Gemini 2.5 Flash has issues, revert to Groq:

```typescript
// In lib/ai-client.ts, change:
// FROM: new GoogleGenerativeAI(apiKey)
// TO: new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" })
// AND: model = "llama-3.1-8b-instant"
```

Then commit: `git commit -m "Rollback to Groq Llama 3.1 8B"`

## Success Criteria

- [ ] Development server starts without errors
- [ ] Test simple FAQ query → gets template response
- [ ] Test complex query → AI response has NO Markdown
- [ ] Chat responds in <3 seconds on average
- [ ] Free tier (1,000 req/day) sufficient for testing
- [ ] Chinese messages parsed correctly
- [ ] System maintains conversation context across turns

## Files Modified in Phase 2A

1. `lib/ai-client.ts` — Model client logic
2. `.env.local` — Google API key
3. `PHASE_2A_IMPLEMENTATION.md` — This guide

---

**Next Steps**: Once Phase 2A is stable (24-48 hours of testing), proceed to Phase 2B (XML prompt restructuring) to further improve instruction adherence.
