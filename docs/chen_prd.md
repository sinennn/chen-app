**CHEN**

Product Requirements Document

_v1.0 - MVP_

Author: Sy | Stack: React Native (Expo) + Golang/Gin + Supabase

_Your friends are your playlist. 🎵_

# **1\. Product Overview**

Chen is a social music app built for Nigerian users - and music lovers everywhere - that shows what your friends are listening to in real time. It combines social discovery, AI companionship, and expressive design into a single cohesive experience that is more alluring, more alive, and more culturally rooted than anything currently available in the market.

Chen fills the vacuum left by Airbuds in Nigeria following its ban, with a deliberate focus on making the UI feel premium, ethereal, and distinctly Nigerian without being exclusionary. The AI companion - also named Chen - ties the product together by giving users a musical personality that knows their taste intimately.

| **Attribute** | **Detail** |
| --- | --- |
| Platform | iOS + Android (React Native Expo) |
| Backend | Golang + Gin + Supabase (PostgreSQL) |
| Primary Market | Nigeria (global-ready architecture) |
| Music Platforms | Spotify (MVP), Audiomack (MVP), Apple Music (v1.1) |
| Monetisation | Freemium - ₦900/month via Paystack |
| AI Model | Groq (Llama 3) for speed and free tier |
| Voice (v1.1) | ElevenLabs voice clone of real person named Chen |
| Target Users | 18-30 year old Nigerian music listeners |

# **2\. Design Philosophy**

Chen's UI is the product's most important differentiator. The design language is built around three words: ethereal, alluring, stimulating. Every screen, animation, and interaction should feel like listening to music at 2am with the lights off - warm, intimate, alive.

## **2.1 Visual Language**

| **Principle** | **Application** |
| --- | --- |
| Dark & Warm | Background #0D0B09 - not pure black. Warm dark with subtle brown undertones. Feels like midnight, not a void. |
| Dusty Orange Accent | #E8640A bleeds through the entire app. Glows, borders, active states, highlights. This color IS Chen. |
| Album Art Bleeds | When music is playing, the dominant color from the album art bleeds into the card background dynamically. Alive, reactive. |
| Glassmorphism Cards | Frosted glass effect on activity cards. Background blur + semi-transparent fill + orange border glow. |
| Micro-animations | Everything moves. Pulsing rings on active listeners. Spring animations on interactions. Smooth transitions between screens. |
| No Sharp Edges | Heavy use of border-radius. Rounded cards, pill-shaped tags, circular avatars with glowing rings. |
| Typography Hierarchy | Bold expressive display font for headings. Clean readable sans-serif for body. Size contrast tells the story. |

## **2.2 Theme System**

Users can personalise Chen with themes. Each theme changes the accent color and background mood. Free users get 2 themes, premium users get all 5 plus future exclusive drops.

| **Theme** | **Accent / Background / Mood** |
| --- | --- |
| Chen (Default) | #E8640A / #0D0B09 - Warm, dusty, grounded. The default Chen experience. |
| Lagos Night | #7C3AED / #08060F - Deep purple, electric. Late night Lekki energy. |
| Harmattan | #D4A017 / #0F0D08 - Golden amber. Dry season dust and warmth. |
| Midnight Afro | #00BFA5 / #060F0D - Cool teal. Amapiano at sunrise. |
| Atilola Red | #E74C3C / #0F0706 - Bold red. Afrobeats festival season. |

## **2.3 Animation Principles**

- Spring physics on all interactive elements - buttons, cards, modals feel physical not mechanical
- Pulse animation on avatar rings of currently-playing users - 2s ease-in-out infinite
- Album art color extraction drives card background transitions - smooth 500ms crossfade
- Screen transitions use shared element transitions where possible
- Skeleton loaders on all async content - never show empty states, always show loading states
- Haptic feedback on all meaningful interactions - likes, sends, friend accepts

# **3\. Information Architecture**

Chen uses Expo Router for file-based navigation. The app has two main navigation zones - the auth flow for unauthenticated users, and the main tab bar for authenticated users.

