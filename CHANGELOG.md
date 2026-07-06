# VK Mentorship — Platform Changelog

A running log of platform updates. Newest first. Ask any time for a **PDF** of this list.

---

## 2026-07-07

### Fixed
- **Scrolling in bottom-sheet drawers** — the "Update snapshot" form on **My Business** (and other mobile bottom-sheets) could get clipped at the bottom on smaller screens, so you couldn't scroll down to the Save button. Fixed the drawer body to scroll properly within its height — affects the business snapshot editor, the mobile "All sections" menu, and KPI detail sheets.

### Added
- **Voice input on the AI Business Advisor** — tap the new **microphone** button in the advisor's message box to speak your question instead of typing. Your words appear live as you talk, and when you stop (or tap stop) it's sent automatically so the advisor answers right away. Uses your browser's built-in speech recognition (no extra cost), works on Chrome, Edge and Safari including mobile, and the mic simply doesn't appear on browsers that don't support it.
- **WhatsApp log** — a new **WhatsApp log** tab in Admin → Messaging (and Admin → WhatsApp), mirroring the Email log: every WhatsApp message the platform attempts — daily reminders, manual sends, and provider tests — is recorded with recipient, message, type, provider, status and time, updating live. Filter by type or "Failed only" to debug delivery, with the provider's error shown on hover for failures.
- **AiSensy WhatsApp provider** — you can now connect **AiSensy** as a WhatsApp provider in **Admin → WhatsApp** (alongside Meta Cloud API and Twilio). Paste your AiSensy API key and default campaign name, Save, and WhatsApp notifications/automation reminders go out through AiSensy's approved-template campaigns. A message's text fills the template's first variable; automation uses the template/campaign name from the Templates tab.
- **Admin Reports are now ultra-detailed, with AI-written summaries** — every report card (Individual, Batch, Coach, Mentor) now shows far more. **Participant reports** add batch + coach context, all-time vs range points, proof approval rate, weeks approved/pending/rejected, current habit streak, focus minutes, water adherence, average steps, meetings attended, milestones earned, and a full **business snapshot** (MRR, target, monthly leads, closing rate, team size). **Batch reports** add at-risk / alumni / active counts, coach coverage (with unassigned flagged), and a top-performers list. **Coach reports** add review volume, approval rate, turnaround speed, coaching notes, meetings, at-risk count and caseload habit activity. **Mentor reports** add approved/rejected proofs, meetings hosted, and batches/coaches overseen. On top of that, a new **"AI Report"** button reads the report's live data and writes a clear executive summary — Summary, Highlights, Concerns, and Recommended actions — streamed live, and included automatically when you export to Excel or PDF.

### Changed
- **Inviting users: batch is now a dropdown, and only for participants** — when inviting a Coach, Mentor, or Co-Admin, the batch field no longer appears (they don't belong to a batch). For participants, instead of typing a batch number, you now **pick from a dropdown of the batches you've already created** (e.g. Batch 16, Batch 15) — no more typing, and no accidentally creating a mis-spelled batch. If no batches exist yet, it points you to create one in Academy → Batches first.

### Added
- **Co-Admins — create additional administrators with full admin access** — Super Admins can now add **Co-Admins**, who have the *exact same* powers as a Super Admin (manage users, batches, content, settings — everything), just labelled "Co-Admin". Two ways to create them: invite a brand-new person as "Co-Admin" from **User Management → Invite user**, or open any existing user and use **Admin access → Make co-admin**. You can revoke co-admin access at any time from the same place. Safeguards: you can't change your own admin status, and the original Super Admin account(s) are protected and can't be stripped through this flow. Co-admins are labelled "Co-Admin" in the portal switcher and the user list.
- **Coach Performance now scores each coach's daily review rhythm + their participants' habit engagement** — the coach drill-down has a new **"Daily review performance"** panel that treats reviewing as a daily habit: reviews done today, this week, current **review streak** (consecutive days with a review), active review days out of 30, average reviews per active day, and busiest day. Beside it, a **"Caseload daily-habit engagement"** panel shows how the coach's participants are doing on their own daily habits — how many did habits today, how many are active in the last 3 days, the average habits/6 across the caseload, and a per-participant chip list. The scoreboard also gains a **"Habit %"** column (share of each coach's participants active in their daily habits), so you can compare habit engagement across all coaches at a glance. Everything is real, live data.

