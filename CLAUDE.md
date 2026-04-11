# Antnest Chatbot - Development Guide

## Deployment

This project is deployed on **two platforms simultaneously**:

### Zeabur (Primary - VPS)

- **URL**: https://antnest-chatbot-0410.zeabur.app
- **VPS**: Tencent Cloud Tokyo (43.167.169.222), 2vCPU/2GB
- **AI Model**: Zeabur AI Hub (GPT-4.1 family via OpenAI-compatible API)
- **Project ID**: `69d9080ee8ec40d5bceac2c7`
- **Service ID**: `69d90817e8ec40d5bceac2ca`
- **Env ID**: `69d9080e474db8a99d6de860`

**Zeabur does NOT auto-deploy.** After pushing to GitHub, you must also run:

```bash
cd C:\Users\stans\Projects\antnest-chatbot
zeabur deploy --project-id 69d9080ee8ec40d5bceac2c7 --service-id 69d90817e8ec40d5bceac2ca --name antnest-chatbot
```

### Vercel (Legacy)

- **URL**: https://antnest-chatbot.vercel.app
- **AI Model**: Google Gemini 2.5 Flash
- **Auto-deploy**: push to `main` branch triggers build

### Shared Infrastructure

- Both deployments share the **same Supabase database** — admin changes apply to both
- LINE Webhook can only point to one deployment at a time

## Git Workflow

Always push to GitHub AND deploy to Zeabur:

```bash
git add . && git commit -m "message" && git push origin main
zeabur deploy --project-id 69d9080ee8ec40d5bceac2c7 --service-id 69d90817e8ec40d5bceac2ca --name antnest-chatbot
```

## Environment Variables

- **Zeabur**: `ZEABUR_AI_HUB_KEY` (Zeabur AI Hub)
- **Vercel**: `GOOGLE_AI_API_KEY` (Google Gemini)
- Both share: LINE keys, Supabase keys, Admin keys, LIFF ID

## Checklists

### Pre-push

- Verify `.gitignore` is properly configured before pushing
- Never commit `.env.local` or any file containing secrets (API keys, tokens)
- Run `npm run build` to confirm the project compiles

### Version Release

- Update the version number in `package.json`
- Verify all environment variables are documented in `.env.example`

## Tech Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- AI: Zeabur AI Hub (OpenAI-compatible, Tokyo endpoint hnd1.aihub.zeabur.ai)
- Database: Supabase (PostgreSQL)
- LINE: @line/bot-sdk + @line/liff
- Docker: Multi-stage Dockerfile for Zeabur VPS