| **Route** | **Description** |
| --- | --- |
| (auth)/welcome | Splash/welcome screen with Chen branding |
| (auth)/login | Email/Google login via Supabase Auth |
| (auth)/signup | New account creation |
| (auth)/onboarding | Username, avatar picker, connect Spotify |
| (tabs)/index | Home feed - friend activity in real time |
| (tabs)/friends | Friends list, requests, search, compatibility |
| (tabs)/chen | Chen AI chat interface |
| (tabs)/profile | User profile, themes, settings, subscription |
| messages/\[friendId\] | DM thread with a specific friend |
| player/\[trackId\] | Expanded now-playing view |

# **4\. Screen Specifications - Frontend**

Each screen specification covers purpose, key components, interactions, and the specific design details that make it feel premium. These specs are the source of truth for UI generation prompts.

## **4.1 Onboarding Flow**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Welcome Screen</strong> (auth)/welcome</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>First impression of Chen. Sets the aesthetic tone. Users who see this screen should immediately feel the premium, ethereal quality of the app and want to sign up.</p><p><strong>Key Components</strong></p><ul><li>Full screen dark background (#0D0B09) with subtle warm gradient</li><li>Animated Chen logo - the dusty orange ring slowly rotating and pulsing</li><li>App name 'chen' in lowercase, bold display font, white</li><li>Tagline: 'your friends are your playlist' in muted orange</li><li>Two CTAs: 'Get Started' (orange filled button) and 'I have an account' (ghost button)</li><li>Subtle floating music note particles in background (very subtle, not distracting)</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Logo ring pulses gently on entry with spring animation</li><li>Text fades in sequentially - logo first, name second, tagline third, buttons last</li><li>Get Started button has orange glow shadow that pulses</li><li>Haptic feedback on button press</li></ul></td></tr></tbody></table></div>

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Avatar Picker</strong> (auth)/onboarding - step 2</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>Users choose their DiceBear illustrated avatar. This screen should feel fun and personalised - like choosing your character. No photos, no catfishing.</p><p><strong>Key Components</strong></p><ul><li>Grid of 16 avatar options (DiceBear adventurer style, varied seeds)</li><li>Each avatar in a circular card with subtle dark background</li><li>Selected avatar has orange ring glow around it</li><li>Refresh button to generate 16 new random avatars</li><li>Large preview of selected avatar at top of screen</li><li>Continue CTA at bottom, disabled until avatar selected</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Tap avatar - spring scale animation, orange ring appears with glow</li><li>Refresh button - cards flip/fade out and new ones fade in</li><li>Selected avatar floats slightly (subtle translateY animation)</li><li>Preview avatar at top crossfades when selection changes</li></ul></td></tr></tbody></table></div>

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Connect Spotify</strong> (auth)/onboarding - step 3</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>Users connect their Spotify account. This is the critical integration step. Must feel trustworthy and explain clearly why we need access.</p><p><strong>Key Components</strong></p><ul><li>Spotify logo + Chen logo with a connecting animation between them</li><li>Short explanation: what we access (currently playing, listening history) and what we never do (control playback, access payment info)</li><li>Large 'Connect Spotify' button in Spotify green</li><li>'Skip for now' link below (allows app access without Spotify, limited experience)</li><li>Privacy reassurance text in muted color</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>The connecting animation between logos plays on screen entry</li><li>Button press triggers Spotify OAuth in browser/webview</li><li>Success state - checkmark animation, brief celebration, then advance</li><li>Error state - shake animation on button, error message</li></ul></td></tr></tbody></table></div>

