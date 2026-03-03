# OpenWatch — Dealer Network Context

## What We're Building
OpenWatch is an invite-only luxury watch dealer network — the B2B layer before public marketplace.
Think: dealers share inventory with each other, see each other's stock, analytics on what's moving.
Public marketplace (Phase 2) comes AFTER dealers are onboarded.

## Dealer-First Schema Additions (on top of CLAUDE.md)
- `invite_codes` table — dealers need an invite code to register
- `wholesale_price` column on listings — only dealers see this
- `retail_price` column on listings — what public will see (Phase 2)
- `deal_inquiries` table — dealer contacts another dealer about a watch
- `dealer_profiles` table extension — company name, location, specialties

## Phase 1 Scope (build this NOW)
1. Dealer auth (invite code → register → dealer role)
2. Inventory management (add/edit/delete watches)
3. Network browse (see ALL dealers' stock in OpenSea-style grid)
4. Analytics dashboard (floor prices, what's moving, brand breakdown)
5. Deal inquiry (contact dealer on any listing)
6. Admin panel (manage invite codes, verify dealers)

## NOT in Phase 1
- Public buyer accounts
- Payment/transaction processing
- Scraping external sources
- WhatsApp integration

## Domain: getopenwatch.com
## Supabase: separate project (new one)
## Deployment: Vercel
## Stack: Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui, Supabase
