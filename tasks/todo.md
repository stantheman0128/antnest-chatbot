# 螞蟻窩 POS 系統 — Phase 1 TODO

## Phase 1A: Project Scaffolding ✅
- [x] 1A-1. create-next-app (Next.js 16, TS, Tailwind v4, App Router, src/)
- [x] 1A-2. git init + first commit
- [x] 1A-3. Install Prisma 7 + init (adapter-pg for PostgreSQL)
- [x] 1A-4. shadcn/ui init
- [x] 1A-5. Install 19 shadcn components
- [x] 1A-6. Install dependencies (next-auth beta, zod, zustand, date-fns, sharp)
- [x] 1A-7. .env.local + .env.example (ECPay sandbox creds included)
- [x] 1A-8. Directory structure skeleton
- [x] 1A-9. Prisma client singleton (PrismaPg adapter)
- [x] 1A-10. middleware.ts for route protection
- [x] 1A-11. Commit scaffolding

## Phase 1B: Database Schema
- [ ] 1B-1. Set up Supabase project
- [ ] 1B-2. Write Prisma schema (all Phase 1 entities)
- [ ] 1B-3. Run initial migration
- [ ] 1B-4. Generate Prisma client
- [ ] 1B-5. Seed script (products from chatbot data + admin user + sample batch)
- [ ] 1B-6. Run seed
- [ ] 1B-7. Commit

## Phase 1C: Admin Backend
- [ ] 1C-1a. Admin auth (credentials, separate from members)
- [ ] 1C-1b. Admin login page
- [ ] 1C-1c. Admin layout (sidebar nav)
- [ ] 1C-1d. Admin dashboard (stats cards)
- [ ] 1C-2a. Product list page
- [ ] 1C-2b. Product form component
- [ ] 1C-2c. Create product page
- [ ] 1C-2d. Edit product page
- [ ] 1C-3a. Batch list page
- [ ] 1C-3b. Batch form component
- [ ] 1C-3c. Create batch page
- [ ] 1C-3d. Edit batch page
- [ ] 1C-3e. Batch detail/management page (status actions)
- [ ] 1C-3f. Batch status transition server actions
- [ ] 1C-3g. Auto-publish cron endpoint
- [ ] 1C-4a. Order list page (read-only)
- [ ] 1C-4b. Order detail page
- [ ] 1C-5a. Member list page
- [ ] 1C-5b. Member detail page

## Phase 1D: Store Frontend
- [ ] 1D-1a. Store layout (header, nav, footer)
- [ ] 1D-1b. Brand styling (螞蟻窩 warm browns)
- [ ] 1D-2a. Homepage / active batch product grid
- [ ] 1D-2b. Product detail page
- [ ] 1D-3a. Cart state (Zustand + localStorage)
- [ ] 1D-3b. Cart page
- [ ] 1D-3c. Cart icon badge in header
- [ ] 1D-4a. Checkout page (shipping, payment, recipient)
- [ ] 1D-4b. Order creation API (Prisma transaction, stock check)
- [ ] 1D-4c. Order confirmation page
- [ ] 1D-4d. My Orders page
- [ ] 1D-4e. Sold-out auto-close logic

## Phase 1E: Payment (ECPay)
- [ ] 1E-1a. ECPay utility module (CheckMacValue, form builder)
- [ ] 1E-1b. ECPay types
- [ ] 1E-2a. ECPay payment redirect page
- [ ] 1E-2b. ECPay payment webhook
- [ ] 1E-2c. ECPay result redirect page
- [ ] 1E-2d. Cash on delivery handling
- [ ] 1E-3. Test ECPay sandbox end-to-end

## Phase 1F: Auth & Members
- [ ] 1F-1a. NextAuth v5 config (LINE Login + Prisma adapter)
- [ ] 1F-1b. Auth route handler
- [ ] 1F-1c. Auth middleware
- [ ] 1F-2a. Login page (LINE Login button)
- [ ] 1F-2b. Member profile page
- [ ] 1F-2c. Complete profile prompt
- [ ] 1F-3a. LINE Login channel config (LINE Developers Console)

## Phase 1G: Polish & Deploy
- [ ] 1G-1. Responsive design pass
- [ ] 1G-2. Loading/error states
- [ ] 1G-3. SEO metadata
- [ ] 1G-4. Copy product images
- [ ] 1G-5. Vercel config + env vars
- [ ] 1G-6. E2E testing checklist
- [ ] 1G-7. Final commit + deploy