## **4.2 Home Feed**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Home Feed</strong> (tabs)/index</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>The heart of Chen. Shows what friends are listening to right now. This is the screen users will spend most time on. It must be beautiful, fast, and feel alive. The album art color bleeding into cards is the signature visual feature.</p><p><strong>Key Components</strong></p><ul><li>Header: 'chen' wordmark left, notification bell right</li><li>Currently playing banner - if current user is playing something, subtle banner at top showing their own track</li><li>Friend activity cards - scrollable vertical feed</li><li>Each card contains: avatar with pulse ring (if playing), username, track name, artist, album art thumbnail, platform badge (Spotify/Audiomack), time ago, reaction bar</li><li>Album art dominant color bleeds into card background (dynamic color extraction)</li><li>Empty state: 'Your friends are quiet right now' with Chen suggestion to discover music</li><li>Floating Chen button (bottom right) - quick access to ask Chen about the feed</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Cards animate in with slideUp + fadeIn on initial load</li><li>New activity cards slide in from top with spring animation - no jarring full refresh</li><li>Avatar ring pulses continuously while friend is actively playing</li><li>Tap album art - expands to full player view with shared element transition</li><li>Long press card - reaction picker appears (🔥❤️😭🤯👏)</li><li>Reaction appears with burst animation, floats up and fades</li><li>Pull to refresh - custom Chen-branded refresh indicator (the orange ring spinning)</li><li>Swipe card right - quick message friend about the track</li></ul></td></tr></tbody></table></div>

## **4.3 Friends Screen**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Friends Screen</strong> (tabs)/friends</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>Discover and manage your music network. Shows friends, their compatibility scores, and lets you find new people. The compatibility score is a key social hook.</p><p><strong>Key Components</strong></p><ul><li>Search bar at top - search by username</li><li>Three sections: Online Now (currently playing), My Friends (full list), Pending Requests</li><li>Friend card: avatar, username, compatibility score badge (e.g. 87% match), current/last track</li><li>Compatibility score shown as colored badge - green 70%+, orange 40-70%, muted below 40%</li><li>Pending requests section with accept/decline buttons</li><li>Add friend button - opens search</li><li>Empty state with prompt to find friends</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Compatibility score badge animates in with counter (0 → score) on first view</li><li>Accept friend request - card slides in to friends list with spring animation</li><li>Decline - card slides out with fade</li><li>Tap friend - goes to their mini profile with listening history and compatibility breakdown</li><li>Online Now section updates in real time via Supabase Realtime</li></ul></td></tr></tbody></table></div>

## **4.4 Chen AI Screen**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Chen Chat</strong> (tabs)/chen</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>The AI companion interface. Chen knows what you and your friends are listening to and can have genuinely useful music conversations. This screen should feel intimate and slightly magical - like texting a friend who knows music better than anyone.</p><p><strong>Key Components</strong></p><ul><li>Chen avatar at top - animated, alive, reacts to messages</li><li>Chat bubbles: user messages right (orange), Chen messages left (dark card)</li><li>Chen message cards have subtle orange left border</li><li>Typing indicator - three pulsing dots in Chen's colors while response generates</li><li>Streaming text - Chen's response appears word by word (streaming from Groq)</li><li>Context bar at top - shows what user is currently playing (if anything)</li><li>Quick prompts: suggestion chips for common questions ('What should I listen to?', 'Who do I vibe with most?', 'Explain my music taste')</li><li>Premium badge on unlimited message CTA for free users</li><li>Message input with send button</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Chen avatar blinks and subtly animates between messages</li><li>User message slides in from right with spring</li><li>Chen response streams in character by character - feels alive</li><li>Typing indicator bounces while waiting for response</li><li>Quick prompt chips scroll horizontally, tap to send instantly</li><li>10 message limit for free users - soft paywall appears with upgrade prompt after limit</li><li>Haptic feedback on send and on receiving Chen response</li></ul></td></tr></tbody></table></div>

## **4.5 Profile Screen**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>Profile Screen</strong> (tabs)/profile</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>Personal space. Shows listening stats, manages account, picks themes, and handles subscription. Should feel like a dashboard of your musical identity.</p><p><strong>Key Components</strong></p><ul><li>Large avatar at top with username and bio</li><li>Stats row: Friends count, Tracks played this week, Compatibility avg</li><li>Currently playing card (if active)</li><li>Listening history - recent tracks in a clean list</li><li>Themes section - horizontal scroll of theme previews, tap to apply</li><li>Premium section - current plan, upgrade CTA for free users</li><li>Connected platforms (Spotify connected badge, Audiomack badge)</li><li>Settings: Edit profile, Notifications, Privacy, Sign out</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Theme preview cards show live color preview - tap applies instantly with smooth color transition across entire app</li><li>Stats animate in with counter on screen enter</li><li>Premium upgrade CTA has subtle shimmer animation</li><li>Disconnect/connect platform toggles with confirmation</li><li>Sign out requires confirmation bottom sheet</li></ul></td></tr></tbody></table></div>

