# Chen - Current State PRD
**Product Requirements Document - What We've Built So Far**

_Version: Current State Analysis (Updated July 2026)_  
_Author: Development Team_  
_Stack: React Native (Expo) + Golang/Gin + Supabase_

---

## Executive Summary

Chen is a social music discovery app that shows what your friends are listening to in real time. We've built a comprehensive MVP with a premium, ethereal UI design, complete authentication flow, social features, AI companion, and a fully functional Go backend. The app is in advanced development with all core features implemented on both frontend and backend.

---

## What We've Built

### 🎨 **Design System & UI Framework**
- **Premium Dark Theme**: Deep navy background (#000106ff) with warm orange accent (#E8640A)
- **Glassmorphism Components**: Translucent cards with blur effects and orange glow borders
- **Animation System**: Spring physics, pulse animations, shared element transitions
- **Theme System**: 5 complete themes (Chen default, Lagos Night, Harmattan, Midnight Afro, Atilola Red)
- **Typography**: Hierarchical font system with bold display fonts and clean body text
- **Component Library**: 15+ reusable components (GlassCard, AvatarRing, ActivityCard, etc.)

### 🔐 **Authentication & Onboarding**
- **Welcome Flow**: 3-slide onboarding with swipe navigation and premium visuals
- **Multi-Provider Auth**: Google and Apple sign-in integration ready
- **Avatar System**: DiceBear avatar picker with randomization
- **Music Service Connection**: Spotify, Apple Music, and Audiomack integration UI
- **Terms & Privacy**: Checkbox validation and legal compliance
- **Slide-to-Continue**: Custom gesture-based progression through onboarding

### 🏠 **Core App Screens**

#### **Home Feed (Main Screen)**
- **Real-time Activity Cards**: Friend listening activity with album art color bleeding
- **Live Status Indicators**: Pulsing rings for currently playing users
- **Interactive Elements**: Double-tap to like, reaction system (🔥❤️😭🤯👏)
- **Pull-to-Refresh**: Custom Chen-branded refresh indicator
- **Mock Data Integration**: Realistic demo data for development/testing

#### **Chen AI Chat**
- **Animated Avatar**: Rotating orange ring with thinking states
- **Streaming Chat**: Real-time message appearance with typing indicators
- **Context Awareness**: UI ready for music-aware conversations
- **Premium Features**: Message limits and upgrade prompts
- **Voice Note Ready**: UI prepared for future voice integration

#### **Friends Screen**
- **Network Overview**: Online status, compatibility scores, shared taste insights
- **Discovery Section**: Find new people with music compatibility
- **Animated Cards**: Spring animations and compatibility score counters
- **Search & Add**: Friend request system UI

#### **Profile Screen**
- **Comprehensive Dashboard**: Stats, top artists, top tracks, recently played
- **Live Now Playing**: Real-time currently playing display with equalizer
- **Taste Network**: Compatibility scores with friends
- **Theme Picker**: Live theme switching with color transitions
- **Settings Integration**: Profile editing and account management

### 🎵 **Music Integration (UI Complete)**
- **Multi-Platform Support**: Spotify, Apple Music, Audiomack connection flows
- **Album Art Processing**: Dynamic color extraction for card backgrounds
- **Platform Badges**: Service identification on activity cards
- **Track Metadata**: Artist, song, album display with proper formatting
- **Playback States**: Visual indicators for currently playing vs. recently played

### 🤖 **AI Companion (Chen)**
- **Personality System**: Warm, knowledgeable music companion character
- **Conversation UI**: Chat bubbles, streaming responses, conversation history
- **Context Integration**: UI ready for music taste analysis and recommendations
- **Premium Gating**: Free tier limits with upgrade prompts
- **Thinking States**: Visual feedback during AI processing

---

## Backend Architecture (Go/Gin)

### 🏗 **Architecture Overview**

The backend is a **monolithic Go HTTP server** using the **Gin** web framework. It acts as a BFF (Backend For Frontend) layer between the React Native app and external services.

```
React Native App (Expo)
        │ HTTPS (JWT Bearer)
        ▼
  ┌─────────────────────────────────┐
  │     Gin HTTP Server (Go)        │
  │  ┌──────────┐  ┌─────────────┐  │
  │  │ JWT Auth  │  │ 11 Domain  │  │
  │  │ Middleware│  │  Modules   │  │
  │  └──────────┘  └──────┬──────┘  │
  │  ┌────────────────────┴──────┐  │
  │  │   Spotify Subsystem       │  │
  │  │  (Client + Poller + Cache │  │
  │  │   + Guard + Connection)   │  │
  │  └───────────────────────────┘  │
  └────────┬──────────┬─────────────┘
           │          │
           ▼          ▼
    ┌──────────┐ ┌──────────┐
    │ Supabase │ │ Spotify  │
    │(Postgres)│ │ Web API  │
    └──────────┘ └──────────┘
```

### 📦 **11 Domain Modules**

| Module | Purpose | Endpoints |
|---|---|---|
| **Auth** | JWT middleware, user CRUD | 4 |
| **Spotify** | Music data, OAuth, polling | 8 |
| **Activity** | Listening feed, comments | 4 |
| **Profile** | User stats, genres, top artists | 4 |
| **Compatibility** | Music taste scoring | 2 |
| **Friends** | Social graph, requests, search | 6 |
| **Messages** | Direct messaging, voice notes | 3 |
| **Notifications** | Push notifications, in-app | 4 |
| **Reactions** | Love/fire/headphones | 3 |
| **Chen AI** | AI conversation storage | 2 |
| **Referrals** | Referral codes, unlocks | 2 |
| **Payments** | Subscription/stripe | 3 |
| **Admin** | Super-user management | 4 |

### 🗄 **Database Schema (Supabase/PostgreSQL)**

**10 tables** with proper indexes, RLS policies, and a stored procedure:

- `users` — Core profiles with unique username, user_tag, referral_code
- `spotify_connections` — OAuth token storage (1:1 with users)
- `listening_activity` — All listening events with track metadata
- `activity_comments` — Threaded comments with parent_comment_id
- `activity_reactions` — Love/fire/headphones with UNIQUE constraint
- `direct_messages` — Text, voice, and track sharing with JSONB metadata
- `notifications` — In-app notifications with JSONB payload
- `chen_conversations` — AI chat history as JSONB
- `user_push_tokens` — Expo push notification tokens
- `referral_completions` — Referral tracking with perk keys

### 🔄 **Background Workers**

1. **Spotify Poller** — Background goroutine that polls all users' currently playing state every ~30s with adaptive intervals (faster when playing, exponential backoff when idle)
2. **Listening Insights Scheduler** — Optional daily listening summary digests
3. **Immediate Post-Connect Poll** — One-shot poll triggered when a user connects Spotify

### 🔌 **External Integrations**

| Service | Purpose | Auth |
|---|---|---|
| **Spotify Web API** | Currently playing, top artists/tracks, genre lookup | OAuth (server-side code exchange) |
| **Last.fm API** | Genre resolution fallback (artist.gettoptags) | API key |
| **Supabase** | PostgreSQL database, Auth, Storage | Service role key (server) / Anon key (client) |
| **Expo Push API** | Push notifications | Expo push tokens |

---

## Frontend Architecture (React Native/Expo)

### 🏗 **Architecture Overview**

```
App Entry (expo-router)
  │
  ├── _layout.tsx          # Root layout (providers, fonts)
  │
  ├── (auth)/              # Auth flow (no tabs)
  │   ├── welcome.tsx      # 3-slide onboarding
  │   ├── login.tsx        # Google/Apple sign-in
  │   ├── username.tsx     # Username selection
  │   ├── avatar.tsx       # Avatar picker
  │   └── music-services.tsx # Spotify/Apple Music connect
  │
  ├── (tabs)/              # Main app (bottom tabs)
  │   ├── index.tsx        # Home feed (1454 lines)
  │   ├── friends.tsx      # Social graph
  │   ├── chen.tsx         # AI chat
  │   └── profile.tsx      # User profile
  │
  ├── compare/[userId].tsx # Compatibility comparison
  ├── friends/[username].tsx # Friend detail
  ├── messages/[friendId].tsx # DM thread
  ├── notifications/       # Notification list
  ├── player/[trackId].tsx # Music player
  ├── profile/[userId].tsx # Other user's profile
  ├── settings.tsx         # App settings
  ├── terms.tsx            # Legal
  ├── intro.tsx            # App intro
  └── modal.tsx            # Generic modal
```

### 📁 **Supporting Layers**

| Directory | Purpose | Key Files |
|---|---|---|
| `lib/` | API client, auth helpers, storage | `api.ts` (634 lines, 30+ types), `supabase.ts`, `auth.ts` |
| `contexts/` | React context providers | `AuthContext.tsx` (360 lines), `ThemeContext.tsx`, `UnlocksContext.tsx` |
| `components/` | Reusable UI components | 15+ components (activity-card, comment-modal, glass-card, etc.) |
| `hooks/` | Custom React hooks | `use-current-user-identity`, `use-theme-color`, `use-color-scheme` |
| `constants/` | Theme constants | `theme.ts` (colors, spacing, typography) |

### 🔗 **API Client Layer (`lib/api.ts`)**

The frontend communicates with the backend through a typed API client:

- **30+ TypeScript types** mirroring backend responses
- **Generic helpers**: `getJSON<T>`, `postJSON<T>`, `deleteJSON<T>` with automatic JWT injection
- **Organized by domain**: `api.feed.*`, `api.friends.*`, `api.spotify.*`, `api.profile.*`, etc.
- **Smart features**: Android emulator localhost → 10.0.2.2 rewriting, compatibility score normalization, friend enrichment with parallel requests
- **Error handling**: All API calls throw on non-OK responses with the response body as the error message

### 🔐 **Auth Flow (Frontend)**

```
App Launch
  │
  ├── Load cached profile from AsyncStorage
  ├── Check Supabase session
  │
  ├── Session exists?
  │   ├── YES → Fetch user profile from `users` table
  │   │         ├── Success → Set profile in context
  │   │         └── "User not found" → Auto-create user row
  │   └── NO  → Show welcome/login screen
  │
  ├── Auth state changes → Re-fetch profile
  └── Sign out → Clear cache, navigate to welcome
```

**Key design decisions:**
- Profile caching with AsyncStorage for instant load on app restart
- Merge strategy: cached fields survive if server returns empty values
- Auto-creates user row in Supabase if missing (handles first-time login race conditions)
- Push token sync on auth state change

---

## Architectural Assessment

### ✅ **Strengths**

#### Backend
1. **Clean modular structure** — Package-per-domain with consistent `RegisterRoutes` pattern
2. **Well-engineered Spotify integration** — Adaptive polling, rate limit guard (semaphore + cooldowns), genre enrichment pipeline (batch → individual → Last.fm fallback), graceful degradation
3. **Good resilience patterns** — `retryWithBackoff()`, per-user error isolation in poller, non-fatal errors log and continue
4. **Smart caching** — Aggressive TTLs (7d for artist lookups, 24h for top artists), cache-busting on incomplete data, per-user + global key separation
5. **Solid schema design** — Partial unique indexes, CHECK constraints, JSONB where appropriate, stored procedure for percentile calculation

#### Frontend
1. **Comprehensive type system** — 30+ TypeScript types in `api.ts` ensure type safety across the API boundary
2. **Well-organized routing** — Expo Router file-based navigation with clear auth/tabs/screens separation
3. **Smart auth caching** — AsyncStorage profile cache with intelligent merge strategy prevents flash-of-empty on app launch
4. **Rich component library** — 15+ reusable components with consistent glassmorphism design language
5. **Good error boundaries** — API client throws descriptive errors, auth context handles missing profiles gracefully

### 🔴 **Weaknesses & Technical Debt**

#### Backend
1. **No repository layer** — Every handler calls `supabase.GetClient().From("table")` directly; no unit-testable data access
2. **Shared mutable state** — `sharedSpotifyCache` and `userCache` are process-wide globals; not safe for horizontal scaling, no eviction policy
3. **Inconsistent error responses** — Some handlers return `null`, others `{"error": "..."}`; no standard error envelope
4. **Bug: duplicate response in `auth/routes.go`** — Lines 99-117: success `c.JSON` falls through to a second "User not found" response
5. **No request rate limiting** — No protection against abuse on public endpoints
6. **No structured logging** — Just `log.Printf`; no slog, no metrics, no tracing
7. **Manual migrations** — No automated migration tooling; some migrations contain duplicate table creation
8. **Sequential poller** — `pollAllUsers()` iterates users one-by-one; doesn't scale to thousands

#### Frontend
1. **Massive screen files** — `app/(tabs)/index.tsx` is 1454 lines; violates single-responsibility principle
2. **`@ts-nocheck` at file top** — Several files disable TypeScript checking entirely, defeating the purpose of the type system
3. **Mixed data sources** — Some components read directly from Supabase (`supabase.from('users')`), others go through the Go API (`api.feed.get()`); no consistent data access pattern
4. **No offline support** — No caching layer for API responses; app is non-functional without network
5. **No loading states** — Many screens lack skeleton loaders or proper loading indicators
6. **Mock data mixed with real data** — Demo data is hardcoded in components rather than injected, making the transition to real data harder
7. **No error recovery** — API errors are thrown but not caught with user-friendly retry UI

### 🎯 **What to Fix First**

#### Critical (bugs)
1. Fix the duplicate response bug in `server/internal/auth/routes.go` (lines 99-117)
2. Remove `@ts-nocheck` from screen files and fix the underlying type issues

#### High Priority (architecture)
3. Extract a repository layer for Supabase queries
4. Add structured logging (`slog`) and basic metrics
5. Add rate limiting middleware for public endpoints
6. Break down `app/(tabs)/index.tsx` into smaller components

#### Medium Priority (scalability)
7. Add context timeouts to all external API calls
8. Implement offline-first caching with AsyncStorage for API responses
9. Parallelize the Spotify poller with a worker pool
10. Add automated database migrations (golang-migrate or goose)

---

## Current Development Status

### ✅ **Completed Features**
1. **Complete UI/UX Design System** — All screens designed and implemented
2. **Authentication Flow** — Full onboarding experience with Supabase Auth
3. **Navigation Structure** — All screen transitions working
4. **Theme System** — 5 themes with live switching
5. **Animation Framework** — Smooth, premium animations throughout
6. **Component Library** — Reusable, consistent components
7. **Backend API** — 11 domain modules with 40+ endpoints
8. **Spotify Integration** — OAuth, polling, genre resolution, caching
9. **Database Schema** — 10 tables with indexes, RLS, stored procedures
10. **Push Notifications** — Expo push token registration and delivery
11. **Direct Messaging** — Text, voice notes, and track sharing
12. **Referral System** — Referral codes, perk unlocks, theme gating
13. **Admin API** — Super-user management endpoints
14. **API Client** — Typed frontend client with 30+ type definitions

### 🚧 **In Progress**
1. **Real-time Features** — Live activity updates via Supabase subscriptions
2. **Chen AI Backend** — Groq/Llama integration for AI conversations
3. **Payment Integration** — Paystack subscription system
4. **Performance Optimization** — Reducing bundle size, optimizing renders

### 📋 **Next Phase**
1. **Offline Support** — AsyncStorage caching for API responses
2. **Push Notification Delivery** — End-to-end notification flow
3. **Horizontal Scaling** — Address shared state for multi-instance deployment
4. **Observability** — Metrics, structured logging, error tracking

---

## Technical Stack Summary

### **Frontend**
| Component | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo 54 |
| Language | TypeScript |
| Routing | Expo Router (file-based) |
| Styling | NativeWind (Tailwind CSS) |
| Animations | Reanimated 3 |
| Auth | Supabase Auth (Google + Apple) |
| State | React Context (Auth, Theme, Unlocks) |
| Storage | AsyncStorage |
| Notifications | Expo Notifications + Expo Push API |

### **Backend**
| Component | Technology |
|---|---|
| Language | Go 1.25 |
| HTTP Framework | Gin v1.11 |
| Database | Supabase (PostgreSQL via PostgREST) |
| Auth | JWT (HMAC-SHA256) |
| API Docs | Swagger/OpenAPI |
| External APIs | Spotify Web API, Last.fm API, Expo Push API |
| Caching | In-memory (sync.RWMutex + TTL) |
| Concurrency | Goroutines + channels + errgroup |

---

## Key Differentiators

1. **Album Art Color Bleeding** — Dynamic card backgrounds based on album artwork
2. **Chen AI Personality** — Warm, music-knowledgeable AI companion
3. **Premium Glassmorphism** — iOS-level visual polish with blur effects
4. **Real-time Social Feed** — Live friend activity with pulse animations
5. **Nigerian Market Focus** — Themes, payment integration, and cultural relevance
6. **Multi-Platform Music** — Spotify, Apple Music, and Audiomack support
7. **Adaptive Spotify Polling** — Smart polling intervals that adapt to user activity
8. **Genre Enrichment Pipeline** — Multi-source genre resolution (Spotify batch → individual → Last.fm)

---

## Development Metrics

### **Codebase Size**
- **Frontend**: ~20 screen files, 15+ components, 6 lib modules, 3 contexts
- **Backend**: 33 Go source files, 17 SQL migrations, ~10,000 lines of Go
- **Types**: 30+ TypeScript types shared between API client and screens

### **API Surface**
- **Total endpoints**: 40+ (5 public, 35+ JWT-protected, 4 admin)
- **Database tables**: 10
- **External integrations**: 3 (Spotify, Last.fm, Expo Push)

### **Completion Estimate**
- **Frontend UI**: ~90% complete (all screens built, some polish remaining)
- **Backend API**: ~85% complete (all routes implemented, some real-time features pending)
- **Integration**: ~60% complete (API client wired up, some endpoints need end-to-end testing)
- **Overall MVP**: ~75% complete

---

## Conclusion

Chen has achieved a remarkable level of completion with a premium, production-ready frontend and a well-architected Go backend. The app successfully captures the ethereal, music-focused social experience envisioned in the original PRD.

**The backend is a 7/10** — solid foundation with a particularly well-engineered Spotify integration. The main areas for improvement are adding a repository layer, structured logging, and addressing the shared state for horizontal scaling.

**The frontend is a 7/10** — beautiful UI with comprehensive type safety, but suffers from massive screen files, `@ts-nocheck` workarounds, and mixed data access patterns. The auth caching strategy is well-thought-out.

The remaining work focuses on connecting the polished frontend to live data, adding real-time features, and addressing technical debt before scaling. The architecture won't be the bottleneck for the next growth phase, but the data access layer and observability need attention soon.

---

*Chen - Built different. 🎵*