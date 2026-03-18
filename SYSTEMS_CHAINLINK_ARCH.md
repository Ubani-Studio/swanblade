# Systems Chainlink Architecture

**Date:** 2026-02-10
**Status:** Planning
**Scope:** Swanblade + Starforge + Clarosa Integration

---

## Ecosystem Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SWANBLADE                                      │
│                      (Primary Landing)                                   │
│                                                                         │
│   Audio Generation  ·  Sound Library  ·  Provenance  ·  Game Audio     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          STARFORGE                                       │
│                        (Twin OS Layer)                                   │
│                                                                         │
│   Audio DNA  ·  Visual DNA Import  ·  Cross-Modal Coherence            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLAROSA                                        │
│                       (Local-First)                                      │
│                                                                         │
│   Photo Curation  ·  Visual Taste Vector  ·  A/B Comparisons           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Strategy: Unified Membership

**One membership. Escalating access.**

| Tier | Monthly | Annual | Access |
|------|---------|--------|--------|
| **Professional** | $299 | $2,999 | Swanblade (audio generation) |
| **Studio** | $999 | $9,999 | Swanblade + Starforge (Twin OS, Audio DNA) |
| **Enterprise** | Custom | $25,000+ | Full ecosystem (all apps + custom terms) |

### Why Unified

- Luxury brands don't nickel-and-dime
- One relationship, one membership
- Natural upsell path: audio → DNA → full ecosystem
- Enterprise expects single contract, not three vendors

---

## Database Architecture: Shared Identity, Separate Domains

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED IDENTITY DB                        │
│  (Users, Auth, Membership, Billing)                         │
│  PostgreSQL on Supabase or PlanetScale                      │
└─────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   SWANBLADE     │  │   STARFORGE     │  │    CLAROSA      │
│   Domain DB     │  │   Domain DB     │  │   Local-First   │
│                 │  │                 │  │                 │
│ - Sound Library │  │ - Audio DNA     │  │ - Photos (local)│
│ - Generations   │  │ - Visual DNA    │  │ - Taste vectors │
│ - Palettes      │  │ - Cross-modal   │  │ - Comparisons   │
│ - Provenance    │  │ - Twin profiles │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Why This Architecture

| Principle | Rationale |
|-----------|-----------|
| **Single auth** | User logs in once, token works everywhere |
| **Domain isolation** | Each app owns its data, scales independently |
| **Clarosa local** | Photos never leave device (privacy-first) |
| **API contracts** | Apps sync via defined endpoints |

---

## Landing & Onboarding: Swanblade as Front Door

**Swanblade is the primary landing page.**

### Why Swanblade Leads

1. **Highest value prop** — Audio generation is tangible, demonstrable
2. **Luxury positioning** — Brand architecture (Diamonds or Silence) is here
3. **Clearest use case** — "Generate broadcast-ready audio" beats abstract DNA concepts
4. **Revenue driver** — This is what people pay for

### User Flow

```
swanblade.com (landing)
    │
    ▼
Apply for Membership
    │
    ▼
Onboarding (brief)
    │
    ▼
/studio (immediate value)
    │
    ├──▶ Settings → Connect Starforge (Audio DNA)
    │
    └──▶ Settings → Sync Clarosa (Visual DNA)
```

---

## API Contracts

### Swanblade → Starforge (Audio DNA Enrichment)

```javascript
// When user generates sound, optionally enrich with Twin OS context
GET /api/twin/context/{user_id}

Response: {
  audio_dna: {
    sonic_palette: object,
    influence_genealogy: object,
    taste_coherence: number
  },
  visual_dna: {
    color_palette: string[],
    visual_themes: string[],
    warmth: number
  },
  cross_modal_coherence: number,
  archetype: string
}
```

**Swanblade uses this to:**
- Suggest palettes matching user's taste
- Auto-tune generation params to their DNA
- Show "Your sound signature" in studio UI

### Clarosa → Starforge (Visual DNA Sync)

```javascript
// Clarosa exports taste vector (local → cloud)
POST /api/v1/visual-dna/export

Request: { user_id: string }

Response: {
  taste_vector: number[768],      // DINOv2 embedding
  confidence: number,             // 0-1
  photo_count: number,
  comparison_count: number,
  exported_at: ISO8601
}
```

### Starforge → Swanblade (Cross-Modal Translation)

```javascript
// Visual-to-audio translation for generation hints
GET /api/twin/audio-hints/{user_id}

Response: {
  suggested_warmth: number,       // From visual warmth
  suggested_energy: number,       // From visual energy
  palette_affinity: string[],     // e.g., ["ambient", "textural"]
  coherence_score: number
}
```

**Translation logic:**
- Visual warmth 0.8 → Suggest warm pad sounds
- Visual energy 0.3 → Suggest ambient textures
- High coherence → Tighter parameter bounds

---

## Domain Structure

### Option A: Subdomains

```
swanblade.com          → Landing, Apply, Studio (primary)
twin.swanblade.com     → Starforge (Audio/Visual DNA)
local.swanblade.com    → Clarosa download/sync portal
```

### Option B: Unified Routes (Recommended)

```
swanblade.com          → Everything
swanblade.com/twin     → Starforge features (embedded)
swanblade.com/visual   → Clarosa sync portal
swanblade.com/studio   → Sound generation
```

---

## Implementation Priorities

| Priority | Task | Effort | Dependency |
|----------|------|--------|------------|
| 1 | Shared auth (Supabase/Clerk) | 2 days | None |
| 2 | Starforge API client in Swanblade | 1 day | Auth |
| 3 | /studio settings — "Connect Twin OS" | 1 day | API client |
| 4 | Stripe integration — membership tiers | 2 days | Auth |
| 5 | Cross-app session — single token | 1 day | Auth |
| 6 | Visual DNA hints in generation UI | 2 days | Starforge API |

---

## Environment Variables

```bash
# Shared Identity
AUTH_PROVIDER=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Cross-App Communication
ECOSYSTEM_API_SECRET=<shared-secret>
STARFORGE_API_URL=http://localhost:5000/api
CLAROSA_API_URL=http://localhost:8001/api/v1

# Payments
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PROFESSIONAL=price_xxx
STRIPE_PRICE_STUDIO=price_xxx
```

---

## Ports Reference

| App | Backend | Frontend |
|-----|---------|----------|
| Swanblade | 3000 (Next.js) | — |
| Starforge | 5000 | 3000 |
| Clarosa | 8001 | 5180 |

---

## Key Principle

**Swanblade is the luxury audio platform with optional DNA intelligence.**

Starforge and Clarosa are premium features, not separate products. Users come for audio generation. They stay for the ecosystem.

---

*Last updated: 2026-02-10*