## **4.6 Messages Screen**

<div class="joplin-table-wrapper"><table><tbody><tr><th><p><strong>DM Thread</strong> messages/[friendId]</p></th></tr><tr><td><p><strong>Purpose</strong></p><p>Direct messaging between friends. Text and voice notes only - no images, no catfishing. Intimate and fast. The voice note feature is a key differentiator.</p><p><strong>Key Components</strong></p><ul><li>Friend's avatar and name in header with currently playing track subtitle</li><li>Chat bubbles - text messages standard</li><li>Voice note bubbles: waveform visualisation, play button, duration, playback progress bar</li><li>Message input bar with: text input, voice note record button (hold to record)</li><li>Recording state: pulsing red indicator, waveform preview, swipe to cancel</li><li>Read receipts - subtle tick marks</li><li>Reaction on messages - long press to react with emoji</li></ul><p><strong>Interactions &amp; Animations</strong></p><ul><li>Hold voice note button - recording starts with haptic, waveform animates</li><li>Release to send - voice note uploads to Supabase Storage, sends</li><li>Swipe left while recording - cancels with animation</li><li>Voice note playback - waveform animates as audio plays</li><li>New message notification - banner at top if user scrolled up</li><li>Keyboard appear/dismiss - smooth layout adjustment</li></ul></td></tr></tbody></table></div>

# **5\. Shared Component Library**

These components are used across multiple screens. Building them well once means every screen benefits.

| **Component** | **Description** |
| --- | --- |
| ActivityCard | The friend listening card. Album art, dynamic background color, pulse animation, reaction bar. Most important component in the app. |
| AvatarRing | Circular avatar with optional pulsing orange ring. Ring pulses when user is actively playing. |
| TrackMini | Compact track display - album art thumbnail, track name, artist, platform badge. Used in feed, profile, messages header. |
| ChenBubble | Chen's chat message card. Dark background, orange left border, streaming text support. |
| ThemeCard | Theme preview card for the theme picker. Shows color palette and name. |
| CompatibilityBadge | Colored badge showing % compatibility. Green/orange/muted based on score. |
| GlassCard | Base frosted glass card component. Used for most card surfaces. |
| OrangeButton | Primary CTA button. Filled orange with glow shadow. Spring press animation. |
| GhostButton | Secondary CTA. Transparent with orange border and text. |
| PlatformBadge | Small badge showing Spotify/Audiomack logo. Used on activity cards. |
| VoiceNotePlayer | Waveform + play button + duration + progress. Used in message threads. |
| ReactionPicker | Emoji reaction selector that appears on long press. Burst animation on select. |
| SkeletonCard | Loading placeholder that matches ActivityCard dimensions with shimmer animation. |

# **6\. Backend Requirements**

The backend is built with Golang + Gin + Supabase. It is the orchestration layer - it handles music platform OAuth, real-time data flow, AI requests, payments, and push notifications. The full architecture is documented separately in the Backend Architecture Document.

## **6.1 API Modules**

| **Module** | **Responsibility** |
| --- | --- |
| /api/v1/auth | Supabase JWT validation middleware, user profile creation on signup |
| /api/v1/spotify | OAuth 2.0 flow, token storage, token refresh middleware, polling service (every 30s) |
| /api/v1/audiomack | OAuth flow, currently playing detection (pending API key) |
| /api/v1/friends | Send/accept/decline/block friend requests, list friends with activity |
| /api/v1/activity | Historical activity feed, paginated queries |
| /api/v1/compatibility | Score calculation background job, retrieve scores between friend pairs |
| /api/v1/chen | Groq API calls, context injection, conversation history, rate limiting |
| /api/v1/messages | Send/receive text and voice messages, mark as read, voice note upload URLs |
| /api/v1/reactions | Add/remove reactions on activity items |
| /api/v1/payments | Paystack session init, webhook handler, subscription status |
| /api/v1/notifications | Expo push token registration, send notifications |

