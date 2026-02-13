# Phase 2A Setup Checklist

## ✅ What's Done (Code Implementation)
- [x] Updated `lib/ai-client.ts` to use Google Generative AI SDK
- [x] Changed model from Groq Llama 3.1 8B to Gemini 2.5 Flash-Lite
- [x] Added Google API key configuration in `.env.local`
- [x] Added helpful error messages for missing/invalid API key
- [x] Preserved conversation history format for multi-turn chats
- [x] Set temperature 0.5, max_tokens 2048 (same as before)
- [x] Created `PHASE_2A_IMPLEMENTATION.md` with detailed guide
- [x] Committed all changes to GitHub

## 🔧 What You Need to Do (One-time Setup)

### Step 1: Get Google AI API Key (5 minutes)
1. Visit: https://aistudio.google.com/apikey
2. Sign in with your Google account (no credit card needed)
3. Click "Create API Key" if you don't have one
4. Copy the key (looks like: `AIzaSyD1234567890abcd...`)

### Step 2: Update .env.local
1. Open `.env.local` in the project root
2. Find this line:
   ```
   GOOGLE_AI_API_KEY=your_google_ai_key_here
   ```
3. Replace with your actual key:
   ```
   GOOGLE_AI_API_KEY=AIzaSyD1234567890abcd...
   ```

### Step 3: Restart Dev Server
```bash
npm run dev
```

## 🧪 Quick Test
After restarting, test in the web chat:

**Test 1 - Template Match** (should be instant)
```
User: "運費多少"
Expected: Template response from faq-pairs.json
```

**Test 2 - AI Generation** (should be ~1-2 seconds)
```
User: "我很喜歡巧克力，預算 500 塊，推薦什麼？"
Expected: AI-generated response with NO **粗體** formatting
```

**Test 3 - Format Compliance**
```
User: "可以告訴我提拉米蘇的詳細資訊嗎？"
Expected: Plain text only, no:
  ❌ **粗體**
  ❌ #標題
  ❌ `反引號`
  ❌ *斜體*
✅ Only plain text with emoji and line breaks
```

## 📊 Expected Improvements
| Issue | Before (Llama 8B) | After (Gemini Flash) |
|-------|-------------------|----------------------|
| Format leakage | ❌ Often outputs `**粗體**` | ✅ Pure plain text |
| Chinese comprehension | ❌ Struggles with colloquialisms | ✅ Understands natural phrasing |
| Multi-constraint queries | ❌ Loses some constraints | ✅ Maintains all conditions |
| Reasoning quality | ❌ Weak on logic | ✅ Better inference |
| Speed | ~500ms (Groq) | ~1-2s (normal for Gemini) |
| Cost | Free but limited | **Free: 1,000 req/day** |

## 📱 Testing on LINE Bot
Once web chat works fine, test on LINE:
1. Open LINE Official Account: `lin.ee/0Mdsdci`
2. Send the same test messages
3. Verify responses appear correctly (no Markdown formatting)

## ⚠️ Troubleshooting

### Error: "GOOGLE_AI_API_KEY not configured"
- ✅ Check `.env.local` has the ACTUAL key (not placeholder)
- ✅ Did NOT use quotes around key: `GOOGLE_AI_API_KEY=AIzaSy...` (no quotes!)
- ✅ Restart dev server: `npm run dev`

### Error: "429 Too Many Requests"
- Exceeded free tier (1,000 requests/day)
- Solution: Wait 24 hours, or add billing to Google project
- Documentation: https://ai.google.dev/pricing

### Response still has `**粗體**`
- Check `data/system-prompt.md` — ensure NO markdown symbols
- (Should be fixed already, but double-check)

### Response is too slow (>3 seconds)
- Normal for Gemini Flash (expect 1-2s, up to 3s is acceptable)
- Not a network issue; Gemini API is inherently slower than Groq
- Trade-off: Better quality for slightly slower response

## 🚀 Next Phases (After Phase 2A is Stable)

Once you've tested for 24-48 hours and confirmed:
- ✅ No Markdown formatting issues
- ✅ Good Chinese understanding
- ✅ Reasonable response time (<3s)
- ✅ Free tier quota is sufficient

Then proceed to:
- **Phase 2B**: XML prompt restructuring for better instruction isolation
- **Phase 2C**: RAG system with vector embeddings
- **Phase 2D**: Reflexion feedback loop with learning mechanism

## 📞 Support
If issues arise:
1. Check error message in browser console (F12)
2. Refer to `PHASE_2A_IMPLEMENTATION.md` troubleshooting section
3. Review `PROJECT_STATUS.md` for overall architecture

---

**You're all set!** 🎉 Just add the API key and restart. The chatbot will automatically use Gemini 2.5 Flash for better conversations.
