# VK Mentorship — Platform Changelog

A running log of platform updates. Newest first. Ask any time for a **PDF** of this list.

---

## 2026-07-04

### Fixed
- **"Download all (.zip)" failing on some files** — a few files were reported as "couldn't be fetched" when zipping. The browser was fetching each file directly from storage, which can silently fail depending on the browser's cross-origin caching/CORS state even when the file itself is perfectly reachable. Files are now fetched **through the server** first (no cross-origin restriction applies server-to-server), so zipping no longer depends on the browser's own network visibility into storage.

### New
- **Super Admin → Files, fully built out** — was a placeholder page; now shows **every participant's uploaded files, batch-wise then participant-wise**. Pick a batch, see every participant with at-a-glance file counts (weekly proofs, habit proofs, vision board), click any participant to drill into their full file browser (same day-by-day grouping and single-participant "Download all (.zip)" as the Coach/Mentor/Admin participant profile's Files tab), or hit **"Download entire batch (.zip)"** to get one zip with a folder per participant, each mirroring their individual files. Two lightweight database functions back this — a cheap per-participant count query for the roster list, and a full grouped listing fetched only when a participant is expanded — so browsing a large batch stays fast.
- **Participant profile, fully rebuilt (Coach/Mentor/Admin)** — the participant detail page used by Coach → Participants, Mentor → Participants, and Admin → Participants is no longer just the 16-week program view — it's now **5 tabs**: **Overview** (personal info, team, today's engagement, coaching notes, milestones), **Program & Habits** (the 16-week review + habit tracker, unchanged), **Business** (every business field — was only ~14 of 24 fetched before — plus the full monthly business-snapshot history with a revenue trend chart and win/blocker reflections, none of which was shown anywhere before), **Vision Board** (5-year & 1-year statements, primary goal, all 5 years of goals with progress, and the full mood-board photo gallery — previously only a partial mini-widget existed), and **Files** (every file the participant has ever uploaded — weekly proofs, daily habit proofs, vision board photos — grouped **day-by-day** with a **"Download all (.zip)"** button that builds one zip file mirroring the on-screen folders (`Weekly Proofs/Week NN`, `Daily Habit Proofs/Day NN`, `Vision Board`) so a coach can grab everything in one click. The old fake "Download report" button (just triggered a browser print) is now a real **Export → Excel / PDF** covering the whole profile.
- **Messages redesign — online status, "seen" ticks, typing indicators** — the Messages page (coaching chat + community DMs) now shows when the other person is **online**, an animated **"typing…"** indicator while they're composing a reply, and **✓ / ✓✓ "seen" ticks** on your own sent messages. Message bubbles now group consecutive messages, show date separators between days, and animate in; a floating scroll-to-latest button appears with an unread count when you've scrolled up. The conversation list and thread panel got a visual refresh (frosted-glass panel, animated unread badges, smoother transitions). These upgrades also apply automatically to the Coach/Mentor/Admin chat inbox, since it shares the same conversation view.
- **AI Assistant (floating chat, every role)** — the floating chat bubble is now an instant AI help assistant, answering questions about how to use the platform (navigation, habits, proof submission, points, batches, community, support — role-aware, so a coach and a participant get different answers). Powered by the same AI provider already configured in **Admin → AI Configurations**. Available to every signed-in role, not just participants.

### Removed
- **"Connect a health app" section** removed from Daily Habits (Steps card) — Apple Health / Google Fit were never actually wired up; in-app live step tracking remains the active source.

### Fixed
- **Steps & Hydration cards now line up** — after removing the health-app section the Steps card was shorter than the Hydration card next to it on desktop; both now stretch to match height.

## 2026-07-03

### Improved
- **Faster, snappier UI platform-wide** — hashed JS/CSS assets are now cached by the browser for a year instead of re-validating over the network on every single load (the biggest single win — repeat visits and navigations now load already-fetched code instantly, offline-capable). Hover-prefetching now actually gets used (was expiring instantly before you could click). Cached data (program enrollment, dashboard points/milestones) no longer re-fetches from scratch on every page visit — revisiting a page you've already loaded is now instant. Avatar images lazy-load so long member/leaderboard lists don't fire dozens of image requests upfront.

### New
- **Reports — one-on-one, batch, coach & mentor** — Admin → Reports is now a full report builder: pick **Individual** (search any participant/coach/mentor by name), **Batch**, **Coach**, or **Mentor**, choose a date range (7d/30d/90d presets or custom), and get KPIs, a trend chart, and a drillable table — click any participant row in a Batch or Coach report to jump straight into their **Individual** report. Every report **exports to a styled Excel (.xlsx) or PDF** in the platform's navy/gold theme. Loads on demand only (never polls), so it adds no background database load.
- **Platform Analytics, for real** — Admin → Analytics is now a live dashboard built entirely from real platform data (no more placeholder numbers): KPIs (participants, coaches, mentors, active batches, active-in-last-15-min, new signups, at-risk, open tickets), 30-day signup / 14-day habit-completion / 30-day points trends, per-coach caseload & performance, per-batch health, per-mentor oversight activity, and a **live activity feed** that pushes new events (habit completions, points awarded) the instant they happen. Auto-refreshes in the background without ever flashing a loading skeleton.
- **AI model picker** — Admin → AI Configurations now has a **dropdown of the models available on your gateway plan** (Claude Opus/Sonnet/Haiku, GPT-4.1, GPT-5/GPT-5 Mini/GPT-4.1 Mini/o4-mini, North Code), grouped with their capabilities, plus a **Custom** option for any other model id. Models not currently entitled on the plan are shown disabled with a clear warning instead of silently failing.

### Fixed
- **AI Advisor could get stuck on "…" forever** — outbound calls to the AI provider had no timeout, so a slow or unresponsive upstream could leave the typing indicator spinning indefinitely with no error, on any model. Added bounded timeouts (with a clear "taking too long, please try again" message) to both the streaming and non-streaming request paths, plus a client-side safety-net watchdog, so the advisor always resolves within a bounded time instead of hanging.

---

## 2026-07-02

### New
- **Workflow & Automation — daily task reminders** — a new **Admin → Workflow & Automation** page that automatically nudges every active participant who hasn't finished their **6 daily habits**, every day at an **admin-chosen time (IST)**, by **email and/or WhatsApp**. Includes a modern branded email template, editable subject/heading/message (with `{name}` · `{done}` · `{remaining}` variables), per-channel on/off switches, **Send test email / test WhatsApp** buttons, a **Run now** button, a live "Schedule active" indicator and a last-run summary. Alumni and staff are never contacted, and already-reminded participants are skipped so re-runs are safe. Off by default until an admin enables it.

### Security
- **Platform-wide security hardening** — a full audit closed several access-control gaps: coaches can now only approve proofs, award points and grant milestones for **their own assigned participants** (previously any coach could act on any participant); phone numbers are no longer exposed to coaches outside their cohort; the file-upload system now rejects attempts to write outside your own folder; login-code (OTP) requests are rate-limited to stop email flooding; and meeting-invite emails can only go to real platform members. Also fixed a few minor memory leaks (leftover file previews) on the proof, habits and support screens. No action needed from users.

### New
- **SEO & Analytics admin page** — a new **Admin → SEO & Analytics** page to control how the platform appears in search and on social. Edit the **site title, meta description, keywords, canonical URL**, and toggle **search-engine indexing**; set the **social share card** (Open Graph/Twitter title, description and image) with live **Google search** and **social card** previews; and connect **Google Analytics (GA4)** by entering a Measurement ID and flipping it on. Everything is seeded with the current values, so nothing changes until edited. Analytics only loads when enabled with a valid ID.
- **Habit lists export to Excel & PDF** — in Coach → Participant Habits (list view), the Export menu now downloads a **styled Excel (.xlsx)** — bold navy header in the platform theme with a gold accent, and "Done" cells tinted green — and a **themed PDF** with a navy title bar, gold branding and per-habit ✓/✗ marks. (Alongside the existing PNG/JPG image export.) All downloads are generated in your browser — nothing is stored.

### Fixed
- **"At risk" no longer flags everyone** — the at-risk badge was comparing each participant against the wrong program week. It now uses each participant's own enrollment week and only flags someone from week 3 onwards when their completed weeks fall meaningfully behind.

### Improved
- **Community shows real business details** — the Member Network now auto-pulls each member's business name, industry, location, website, USP and logo straight from their **My Business / business profile** (only public, non-financial fields), instead of a separately typed copy. Member profiles show a richer Business card.

### New
- **Batches, alumni & tiered access** — a real **Batches** admin page (Admin → Batches): create cohorts, set a batch's status, **import members in bulk** (paste Name/email/phone → invites + auto-assigned to the batch), and **mark a batch's members as alumni**. Access now follows the cohort: **active** batch = full app; **completed/archived** batch = **Community page only**; **alumni** = **Community + My Business + Support + Settings**. Nav and routes adapt automatically to each participant's tier.
- **Coach Participant Habits, reworked** — same batch-first browsing as the Participants page: pick a batch, then a **Grid ⇄ List** of participants (search, sort by name/points/progress, an **At risk** filter), and open any participant's full live habit tracker. Now scoped to the coach's assigned participants (no coaches in the list).
- **Participant Leaderboard, reworked** — coaches/mentors/admins no longer appear (participants only); a **My batch ⇄ All batches** toggle with per-scope ranking, stats and a real cohort **activity feed** (from actual points earned). "View Points History" now opens a **real Points History** page — every XP entry grouped by day, a total/stage/top-source summary, and a per-source breakdown.

### Fixed
- **Forgot password now works** — the sign-in "Forgot password?" link previously led to a page that required being logged in. It now runs a proper flow: enter your email → receive a **6-digit code** → enter the code and a **new password**, and you're signed in.

### Improved
- **Profile password change** now verifies it's you first — enter a new password, receive an email **code**, confirm it, then the password updates.

### New
- **Batch-wise program content** — class videos and per-week **downloads/resources** are now scoped to a batch's program. Admin/mentor pick a batch in **Program Design**, **Program Builder**, and **Class Videos**, then add that batch's videos and files (upload or link) per week. Participants automatically see only **their** batch's content, so a future Batch 17 can have different videos/resources from Batch 16 (which stays unchanged).
- **Installable App (PWA) settings** — a new Admin page (**Admin → Installable App**) to control the installed app's **name, short name, iOS title, description, icon, and theme/splash colors**, with a live home-screen + splash preview. Defaults match the current app, so nothing changes until edited.
- **Business logo** — owners can upload a business logo from **either** the Business profile settings **or** the My Business page; it's a single source of truth, so it reflects in both places automatically.

### Improved
- **Participants (coach / mentor / admin)** — reworked from one flat list into **batch-wise browsing**: pick a batch (Batch 16, 15, … + Unassigned), then view its participants with a **Grid ⇄ List toggle** (grid by default, remembered), search, and the same details in both layouts.

---

## 2026-07-01

### New
- **Support tickets** — participants can raise support tickets (**Participant → Support**) to mentors/admins with categories, priority, threaded replies and attachments. New **staff inboxes** at **Admin → Support** and **Mentor → Support** with status filters, search, assign, and reply. Live notifications both ways.
- **Group meeting scheduler** — staff can schedule meetings (auto Zoom / custom link / in-person) inviting participants + coach + mentor + admin, with email invites, in-app calendar blocks, and notifications for everyone.
- **Branded video player** — a custom YouTube/JWPlayer-style player for **HLS (.m3u8), MP4, and YouTube/Vimeo** embeds, with quality selection, playback speed, resume-where-you-left-off, buffering states, keyboard shortcuts, and **mobile rotate-to-fullscreen**. Download and right-click save are disabled.
- **Staff "Log in as participant"** — coaches/mentors/admins can open a participant's app to help troubleshoot.
- **Cloudflare R2 storage** — made the default storage provider for all uploads.

### Improved
- **AI Business Advisor** — now answers with the owner's **full live context** (profile, revenue, monthly numbers, wins/blockers, coach notes, and program week) and replies in **English, Telugu, or Tenglish** to match how the owner writes. The "Business Brain" button now opens the My Business page; the whole page got a mobile/desktop polish.
- **Toasts redesigned** — bold, Duolingo-style success/error/info toasts, top-center on desktop and a full-width banner on mobile, with a success chime when a habit is marked done.
- **Media auto-compression** — images are compressed before upload (smaller files, faster on mobile data), applied everywhere uploads happen.
- **HEIC (iPhone) photos** — HEIC uploads are converted for universal display; previously-uploaded HEIC files are handled too.
- **User Management** — assign **multiple coaches** per participant, plus bulk email-resend and bulk batch-assign.
- **Habit & weekly proofs** — approve/reject on **every** proof type (weekly, daily habits, water, etc.); reviewed proofs move to History. Proofs open in an in-page lightbox with a Download button (no more new tabs).
- **Water tracker** — removed the 30-minute add lock; rapid logs now flag coaches/mentors/admins in notifications and the "Who needs attention" area.
- **Today's Focus & Habits** — compact mobile stat cards, correct per-participant program week, accurate "habits today" count, and removed the redundant Daily Habits card.
- **My Business** — the "Week X of 16" journey now tracks each participant's own start date, not the global cohort clock.
- **Affirmation habit** — proof is now optional; participants can simply "Mark as done" (still visible to staff).
- **Sign-in page** — the self-serve "Create account" tab is hidden (accounts are invite-provisioned).

### Fixed
- **Unexpected logouts** — stopped the service worker from force-reloading every open app on each deploy (which could drop the session); sessions now refresh reliably when the app returns to the foreground.
- **Coach Performance** — participants are now scoped by coach **assignment** (was showing 0 due to the old batch model).
- **Day / streak / proof-week** — now relative to each participant's own program start (fixed the wrong "Day 66" and broken streaks for new users).
- **Email OTP** — the login screen now expects the correct **6-digit** code.
- **Habit tracker persistence** — water and steps now save correctly on refresh.
- **Invites** — fixed "Invite unavailable" appearing for every invite link.

---

## 2026-06-30

### Security & Fixes
- Moved the AI API key out of committed config into a Cloudflare secret.
- Fixed invite and test-email errors; added invite sharing, business-document import, and streaming AI advisor replies.