## **6.2 Real-Time Architecture**

Real-time friend activity works through three systems in sequence:

- Gin polling service runs every 30 seconds, calling Spotify/Audiomack APIs for each connected user
- New tracks are written to the listening_activity table in Supabase
- Supabase Realtime broadcasts the new row to all subscribed friends instantly
- React Native client has a Supabase Realtime subscription open, filtered to accepted friends only
- Feed updates without polling - client just listens

**RLS Policy Note**

Supabase Row Level Security ensures users can only subscribe to activity from accepted friends. This is the NDPC compliance layer and must never be disabled.

## **6.3 Chen AI Context Injection**

Before every Groq API call, the chen/ module builds a rich context object and injects it into Chen's system prompt. This is what makes Chen feel genuinely knowledgeable rather than generic.

- User's currently playing track (if any)
- Friends' currently playing tracks (up to 5 most recent)
- User's top 10 artists from last 30 days
- Compatibility scores with friends
- Last 20 messages in conversation history (for memory)
- User's premium status (affects response length and features)

## **6.4 Database Schema Summary**

| **Table** | **Purpose** |
| --- | --- |
| users | User profiles, avatar_id (DiceBear seed), theme preference, premium status |
| spotify_connections | Encrypted Spotify OAuth tokens per user |
| audiomack_connections | Audiomack OAuth tokens (pending API approval) |
| friendships | Social graph - pending/accepted/blocked states |
| listening_activity | Every track played - core data of the app. Realtime enabled. |
| tracks | Track metadata cache - avoids hammering music APIs |
| compatibility_scores | Friendship compatibility scores, recalculated daily |
| chen_conversations | AI conversation history per user |
| messages | DM messages - text and voice note references |
| reactions | Emoji reactions on listening activity items |

# **7\. Freemium Model**

| **Feature** | **Free / Premium** |
| --- | --- |
| Real-time friend activity feed | Free |
| Friend system (add, accept, block) | Free |
| Basic themes (Chen default + 1 more) | Free |
| Chen AI messages | Free (10/day limit) |
| Music compatibility score (basic %) | Free |
| DM text messages | Free |
| All 5 themes + future exclusive drops | Premium |
| Unlimited Chen AI conversations | Premium |
| Detailed compatibility breakdown | Premium |
| Voice notes in DMs | Premium |
| Listening history (beyond 7 days) | Premium |
| Chen voice (ElevenLabs - v1.1) | Premium |
| Price | ₦900/month via Paystack |

# **8\. MVP Scope & Build Order**

**20-Day Target**

The MVP must be shippable within 20 days post-exams. Scope is deliberately constrained to the features that make Chen meaningfully different from nothing. Everything else is v1.1+.

## **8.1 In Scope for MVP**

- Full authentication flow (Supabase Auth + onboarding)
- Spotify integration - OAuth, token management, real-time polling
- Audiomack integration - pending API key, architecture ready
- Friend system - add, accept, decline, block
- Real-time activity feed with album art color bleeding
- Chen AI text chat (Groq, no voice yet)
- Music compatibility scores (basic algorithm)
- DM text messages (no voice notes yet)
- 5 themes (all built, 2 free / 3 premium)
- DiceBear avatar system
- Paystack subscription (₦900/month)
- Push notifications (Expo)

## **8.2 Explicitly Out of Scope (v1.1+)**

- Voice notes in DMs
- Chen voice (ElevenLabs)
- Apple Music integration
- YouTube Music integration
- Artist listening parties / brand partnerships
- Group listening sessions
- Music recommendations engine
- Web app

# **9\. Success Metrics**

| **Metric** | **Target (Month 3)** |
| --- | --- |
| Total downloads | 5,000+ |
| Daily Active Users | 500+ |
| Free to Premium conversion | 5%+ |
| Day 7 retention | 30%+ |
| Chen AI messages sent/day | 1,000+ |
| Average session length | 4+ minutes |
| Premium subscribers | 100+ |
| Monthly revenue | ₦90,000+ |

_Chen - Built different. 🎵_

This document is the single source of truth for Chen v1.0 MVP.