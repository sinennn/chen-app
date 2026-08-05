# Chen Backend — System Design Document

> **Version:** 1.0  
> **Last Updated:** July 2026  
> **Module:** `chen` (Go backend server)

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [API Layer & Routing](#4-api-layer--routing)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Database Schema (Supabase/PostgreSQL)](#6-database-schema)
7. [External Service Integrations](#7-external-service-integrations)
   - 7.1 [Spotify Integration](#71-spotify-integration)
   - 7.2 [Last.fm Genre Resolution](#72-lastfm-genre-resolution)
8. [Core Domain Modules](#8-core-domain-modules)
   - 8.1 [Activity Module](#81-activity-module)
   - 8.2 [Profile Module](#82-profile-module)
   - 8.3 [Compatibility Module](#83-compatibility-module)
   - 8.4 [Friends Module](#84-friends-module)
   - 8.5 [Messages Module](#85-messages-module)
   - 8.6 [Notifications Module](#86-notifications-module)
   - 8.7 [Reactions Module](#87-reactions-module)
   - 8.8 [Chen AI Conversations Module](#88-chen-ai-conversations-module)
   - 8.9 [Referrals Module](#89-referrals-module)
   - 8.10 [Payments Module](#810-payments-module)
   - 8.11 [Admin Module](#811-admin-module)
9. [Background Workers & Polling](#9-background-workers--polling)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Caching Strategy](#11-caching-strategy)
12. [Rate Limiting & Resilience](#12-rate-limiting--resilience)
13. [Configuration & Environment](#13-configuration--environment)
14. [API Endpoint Reference](#14-api-endpoint-reference)

---

## 1. Overview & Architecture

Chen is a **music compatibility and social platform** that connects friends through their listening habits. The backend is a **monolithic Go HTTP server** using the **Gin** web framework. It acts as a BFF (Backend For Frontend) layer between the React Native mobile app and external services (Spotify, Last.fm, Supabase).

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         React Native App                            │
│                    (Expo / TypeScript)                               │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Gin HTTP Server (Go)                          │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ Auth        │  │ Spotify      │  │ Domain Modules         │    │
│  │ Middleware  │  │ Integration  │  │ • Activity             │    │
│  │ (JWT)       │  │              │  │ • Profile              │    │
│  └─────────────┘  │ • Client     │  │ • Compatibility        │    │
│                   │ • Poller     │  │ • Friends              │    │
│                   │ • Guard      │  │ • Messages             │    │
│                   │ • Cache      │  │ • Notifications        │    │
│                   └──────┬───────┘  │ • Reactions            │    │
│                          │          │ • Chen AI              │    │
│                          │          │ • Referrals            │    │
│                          │          │ • Payments             │    │
│                          │          │ • Admin                │    │
│                          │          └────────────────────────┘    │
└─────────────────────┬────┼──────────────────┬─────────────────────┘
                      │    │                  │
                      ▼    ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐
│  Spotify     │  │  Supabase    │  │  Last.fm            │
│  Web API     │  │  (PostgreSQL │  │  API                │
│              │  │   + Auth)    │  │                     │
└──────────────┘  └──────────────┘  └─────────────────────┘
```

### Architectural Characteristics

| Property | Implementation |
|---|---|
| **Pattern** | Monolithic with package-based modularization |
| **API Style** | RESTful JSON over HTTP/HTTPS |
| **Port** | `5001` (configurable via `PORT` env) |
| **Server Framework** | Gin (`github.com/gin-gonic/gin`) |
| **Base Path** | `/api/v1` |
| **Auth** | JWT Bearer tokens (Supabase-issued) |
| **Database** | Supabase (managed PostgreSQL via `postgrest-go`) |
| **Concurrency** | Goroutines for background polling, scheduler |

---

## 2. Technology Stack

| Component | Technology |
|---|---|
| **Language** | Go 1.25 |
| **HTTP Framework** | Gin v1.11 |
| **Database Client** | Supabase Go SDK (`supabase-community/supabase-go`) |
| **Auth** | `golang-jwt/jwt/v5` |
| **API Docs** | Swagger/OpenAPI (`swaggo/swag`) |
| **Sync Primitives** | `golang.org/x/sync` |
| **Config** | `.env` via `joho/godotenv` |

### Key Go Modules (from `go.mod`)

```
gin-gonic/gin         → HTTP routing & middleware
golang-jwt/jwt/v5     → JWT parsing & verification
supabase-community/   → Supabase client (PostgREST, Auth, Storage, Functions)
swaggo/               → Swagger UI & OpenAPI spec generation
joho/godotenv         → Environment variable loading
```

---

## 3. Directory Structure

```
server/
├── server.go                        # Entry point — router setup, middleware, background start
├── go.mod / go.sum                  # Go module definition
├── .env                             # Environment variables (not in VCS)
├── main / chen / chen-server        # Compiled binaries (gitignored)
│
├── config/                          # (empty; config via env vars)
│
├── docs/                            # Auto-generated Swagger docs
│   ├── docs.go
│   ├── swagger.json
│   └── swagger.yaml
│
├── internal/                        # Application packages
│   ├── activity/      routes.go     # Listening activity feed & comments
│   ├── admin/         routes.go     # Admin-only endpoints
│   ├── applemusic/                  # (stub/external client)
│   ├── audiomack/                   # (stub/external client)
│   ├── auth/          routes.go     # User CRUD, callback
│   │                 middleware.go  # JWT middleware
│   ├── chen/          routes.go     # AI conversation (ChatGPT-style)
│   ├── compatibility/ routes.go     # Music compatibility scoring
│   ├── friends/       routes.go     # Friend management
│   │                 service.go    # Friend business logic
│   ├── lastfm/        client.go     # Last.fm API client (genre fallback)
│   ├── messages/      routes.go     # Direct messaging
│   ├── notifications/ routes.go     # Notification CRUD
│   │                 push.go       # Expo Push Notifications
│   │                 listening.go  # Listening insights scheduler
│   ├── payments/      routes.go     # Payment/Stripe integration
│   ├── profile/       routes.go     # User profile & stats
│   │                 genre_resolver.go
│   ├── reactions/     routes.go     # Activity reactions (love/fire/headphones)
│   ├── referrals/     routes.go     # Referral system & unlocks
│   └── spotify/       routes.go     # Spotify API endpoints
│                      spotify_client.go  # Spotify Web API client
│                      poller.go          # Background activity poller
│                      connection.go      # Token management & authorized client
│                      cache.go           # Shared in-memory cache
│                      guard.go           # Rate limit guard
│                      errors.go          # Spotify-specific errors
│
├── migrations/                      # SQL migration files
│   ├── create_notifications_and_direct_messages.sql
│   ├── create_chen_conversations.sql
│   ├── create_comments_table.sql
│   ├── add_listening_activity_track_metadata.sql
│   ├── fix_listening_activity_schema.sql
│   ├── add_activity_comments.sql
│   ├── add_activity_engagement.sql
│   ├── add_artist_listener_percentile.sql
│   ├── add_push_tokens_table.sql
│   ├── add_referral_unlocks.sql
│   ├── add_super_user_flag.sql
│   ├── add_user_tag_column.sql
│   ├── add_username_unique_constraint.sql
│   ├── add_voice_notes_to_direct_messages.sql
│   ├── add_track_replies_to_direct_messages.sql
│   ├── fix_listening_activity_track_id_type.sql
│   └── add_voice_note_read_policy.sql
│
└── pkg/
    └── supabase/
        └── client.go                # Supabase client singleton
```

---

## 4. API Layer & Routing

### 4.1 Server Initialization (`server.go`)

The entry point follows this sequence:

```
main()
├── godotenv.Load()                          # Load .env
├── supabase.InitClient()                    # Initialize DB client
├── go spotify.StartPoller()                 # Start background poller goroutine
├── [if ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER]
│   └── go notifications.StartListeningInsightsScheduler()
├── router := gin.Default()
├── CORS middleware                          # Allow all origins
├── /health                                  # Health check endpoint
├── /swagger/*any, /docs/*any                # Swagger UI
└── /api/v1
    ├── /auth       (public)                 # callback, signout
    └── [JWT Middleware]                     # All routes below require auth
        ├── /auth          (protected)       # user get/update
        ├── /spotify                         # Connect, play data, top artists/tracks
        ├── /friends                         # Friend list, requests, search
        ├── /activity                        # Listening activity feed
        ├── /profile                         # User profile & stats
        ├── /compatibility                   # Compatibility scores
        ├── /chen                            # AI conversation
        ├── /referrals                       # Referral codes, unlocks
        ├── /notifications                   # Notification list & push tokens
        ├── /messages                        # Direct messages
        └── /reactions                       # Activity reactions
    └── /admin      [Admin Middleware]       # Super-user administration
```

### 4.2 Route Registration Pattern

Each internal package follows a consistent pattern:
- A `RegisterRoutes(rg *gin.RouterGroup)` function registers handlers
- Handlers receive the authenticated user ID via `c.Get("user_id")`
- Response format is always JSON

### 4.3 Middleware Stack

1. **Gin Default middleware** (Logger, Recovery)
2. **CORS middleware** (custom — allows all origins)
3. **JWT Middleware** (only on protected routes)
4. **Admin Middleware** (only on `/admin` routes)

---

## 5. Authentication & Authorization

### 5.1 Authentication Flow

```
┌─────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Mobile  │     │  Chen    │     │ Supabase  │     │ Spotify  │
│  App     │     │  Server  │     │ Auth      │     │ OAuth    │
└────┬─────┘     └────┬─────┘     └─────┬─────┘     └────┬─────┘
     │                 │                 │                 │
     │ 1. OAuth Login  │                 │                 │
     │────────────────►│                 │                 │
     │                 │ 2. Auth Request │                 │
     │                 │────────────────►│                 │
     │                 │ 3. JWT Token    │                 │
     │                 │◄────────────────│                 │
     │ 4. Bearer Token │                 │                 │
     │◄────────────────│                 │                 │
     │                 │                 │                 │
     │ 5. API Request  │                 │                 │
     │ (Authorization: │                 │                 │
     │  Bearer <JWT>)  │                 │                 │
     │────────────────►│                 │                 │
     │                 │ 6. Verify JWT   │                 │
     │                 │ (HMAC-SHA256)   │                 │
     │                 │                 │                 │
     │                 │ 7. Set user_id  │                 │
     │                 │ in context      │                 │
     │                 │                 │                 │
     │ 8. JSON Response│                 │                 │
     │◄────────────────│                 │                 │
```

### 5.2 JWT Middleware (`auth/middleware.go`)

- Extracts Bearer token from `Authorization` header
- **Signature verification** is conditional:
  - Production (`APP_ENV=production`): **Always verifies** with `SUPABASE_JWT_SECRET`
  - Development: **Skips verification** unless `VERIFY_SUPABASE_JWT=true`
- **Rejects anonymous tokens** (JWT `role` claim == `"anon"`)
- Extracts `sub` claim as `user_id` into Gin context
- Optionally extracts `email` claim

### 5.3 Public vs Protected Routes

| Route Group | Middleware | Purpose |
|---|---|---|
| `/api/v1/auth/callback` | None | OAuth callback endpoint |
| `/api/v1/auth/signout` | None | Sign out |
| `/api/v1/auth/user` | JWT | Get/update current user |
| `/api/v1/*` | JWT | All other business endpoints |
| `/admin/*` | AdminMiddleware | Admin operations |

### 5.4 Admin Middleware

Checks `ADMIN_SECRET` environment variable against an `Authorization: Bearer <admin-secret>` header. This is separate from the JWT auth system.

---

## 6. Database Schema (Supabase / PostgreSQL)

The database is a **Supabase** (managed PostgreSQL) instance. The server connects using the **Supabase Go SDK** which wraps **PostgREST**. All queries are performed through `supabase.From("table_name").Select/Update/Insert/Upsert/Delete().Eq().Execute()`.

### 6.1 Entity Relationship Diagram

```
┌───────────────────┐       ┌──────────────────────────┐
│      users        │       │   spotify_connections    │
├───────────────────┤       ├──────────────────────────┤
│ id (PK, UUID)     │◄──────│ user_id (PK, FK)         │
│ email             │   1:1 │ access_token             │
│ username (UNIQUE) │       │ refresh_token            │
│ user_tag (UNIQUE) │       │ expires_at               │
│ avatar_id         │       │ created_at               │
│ is_premium        │       └──────────────────────────┘
│ is_super_user     │
│ theme_preference  │       ┌──────────────────────────┐
│ referral_code     │       │   listening_activity     │
│ onboarding_comp.. │◄──────│──────────────────────────│
│ created_at        │   1:N │ id (PK, UUID)            │
└───────────────────┘       │ user_id (FK)             │
       │  │  │              │ track_name              │
       │  │  │              │ artist_name             │
       │  │  │              │ album_name              │
       │  │  │              │ album_art_url           │
       │  │  │              │ track_id                │
       │  │  │              │ spotify_url             │
       │  │  │              │ preview_url             │
       │  │  │              │ is_playing              │
       │  │  │              │ progress_ms             │
       │  │  │              │ platform                │
       │  │  │              │ started_at              │
       │  │  │              │ played_at               │
       │  │  │              │ synced_at               │
       │  │  │              └──────────┬───────────────┘
       │  │  │                         │
       │  │  │              ┌──────────▼───────────────┐
       │  │  │              │    activity_comments     │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ activity_id (FK)         │
       │  │  │              │ user_id (FK)             │
       │  │  │              │ content                  │
       │  │  │              │ parent_comment_id (FK)   │
       │  │  │              │ created_at               │
       │  │  │              │ updated_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │    activity_reactions    │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ activity_id (FK)         │
       │  │  │              │ user_id (FK)             │
       │  │  │              │ reaction_type (CHECK)    │
       │  │  │              │ created_at               │
       │  │  │              │ UNIQUE(activity_id,      │
       │  │  │              │        user_id,          │
       │  │  │              │        reaction_type)    │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  user_friends            │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ user_id (PK, FK)         │
       │  │  │              │ friend_id (PK, FK)       │
       │  │  │              │ status                   │
       │  │  │              │ created_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  direct_messages         │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ sender_id (FK)           │
       │  │  │              │ recipient_id (FK)        │
       │  │  │              │ content                  │
       │  │  │              │ message_type             │
       │  │  │              │ audio_url                │
       │  │  │              │ audio_duration_ms        │
       │  │  │              │ track_metadata (JSONB)   │
       │  │  │              │ read_at                  │
       │  │  │              │ created_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  user_push_tokens        │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ user_id (FK)             │
       │  │  │              │ expo_push_token (UNIQUE) │
       │  │  │              │ platform                 │
       │  │  │              │ device_id                │
       │  │  │              │ last_seen_at             │
       │  │  │              │ created_at               │
       │  │  │              │ updated_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  notifications           │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ user_id (FK)             │
       │  │  │              │ actor_id (FK, nullable)  │
       │  │  │              │ type                     │
       │  │  │              │ title                    │
       │  │  │              │ body                     │
       │  │  │              │ entity_id                │
       │  │  │              │ metadata (JSONB)         │
       │  │  │              │ read_at                  │
       │  │  │              │ created_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  chen_conversations      │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ user_id (PK, FK)         │
       │  │  │              │ messages (JSONB)         │
       │  │  │              │ created_at               │
       │  │  │              │ updated_at               │
       │  │  │              └──────────────────────────┘
       │  │  │
       │  │  │              ┌──────────────────────────┐
       │  │  │              │  referral_completions    │
       │  │  │              ├──────────────────────────┤
       │  │  │              │ id (PK, UUID)            │
       │  │  │              │ referrer_user_id (FK)    │
       │  │  │              │ referred_user_id (FK)    │
       │  │  │              │ referral_code            │
       │  │  │              │ perk_key                 │
       │  │  │              │ completed_at             │
       │  │  │              │ created_at               │
       │  │  │              └──────────────────────────┘
```

### 6.2 Key Tables

#### `users`
Core user profile table managed by Supabase Auth with custom columns:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Managed by Supabase Auth |
| `email` | TEXT | From Supabase Auth |
| `username` | TEXT | UNIQUE constraint |
| `user_tag` | TEXT | Unique (partial index, nullable) |
| `avatar_id` | TEXT | Avatar identifier |
| `is_premium` | BOOLEAN | Premium subscription flag |
| `is_super_user` | BOOLEAN | Feature flag for all unlocks |
| `theme_preference` | TEXT | Default: `'default'` |
| `referral_code` | TEXT | Unique, auto-generated (MD5 hash) |
| `onboarding_completed_at` | TIMESTAMPTZ | Nullable |

#### `spotify_connections`
Stores Spotify OAuth tokens for each user:

| Column | Type | Notes |
|---|---|---|
| `user_id` | UUID (PK, FK) | References `users(id)` |
| `access_token` | TEXT | Spotify API access token |
| `refresh_token` | TEXT | Used to refresh expired tokens |
| `expires_at` | TIMESTAMPTZ | Token expiry timestamp |

#### `listening_activity`
Records all listening events:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK) | References `users(id)` |
| `track_name` | TEXT | |
| `artist_name` | TEXT | |
| `album_name` | TEXT | |
| `album_art_url` | TEXT | Spotify album art URL |
| `track_id` | TEXT | Spotify track ID |
| `spotify_url` | TEXT | |
| `preview_url` | TEXT | 30-second preview |
| `is_playing` | BOOLEAN | Currently playing flag |
| `progress_ms` | INTEGER | Playback position |
| `platform` | TEXT | e.g., `"spotify"` |
| `started_at` | TIMESTAMPTZ | |
| `played_at` | TIMESTAMPTZ | Indexed for queries |
| `synced_at` | TIMESTAMPTZ | Last sync timestamp |

#### `direct_messages`
Direct messaging with voice note support:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `sender_id` | UUID (FK) | |
| `recipient_id` | UUID (FK) | |
| `content` | TEXT | Message body |
| `message_type` | TEXT | `'text'`, `'voice'`, or `'track'` |
| `audio_url` | TEXT | Supabase Storage URL for voice notes |
| `audio_duration_ms` | INTEGER | |
| `track_metadata` | JSONB | Shared track metadata |
| `read_at` | TIMESTAMPTZ | Nullable read receipt |

#### `notifications`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | |
| `user_id` | UUID (FK) | Notification recipient |
| `actor_id` | UUID (FK, nullable) | User who triggered the notification |
| `type` | TEXT | e.g., `friend_request`, `reaction`, `comment` |
| `title` | TEXT | |
| `body` | TEXT | |
| `entity_id` | UUID | Related entity (activity, message, etc.) |
| `metadata` | JSONB | Flexible payload |
| `read_at` | TIMESTAMPTZ | Nullable |
| `created_at` | TIMESTAMPTZ | |

### 6.3 Indexes

Key performance indexes:

- `direct_messages`: `(sender_id, recipient_id, created_at DESC)`, `(recipient_id, read_at, created_at DESC)`
- `notifications`: `(user_id, created_at DESC)`, `(user_id, read_at, created_at DESC)`
- `listening_activity`: `(user_id, played_at DESC)`, `(user_id, track_name, artist_name, played_at)`
- `activity_comments`: `(activity_id)`, `(user_id)`, `(created_at DESC)`, `(parent_comment_id)`
- `activity_reactions`: `(activity_id)`, `(user_id)`

### 6.4 Row-Level Security (RLS)

The schema uses Supabase RLS policies for:
- `activity_comments`: Users can read all, but only write/update/delete their own
- `activity_reactions`: Same pattern
- Storage bucket `voice-notes`: Authenticated uploads/reads only
- Other tables rely on server-side access control (the Go server uses the service key)

### 6.5 Stored Procedure

`artist_listener_percentile()` — a PL/pgSQL function that calculates a user's percentile rank for plays of a given artist within a configurable window (default 30 days). Used for the compatibility scoring.

---

## 7. External Service Integrations

### 7.1 Spotify Integration

The Spotify integration is the most complex subsystem in the backend, comprising 6 files in `internal/spotify/`.

#### 7.1.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                  Spotify Subsystem                        │
│                                                          │
│  ┌───────────────┐                                       │
│  │  Routes       │  HTTP Handlers for API endpoints      │
│  │  (routes.go)  │  • /connect, /exchange-code           │
│  │               │  • /now-playing, /recent              │
│  │               │  • /top-tracks, /top-artists          │
│  │               │  • /on-repeat, /recommendations       │
│  └───────┬───────┘                                       │
│          │                                               │
│          ▼                                               │
│  ┌───────────────┐                                       │
│  │  Connection   │  Token management, refresh,           │
│  │  (connection  │  authorized client creation           │
│  │   .go)        │                                       │
│  └───────┬───────┘                                       │
│          │                                               │
│          ▼                                               │
│  ┌───────────────┐  ┌────────────┐  ┌──────────────┐   │
│  │  Spotify      │  │  Cache     │  │  Guard       │   │
│  │  Client       │  │  (cache.go)│  │  (guard.go)  │   │
│  │  (spotify_    │  │  In-memory│  │  Concurrency │   │
│  │   client.go)  │  │  TTL cache│  │  + rate lim.│   │
│  └───────┬───────┘  └────────────┘  └──────────────┘   │
│          │                                               │
│          ▼                                               │
│  ┌───────────────┐                                       │
│  │  Poller       │  Background goroutine that            │
│  │  (poller.go)  │  periodically polls all users         │
│  │               │  and writes to listening_activity     │
│  └───────────────┘                                       │
│                                                          │
│  ┌───────────────┐                                       │
│  │  Errors       │  Spotify API error types              │
│  │  (errors.go)  │  • RateLimitError                    │
│  │               │  • SpotifyAPIError                   │
│  │               │  • SpotifyError (wrapped)             │
│  └───────────────┘                                       │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────┐
│   Spotify Web API  │
│   api.spotify.com  │
└────────────────────┘
```

#### 7.1.2 Spotify Client (`spotify_client.go`)

The `SpotifyClient` struct encapsulates all Spotify Web API interactions:

```go
type SpotifyClient struct {
    UserID      string
    AccessToken string
    HTTPClient  *http.Client  // 10s timeout
}
```

**API Methods:**

| Method | Spotify Endpoint | Cache TTL | Description |
|---|---|---|---|
| `GetCurrentlyPlaying()` | `/me/player/currently-playing` | 30s | Current playback state |
| `GetRecentlyPlayed()` | `/me/player/recently-played?limit=50` | 5min | Recent listening history |
| `GetRecentlyPlayedSince()` | — | N/A | Paginated recent tracks since timestamp |
| `GetTopTracks(timeRange)` | `/me/top/tracks?time_range=xxx&limit=50` | 12h | Top tracks (short/medium/long term) |
| `GetTopArtists(timeRange)` | `/me/top/artists?time_range=xxx&limit=50` | 24h | Top artists with genre enrichment |
| `GetOnRepeatTracks()` | Uses `GetTopTracks(long_term)` | 24h | On-repeat tracks |
| `GetRecommendedTracks()` | Aggregates top tracks across all ranges | 6h | Track recommendations |
| `GetArtistGenres(name)` | `/search?type=artist` | 7d | Genre lookup by name |
| `GetArtistGenresByID(id)` | `/artists/{id}` | 7d | Genre lookup by Spotify ID |
| `GetTrackDetails(id)` | `/tracks/{id}` | 7d | Track metadata |
| `RefreshToken(refreshToken)` | `/api/token` | N/A | OAuth token refresh |
| `RefreshTokenIfNeeded(refreshToken)` | `/me` + refresh | N/A | Conditional refresh |

**Genre Enrichment Pipeline:**

```
GetTopArtists(timeRange)
  └─► GetTopArtistsRaw(timeRange, limit)
        └─► Spotify API: /me/top/artists
        └─► populateMissingGenresInTopArtistResponse()
              ├─► populateMissingGenresFromBatchArtistLookup()
              │     └─► getArtistGenresBatch()  ──► Spotify: /artists?ids=...
              ├─► GetArtistGenresByID(id)       ──► Spotify: /artists/{id}
              └─► GetArtistGenres(name)          ──► Spotify: /search?type=artist
```

#### 7.1.3 Connection Management (`connection.go`)

Manages Spotify OAuth token lifecycle:

- **Retrieve connection** for a user from `spotify_connections` table
- **Auto-refresh tokens** that are expired or about to expire (within 5-minute window)
- **Update** the stored `access_token` and `expires_at` after refresh
- Return authorized `SpotifyClient` instance

```go
func GetAuthorizedClient(userID string) (*SpotifyClient, string, error)
```

Also handles:
- `ExchangeAuthorizationCode(code, redirectURI)` — server-side OAuth code exchange (keeps client secret secure)
- No Spotify connection → returns `ErrNoSpotifyConnection`
- Rate limited → returns `SpotifyRateLimitError` with retry duration

#### 7.1.4 Cache Layer (`cache.go`)

An in-memory, TTL-based cache shared across all Spotify operations:

```go
type sharedCache struct {
    mu      sync.RWMutex
    entries map[string]*cacheEntry
}

type cacheEntry struct {
    value     any
    expiresAt time.Time
    createdAt time.Time
}
```

**Functions:**

| Function | Purpose |
|---|---|
| `getFresh(key)` | Returns value if exists and not expired |
| `set(key, value, ttl)` | Stores with TTL |
| `get(key)` | Returns value and fresh boolean |
| `Delete(key)` | Removes entry |
| `loadSharedResource(cache, key, ttl, loader)` | Generic load-with-cache pattern |

**Cache Keys:**
- Per-user: `<userID>:currently-playing`, `<userID>:recently-played`, `<userID>:top-tracks:<timeRange>`
- Per-user with version: `<userID>:top-artists:v2:<timeRange>`
- Global: `global:artist-genres:<normalized-name>`, `global:artist-genres-id:<spotifyID>`, `global:track-details:<spotifyID>`

**TTL Values:**

| Resource | TTL |
|---|---|
| Currently Playing | 30 seconds |
| Recently Played | 5 minutes |
| Top Tracks | 12 hours |
| Top Artists | 24 hours |
| Recommendations | 6 hours |
| Artist Lookup | 7 days |
| Track Lookup | 7 days |

#### 7.1.5 Rate Limit Guard (`guard.go`)

Protects against Spotify API rate limiting:

- **Semaphore pattern**: Limits concurrent Spotify requests (configurable, default 5)
- **Rate limit detection**: When a 429 response is received, marks guard as rate-limited with a computed retry-after duration
- **Cooldown**: All subsequent requests are blocked until the cooldown expires

```go
type spotifyGuard struct {
    sem       chan struct{}     // Concurrency limiter (5)
    limitedMu sync.RWMutex
    limitedBy map[string]time.Time  // Per-endpoint cool-downs
}
```

#### 7.1.6 Error Handling (`errors.go`)

Custom error types:

| Type | When | Behavior |
|---|---|---|
| `SpotifyRateLimitError` | HTTP 429 | Retry-After header respected |
| `SpotifyAPIError` | Non-200 status | Endpoint + status code |
| `SpotifyError` | Generic | Wrapped error with context |
| `ErrNoSpotifyConnection` | Missing tokens | Graceful degradation |

Helper functions:
- `IsRateLimitError(err)` — checks if error chain contains rate limit
- `RetryAfter(err)` — extracts retry duration
- `isTokenExpiredError(err)` — checks for 401 token expiry
- `isRetryableError(err)` — checks for 500-class errors (for retry logic)

#### 7.1.7 Polling System (`poller.go`)

The poller is a **background goroutine** that continuously tracks what all users are listening to.

**Polling Algorithm:**

```
StartPoller()
└─► pollAllUsers()
    └─► Query all spotify_connections
    └─► For each user:
        ├─► shouldPollUser(userID, now)?
        │     Check UserTrackCache for adaptive interval
        ├─► GetAuthorizedClient(userID)
        ├─► GetCurrentlyPlaying()
        ├─► Compare with cached state
        ├─► IF (track changed OR track stopped AND was playing):
        │     └─► Write listening_activity record
        └─► Update UserTrackCache with new state + next poll time
```

**Adaptive Polling Intervals:**

| State | Interval | Notes |
|---|---|---|
| Actively playing | ~30s | Dynamic based on `progress_ms` |
| Idle (no playback) | Exponential backoff | `ConsecutiveIdle` counter |
| Rate limited | Retry-After duration | From Spotify response |

**UserTrackCache** (per-user in-memory state):

```go
type UserTrackCache struct {
    TrackName       string
    ArtistName      string
    AlbumName       string
    IsPlaying       bool
    LastUpdate      time.Time
    PollInterval    time.Duration
    NextPollAt      time.Time
    ConsecutiveIdle int
}
```

**Track Change Detection:**
- Detects when track name, artist, or album changes
- Detects when playback stops (is_playing transition)
- Only writes to `listening_activity` when a meaningful change occurs
- Updates `synced_at` timestamp on the activity record

**Immediate Poll on Connect:**
When a user connects Spotify via `POST /spotify/exchange-code`, an immediate one-shot poll is triggered:

```go
go func() {
    PollUserActivityNow(userID)  // Runs instantly, not waiting for ticker
}()
```

### 7.2 Last.fm Genre Resolution

**Package:** `internal/lastfm/client.go`

The Last.fm integration serves as a **genre resolution fallback** when Spotify's genre data is incomplete. Many Spotify artists have empty genre arrays — Last.fm tags fill this gap.

#### Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Profile    │───►│  Genre       │───►│  Last.fm     │
│  Module     │    │  Resolver    │    │  Client      │
│             │    │  (priority:  │    │              │
│             │    │   Spotify >  │    │  api.last.fm │
│             │    │   Last.fm)   │    │              │
└─────────────┘    └──────────────┘    └──────────────┘
```

#### Last.fm Client Features

- **API**: `http://ws.audioscrobbler.com/2.0/?method=artist.gettoptags`
- **Auth**: `LASTFM_API_KEY` environment variable
- **Cache**: In-memory TTL cache (7 days for tags)
- **Response parsing**: Extracts top tags, returns as genre strings
- **Normalization**: Lowercases and trims artist names for cache key consistency
- **Logging**: Logs each lookup result (artist, cache status, dominant genre)

```go
func (c *Client) GetArtistGenres(artistName string) ([]string, error)
```

#### Genre Resolver (`profile/genre_resolver.go`)

```go
func (r *GenreResolver) ResolveGenres(artistName string) []string
```

Priority chain:
1. **Spotify** (via `GetArtistGenres` or `GetArtistGenresByID`)
2. **Last.fm** (via `GetArtistGenres` — fallback)
3. Returns empty slice if both fail

The resolver uses `errgroup` (`golang.org/x/sync/errgroup`) for concurrent resolution when dealing with multiple artists.

#### Artist Tag Cache

```go
type artistTagCache struct {
    mu      sync.RWMutex
    entries map[string]artistTagCacheEntry
}

type artistTagCacheEntry struct {
    tags      []string
    expiresAt time.Time
}
```

---

## 8. Core Domain Modules

### 8.1 Activity Module (`internal/activity/routes.go`)

Manages the listening activity feed and commenting system.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/activity/feed` | Get friends' listening activity (paginated) |
| GET | `/activity/user/:userId` | Get a specific user's activity |
| POST | `/activity/:id/comment` | Add comment to an activity |
| GET | `/activity/:id/comments` | Get comments for an activity |

**Feed Algorithm:**
- Queries `listening_activity` joined with friends list
- Returns most recent plays from friends + self
- Paginated with cursor-based or offset pagination

### 8.2 Profile Module (`internal/profile/routes.go`)

User profile data, stats, and genre resolution.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/profile/:userId` | Get user profile |
| GET | `/profile/:userId/stats` | Get listening stats |
| GET | `/profile/:userId/top-artists` | Get user's top artists |
| GET | `/profile/:userId/top-genres` | Get user's top genres |

**Genre Resolution:**
- Uses `GenreResolver` which chains Spotify → Last.fm
- Caches results aggressively (7-day TTL for artist lookups)
- Resolves genres for top artists to build genre profiles

### 8.3 Compatibility Module (`internal/compatibility/routes.go`)

Calculates music taste compatibility between users.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/compatibility/:userId` | Get compatibility score with another user |
| GET | `/compatibility/friends` | Get compatibility scores for all friends |

**Scoring Algorithm:**
- Compares top artists overlap between two users
- Uses `artist_listener_percentile()` stored procedure
- Factors in genre overlap
- Returns percentage score and shared artists/genres

### 8.4 Friends Module (`internal/friends/routes.go` & `service.go`)

Social graph management.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/friends` | Get friend list |
| POST | `/friends/request` | Send friend request |
| POST | `/friends/accept` | Accept friend request |
| POST | `/friends/reject` | Reject friend request |
| DELETE | `/friends/:friendId` | Remove friend |
| GET | `/friends/search` | Search users by username |

**Service Layer (`service.go`):**
- `GetFriendsWithActivity(userID)` — fetches friends with their current listening state
- Uses Supabase queries with joins to enrich friend data

### 8.5 Messages Module (`internal/messages/routes.go`)

Direct messaging with text, voice notes, and track sharing.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/messages/:friendId` | Get conversation thread |
| POST | `/messages/:friendId` | Send a message |
| GET | `/messages/conversations` | List all conversations |

**Message Types:**
- `text` — Standard text message
- `voice` — Voice note (audio stored in Supabase Storage `voice-notes` bucket)
- `track` — Shared track (metadata in `track_metadata` JSONB column)

### 8.6 Notifications Module (`internal/notifications/routes.go`, `push.go`, `listening.go`)

Push notifications and in-app notifications.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | Get user's notifications |
| POST | `/notifications/read` | Mark notifications as read |
| POST | `/notifications/push-token` | Register Expo push token |
| DELETE | `/notifications/push-token` | Remove push token |

**Push Notifications (`push.go`):**
- Sends notifications via **Expo Push Notification API** (`https://exp.host/--/api/v2/push/send`)
- Batches notifications for multiple recipients
- Handles Expo push token errors (invalid, expired)
- Triggers on: new message, friend request, reaction, comment

**Listening Insights (`listening.go`):**
- Scheduled background goroutine (`StartListeningInsightsScheduler()`)
- Conditionally enabled via `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER` env var
- Sends periodic listening summary digests

### 8.7 Reactions Module (`internal/reactions/routes.go`)

Reactions to listening activities (emote-style).

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| POST | `/reactions` | Add/update reaction |
| DELETE | `/reactions/:id` | Remove reaction |
| GET | `/reactions/:activityId` | Get reactions for an activity |

**Reaction Types (DB-enforced CHECK):**
- `love` ❤️
- `fire` 🔥
- `headphones` 🎧

### 8.8 Chen AI Conversations Module (`internal/chen/routes.go`)

AI-powered conversations about music (ChatGPT-style).

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| POST | `/chen/message` | Send a message to Chen AI |
| GET | `/chen/history` | Get conversation history |

**Storage:**
- Conversations stored as JSONB in `chen_conversations` table
- Each user has one conversation record
- Messages array: `[{role, content, timestamp}]`

### 8.9 Referrals Module (`internal/referrals/routes.go`)

Referral system for unlocking features.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| POST | `/referrals/claim` | Claim a referral code |
| GET | `/referrals/unlocks` | Get user's unlocked features |

**Perk System:**
- Referrals unlock features (themes, top artist slots, voice notes)
- `ThemeAccessible(userID, theme)` — checks if theme is unlocked
- `AllowedTopArtistCount(userID)` — returns number of top artist slots
- `IsSuperUser(userID)` — checks the `is_super_user` flag (bypasses all gates)
- Perk tracking in `referral_completions` table with `perk_key`

### 8.10 Payments Module (`internal/payments/routes.go`)

Premium subscription payments (likely Stripe).

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| POST | `/payments/create-intent` | Create payment intent |
| POST | `/payments/webhook` | Stripe webhook handler |
| GET | `/payments/subscription` | Get subscription status |

### 8.11 Admin Module (`internal/admin/routes.go`)

Super-user administration endpoints.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| POST | `/admin/users/:id/superuser` | Toggle super user flag |
| POST | `/admin/users/:id/premium` | Toggle premium status |
| GET | `/admin/stats` | Platform statistics |

**Auth:** Uses `AdminMiddleware` which checks `Admin-Secret` header against `ADMIN_SECRET` env var.

---

## 9. Background Workers & Polling

### 9.1 Spotify Poller (Primary)

**Startup:** `go spotify.StartPoller()` in `main()`

| Property | Value |
|---|---|
| Frequency | Every `pollerTickInterval` (~30s) |
| Scope | All users with active `spotify_connections` |
| Data written | `listening_activity` table |
| State management | In-memory `UserTrackCache` map |

### 9.2 Listening Insights Scheduler

**Startup:** `go notifications.StartListeningInsightsScheduler()` (conditional)

| Property | Value |
|---|---|
| Trigger | `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER=true` |
| Frequency | Periodic (daily or configurable) |
| Purpose | Sends listening summary push notifications |

### 9.3 Ad-Hoc Goroutines

- **Immediate post-connect poll** — triggered on Spotify code exchange
- Notifications are sent synchronously within request handlers (no separate notification worker queue)

---

## 10. Data Flow Diagrams

### 10.1 User Connects Spotify

```
Mobile App                                        Chen Server                              Spotify API
     │                                                │                                        │
     │ 1. OAuth login (Spotify)                       │                                        │
     │────────────────────────────────────────────────────────────────────────────────►        │
     │◄────────────────────────────────────────────────────────────────────────────────        │
     │ 2. Auth code received                          │                                        │
     │                                                │                                        │
     │ 3. POST /spotify/exchange-code                 │                                        │
     │    { code, redirect_uri, username, avatar }    │                                        │
     │───────────────────────────────────────────────►│                                        │
     │                                                │                                        │
     │                                                │ 4. POST /api/token                     │
     │                                                │    { grant_type: auth_code }            │
     │                                                │───────────────────────────────────────►│
     │                                                │◄───────────────────────────────────────│
     │                                                │    { access_token, refresh_token,      │
     │                                                │      expires_in }                      │
     │                                                │                                        │
     │                                                │ 5. Upsert spotify_connections          │
     │                                                │    (Supabase)                          │
     │                                                │                                        │
     │                                                │ 6. Update username/avatar in users     │
     │                                                │    (if provided)                       │
     │                                                │                                        │
     │                                                │ 7. go PollUserActivityNow(userID)     │
     │                                                │    ┌──────────────────┐                │
     │                                                │    │ GET /me/player/  │                │
     │                                                │    │ currently-playing│                │
     │◄───────────────────────────────────────────────│    └────────┬─────────┘                │
     │ 8. { message: "connected" }                    │             │                          │
     │                                                │             ▼                          │
     │                                                │    Write listening_activity            │
     │                                                │    (Supabase)                          │
```

### 10.2 Background Polling Cycle

```
Every ~30 seconds (pollerTickInterval):
┌─────────────────────────────────────┐
│ pollAllUsers()                      │
│                                     │
│ 1. SELECT user_id FROM              │
│    spotify_connections              │
│    (Supabase)                       │
│                                     │
│ 2. For each user:                   │
│    ├─► shouldPollUser(userID)?     │
│    │   └─► Check UserTrackCache    │
│    │       for adaptive interval    │
│    │                                │
│    ├─► GetAuthorizedClient(userID) │
│    │   ├─► Query spotify_connections│
│    │   ├─► Check token expiry       │
│    │   └─► Refresh if needed        │
│    │                                │
│    ├─► GET /me/player/currently-   │
│    │    playing (Spotify API)       │
│    │                                │
│    └─► Compare with cached state:  │
│        ├─► Track changed?           │
│        ├─► Playing → stopped?       │
│        └─► Write activity if change │
│                                     │
│ 3. Update UserTrackCache for each   │
│    user (NextPollAt, interval)      │
└─────────────────────────────────────┘
```

### 10.3 Genre Resolution Flow

```
Profile/Top Artists Request
        │
        ▼
GetTopArtistsRaw(timeRange)
        │
        ▼
Spotify API: /me/top/artists
        │
        ▼
populateMissingGenresInTopArtistResponse()
        │
        ├──► Batch lookup (up to 50 IDs)
        │     └─► Spotify: /artists?ids=...
        │         └─► Cache each result (7d TTL)
        │
        ├──► Individual lookup by ID
        │     ├─► Check cache (global:artist-genres-id:<id>)
        │     ├─► Spotify: /artists/{id}
        │     └─► Cache result (7d TTL)
        │
        └──► Individual lookup by name (last resort)
              ├─► Check cache (global:artist-genres:<name>)
              ├─► Spotify: /search?type=artist
              │          OR
              ├─► Last.fm: artist.gettoptags (fallback)
              └─► Cache result (7d TTL)

        │
        ▼
Profile module returns enriched artist data with genres
```

### 10.4 Message Flow (Direct + Voice)

```
User A                                Chen Server                         Supabase                  Expo
  │                                       │                                │                         │
  │ 1. POST /messages/:friendId           │                                │                         │
  │    { content, message_type,           │                                │                         │
  │      audio_url (optional) }           │                                │                         │
  │──────────────────────────────────────►│                                │                         │
  │                                       │ 2. INSERT direct_messages      │                         │
  │                                       │───────────────────────────────►│                         │
  │                                       │                                │                         │
  │                                       │ 3. Query User B's push tokens │                         │
  │                                       │───────────────────────────────►│                         │
  │                                       │◄───────────────────────────────│                         │
  │                                       │                                │                         │
  │                                       │ 4. POST /push/send            │                         │
  │                                       │────────────────────────────────────────────────────────►│
  │◄──────────────────────────────────────│                                │                         │
  │ 5. { message: "sent" }               │                                │                         │
```

---

## 11. Caching Strategy

### 11.1 Cache Layers

| Layer | Location | Scope | TTL Pattern |
|---|---|---|---|
| **In-Memory** | `spotify/cache.go` | Shared across requests (process-wide) | Fixed per resource (30s–7d) |
| **In-Memory** | `lastfm/client.go` | Per Last.fm client | 7 days (artist tags) |
| **In-Memory** | `poller.go` | Per-user state map | Continuous (adaptive) |
| **Supabase** | — | Persistent storage | N/A |

### 11.2 In-Memory Cache Details

```
sharedCache (sync.RWMutex protected)
├── Per-User Keys:    <userID>:<endpoint>:<params>
├── Global Keys:      global:<resource>:<identifier>
└── Entry:            { value, expiresAt, createdAt }
```

### 11.3 Cache Invalidation

- **Forced refresh**: `GET /spotify/top-artists?fresh=true` invalidates top-artist caches for that user
- **Cache-busting on genre enrichment**: If cached top artist data has no genres, cache is purged and re-fetched
- **TTL-based expiry**: All entries auto-expire based on their TTL
- **No write-through**: The poller directly writes to DB without invalidating read caches (acceptable staleness for activity data)

---

## 12. Rate Limiting & Resilience

### 12.1 Spotify Rate Limit Protection

| Mechanism | Implementation |
|---|---|
| **Concurrency Semaphore** | Buffered channel (capacity: 5) — limits parallel Spotify requests |
| **Endpoint Cooldowns** | Per-endpoint cool-down map prevents retry storms after 429 |
| **Retry with Backoff** | `retryWithBackoff()` — exponential backoff for transient failures |
| **Graceful Degradation** | Rate-limited endpoints return empty/null results instead of errors |

### 12.2 Error Resilience Patterns

| Pattern | Usage |
|---|---|
| **Retry with backoff** | All Spotify API calls, token refresh |
| **Graceful degradation** | Missing Spotify connection → empty results (not errors) |
| **Non-fatal error handling** | Profile update failure during connect → log and continue |
| **Goroutine isolation** | Poller errors don't crash the server (per-user isolation) |
| **Conditional signature verification** | JWT verification skipped in dev, enforced in prod |

### 12.3 Concurrency Model

```
┌──────────────────────────────────────────────────┐
│                   main()                          │
│                                                   │
│  ┌──────────────────┐  ┌─────────────────────┐   │
│  │   Gin HTTP       │  │   Spotify Poller    │   │
│  │   Server         │  │   (1 goroutine)     │   │
│  │   (goroutine)    │  │                     │   │
│  └────────┬─────────┘  └──────────┬──────────┘   │
│           │                       │               │
│           ▼                       ▼               │
│    ┌──────────────┐       ┌──────────────┐       │
│    │ Request      │       │ pollAllUsers │       │
│    │ Handlers     │       │ (sequential  │       │
│    │ (goroutines) │       │  per tick)   │       │
│    └──────────────┘       └──────────────┘       │
│           │                       │               │
│           ▼                       ▼               │
│    ┌──────────────────────────────────────┐       │
│    │       Spotify API Calls              │       │
│    │       (bounded by guard semaphore)   │       │
│    └──────────────────────────────────────┘       │
│                                                   │
│  ┌──────────────────────────────────────┐         │
│  │    Supabase DB Queries              │         │
│  │    (via PostgREST, unbounded)       │         │
│  └──────────────────────────────────────┘         │
└──────────────────────────────────────────────────┘
```

---

## 13. Configuration & Environment

### 13.1 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 5001) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `SUPABASE_JWT_SECRET` | Prod | JWT signing secret (required in production) |
| `APP_ENV` | No | `production` or `development` |
| `VERIFY_SUPABASE_JWT` | No | Force JWT verification in dev |
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret |
| `LASTFM_API_KEY` | No | Last.fm API key (genre fallback) |
| `ADMIN_SECRET` | Yes | Admin API secret key |
| `ENABLE_LISTENING_NOTIFICATIONS_SCHEDULER` | No | Enable scheduled listening insights |

### 13.2 Supabase Configuration

The server connects with the **service role key** (admin privileges). This means:
- All DB operations bypass Row-Level Security (RLS)
- The server is responsible for all authorization logic
- The mobile app uses anonymous/an authenticated role for direct Supabase interactions (auth, storage)

---

## 14. API Endpoint Reference

### 14.1 Public Endpoints (No Auth Required)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/swagger/*any` | Swagger UI |
| GET | `/docs/*any` | Swagger UI (alias) |
| POST | `/api/v1/auth/callback` | OAuth callback |
| POST | `/api/v1/auth/signout` | Sign out |

### 14.2 Protected Endpoints (JWT Required)

#### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/auth/user` | Get current user profile |
| POST | `/api/v1/auth/user` | Update user profile |

#### Spotify
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/spotify/connect` | Connect Spotify (with tokens) |
| POST | `/api/v1/spotify/exchange-code` | OAuth code exchange (server-side) |
| GET | `/api/v1/spotify/now-playing` | Currently playing track |
| GET | `/api/v1/spotify/recent` | Recently played (last 10) |
| GET | `/api/v1/spotify/top-tracks` | Top tracks (query: `time_range`) |
| GET | `/api/v1/spotify/top-artists` | Top artists (query: `time_range`, `limit`, `fresh`) |
| GET | `/api/v1/spotify/on-repeat` | On-repeat tracks |
| GET | `/api/v1/spotify/recommendations` | Track recommendations |

#### Friends
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/friends` | Get friends list |
| POST | `/api/v1/friends/request` | Send friend request |
| POST | `/api/v1/friends/accept` | Accept friend request |
| POST | `/api/v1/friends/reject` | Reject friend request |
| DELETE | `/api/v1/friends/:friendId` | Remove friend |
| GET | `/api/v1/friends/search` | Search users |

#### Activity
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/activity/feed` | Friends' activity feed |
| GET | `/api/v1/activity/user/:userId` | User's activity |
| POST | `/api/v1/activity/:id/comment` | Comment on activity |
| GET | `/api/v1/activity/:id/comments` | Get comments |

#### Profile
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/profile/:userId` | Get user profile |
| GET | `/api/v1/profile/:userId/stats` | Get listening stats |
| GET | `/api/v1/profile/:userId/top-artists` | Get top artists |
| GET | `/api/v1/profile/:userId/top-genres` | Get top genres |

#### Compatibility
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/compatibility/:userId` | Compatibility with user |
| GET | `/api/v1/compatibility/friends` | Compatibility with all friends |

#### Messages
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/messages/:friendId` | Conversation thread |
| POST | `/api/v1/messages/:friendId` | Send message |
| GET | `/api/v1/messages/conversations` | List conversations |

#### Notifications
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/notifications` | Get notifications |
| POST | `/api/v1/notifications/read` | Mark as read |
| POST | `/api/v1/notifications/push-token` | Register push token |
| DELETE | `/api/v1/notifications/push-token` | Remove push token |

#### Reactions
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/reactions` | Add/update reaction |
| DELETE | `/api/v1/reactions/:id` | Remove reaction |
| GET | `/api/v1/reactions/:activityId` | Get reactions |

#### Chen AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/chen/message` | Send AI message |
| GET | `/api/v1/chen/history` | Get conversation history |

#### Referrals
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/referrals/claim` | Claim referral code |
| GET | `/api/v1/referrals/unlocks` | Get unlocked features |

### 14.3 Admin Endpoints (Admin Secret Required)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/users` | List all users |
| POST | `/admin/users/:id/superuser` | Toggle super user |
| POST | `/admin/users/:id/premium` | Toggle premium |
| GET | `/admin/stats` | Platform stats |

---

## Appendix A: Migration Summary

| Migration # | File | Purpose |
|---|---|---|
| 1 | `create_notifications_and_direct_messages.sql` | Core messaging & notification tables |
| 2 | `create_chen_conversations.sql` | AI conversation storage |
| 3 | `create_comments_table.sql` | Activity comments (with RLS, triggers) |
| 4 | `add_listening_activity_track_metadata.sql` | Track ID, Spotify URL, preview URL |
| 5 | `fix_listening_activity_schema.sql` | Schema cleanup (rename artist, add played_at) |
| 6 | `add_activity_comments.sql` | Parent comment support (threading) |
| 7 | `add_activity_engagement.sql` | Activity reactions with CHECK constraint |
| 8 | `add_artist_listener_percentile.sql` | Stored procedure for percentile calculation |
| 9 | `add_push_tokens_table.sql` | Expo push token registration |
| 10 | `add_referral_unlocks.sql` | Referral codes, theme preferences, completions |
| 11 | `add_super_user_flag.sql` | Admin feature flag |
| 12 | `add_user_tag_column.sql` | Unique user tags |
| 13 | `add_username_unique_constraint.sql` | Unique usernames (with dedup) |
| 14 | `add_voice_notes_to_direct_messages.sql` | Voice note support + storage bucket |
| 15 | `add_track_replies_to_direct_messages.sql` | Track metadata in messages |
| 16 | `fix_listening_activity_track_id_type.sql` | Fix track ID type/constraint |
| 17 | `add_voice_note_read_policy.sql` | Storage read policy for voice notes |

## Appendix B: Key Design Decisions

1. **Monolith over microservices** — The app is early-stage; a monolith reduces complexity, deployment overhead, and latency.
2. **Supabase over raw PostgreSQL** — Leverages managed auth, storage, and real-time features; Go SDK wraps PostgREST.
3. **In-memory cache over Redis** — Simpler deployment; no external dependency; acceptable for single-instance deployment.
4. **Polling over Webhooks for Spotify** — Spotify doesn't provide real-time webhooks for listening activity; polling is the only option.
5. **Adaptive polling intervals** — Reduces Spotify API calls during idle periods; more responsive during active listening.
6. **Server-side token exchange** — Spotify client secret never exposed to the mobile app.
7. **Last.fm as genre fallback** — Many Spotify artists lack genre data; Last.fm community tags fill the gap.
8. **Conditional JWT verification** — Enables local development without Supabase JWT secret.
9. **Service role key for server** — Server manages authorization; avoids RLS complexity for server-side operations.
10. **JSONB for flexible schemas** — Notifications metadata, Chen conversations, and track sharing use JSONB for schema flexibility.

---

*End of System Design Document*