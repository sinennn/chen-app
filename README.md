# Chen — Social Music Platform | Technical Deep Dive

Chen is a next-generation, AI-powered social music platform engineered for global scale and cultural impact. Chen’s backend is a showcase of modern distributed systems, real-time data streaming, and secure, modular architecture—built to impress both users and technical audiences.

## Why Chen Stands Out

**Full-Stack Innovation:**
- Frontend: React Native (Expo), NativeWind, TypeScript, glassmorphism UI, 60fps animations  
- Backend: Golang (Gin), Supabase (PostgreSQL + Realtime), Groq (Llama 3), Paystack, Expo Push  

**Global-Ready, Culturally Rooted:**  
Nigeria-focused, but architected for international scale  

**AI at the Core:**  
Context-aware music conversations powered by Llama 3, with real-time context injection and streaming responses  

**Real-Time Social Graph:**  
See what friends are listening to instantly across Spotify, Apple Music, and Audiomack  

**Enterprise-Grade Security:**  
RLS, token encryption, HMAC webhooks, and strict secret management  

**Monetization-Ready:**  
Freemium model, Paystack billing, premium features, and usage analytics  

---

## Backend Architecture: Built for Scale & Speed

**Golang + Gin:**  
Ultra-fast, concurrent HTTP server with modular, domain-driven design. Each feature is an isolated package with clear API boundaries.

**Supabase (PostgreSQL):**
- Managed Postgres with instant Realtime subscriptions  
- Row Level Security (RLS) on every table for NDPC compliance  
- Auth, storage, and policy-driven access  

**Groq (Llama 3):**
- State-of-the-art LLM for music-aware chat  
- Context injection:
  - User’s track  
  - Friends’ tracks  
  - Top artists  
  - Compatibility  
  - Conversation memory  
- Token streaming for real-time UX  

**Paystack:**
- Webhook-driven premium status  
- Subscription lifecycle management  

**Expo Push:**
- Unified push notifications for iOS and Android  
- Triggered by backend events (friend activity, requests, compatibility updates)  

---

## Key Modules

### Real-Time Data Flow: Zero-Latency Social

- Backend polling using Gin goroutines every 30 seconds per user  
- Atomic writes to `listening_activity` (Supabase)  
- Instant broadcast via Supabase Realtime  
- Client sync with immediate UI updates (no polling, no lag)  

---

### AI Module (“Chen”): Contextual, Streaming, Human

**Context Injection:**
- User’s current track  
- Friends’ current tracks  
- Top artists (30 days)  
- Compatibility scores  
- Last 20 messages (memory)  

**Streaming:**
- Llama 3 responses streamed token-by-token for real-time chat  

**Rate Limiting:**
- 10 messages/day (free)  
- Unlimited (premium)  

---

## Security & Compliance: Enterprise-Grade

- Row Level Security (RLS) on all Supabase tables  
- OAuth tokens encrypted at rest  
- All secrets stored in `.env` (never committed)  
- Paystack webhooks verified with HMAC  
- Strict rate limiting on AI and API endpoints  
- Full audit logging for access and actions  

---

## Build & Run

**Install dependencies**

**Start the app**

**Backend:**
- See `server/chen_backend.md` for Go backend setup and API docs  
- Copy `.env.example` to `.env` and configure secrets  

---

## Chen, essentially

- Distributed, modular backend with real-time streaming and AI integration  
- Security-first architecture with RLS, encryption, and compliance practices  
- Premium user experience with high-performance UI and cultural theming  
- Scalable, testable, and production-ready system design  
- Clear separation of concerns and modern codebase structure  