### Fixed
- **Coach Performance now shows each coach's own interaction data** — previously, when a participant was assigned to several coaches, every coach saw the *same* "reviews received / notes / meetings / last contacted" for that participant (the numbers were counted per participant, not per coach), which made all coaches look identical. These are now scoped to the specific coach — "reviews I gave, notes I wrote, meetings I hosted, the last time I contacted them" — so a participant reviewed by one coach correctly shows 0/never under the others. Also added each participant's **daily-habit activity** (habits ticked today out of 6, plus an active-in-last-3-days indicator) to the participant map and drill-down cards. *(Note: if several coaches still show similar overall progress / at-risk numbers, that's because those reflect the participant's own progress and most participants are currently assigned to most coaches — assign participants more distinctly and the coaches will diverge.)*
- **"Log in as participant" links now use your own domain** — the one-time support login link (staff "log in as participant" and admin impersonation) previously showed the raw Supabase URL (`…supabase.co/auth/v1/verify…`). It now points at `vkmentorship.com/auth-confirm`, which verifies the same one-time token behind the scenes — so nothing internal is exposed and the link is on-brand.

### Added
- **Coach Performance, rebuilt for judging coaches** — the Coach Performance screen (mentor + admin) is now a full evaluation toolkit built entirely on real data. Every coach gets a **balanced 5-dimension score** — Quality (proof-review approval), Responsiveness (turnaround + login recency), Consistency (active days), Coverage (share of their caseload contacted each week), and Outcomes (how their assigned participants actually progress and how few go at-risk) — shown as a breakdown so you can see *why* a coach scored what they did, not just a number. New views: a **30-day daily-activity heatmap** (each coach's real work rhythm across reviews, notes, meetings and chat), a **Compare tab** for head-to-head coach-vs-coach, and a **Batch-wise tab** showing each coach's performance per batch plus batch-level health. The scoreboard adds active-days, coverage, participant-progress, at-risk and last-login columns. **Coach reports export to Excel and PDF** — both a single-coach packet and the whole-team scoreboard. The app now also records a lightweight **daily login/activity heartbeat** for staff, so real login history and streaks build up over time.

### Changed
- **All mock/demo data removed from Admin & Mentor — real data everywhere** — every admin and mentor page now shows live data or an honest "not set up yet" notice; there are no more fabricated names or numbers anywhere in those areas. Specifically: **mentors now get the same real org-wide Analytics and Reports as super admins** (they were previously blocked); a batch of mentor pages that duplicated real screens (Analytics, Reports, Batches, Coaches, Community, Content, Live Classes, Review Cohorts, Settings) now render the real components; and four pages were built fresh on real data — **Mentor Insights** (live at-risk / attention signals derived from real cohort data), **Mentor Leaderboards** (real cross-batch standings), **Graduation & Recognition** (real alumni, graduation rate, ready-to-graduate with one-click "mark alumni" — for both mentor and admin), and **Coach Assignment** (the real coach→participant caseload map). Pages for features the platform genuinely doesn't have yet (Payments, Invoices, CRM, Backup, Database, Exports, Feature Flags, API Keys, and the operational planning pages like Admissions/Campaigns/Printing/Gifts/Welcome-Kit/Events/Feedback) were removed from the navigation rather than shown with fake data. (Coach and participant pages are unchanged in this pass.)

## 2026-07-06

### New
- **Super Admin System Overview — a real-time command center** — the admin home page (previously placeholder/sample numbers) is now a live dashboard driven entirely by real data. A **batch selector** (current vs previous batches) scopes the whole page. Live KPI tiles (participants, online now, today's completion, at-risk, pending proofs, open tickets, new signups, cohort revenue), a **live participant tracker** (each person's online status, today's habits as a 6-dot ring, current week, points, at-risk reasons, last-seen — filter by online/at-risk/pending, updates the instant someone logs a habit or earns points), a real live activity feed, real 30/14-day trends, clickable batch-health cards, and an honest system-health strip. All mock data removed.
- **Clone a program for a new batch (Super Admin + Mentor)** — a new **Programs** manager lets staff **clone** the current 16-week program into a brand-new one (e.g. "Batch 17") in one step — copying every week, class video, milestone and resource — then assign it to a batch so **only that batch's participants see it**. Also create programs from scratch (blank or seeded with the default plan) and assign which program each batch runs (from the Programs hub or the Batches screen). Mentors now have full program tools (manage, clone, builder, videos & files) — previously admin-only. Cloned programs are fully independent (editing one never touches the other).
- **Video thumbnails (YouTube-style poster before play)** — program class videos can now show a proper thumbnail before playing. YouTube links auto-generate one; for uploaded videos or Vimeo you can **upload a custom thumbnail** in the video editor (with a live preview). A consistent, responsive thumbnail card (play button, duration, "Sample"/"Watched" badges) now appears on both the LMS page and the Program Progress week view, on desktop and mobile. Thumbnails are copied when a program is cloned.

### New
- **Email log — see every email the platform sends** — a new **Email log** tab on Admin → Messaging (and a panel on Admin → Workflow Automation) lists every email the platform has sent, newest first, updating live as they go out: login codes, 2FA codes, daily reminders, bulk/meeting invites, manual admin sends, and provider tests. Each row shows the recipient, type, subject, time, provider, and whether it **sent or failed** (with the provider's error message on hover for failures). Filter by type or show failures only. For privacy it records only the metadata — never the email body or any login/2FA code. Visible to super admins only.

### Fixed
- **Getting logged out when reopening the app** — investigated live against the auth server (which was confirmed to be keeping sessions valid — the problem was entirely in the app). Two causes: (1) on a phone's cold start the very first network request often fails while the connection wakes up, and the app made exactly **one** attempt to restore the session before showing the login screen — it now retries with backoff, only accepts a genuine "session invalid" answer from the server as a logout, and quietly signs you back in the moment connectivity or focus returns even if the first attempts failed; (2) after every deployment, the app-update reload could fire at launch right in the middle of restoring the session — the update now waits until the session is safely stored before reloading.

### Improved
- **Mobile / installed-app experience, top to bottom** — a pass to make the phone and PWA experience feel like a real app instead of a website:
  - **Toasts no longer overlap the bottom navigation.** Every floating element that has to clear the bottom tab bar (page content, toasts, the install prompt, the AI button) now measures from a single shared value, so notifications always sit cleanly above the nav with a proper gap — and the "Install app" prompt and a toast can never land on top of each other anymore.
  - **Pop-ups open as native bottom sheets on phones.** Editing a vision goal, opening a class video, messaging a community member, editing your community profile, adding a team member, importing a document, and the support and avatar dialogs now slide up from the bottom with a drag handle (like a native app) on mobile, while staying as centered dialogs on desktop.
  - **The AI Assistant now works on mobile.** The floating assistant button (previously desktop-only) now appears on phones just above the tab bar and opens a full-height chat sheet with a keyboard-aware input.
  - **On-screen keyboard no longer covers inputs.** The chat, AI Advisor, support, and AI Assistant composers now all stay above the keyboard.
  - **Collapsing page title.** As you scroll down any page, its title slides up into the top bar so you never lose track of where you are.
  - **Bigger tap targets & touch-friendly info tips**, a springy active-tab animation, and removed dead whitespace at the bottom of a couple of pages.

## 2026-07-05

### New
- **Two-factor authentication for staff (Super Admin → Security)** — the Security page is no longer a placeholder. Super admins can now turn on two independent second-factor methods for every coach, mentor, and super admin login (participants are never affected): **Authenticator app (TOTP)** — scan a QR code with Google Authenticator, Microsoft Authenticator, or any compatible app, then enter the 6-digit code at login — and **Email code** — a one-time code emailed as a second factor. Each has its own on/off switch, with a confirmation step before enabling since it's a platform-wide change. When Authenticator app is turned on, staff without one set up are guided through QR-code enrollment before they can reach their dashboard; if both methods are on and someone hasn't set up an authenticator yet, they can choose to set one up on the spot or use an emailed code instead. Every staff member manages their own authenticator app enrollment/removal from the same Security page (removal requires a fresh code, so a stolen session alone can't turn 2FA off). Built on Supabase's native authenticator-assurance-level system for the authenticator-app path — the same mechanism used industry-wide — plus a purpose-built, rate-limited, hashed one-time-code system for the email path.
- **Individual 2FA choice for coaches & mentors (Profile → Account)** — beyond the platform-wide toggles above, every coach and mentor can now require a second factor on their *own* account from their own Profile → Account tab, independent of what the super admin has set platform-wide — "Require authenticator app when I sign in" and "Require an email code when I sign in", each its own switch, plus the same authenticator-app set-up/removal control. Turning either on affects only that individual's next login.

### Fixed
- **Mentor Cockpit dashboard now shows real cohort data** — the mentor home page's KPI tiles (active batches, active participants, avg completion, graduation rate), "what needs your attention" signals, cohort pipeline, and top-performers leaderboard were all hardcoded sample numbers and fake names. All four now come from real data: active batches and their participant counts, real completion percentages, a real graduation rate (from alumni status), real at-risk/lowest-completion/near-graduation signals, and a real points leaderboard across active batches — scoped org-wide the same way every other real mentor page already is.
- **"A factor with the friendly name... already exists" blocking authenticator app set-up** — an abandoned QR-code enrollment (closed the page before entering the code) left a stale, unnamed factor that Supabase's uniqueness check then rejected on every later attempt. Set-up now clears any such stale attempt automatically before enrolling.

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
