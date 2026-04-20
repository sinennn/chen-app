# Chen — Codebase Guide (Single Source of Truth)

> **Last updated:** Super-user feature flag added (see §6.9, §9, §11).

> **Purpose:** This document is the definitive onboarding reference for engineers (human or AI) working on the Chen codebase. Read this before touching any code.

---

## Table of Contents

1. [What Is Chen?](#1-what-is-chen)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Frontend (React Native / Expo)](#5-frontend-react-native--expo)
   - [Navigation & Routing](#51-navigation--routing)
   - [Context Providers](#52-context-providers)
   - [Screen Inventory](#53-screen-inventory)
   - [Component Library](#54-component-library)
   - [Design System & Theming](#55-design-system--theming)
   - [API Client (`lib/api.ts`)](#56-api-client-libapiTs)
   - [Auth (`lib/auth.ts`)](#57-auth-libauthts)
   - [Storage & Push Notifications](#58-storage--push-notifications)
   - [Referral System (Client)](#59-referral-system-client)
6. [Backend (Go / Gin)](#6-backend-go--gin)
   - [Server Entry Point](#61-server-entry-point)
   - [Authentication Middleware](#62-authentication-middleware)
   - [Internal Modules](#63-internal-modules)
   - [Spotify Polling Engine](#64-spotify-polling-engine)
   - [Chen AI Module](#65-chen-ai-module)
   - [Referral & Unlocks System (Server)](#66-referral--unlocks-system-server)
   - [Push Notifications (Server)](#67-push-notifications-server)
   - [Supabase Client (pkg/supabase)](#68-supabase-client-pkgsupabase)
   - [Super-User Feature Flag](#69-super-user-feature-flag)
7. [Database Schema](#7-database-schema)
8. [Data Flow Diagrams](#8-data-flow-diagrams)
   - [Auth Flow](#81-auth-flow)
   - [Spotify Real-Time Polling](#82-spotify-real-time-polling)
   - [Feed Load Sequence](#83-feed-load-sequence)
   - [Chen AI Chat Sequence](#84-chen-ai-chat-sequence)
9. [Environment Variables](#9-environment-variables)
10. [Key Design Decisions & Patterns](#10-key-design-decisions--patterns)
11. [Known Limitations & Gotchas](#11-known-limitations--gotchas)
12. [Feature Status Matrix](#12-feature-status-matrix)
13. [Glossary](#13-glossary)

---

## 1. What Is Chen?

Chen is a **social music discovery app** for mobile (iOS + Android). Its core value proposition:

- **Real-time feed**: See exactly what your friends are listening to, updated live via a Spotify polling engine.
- **Social graph**: Add friends, manage friend requests, view friend profiles.
- **Chen AI**: An AI chat companion powered by Groq (Llama 3) that is context-aware of the user's listening history and their friends' activity.
- **Direct messaging**: Text, voice notes, and track-reply messages between friends.
- **Referral/unlocks system**: Users unlock extra top artists, themes, and voice notes by referring friends.
- **Premium dark aesthetic**: Deep navy + warm orange glassmorphism design. 5 unlockable themes, all named with a Nigerian cultural flavor.

**Target market:** Nigerian music listeners and the diaspora. The app name references the Nigerian slang for "to see/understand."

---

## 2. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 via Expo 54 |
| Language | TypeScript 5.9 |
| Navigation | Expo Router 6 (file-based routing) |
| Styling | NativeWind 4 (Tailwind CSS for RN) + inline StyleSheet |
| Animations | React Native Reanimated 4 + Animated API |
| Auth | Supabase Auth + `@react-native-google-signin/google-signin` + `expo-apple-authentication` |
| HTTP/API | Native `fetch` (wrapped in `lib/api.ts`) |
| Real-time | Supabase Realtime (Postgres change subscriptions) |
| Storage | `@react-native-async-storage/async-storage` |
| Push Notifs | Expo Notifications |
| Music OAuth | `expo-auth-session` (Spotify PKCE-less code flow) |

### Backend
| Layer | Technology |
|---|---|
| Language | Go 1.25.4 |
| HTTP Framework | Gin |
| Database | Supabase (PostgreSQL) via `supabase-community/supabase-go` |
| Auth Validation | `golang-jwt/jwt/v5` (validates Supabase JWTs) |
| AI | Groq API — `llama-3.3-70b-versatile` model |
| Push Notifications | Expo Push API (`https://exp.host/--/api/v2/push/send`) |
| API Docs | Swagger via `swaggo/gin-swagger` |

---

## 3. Repository Structure

```
Chen/                          ← Monorepo root
├── app/                       ← All Expo Router screens
│   ├── _layout.tsx            ← Root navigator, wraps all providers
│   ├── (auth)/                ← Auth-gated group (no tab bar)
│   │   ├── _layout.tsx        ← Auth redirect logic
│   │   ├── welcome.tsx        ← 3-slide onboarding carousel
│   │   ├── signup.tsx         ← Sign up (Google / Apple)
│   │   ├── login.tsx          ← Sign in (Google / Apple)
│   │   ├── username.tsx       ← Username selection step
│   │   ├── avatar.tsx         ← Avatar picker step
│   │   └── music-services.tsx ← Spotify OAuth connection step
│   ├── (tabs)/                ← Main tab group (post-auth)
│   │   ├── _layout.tsx        ← Tab bar config + auth guard
│   │   ├── index.tsx          ← Home Feed screen
│   │   ├── chen.tsx           ← Chen AI chat screen
│   │   ├── friends.tsx        ← Friends list + discovery
│   │   └── profile.tsx        ← Own profile screen
│   ├── profile/[userId].tsx   ← Public profile (other users)
│   ├── messages/[friendId].tsx← DM thread
│   ├── notifications/index.tsx← Notifications list
│   ├── friends/[username].tsx ← Friend's public profile (alt path)
│   ├── settings.tsx           ← Settings + theme + referrals
│   ├── intro.tsx              ← Intro animation
│   └── modal.tsx              ← Generic modal placeholder
│
├── components/
│   ├── ui/
│   │   ├── avatar-ring.tsx    ← Avatar with orange playing ring
│   │   ├── glass-card.tsx     ← Glassmorphism card container
│   │   ├── orange-button.tsx  ← Primary CTA button
│   │   ├── collapsible.tsx    ← Expandable section
│   │   ├── icon-symbol.tsx    ← Cross-platform SF Symbols
│   │   └── icon-symbol.ios.tsx← iOS-specific SF Symbols
│   ├── activity-card.tsx      ← Feed activity card (simple version)
│   ├── add-friend-modal.tsx   ← Add friend modal
│   ├── comment-modal.tsx      ← Activity comment sheet
│   ├── edit-profile-modal.tsx ← Edit profile bottom sheet
│   └── haptic-tab.tsx         ← Tab bar button with haptics
│
├── constants/
│   └── theme.ts               ← Design tokens, colors, fonts, theme engine
│
├── contexts/
│   ├── AuthContext.tsx         ← User/session/profile state
│   ├── ThemeContext.tsx        ← Active theme state + switcher
│   └── UnlocksContext.tsx      ← Referral perk unlock state
│
├── hooks/
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   ├── use-current-user-identity.ts
│   └── use-theme-color.ts
│
├── lib/
│   ├── api.ts                 ← All API types + fetch wrappers + api object
│   ├── auth.ts                ← Google/Apple/Email sign-in helpers
│   ├── push-notifications.ts  ← Expo push token registration
│   ├── referrals.ts           ← Pending referral storage helpers
│   ├── storage.ts             ← AsyncStorage wrapper
│   └── supabase.ts            ← Supabase client init
│
├── assets/                    ← Images, fonts, onboarding photos
├── app.json                   ← Expo config (bundle ID, plugins)
├── package.json
├── tailwind.config.js
├── tsconfig.json
│
├── server/                    ← Go backend
    ├── server.go              ← main() — router registration & startup
    ├── go.mod
    ├── internal/
    │   ├── admin/
    │   │   └── routes.go      ← /admin endpoints + AdminMiddleware
    │   ├── auth/
    │   │   ├── middleware.go  ← JWT validation middleware
    │   │   └── routes.go      ← /auth endpoints
    │   ├── spotify/
    │   │   ├── routes.go      ← /spotify/* endpoints
    │   │   ├── poller.go      ← Background polling goroutine
    │   │   ├── spotify_client.go ← Spotify API wrapper + caching
    │   │   ├── connection.go  ← Token refresh logic
    │   │   ├── cache.go       ← Shared in-memory cache
    │   │   ├── guard.go       ← Rate-limit guard + poll intervals
    │   │   └── errors.go      ← Spotify error types
    │   ├── chen/
    │   │   └── routes.go      ← /chen/* endpoints + Groq integration
    │   ├── activity/
    │   │   └── routes.go      ← /activity/feed endpoint
    │   ├── friends/
    │   │   ├── routes.go      ← /friends/* endpoints
    │   │   └── service.go     ← Friend relationship helpers
    │   ├── profile/
    │   │   ├── routes.go      ← /profile/* endpoints
    │   │   ├── genre_resolver.go
    │   │   └── *_test.go
    │   ├── notifications/
    │   │   ├── routes.go      ← /notifications/* endpoints
    │   │   ├── push.go        ← Expo push send logic
    │   │   └── listening.go   ← Listening insight scheduler
    │   ├── messages/
    │   │   └── routes.go      ← /messages/* endpoints
    │   ├── reactions/
    │   │   └── routes.go      ← /reactions/* endpoints
    │   ├── referrals/
    │   │   └── routes.go      ← /referrals/* + unlock logic
    │   ├── compatibility/
    │   │   └── routes.go      ← /compatibility/* endpoints
    │   ├── applemusic/        ← Stub (not wired to router yet)
    │   ├── audiomack/         ← Stub (not wired to router yet)
    │   ├── lastfm/            ← Used by profile genre resolution
    │   └── payments/          ← Stub (Paystack, not wired yet)
    ├── pkg/
    │   └── supabase/
    │       └── client.go      ← Singleton Supabase client
    └── migrations/            ← Raw SQL migration files
        └── add_super_user_flag.sql ← adds is_super_user column to users
```

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (Expo RN)                  │
│                                                         │
│  AuthContext → ThemeContext → UnlocksContext             │
│       │                                                  │
│  Expo Router (file-based)                               │
│  (auth)/ group  ←→  (tabs)/ group                       │
│                                                         │
│  lib/api.ts  ──────────────────────────────────────┐    │
│  lib/auth.ts ──→ Supabase Auth (JWT)               │    │
│  lib/supabase.ts → Supabase Realtime subscriptions  │    │
└────────────────────────────────────────────────────┼────┘
                                                     │ Bearer JWT
                                                     ▼
┌─────────────────────────────────────────────────────────┐
│               Go / Gin Backend  (:5000)                  │
│                                                         │
│  /api/v1/                                               │
│  ├── auth.*          (public + protected)               │
│  ├── spotify.*       (protected)                        │
│  ├── activity.*      (protected)                        │
│  ├── friends.*       (protected)                        │
│  ├── profile.*       (protected)                        │
│  ├── chen.*          (protected)                        │
│  ├── reactions.*     (protected)                        │
│  ├── notifications.* (protected)                        │
│  ├── messages.*      (protected)                        │
│  └── referrals.*     (protected)                        │
│                                                         │
│  /admin/  (X-Admin-Secret header required)              │
│  └── users/:userId/super-user  (GET, PUT)               │
│                                                         │
│  Background goroutines:                                 │
│  ├── spotify.StartPoller()   ← polls every 30s          │
│  └── notifications.StartListeningInsightsScheduler()    │
└───────────────────────┬─────────────────────────────────┘
                        │ supabase-go (service key)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                  │
│                                                         │
│  Tables: users, spotify_connections,                    │
│  listening_activity, friendships, activity_comments,    │
│  activity_engagement, activity_reactions,               │
│  direct_messages, notifications, user_push_tokens,      │
│  referral_completions, chen_conversations               │
│                                                         │
│  Realtime: listening_activity (broadcast to clients)    │
│  Storage:  voice-notes bucket                           │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────┐
        │  External APIs            │
        │  Groq (llama-3.3-70b)     │
        │  Spotify Web API          │
        │  Expo Push Notifications  │
        └───────────────────────────┘
```

---

## 5. Frontend (React Native / Expo)

### 5.1 Navigation & Routing

Expo Router uses the file system as the route definition. The root layout (`app/_layout.tsx`) wraps everything in three providers in order:

```
AuthProvider
  └── UnlocksProvider
        └── AppThemeProvider
              └── RootNavigator (Stack)
```

**Route groups:**

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/(auth)/*` | Pre-login screens. `_layout.tsx` redirects authenticated + onboarded users to `/(tabs)`. |
| `(tabs)` | `/(tabs)/*` | Main app. `_layout.tsx` shows loading spinner or redirects unauthenticated to `/(auth)/welcome`. |

**Auth redirect logic in `(auth)/_layout.tsx`:**

1. `loading` → show spinner
2. `user` exists AND `profile !== null`:
   - `profile.username && profile.avatar_id` → `replace('/(tabs)')`
   - `profile.username` but no avatar → `replace('/(auth)/avatar')`
   - neither → `replace('/(auth)/username')`
3. `user` but `profile === null` → show spinner (still fetching profile)
4. No user → render the auth stack normally (welcome/signup/login)

### 5.2 Context Providers

#### `AuthContext` (`contexts/AuthContext.tsx`)

**Exported:** `useAuth()`, `AuthProvider`

**State:**
- `user: User | null` — Supabase auth user
- `profile: UserProfile | null` — row from `users` table
- `session: Session | null` — Supabase session with `access_token`
- `loading: boolean`

**Key behaviors:**
- On init, loads cached profile from AsyncStorage first (key: `chen_user_profile`) for instant display, then fetches from Supabase.
- Profile merging: incoming DB data takes priority field-by-field but falls back to cached data for non-empty fields. This prevents flicker when cached data has more detail.
- Deduplicates concurrent `fetchUserProfile` calls via `profileFetchRef` (a promise ref acting as a single-flight guard).
- Auto-creates a `users` row if none exists (PGRST116 error = not found).
- Gracefully falls back to a simpler select query if newer columns (`referral_code`, `theme_preference`, `onboarding_completed_at`) don't exist yet in the DB.
- On sign-out: unregisters push token, clears Supabase session, clears local state and cache, navigates to `/(auth)/signup`.
- Syncs push token whenever `session.user.id` changes.

**`UserProfile` shape:**
```typescript
{
  id: string;
  email: string;
  username: string;
  user_tag?: string;
  avatar_id: string;          // DiceBear seed string
  is_premium: boolean;
  theme_preference?: string;  // ThemeKey
  referral_code?: string;
  onboarding_completed_at?: string;
  created_at: string;
}
```

---

#### `UnlocksContext` (`contexts/UnlocksContext.tsx`)

**Exported:** `useUnlocks()`, `UnlocksProvider`

Fetches the user's referral status from `GET /api/v1/referrals` on mount and whenever `user.id` changes. Exposes:

- `status: ReferralStatus | null`
- `hasPerk(perkKey)` → boolean
- `isThemeUnlocked(themeKey)` → boolean (default theme always unlocked)
- `isTopArtistUnlocked(rank)` → boolean (ranks 1–2 always unlocked)
- `refreshStatus()` → re-fetches

If the referrals endpoint returns 404 (not yet deployed), falls back to `EMPTY_STATUS` (only default theme + artist ranks 1–2 unlocked) without logging an error.

---

#### `ThemeContext` (`contexts/ThemeContext.tsx`)

**Exported:** `useAppTheme()`, `AppThemeProvider`

- Loads theme preference from AsyncStorage (`chen_theme_preference`) and `profile.theme_preference`.
- Validates the resolved theme against `UnlocksContext.isThemeUnlocked()`. Falls back to `'default'` if locked.
- Calls `applyTheme(themeKey)` which **mutates** the `Colors` object in `constants/theme.ts` globally. This is the mechanism by which theme changes propagate everywhere (since `Colors` is referenced directly, not via context).
- The `themeKey` is used as a React `key` on the `Stack` navigator in `_layout.tsx` to force a full remount on theme change.

---

### 5.3 Screen Inventory

#### Auth Screens

| Screen | File | Purpose |
|---|---|---|
| Welcome | `(auth)/welcome.tsx` | 3-slide horizontal carousel. Last slide shows "Get Started" → signup. |
| Sign Up | `(auth)/signup.tsx` | Google + Apple OAuth. Accepts `referral_code` + `perk_key` URL params. Stores pending referral in AsyncStorage. |
| Login | `(auth)/login.tsx` | Google + Apple OAuth. Identical to signup UI but for returning users. |
| Username | `(auth)/username.tsx` | Text input with validation (2-20 chars, `[a-zA-Z0-9_]`). Suggests 5 preset names. |
| Avatar | `(auth)/avatar.tsx` | DiceBear avatar picker. |
| Music Services | `(auth)/music-services.tsx` | Spotify OAuth via `expo-auth-session`. PKCE-less authorization code flow. On success, sends `code` + `redirect_uri` (plus `username` and `avatar_id`) to `POST /spotify/exchange-code` on the backend. The backend performs the token exchange using the server-held client secret. Calls `completeReferralOnboarding()` at end. `handleSkip` still uses the Supabase client directly to update `username`/`avatar_id` (RLS-protected, no secret involved). |

#### Tab Screens

| Tab | File | Icon | Key Features |
|---|---|---|---|
| Feed | `(tabs)/index.tsx` | `house.fill` | Real-time friend activity cards, reactions (love/fire/headphones), comments, Spotify preview modal via WebView, Supabase Realtime subscription for live updates, double-tap to react. |
| Chen | `(tabs)/chen.tsx` | `record.circle` | AI chat with `ChenAvatar` animation, typing indicator, loads conversation history from server, sends to `POST /chen/chat`. |
| Friends | `(tabs)/friends.tsx` | `person.2.fill` | Friends list (card format), discover section (row format), friend request management, share friend invite link. |
| Profile | `(tabs)/profile.tsx` | `person.circle.fill` | Own profile: now playing, recent tracks, top artists (referral-gated), top tracks, stats, friends list, Spotify reconnect, edit profile modal. |

#### Stack Screens

| Screen | File | Purpose |
|---|---|---|
| Public Profile | `profile/[userId].tsx` | View another user's profile. Relationship status, friend/message actions. |
| Message Thread | `messages/[friendId].tsx` | DM thread with text, voice notes, and track replies. |
| Notifications | `notifications/index.tsx` | Notifications list with mark-read. |
| Settings | `settings.tsx` | Theme picker (with unlock gate), referral sharing, account management, sign-out. |

---

### 5.4 Component Library

| Component | File | Purpose |
|---|---|---|
| `GlassCard` | `ui/glass-card.tsx` | Base glassmorphism container. Uses `Colors.bgGlass` + `Colors.border`. Accepts `padded` prop. |
| `AvatarRing` | `ui/avatar-ring.tsx` | Circular avatar with an orange ring when `isPlaying=true`. |
| `OrangeButton` | `ui/orange-button.tsx` | Primary CTA with `Colors.orange` background and glow shadow. |
| `IconSymbol` | `ui/icon-symbol.tsx` | Cross-platform icon wrapper. iOS uses SF Symbols, Android/web uses a fallback. |
| `ActivityCard` | `activity-card.tsx` | Simple activity card (used in storybook-style contexts). The full feed card is inline in `(tabs)/index.tsx`. |
| `AddFriendModal` | `add-friend-modal.tsx` | Search + add friend by username. |
| `CommentModal` | `comment-modal.tsx` | Bottom sheet for activity comments with threading. |
| `EditProfileModal` | `edit-profile-modal.tsx` | Bottom sheet for editing username/avatar. |
| `HapticTab` | `haptic-tab.tsx` | Tab bar button with `expo-haptics` on press. |

---

### 5.5 Design System & Theming

All design tokens live in `constants/theme.ts`.

**`Colors` object** (mutable — mutated by `applyTheme()`):
```
Colors.orange         ← Primary accent (#E8640A in default theme)
Colors.orangeDim      ← Darkened accent
Colors.orangeGlow     ← rgba accent at 0.15 opacity (glow effects)
Colors.orangeSubtle   ← rgba accent at 0.08 opacity (backgrounds)
Colors.bg             ← App background (#000106ff default)
Colors.bgCard         ← Card background (#020617)
Colors.bgElevated     ← Slightly elevated surface
Colors.bgGlass        ← Translucent bg (rgba 0.85)
Colors.textPrimary    ← #F5F0EB
Colors.textSecondary  ← #9D8F85
Colors.textMuted      ← #5C504A
Colors.border         ← rgba accent at 0.12
Colors.borderStrong   ← rgba accent at 0.25
Colors.success        ← #27AE60
Colors.error          ← #E74C3C
```

**`ThemeDefinitions`** — 5 themes, each with `name`, `accent`, `bg`, `glow`:

| Key | Name | Accent | Background |
|---|---|---|---|
| `default` | Chen | `#E8640A` (orange) | `#020617` |
| `lagosNight` | Lagos Night | `#7C3AED` (purple) | `#08060F` |
| `harmattan` | Harmattan | `#D4A017` (gold) | `#0F0D08` |
| `midnightAfro` | Midnight Afro | `#00BFA5` (teal) | `#060F0D` |
| `atilolaRed` | Atilola Red | `#E74C3C` (red) | `#0F0706` |

> **IMPORTANT:** `applyTheme()` mutates `Colors` in-place. Any component that reads from `Colors` at render time will see the updated values automatically. Components do NOT need to subscribe to context for colors — they just read `Colors.*` directly.

**Unlocked by default:** Only `default` theme. All others require referral perks.

---

### 5.6 API Client (`lib/api.ts`)

All server communication goes through `lib/api.ts`. It is the single contract between frontend and backend.

**`api.spotify.exchangeCode(code, redirectUri, username?, avatarId?)`** — Sends the Spotify authorization `code` and `redirect_uri` to `POST /spotify/exchange-code`. The backend performs the token exchange with Spotify's API using the server-held client secret. Also passes `username` and `avatar_id` so the backend can update the user row in one round-trip. Called from `music-services.tsx` after a successful OAuth redirect.

**Base URL resolution:**
- Uses `EXPO_PUBLIC_API_URL` env var, falls back to `http://localhost:5000/api/v1`.
- On Android emulators, automatically replaces `localhost` with `10.0.2.2`.

**Auth:** Every request fetches a fresh `access_token` from Supabase session via `getAuthHeaders()`. If no session exists, throws `"Authentication required"`.

**HTTP helpers:** `getJSON<T>`, `postJSON<T>`, `deleteJSON<T>` — all handle the `{ data: ... }` response envelope unwrapping.

**API surface:**

```typescript
api.feed.get()                         // GET /activity/feed → ActivityItem[]
api.friends.list()                     // GET /friends → Friend[]
api.friends.discover()                 // GET /friends/discover → FriendDiscoverResult[]
api.friends.requests()                 // GET /friends/requests → PendingFriendRequest[]
api.friends.search(query)              // GET /friends/search?q=...
api.friends.recommendations()          // GET /friends/recommendations
api.friends.add(username)              // POST /friends/add
api.friends.accept(friendshipId)       // POST /friends/accept
api.friends.decline(friendshipId)      // POST /friends/decline
api.spotify.nowPlaying()               // GET /spotify/now-playing
api.spotify.recent()                   // GET /spotify/recent
api.spotify.topArtists(range, limit, {fresh?}) // GET /spotify/top-artists
api.spotify.recommendations()          // GET /spotify/recommendations
api.spotify.connect(...)               // POST /spotify/connect
api.profile.me()                       // GET /auth/user
api.profile.update(data)               // POST /auth/user
api.profile.stats()                    // GET /profile/stats
api.profile.topArtists()               // GET /profile/top-artists
api.profile.topTracks()                // GET /profile/top-tracks
api.profile.user(userId, {fresh?})     // GET /profile/users/:userId
api.reactions.engagement(activityIds)  // GET /reactions/engagement?activity_ids=...
api.reactions.comments(activityId)     // GET /reactions/comments/:id
api.reactions.createComment(...)       // POST /reactions/comments
api.reactions.toggle(activityId, type) // POST /reactions/toggle
api.notifications.list()               // GET /notifications
api.notifications.unreadCount()        // GET /notifications/unread-count
api.notifications.markRead(id)         // POST /notifications/:id/read
api.notifications.markAllRead()        // POST /notifications/read-all
api.notifications.registerPushToken(p) // POST /notifications/push-token
api.notifications.unregisterPushToken(p) // DELETE /notifications/push-token
api.notifications.generateListeningInsight() // POST /notifications/listening-insight
api.messages.threads()                 // GET /messages/threads
api.messages.thread(friendId)          // GET /messages/:friendId
api.messages.send(friendId, payload)   // POST /messages/:friendId
api.messages.markRead(friendId)        // POST /messages/:friendId/read
api.chen.conversation()                // GET /chen/conversation
api.chen.chat(message, history)        // POST /chen/chat
api.referrals.status()                 // GET /referrals
api.referrals.completeOnboarding(p)    // POST /referrals/complete-onboarding
```

---

### 5.7 Auth (`lib/auth.ts`)

Thin wrappers over Supabase Auth + native providers.

| Function | Description |
|---|---|
| `configureGoogleSignIn()` | Sets up `@react-native-google-signin` with `webClientId` + `iosClientId` from env. Called in `AuthContext` on mount. |
| `signInWithGoogle()` | Native Google sign-in → ID token → `supabase.auth.signInWithIdToken({ provider: 'google', token })` |
| `signInWithApple()` | `expo-apple-authentication` → identity token → `supabase.auth.signInWithIdToken({ provider: 'apple', token })` |
| `signInWithEmail()` | `supabase.auth.signInWithPassword()` |
| `signUpWithEmail()` | `supabase.auth.signUp()` |
| `signOut()` | Calls both Google and Supabase sign-out |
| `getCurrentSession()` | Returns current Supabase session |
| `getCurrentUser()` | Returns current Supabase user |

**Note:** Apple Sign-In is only shown on iOS (`Platform.OS === 'ios'`).

---

### 5.8 Storage & Push Notifications

**`lib/storage.ts`** — Re-exports `@react-native-async-storage/async-storage` as the default. Used by Supabase client for session persistence and throughout the app for caching.

**`lib/push-notifications.ts`**
- `syncPushToken({ force? })` — Registers device for Expo push notifications and calls `api.notifications.registerPushToken()`. Caches the last-registered token in AsyncStorage (`chen_last_push_token`) to avoid redundant API calls. Skipped on web.
- `unregisterPushToken()` — Calls `api.notifications.unregisterPushToken()` and removes the cached token.
- Only registers on real devices (`Device.isDevice`). Requests permission if not already granted.
- Uses EAS project ID from `expo-constants` for the push token request.

---

### 5.9 Referral System (Client)

**`lib/referrals.ts`**

Manages a "pending referral" that gets stored when a user arrives via an invite link (URL params `referral_code` + `perk_key` on the signup screen).

- `storePendingReferral(input)` — Validates and saves to AsyncStorage (`chen_pending_referral`).
- `getPendingReferral()` — Reads + validates from AsyncStorage.
- `clearPendingReferral()` — Removes after use.
- `completeReferralOnboarding()` — Called at the end of onboarding (in `music-services.tsx`). Reads pending referral and posts to `POST /referrals/complete-onboarding`. Clears the pending referral afterward.

**Valid perk keys:** `top_artist_3`, `top_artist_4`, `top_artist_5`, `voice_notes`, `theme_lagos_night`, `theme_harmattan`, `theme_midnight_afro`, `theme_atilola_red`

---

## 6. Backend (Go / Gin)

### 6.1 Server Entry Point

`server/server.go` — The `main()` function:

1. Loads `.env` via `godotenv`
2. Initializes Supabase client (`supabase.InitClient()`)
3. Starts background goroutine: `go spotify.StartPoller()`
4. Optionally starts: `go notifications.StartListeningInsightsScheduler()` (if `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER=true`)
5. Creates Gin router with CORS middleware (allow all origins — suitable for dev, review for prod)
6. Registers `/health` endpoint
7. Registers Swagger UI at `/swagger/*` and `/docs/*`
8. Registers all API routes under `/api/v1`:
   - Public: `/auth` (no JWT)
   - Protected (JWT required): all other modules

**Default port:** `5000` (overridden by `PORT` env var)

---

### 6.2 Authentication Middleware

`server/internal/auth/middleware.go`

The `JWTMiddleware()` gin handler:
1. Extracts `Authorization: Bearer <token>` header.
2. In **production** (`APP_ENV=production`) or when `VERIFY_SUPABASE_JWT=true`: verifies HMAC signature using `SUPABASE_JWT_SECRET`.
3. In **development** (default): parses the JWT without signature verification (for easy local dev).
4. Rejects anonymous tokens (`role == "anon"`).
5. Sets `c.Set("user_id", ...)` and optionally `c.Set("user_email", ...)` for downstream handlers.

Helper functions: `GetUserFromContext(c)` → `(string, bool)`, `GetUserEmailFromContext(c)` → `(string, bool)`

---

### 6.3 Internal Modules

Each module follows the pattern: `routes.go` registers routes on a `*gin.RouterGroup`, handlers extract `user_id` from context, call Supabase or external APIs, return JSON.

#### `/activity` — Activity Feed
- `GET /activity/feed` — Fetches `listening_activity` rows for the user's friends (via `friendships` table). Before returning, triggers a fresh poll for feed users via `spotify.PollUserActivityNow()`. Joins with `users` table for `username` and `avatar_id`. Returns latest activity per user, deduped and sorted by recency.

#### `/spotify` — Spotify Integration
- `POST /spotify/exchange-code` — **Primary connection endpoint.** Receives `{ code, redirect_uri, username?, avatar_id? }` from the mobile client after the OAuth redirect. Calls `ExchangeAuthorizationCode()` (which uses `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` from server env) to exchange the code for tokens via Spotify's token endpoint using Basic auth. Upserts tokens into `spotify_connections`, optionally updates `users.username` / `users.avatar_id`, then fires an immediate background poll via `PollUserActivityNow()`. **The client secret never leaves the server.**
- `POST /spotify/connect` — Legacy endpoint. Accepts pre-exchanged tokens directly. Kept for backward compatibility but `exchange-code` is preferred.
- `GET /spotify/now-playing` — Calls Spotify API via authorized client. Returns null if not playing.
- `GET /spotify/recent` — Returns up to 10 recently played tracks.
- `GET /spotify/top-tracks` — Returns top tracks for `time_range` param.
- `GET /spotify/top-artists` — Returns top artists. Applies `referrals.AllowedTopArtistCount()` limit. Supports `fresh=true` to bypass cache.
- `GET /spotify/on-repeat` — Returns "On Repeat" playlist tracks.
- `GET /spotify/recommendations` — Returns recommended tracks.

#### `/friends` — Social Graph
- `GET /friends` — Returns accepted friends with online status and current track.
- `GET /friends/discover` — Suggests new users to add.
- `GET /friends/requests` — Returns pending incoming friend requests.
- `GET /friends/search?q=` — Searches users by username.
- `GET /friends/recommendations` — Music-compatible user recommendations.
- `POST /friends/add` — Creates a `friendships` row with `status=pending`.
- `POST /friends/accept` — Updates `friendship.status=accepted`.
- `POST /friends/decline` — Deletes or rejects the friendship row.

Relationship statuses: `none`, `self`, `friends`, `outgoing_pending`, `incoming_pending`

#### `/profile` — User Profiles
- `GET /profile/stats` — Minutes listened, artists played, top genre.
- `GET /profile/top-artists` — Own top artists.
- `GET /profile/top-tracks` — Own top tracks.
- `GET /profile/users/:userId` — Full public profile: user info, stats, relationship, now playing, recent tracks, top tracks, top artists.

#### `/reactions` — Engagement on Feed
- `GET /reactions/engagement?activity_ids=` — Batch fetch comment counts + reaction counts + user's own reactions for a list of activity IDs.
- `GET /reactions/comments/:activityId` — Thread of comments for an activity.
- `POST /reactions/comments` — Create a comment (supports `parent_comment_id` for threading).
- `POST /reactions/toggle` — Toggle a reaction (`love`, `fire`, `headphones`) on an activity.

#### `/notifications` — Notifications
- `GET /notifications` — Returns notification list + unread count.
- `GET /notifications/unread-count` — Lightweight unread count.
- `POST /notifications/:id/read` — Mark one read.
- `POST /notifications/read-all` — Mark all read.
- `POST /notifications/push-token` — Register Expo push token (upserts `user_push_tokens`).
- `DELETE /notifications/push-token` — Unregister token.
- `POST /notifications/listening-insight` — Manually trigger a listening insight notification.

#### `/messages` — Direct Messages
- `GET /messages/threads` — All message threads (grouped by friend) with last message and unread count.
- `GET /messages/:friendId` — Full message thread with a specific friend.
- `POST /messages/:friendId` — Send a message. Supports `message_type`: `text`, `voice`, `track_reply`. Voice messages include `audio_url` + `audio_duration_ms`. Track replies include `track_metadata` object.
- `POST /messages/:friendId/read` — Mark thread as read.

#### `/chen` — AI Companion
See [Section 6.5](#65-chen-ai-module).

#### `/referrals` — Referral & Unlocks
See [Section 6.6](#66-referral--unlocks-system-server).

#### `/auth` — User Profile Management
- `GET /auth/user` — Returns own user profile from `users` table.
- `POST /auth/user` — Updates own profile (username, avatar_id, theme_preference, etc.).

#### `/compatibility` — Music Compatibility Scores
- Routes registered but implementation details not yet fully surfaced in this analysis. Calculates music compatibility scores between users based on shared listening history.

---

### 6.4 Spotify Polling Engine

`server/internal/spotify/poller.go` — The heart of real-time activity.

**How it works:**

1. `StartPoller()` runs as a goroutine from `main()`.
2. On startup: immediately calls `pollAllUsers()`.
3. Every 30 seconds (`pollerTickInterval`): calls `pollAllUsers()` again.
4. `pollAllUsers()` fetches all rows from `spotify_connections`, then for each user, checks `shouldPollUser()` before polling.
5. `pollUserActivity(userID)`:
   - Gets an authorized Spotify client (refreshes token if needed).
   - Calls `GetCurrentlyPlaying()` from the Spotify API.
   - Compares new state to cached state (`userCache` map, guarded by `cacheMutex`).
   - If track changed or playback started → inserts into `listening_activity`.
   - If previous track was playing and a new one started → finalizes the old row (sets `is_playing=false`, sets `played_at`).
   - If playback stopped → finalizes the current row.

**Adaptive polling intervals:**

| Scenario | Interval |
|---|---|
| User is actively playing | 30s |
| Idle (not playing) — first check | 60s |
| Idle — each additional consecutive check | doubles (up to 10 min cap) |
| Rate-limited by Spotify | 2 min minimum, up to 30 min ceiling |

**In-memory cache (`userCache`):**
```go
type UserTrackCache struct {
    TrackName, ArtistName, AlbumName string
    IsPlaying       bool
    LastUpdate      time.Time
    PollInterval    time.Duration
    NextPollAt      time.Time
    ConsecutiveIdle int
}
```

**Rate limit guard (`guard.go`):**
- `spotifyRequestGuard` enforces a minimum 350ms spacing between requests per user.
- On 429 from Spotify: marks a cooldown period, prevents further requests until the cooldown expires.
- `singleflight.Group` for token refreshes ensures concurrent refresh requests are deduplicated.

**Caching (`cache.go` + `spotify_client.go`):**
- In-memory TTL cache for Spotify API responses:
  - Currently Playing: 30s
  - Recently Played: 5 min
  - Top Tracks: 12 hours
  - Top Artists: 24 hours
  - Recommendations: 6 hours
  - Artist/Track lookups: 7 days

---

### 6.5 Chen AI Module

`server/internal/chen/routes.go`

**Endpoints:**
- `GET /chen/conversation` — Loads saved conversation from `chen_conversations` table.
- `POST /chen/chat` — Main chat endpoint.

**Chat flow (`handleChat`):**
1. Builds a `musicContext` struct by querying:
   - User's currently playing track (via Spotify client)
   - User's recent tracks
   - Friends' current listening activity
   - User's top artists and top tracks
2. Constructs a Groq API request:
   - Model: `llama-3.3-70b-versatile`
   - Max tokens: 300
   - Temperature: 0.85
   - System prompt: personality + music context
   - History: loaded from DB (or from request `history` field if provided)
3. Calls `https://api.groq.com/openai/v1/chat/completions`
4. Saves updated conversation (history + new exchange) to `chen_conversations` table.
5. Returns `{ reply: string }`.

**System prompt** is built by `buildSystemPrompt()` and `buildIntroMessage()`. It injects:
- User's name
- What they're currently playing
- Recent listening activity
- What friends are playing
- Top artists and tracks summary

The conversation is stored as a JSONB array in `chen_conversations.messages`. Max conversation length is truncated/sanitized on each request.

---

### 6.6 Referral & Unlocks System (Server)

`server/internal/referrals/routes.go`

**Database tables:** `users` (has `referral_code`, `theme_preference`, `onboarding_completed_at`), `referral_completions`

**Perk definitions (hardcoded):**

| Key | Title | Required Referrals | Unlock |
|---|---|---|---|
| `top_artist_3` | Top Artist #3 | 1 | Artist rank 3 visible |
| `top_artist_4` | Top Artist #4 | 1 | Artist rank 4 visible |
| `top_artist_5` | Top Artist #5 | 1 | Artist rank 5 visible |
| `voice_notes` | Voice Notes | 2 | Voice notes in DMs |
| `theme_lagos_night` | Lagos Night Theme | 1 | lagosNight theme |
| `theme_harmattan` | Harmattan Theme | 1 | harmattan theme |
| `theme_midnight_afro` | Midnight Afro Theme | 1 | midnightAfro theme |
| `theme_atilola_red` | Atilola Red Theme | 1 | atilolaRed theme |

**`GET /referrals`** (`getStatus` → `BuildStatus()`):
1. Loads user's `username`, `avatar_id`, `theme_preference`, `referral_code`, `onboarding_completed_at` from `users`.
2. Ensures user has a referral code (generates one if missing — 12-char hex).
3. Counts rows in `referral_completions` grouped by `perk_key` where `referrer_user_id = userID`.
4. Returns status with each perk's unlock state.

**`POST /referrals/complete-onboarding`**:
1. Validates user has `username` + `avatar_id` set.
2. Applies referral completion: looks up the referrer by `referral_code`, inserts into `referral_completions` (one row per referred user, `UNIQUE` on `referred_user_id`).
3. Sets `onboarding_completed_at` on the user if not already set.
4. Returns full status.

**`AllowedTopArtistCount(userID)`** — Called by the Spotify routes handler for `GET /spotify/top-artists`. Returns 2 + number of unlocked artist ranks (max 5).

---

### 6.7 Push Notifications (Server)

`server/internal/notifications/push.go`

- Tokens stored in `user_push_tokens` table (`expo_push_token`, `platform`, `device_id`, `last_seen_at`).
- Upserted on `expo_push_token` conflict (deduplication).
- `sendPushForUser(userID, title, body, data)` — loads up to 5 most-recently-seen tokens for the user, sends via Expo Push API.
- Invalid tokens (`DeviceNotRegistered`) are automatically deleted from the table.
- `sendExpoPush()` sends a batch to `https://exp.host/--/api/v2/push/send`.

**Listening Insights Scheduler** (`notifications/listening.go`):
- Runs periodically if `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER=true`.
- Generates personalized listening insight notifications.

---

### 6.9 Super-User Feature Flag

`server/internal/admin/routes.go` + `server/migrations/add_super_user_flag.sql`

A per-user boolean flag (`users.is_super_user`, default `false`) that, when `true`, bypasses every referral gate and grants the user full access to all features — all themes, all top-artist slots (ranks 1–5), voice notes, and every perk — without requiring any referrals.

#### How it works end-to-end

1. **Database** — `users.is_super_user BOOLEAN NOT NULL DEFAULT false`. Run `migrations/add_super_user_flag.sql` to add the column.
2. **`loadUserReferralProfile`** — now selects `is_super_user`. Gracefully falls back to the old query if the column doesn't exist yet (migration not run).
3. **`BuildStatus`** — if `profile.IsSuperUser`, calls `buildSuperUserStatus()` which returns every perk as `unlocked: true` with `completed_referrals = required_referrals` (so the UI renders them identically to legitimately-earned perks). All theme keys and all artist ranks are included.
4. **`AllowedTopArtistCount`** — if `IsSuperUser`, returns `5` immediately (no referral count query).
5. **`HasPerkUnlocked`** — if `IsSuperUser`, returns `true` immediately for any perk key.
6. **Frontend** — `UnlocksContext` calls `GET /referrals` which now returns the fully-unlocked status. No frontend changes required — `isThemeUnlocked`, `isTopArtistUnlocked`, and `hasPerk` all read from this response and just work.

#### Admin API

Routes are registered at `/admin` (outside `/api/v1`), protected by `AdminMiddleware` which checks the `X-Admin-Secret` request header against the `ADMIN_SECRET` environment variable. If `ADMIN_SECRET` is unset, all admin routes return `503`.

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/admin/users/:userId/super-user` | — | Get current flag value for a user |
| `PUT` | `/admin/users/:userId/super-user` | `{ "enabled": true }` | Enable or disable the flag |

**Example — enable:**
```
curl -X PUT https://api.chen.app/admin/users/<USER_UUID>/super-user \
  -H "X-Admin-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

**Example response:**
```json
{
  "user_id": "abc-123",
  "email": "user@example.com",
  "username": "someuser",
  "is_super_user": true,
  "message": "super-user flag enabled for abc-123"
}
```

**Example — disable:**
```
curl -X PUT https://api.chen.app/admin/users/<USER_UUID>/super-user \
  -H "X-Admin-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

#### Security model
- The flag is **never user-settable**. There is no frontend UI, no user-facing API, and no JWT-authenticated route that touches `is_super_user`.
- The only write path is `PUT /admin/users/:userId/super-user` via the `ADMIN_SECRET` key.
- The Supabase service key (used by the backend) can write any column. RLS on the client side does not affect this.
- The flag does **not** affect the user's referral code or their ability to grant perks to others via referrals — those flows are unchanged.

---

### 6.8 Supabase Client (`pkg/supabase`)

`server/pkg/supabase/client.go` — Singleton pattern:
- `InitClient()` — reads `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` from env, creates client.
- `GetClient()` — returns the singleton `*supabase.Client`.

The backend uses the **service key** (not the anon key), which bypasses Row Level Security. The frontend uses the **anon key** with JWT, which is governed by RLS policies.

---


---

## 7. Database Schema

All tables reside in Supabase (PostgreSQL). RLS is enabled. Realtime is enabled on `listening_activity`.

### Core Tables

#### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Set by Supabase Auth |
| `email` | text | |
| `username` | text (UNIQUE) | Set during onboarding |
| `user_tag` | text | Display tag (e.g. `@chen`) |
| `avatar_id` | text | DiceBear seed |
| `is_premium` | boolean | |
| `theme_preference` | text | ThemeKey slug |
| `referral_code` | text (UNIQUE) | 12-char hex, auto-generated |
| `onboarding_completed_at` | timestamptz | Null until onboarding done |
| `is_super_user` | boolean | Default `false`. When `true`, all referral-gated features unlocked. Admin-only write. |
| `created_at` | timestamptz | |

#### `spotify_connections`
| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID (FK → users.id, UNIQUE) | |
| `access_token` | text | |
| `refresh_token` | text | |
| `expires_at` | timestamptz | |

#### `listening_activity`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → users.id) | |
| `track_id` | text | Spotify track ID |
| `track_name` | text | |
| `artist_name` | text | |
| `album_name` | text | |
| `album_art_url` | text | |
| `spotify_url` | text | |
| `preview_url` | text | |
| `platform` | text | `'spotify'` |
| `is_playing` | boolean | |
| `progress_ms` | integer | |
| `started_at` | timestamptz | Estimated start time |
| `played_at` | timestamptz | When last seen playing |

#### `friendships`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `requester_id` | UUID (FK → users.id) | |
| `addressee_id` | UUID (FK → users.id) | |
| `status` | text | `pending`, `accepted`, `declined`, `blocked` |
| `created_at` | timestamptz | |

#### `activity_comments`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `activity_id` | UUID (FK → listening_activity.id) | |
| `user_id` | UUID (FK → users.id) | |
| `content` | text | |
| `parent_comment_id` | UUID (nullable) | For threading |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `activity_engagement` / `activity_reactions`
Stores reaction counts and per-user reaction state (`love`, `fire`, `headphones`).

#### `direct_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `sender_id` | UUID (FK → users.id) | |
| `recipient_id` | UUID (FK → users.id) | |
| `content` | text | |
| `message_type` | text | `text`, `voice`, `track_reply` |
| `audio_url` | text | For voice notes |
| `audio_duration_ms` | integer | |
| `track_metadata` | JSONB | For track replies |
| `created_at` | timestamptz | |
| `read_at` | timestamptz | |

#### `notifications`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK → users.id) | Recipient |
| `actor_id` | UUID (FK → users.id, nullable) | Who triggered it |
| `type` | text | Notification type string |
| `title` | text | |
| `body` | text | |
| `entity_id` | UUID (nullable) | Related entity |
| `metadata` | JSONB | Arbitrary data |
| `read_at` | timestamptz | |
| `created_at` | timestamptz | |

#### `user_push_tokens`
| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID (FK → users.id) | |
| `expo_push_token` | text (UNIQUE) | |
| `platform` | text | `ios`, `android` |
| `device_id` | text | |
| `last_seen_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `referral_completions`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `referrer_user_id` | UUID (FK → users.id) | Who gets the perk |
| `referred_user_id` | UUID (FK → users.id, UNIQUE) | One referral per new user |
| `referral_code` | text | |
| `perk_key` | text | Which perk was chosen |
| `completed_at` | timestamptz | |

#### `chen_conversations`
| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID (PK, FK → users.id) | One row per user |
| `messages` | JSONB | Array of `{role, content}` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Storage Buckets
| Bucket | Public | Max Size | MIME Types |
|---|---|---|---|
| `voice-notes` | true | 10MB | audio/mp4, audio/m4a, audio/aac, audio/webm |

---

## 8. Data Flow Diagrams

### 8.1 Auth Flow

```
User opens app
      │
      ▼
AuthContext.init()
  ├─ Load cached profile from AsyncStorage
  ├─ supabase.auth.getSession()
  │   ├─ No session → setLoading(false) → (auth)/_layout → welcome screen
  │   └─ Session exists
  │       ├─ setUser + setSession
  │       └─ fetchUserProfile(userId)
  │           ├─ SELECT from users table
  │           ├─ If 404 (PGRST116) → INSERT new user row
  │           └─ Merge with cached profile → setProfile
  │
  ▼
(auth)/_layout.tsx redirect logic
  ├─ profile.username && profile.avatar_id → /(tabs) ✓
  ├─ profile.username only → /(auth)/avatar
  └─ neither → /(auth)/username

New user onboarding path:
signup.tsx → (Google/Apple OAuth) → Supabase creates auth.users row
     │
     ▼
(auth)/_layout detects user + empty profile → /(auth)/username
     │
     ▼
username.tsx → store username in state → /(auth)/avatar
     │
     ▼
avatar.tsx → store avatarSeed in state → /(auth)/music-services
     │
     ▼
music-services.tsx
  ├─ Spotify OAuth (expo-auth-session code flow)
  ├─ Exchange code for tokens (client-side fetch to Spotify)
  ├─ Upsert into spotify_connections
  ├─ UPDATE users SET avatar_id, username
  └─ completeReferralOnboarding() → POST /referrals/complete-onboarding
       │
       ▼
     /(tabs) ✓
```

### 8.2 Spotify Real-Time Polling

```
server startup
      │
      └─ go spotify.StartPoller()
              │
              ├─ pollAllUsers() immediately
              └─ every 30s: pollAllUsers()
                      │
                      ▼
              for each row in spotify_connections:
                  shouldPollUser()? (check NextPollAt)
                      │ yes
                      ▼
                  GetAuthorizedClient(userID)
                      ├─ load from spotify_connections
                      └─ if token expired → refresh via Spotify token endpoint
                              │
                              ▼
                  GetCurrentlyPlaying() → Spotify API
                              │
                      compare to userCache[userID]
                              │
                  track changed or playback started?
                      ├─ YES → finalize old row (is_playing=false)
                      │         insert new listening_activity row
                      └─ NO, playback stopped?
                              └─ finalize current row

Supabase Realtime → broadcasts INSERT/UPDATE on listening_activity
      │
      ▼
Mobile app (Supabase client subscription)
  Feed screen: scheduleRefresh() → fetchFeed() → re-render
  Profile screen: updates nowPlaying state directly
```

### 8.3 Feed Load Sequence

```
FeedScreen mounts
      │
      ├─ fetchFeed()
      │     ├─ GET /activity/feed (with Bearer JWT)
      │     │     └─ server: refreshFeedUsers → pollAllUsers for friend IDs
      │     │                SELECT listening_activity JOIN users WHERE user_id IN (friend_ids)
      │     │                Return ActivityItem[]
      │     └─ setFeed(feedData)
      │
      ├─ fetchEngagement(activityIds)
      │     └─ GET /reactions/engagement?activity_ids=...
      │           Returns {[activityId]: {commentCount, reactions, userReactions}}
      │
      ├─ fetchNotificationCount()
      │     └─ GET /notifications/unread-count
      │
      └─ Subscribe to Supabase Realtime
            ├─ listening_activity INSERT/UPDATE → scheduleRefresh()
            └─ activity_reactions changes → scheduleRefresh() for that activity
```

### 8.4 Chen AI Chat Sequence

```
User types message → handleSend()
      │
      ├─ Append user message to local state (optimistic)
      ├─ setIsThinking(true)
      │
      └─ POST /chen/chat { message, history }
              │
              ▼
        server: handleChat()
              ├─ buildMusicContext(userID)
              │     ├─ GetCurrentlyPlaying()
              │     ├─ GetRecentlyPlayed()
              │     ├─ GetAcceptedFriendIDs() → query each friend's now-playing
              │     └─ GetTopArtists() + GetTopTracks()
              │
              ├─ loadConversationMessages() from chen_conversations
              │
              ├─ buildSystemPrompt(context) — injects music taste
              │
              └─ POST https://api.groq.com/openai/v1/chat/completions
                    model: llama-3.3-70b-versatile
                    max_tokens: 300
                    temperature: 0.85
                          │
                          ▼
                  saveConversationMessages() → upsert chen_conversations
                          │
                          ▼
                  return { reply: string }
              │
      setIsThinking(false)
      Append Chen's reply to local messages state
```

---

## 9. Environment Variables

### Frontend (`EXPO_PUBLIC_*` prefix — exposed to client bundle)

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `EXPO_PUBLIC_API_URL` | ✅ | Backend base URL (e.g. `https://api.chen.app/api/v1`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | ✅ | Google OAuth web client ID (for Supabase) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | ✅ | Google OAuth iOS client ID (for native sign-in) |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | ✅ | Spotify app client ID |


### Backend (server `.env`)


| Variable | Required | Description |
|---|---|---|
| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | ✅ in prod | JWT secret from Supabase dashboard |
| `GROQ_API_KEY` | ✅ | Groq API key for Chen AI |
| `SPOTIFY_CLIENT_ID` | ✅ | Spotify app client ID (server-side token exchange + refresh) |
| `SPOTIFY_CLIENT_SECRET` | ✅ | Spotify app client secret (server-side only — never sent to client) |
| `PORT` | ❌ | HTTP port (default: `5000`) |
| `APP_ENV` | ❌ | Set to `production` to enable JWT signature verification |
| `VERIFY_SUPABASE_JWT` | ❌ | Set to `true` to enable JWT verification in dev |
| `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER` | ❌ | Set to `true` to enable push insight scheduler |
| `ADMIN_SECRET` | ✅ for admin | Static secret for `/admin` endpoints. If unset, all admin routes return 503. Use a long random string (e.g. `openssl rand -hex 32`). |

---

## 10. Key Design Decisions & Patterns

### Mutable `Colors` Object for Theming
Rather than passing theme values through React context at the component level, `applyTheme()` mutates the `Colors` singleton. This means any component importing `Colors` directly will get the correct theme values after a theme switch (which forces a remount via the Stack `key` prop). This is a deliberate perf trade-off to avoid re-rendering the entire tree on every color lookup.

### Profile Caching with Merge Strategy
`AuthContext` caches the user profile in AsyncStorage. On reload, it shows cached data instantly, then fetches fresh data and merges — preferring non-empty live data over cached data field-by-field. This prevents jarring blank states during session restore.

### Single-Flight Profile Fetch
`profileFetchRef` in `AuthContext` is a promise ref. If two callers request `fetchUserProfile` concurrently (e.g., `init()` and `onAuthStateChange()`), the second caller awaits the first's promise rather than making a duplicate DB call.

### Adaptive Spotify Polling
The poller is not a fixed-interval cron. It is adaptive: active listeners get 30s intervals, idle users back off exponentially to 10 minutes, and rate-limited users are suppressed for up to 30 minutes. This is critical for staying within Spotify's API rate limits at scale.

### Backend Schema Graceful Degradation
Both the Go server and the React Native client handle missing DB columns gracefully. For example, if `referral_code` or `theme_preference` columns don't exist in the DB yet (older schema), the code falls back to a simpler query and supplies default values. This allows schema migrations to be rolled out without requiring simultaneous code deployments.

### Referral as One-Way Perk Grant
A user can only be a "referred user" once (`UNIQUE` constraint on `referred_user_id` in `referral_completions`). The perk is granted to the *referrer*, not the referee. Each perk requires 1–2 referral completions.

### Voice Notes Storage
Voice notes are stored as audio files in Supabase Storage (`voice-notes` bucket, public) and their URLs are saved in `direct_messages.audio_url`. The frontend uses `expo-audio` / `expo-av` for recording and playback.

### API Response Envelope
The backend returns either raw JSON or wraps data in `{ "data": ... }`. The `lib/api.ts` client handles both: `json.data ?? json`. Be consistent when adding new endpoints — prefer returning raw data at the top level.

---

## 11. Known Limitations & Gotchas

### 🟡 JWT Not Verified in Development
By default (`APP_ENV` unset), the Go backend parses JWTs without verifying the signature. This is intentional for local dev but must be confirmed `APP_ENV=production` is set in all production deployments.

### 🟡 CORS Allows All Origins
The CORS middleware in `server.go` sets `Access-Control-Allow-Origin: *`. Tighten this for production.

### 🟡 No Supabase RLS on Backend
The backend uses the **service key**, which bypasses all RLS policies. All authorization logic must be handled in Go handler code. There is no database-level safety net for backend operations.

### 🟡 `Colors` Object Mutation is Not Thread-Safe
`applyTheme()` mutates a module-level object. In the React Native single-threaded JS environment this is fine, but be aware if ever moving theming to a web worker or SSR context.

### 🟢 Super-User Flag (implemented)
The `is_super_user` column + `/admin` API are fully implemented. Remember to run `migrations/add_super_user_flag.sql` and set `ADMIN_SECRET` in your server environment before use.

### 🟠 Apple Music & Audiomack Not Connected
`server/internal/applemusic/` and `server/internal/audiomack/` exist as stubs. They are **not** registered on the router. The UI shows these as connection options in some places, but no backend polling or data ingestion exists for them yet.

### 🟠 Payments Not Implemented
`server/internal/payments/` is a stub. Paystack integration is planned but not wired up. `is_premium` exists on the `users` table but is not toggled by any backend logic yet.

### 🟠 Compatibility Module
`server/internal/compatibility/` is registered on the router but its implementation details are not fully surfaced. The frontend references `compatibility` scores on friend cards but the calculation logic is unclear.

### 🟡 `lastfm` Package Usage
`server/internal/lastfm/` is imported by `server/internal/profile/genre_resolver.go`. Last.fm appears to be used as a fallback data source for genre resolution when Spotify doesn't return genres. No Last.fm API key environment variable is documented — check if this is configured.

### 🟡 EAS Project ID Placeholder
`app.json` contains `"projectId": "REPLACE_WITH_EAS_PROJECT_ID"`. This must be replaced with the actual Expo Application Services project ID for push notifications and OTA updates to work.

### 🟡 Onboarding "Login" Screen UI
The login screen (`(auth)/login.tsx`) has a commented-out "Create account" link at the bottom pointing to signup. The signup screen has a commented-out "Already have an account" link. Navigation between login and signup is partially disabled in the current UI.

---

## 12. Feature Status Matrix

| Feature | Frontend | Backend | Notes |
|---|---|---|---|
| Auth (Google) | ✅ | ✅ | Via Supabase Auth |
| Auth (Apple) | ✅ | ✅ | iOS only |
| Onboarding flow | ✅ | ✅ | |
| Username selection | ✅ | ✅ | |
| Avatar picker | ✅ | ✅ | DiceBear |
| Spotify connection | ✅ | ✅ | OAuth + server-side token exchange |
| Super-user feature flag | ✅ | ✅ | Admin API + DB column |
| Real-time Spotify polling | N/A | ✅ | Backend goroutine |
| Home feed | ✅ | ✅ | |
| Feed reactions | ✅ | ✅ | love/fire/headphones |
| Feed comments | ✅ | ✅ | With threading |
| Spotify preview (WebView) | ✅ | N/A | Embed in feed card |
| Friends list | ✅ | ✅ | |
| Friend requests | ✅ | ✅ | |
| Friend discovery | ✅ | ✅ | |
| Friend search | ✅ | ✅ | |
| Public profiles | ✅ | ✅ | |
| Own profile | ✅ | ✅ | |
| Top artists (gated) | ✅ | ✅ | Referral-gated |
| Top tracks | ✅ | ✅ | |
| Listening stats | ✅ | ✅ | |
| Theme system (5 themes) | ✅ | ✅ | |
| Referral/unlock system | ✅ | ✅ | |
| Chen AI chat | ✅ | ✅ | Groq / Llama 3 |
| Direct messages (text) | ✅ | ✅ | |
| Voice notes (DM) | ✅ (UI) | ✅ | Upload to Supabase Storage |
| Track replies (DM) | ✅ | ✅ | |
| Push notifications | ✅ | ✅ | Expo Push |
| Notifications screen | ✅ | ✅ | |
| Settings screen | ✅ | ✅ | Theme picker, referrals |
| Edit profile | ✅ | ✅ | |
| Spotify reconnect | ✅ | ✅ | |
| Music compatibility scores | ✅ (UI) | 🔶 | Implementation unclear |
| Apple Music integration | 🔶 (UI) | ❌ | Backend stub only |
| Audiomack integration | 🔶 (UI) | ❌ | Backend stub only |
| Premium subscription | 🔶 (UI) | ❌ | Paystack not wired |
| Listening insight notifications | N/A | 🔶 | Scheduler exists, env-gated |

Legend: ✅ Done · 🔶 Partial · ❌ Not implemented

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Activity** | A row in `listening_activity` — a track a user was observed playing |
| **AvatarID** | A string seed passed to DiceBear to generate a deterministic avatar SVG |
| **Chen** | 1. The app name. 2. The AI companion character. 3. Nigerian slang meaning "to see/understand" |
| **Discover** | The "People You Might Know" section on the Friends screen |
| **Engagement** | Aggregate of comment count + reaction counts for a feed item |
| **Feed** | The home screen showing friends' listening activity in reverse-chronological order |
| **Finalize** | Updating a `listening_activity` row to set `is_playing=false` when the user stops a track |
| **Groq** | The AI inference provider used for Chen AI (runs Llama 3) |
| **Guest / Anon token** | A Supabase JWT with `role=anon`. These are rejected by the backend middleware. |
| **perk_key** | A string identifier for a referral unlock (e.g. `theme_lagos_night`) |
| **Poller** | The background goroutine in the Go server that polls Spotify for all connected users |
| **Profile cache** | The AsyncStorage copy of the user's `UserProfile`, keyed by `chen_user_profile` |
| **RLS** | Row Level Security — Supabase/PostgreSQL feature governing which rows users can access |
| **Service key** | The Supabase key used by the backend; bypasses RLS |
| **ThemeKey** | One of: `default`, `lagosNight`, `harmattan`, `midnightAfro`, `atilolaRed` |
| **Track reply** | A DM that references a specific song from the feed (a shareable listening activity) |
| **user_tag** | A display tag for the user (e.g. shown below username on profile cards) |
| **is_super_user** | The `users.is_super_user` boolean flag. When `true`, `BuildStatus` returns every perk unlocked, bypassing referral counts entirely. Admin-only via `PUT /admin/users/:userId/super-user`. |
| **ADMIN_SECRET** | Static secret key stored in server env. Must be sent as `X-Admin-Secret` header to access `/admin` routes. |
| **Voice note** | An audio recording sent as a direct message, stored in Supabase Storage |