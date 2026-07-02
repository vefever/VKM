# VK Mentorship — Platform Changelog

A running log of platform updates. Newest first. Ask any time for a **PDF** of this list.

---

## 2026-07-02

### New
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
