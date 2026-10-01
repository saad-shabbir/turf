# ClassStreak — Codex build prompt v4 (paste top to bottom)

You are building ClassStreak, an iOS app. Everything you need is in this document plus the screenshots in `design/`. Read all of it before writing code.

## How to work

- Build the **whole app**: every milestone in §14, in order. Finish one, commit it with a message that names it, then start the next. Do not stop between milestones to ask for approval.
- Do not ask me questions about the product. When something is ambiguous, make the decision that best matches the screenshots and this spec, and record it in `DECISIONS.md` with one line of reasoning. The one thing you should ask me for is a secret (the Google Places key — see below); ask for it in the chat when you reach the studio search, and nowhere else.
- The screenshots in `design/` are the visual source of truth for layout and copy. They are manual screen captures of the design canvas: most have a small label strip at the top with the screen's name (e.g. "One permission") and may be slightly cropped — ignore the strip and any canvas toolbar; only the phone frame matters. This document is the source of truth for behavior. Where they disagree, this document wins.
- Copy the design exactly: colors, fonts, radii, spacing and wording are in §12 and visible in the screenshots. Do not invent new visual styles.
- Keep a `README.md` that says how to run the app on a phone, what is in `.env`, and how to use the Debug screen.
- Write TypeScript throughout. No `any` unless unavoidable, and comment why.

## Existing code (this repo)

This repo is the **Turf** beta you built earlier. It already runs on my phone as a sideloaded `.ipa` and is connected to my Supabase project. Keep what works and replace the rest:

- **Keep:** the Supabase project and its connection settings, the auth setup, and the background-location / geofence code that already fires on my phone. Reuse that code as the base for §4.
- **Replace:** every screen, the navigation, the copy, the data model. Turf becomes ClassStreak. Rename the app, bundle identifier display name, icon and splash.
- **Database:** there is no real data worth keeping. Write new migrations in `supabase/migrations/` that drop the Turf tables and create the schema in §10. Keep the Supabase Auth users table as is.
- Delete the old commitment / league / settlement / money screens and anything else not in this spec.

## Things you cannot set up, and what to do instead

Plain language, because these need my accounts or money, not code:

1. **Google Places key** — I already have one. When you reach the studio search, ask me for it in the chat. Put it **only** in `.env` as `EXPO_PUBLIC_GOOGLE_PLACES_KEY`, make sure `.env` is in `.gitignore`, and ship a `.env.example` with a blank value. Never commit the key, never print it in logs, and never write it into `README.md`, `DECISIONS.md`, or any file that gets committed. Remind me in the README to restrict the key in Google Cloud to this app's iOS bundle identifier and to the Places API only, because an `EXPO_PUBLIC_` value is bundled into the app. The "Find your studio or gym" screen must still work when the key is missing (for example on a build without `.env`): show a map, let me **drop a pin** and type the studio name.
2. **Apple Developer account ($99)** — needed for TestFlight, Apple push certificates (APNs) and Sign in with Apple. I don't have it yet. Set up `eas.json` with a `development` profile and document the build command, but I will keep sideloading with SideStore for now, the way the Turf beta was installed. **Remote push cannot work without APNs credentials**, so: everything that only needs this phone (session logged, usual-day reminders, streak at risk, recap, milestones) is a **local notification**; everything friend-to-friend (nudges, reactions, comments, friend requests) is delivered **in-app** — an inbox behind the bell icon with a badge count, plus a banner on the next app open — and written so that switching to Expo Push later is a one-file change. Say so in `DECISIONS.md`.
3. **Sign in with Apple / Google** — need the account above and a Google console setup. Build **email + password only** for now. Leave visual room for the two buttons in the create-account screen.
4. **Instagram** — apps can't post to Stories directly. "Share to your story" opens the iOS share sheet with the finished image; I pick Instagram there.
5. **Payments** — no App Store products exist yet. Build the Plus screen as pictured, but the button just shows "Coming soon". No RevenueCat. Nothing is locked except the 1 manual session a week.
6. **Home-screen widgets** — try to add the WidgetKit target at the end (milestone 9). If the native target won't build in Expo, leave it out and say so in `DECISIONS.md`. Don't let it block anything else.

---

# ClassStreak — PRD v5.2 (build spec)

## 1. Product

**One sentence:** Save your studio or gym once; every class or gym session after that is counted automatically, your friends see it and compete with you weekly, and you can post proof to your story in one tap.

**Name:** ClassStreak. **Tagline / first-screen headline:** "Go to class. It counts itself." **Subline:** "Other apps make you write it down. This one notices you went."

**Who it's for:** people who go to fitness classes — Pilates first (reformer, mat, hot, Lagree), then yoga, barre, cycling, HIIT, boxing — and people who lift at a gym. Everything in the app treats a gym session and a class the same way: a session.

**What it is not:** a workout logger (no sets/reps), a class-booking app, a step counter, a public social network, a money-stakes app.

**Brand (§12.5):** rounded flame mark + "ClassStreak" wordmark in the soft serif, mixed case, never all caps. The flame is the same shape used for streaks in the app.

## 2. Vocabulary (use these words in code and copy)

| Word | Meaning |
|---|---|
| **Activity** | A kind of thing you do: Reformer Pilates, Mat Pilates, Hot Pilates, Yoga, Cycling, Barre, HIIT, Boxing, Gym / weights. |
| **Place** | A saved studio or gym with a location and a small radius. Belongs to one user. |
| **Session** | One counted visit: the user was inside a place for at least the minimum time. Has an activity (workout type), duration, place, start/end, verified flag. |
| **Goal** | Sessions per week, set per activity. **Weekly goal = sum of activity goals.** |
| **Streak** | Number of consecutive weeks (Mon–Sun, user's timezone) in which the user hit the weekly goal. |
| **Milestone** | Lifetime session counts: 1, 10, 25, 50, 100, 250. |
| **Friend** | Mutual connection. Friends see each other's sessions, goals, streaks, and appear in each other's league. |
| **League** | The Friends tab's weekly view: sessions this week across friends. |
| **Nudge** | A push one friend sends another when a usual day is passing with no session logged. |
| **Sticker** | The frosted stat card placed on a photo for sharing. |
| **Look** | One of three color themes: Blush (default), Sage, Clay. |
| **Plus** | The paid tier. Placeholder screen only for now (§9). |

## 3. Onboarding (10 screens, no sign-up until the end)

"Step n of 7" counters appear on the seven question screens only. Screenshot names in brackets.

| # | Screen | What it shows | Inputs / defaults | Next |
|---|---|---|---|---|
| 1 | **Welcome** [01-welcome] | Logo. Headline "Go to class. It counts itself." Subline "Other apps make you write it down. This one notices you went." Three cards: (a) compare — "Other apps: Type your workout / Log each set / Remember to check in" crossed out, vs "ClassStreak: Just go. Reformer · 52 min · counted · ✓ 2/3 this week"; (b) "Three steps. Then it's automatic." Save your studio → Go to class → It's counted; (c) "Your friends will know if you skipped." mini league (Priya 3, You 2, Maya 1). Button "Get started". Footnote "Takes two minutes. You sign up at the end." | none | 2 |
| 2 | **What do you do?** (1 of 7) [02] | Nine equal tiles, 3×3: Reformer Pilates, Mat Pilates, Hot Pilates, Yoga, Cycling, Barre, HIIT, Boxing, Gym / weights (last). Multi-select. Footnote "Any gym counts for Gym. Studios count for the rest. You can add more later." | ≥1 required. | 3 |
| 3 | **How many sessions a week?** (2 of 7) [03] | Subline "One answer per thing you do. This is your goal." One block per selected activity, each with four rows: 1 Once a week · 2 Twice a week · 3 Three times a week · 4+ Four or more. If 3+ activities were picked, show the first two blocks and a card: "You picked N things. Set up the rest in your profile. Your weekly goal is the total: X sessions." Activities not shown here get **goal 0** until set in Profile — they still log sessions, they just don't add to the weekly goal — so the total on the card equals what the user actually answered. | Defaults shown pre-selected: Pilates 2, Yoga 1, Gym 3, everything else 2. "4+" stores 4. | 4 |
| 4 | **Find your studio or gym** (3 of 7) [04] | Search box (Google Places). Results as rows: name, distance, activity guessed from the place type. Privacy card: "We only pay attention here. When you're at this studio or gym, ClassStreak notes that you came and how long you stayed — that's your workout, logged. Everywhere else, we're not looking." Secondary link "Add mine later". | Tapping a result opens a pin/radius confirm (map, radius chips 75/100/150/250/400 m; default 100 m for studios, 150 m for gyms). No API key → pin-on-map fallback with a name field. | 5 |
| 5 | **When do you usually go?** (4 of 7) [05] | Day chips Mon–Sun (multi), time-of-day chips Morning / Midday / Evening (single). Card "What this turns on" explaining the reminder and the nudge. Buttons "Continue" / "I don't have set days". | Optional. | 6 |
| 6 | **One permission** [06] | Headline "One permission. Nothing to track." Bold line "Turn on location and all **three** of these just happen." ("three" underlined in the accent color.) Three numbered cards: 1 Your workout logs itself (logged-session preview); 2 Post it in one tap (sticker preview); 3 Friends keep you honest (mini league). Buttons "Turn on location" / "Not now". Footnote "Pick 'Always' so it works with your phone in your bag. We only check your saved studios and gyms." | "Turn on location" requests When-In-Use, then Always. If denied: continue; Home shows a banner (§5.1). | 7 |
| 7 | **Pick your look** (5 of 7) [07] | Three options with mini phone previews and swatches: Blush (default, selected), Sage, Clay. Button "Let's go". | Stored as `users.theme`; the whole app repaints. | 8 |
| 8 | **Your name** (6 of 7) [08] | First name (required), last name (optional). Note "Friends see your first name. Studio boards show your first name and last initial." | | 9 |
| 9 | **How you identify** (7 of 7) [09] | Woman / Man / Non-binary / Prefer not to say. "Optional. Helps us show studios, events and stats that fit you. Nobody else sees it." Buttons Continue / Skip. | Optional; never displayed. | 10 |
| 10 | **Create account (last step)** [10] | "Last step" · "Save your streak." · "Create an account so your classes, friends and look stay yours if you switch phones." Summary card "WHAT YOU SET UP" with chips (activities, goal total, place, days, look). Then **email + password** fields and one button "Create account"; links "Already have an account? Sign in" and "Forgot password" (Supabase email reset). Legal line. | Email/password via Supabase Auth only — **this is deliberate**: the screenshot shows Apple and Google buttons, but those need accounts I don't have yet, so build the email form in their place and leave room. Include Sign in, Forgot password and Reset password screens in the same component style (no screenshots exist for them; keep them to standard inputs and one button each). On success, everything from steps 2–9 (held locally) is written to the account in one transaction. | Home |

Rules:
- All answers from steps 2–9 are held in local storage (AsyncStorage or MMKV) until step 10 succeeds. If the person quits before step 10, resume at the same step on next launch.
- A friend-invite code (from a link, a QR, or typed) creates an **already-accepted** friendship: the inviter consented by generating it and the new user consented by using it. Only contact-match suggestions go through request → accept.
- A studio QR link (§5.2) pre-saves that place so step 4 shows it already chosen.
- Never show a paywall during onboarding.

## 4. Detection engine (how a session logs itself)

### 4.1 Geofences
- Each place is a circular region (`lat`, `lng`, `radius_m`). Register all of a user's places as iOS geofences (`expo-location` `startGeofencingAsync` with `expo-task-manager`); iOS allows 20 regions, cap places at 12.
- On ENTER, open a candidate visit with `entered_at`. On EXIT, close it and evaluate.
- Background location: `Accuracy.Balanced`, `distanceInterval` 100 m, `pausesUpdatesAutomatically: true`. Discard fixes with accuracy > 100 m.
- iOS may deliver EXIT a few minutes late; that is acceptable. Never award a session on ENTER alone.
- Geofence callbacks only say ENTER/EXIT; they carry no speed or accuracy. Keep the background location task (the Turf beta already has one) writing a rolling buffer of the last 2 hours of fixes; `evaluateVisit()` uses that buffer for the speed and accuracy checks when it exists and skips them when it doesn't. Visit events are queued locally and uploaded when online, with their original timestamps; evaluation is idempotent (one visit per place per `entered_at` within 5 minutes).
- Every real geofence event and every simulated one (§17) goes through the **same** `evaluateVisit()` function. There is one code path.

### 4.2 What counts as a session
| Activity | Minimum inside time | Notes |
|---|---|---|
| Gym / weights | 25 min | "Long session" flag at 60 min |
| Reformer / Mat / Hot Pilates, Yoga, Barre | 35 min | class + changeover |
| Cycling, HIIT, Boxing | 30 min | |
| Any | — | ENTER/EXIT pairs under 3 min are ignored (drive-bys). If enough fixes exist, median speed inside the region must be < 2 m/s. |

- Only the **first** session per activity per calendar day counts toward the goal; extra sessions are still logged and posted, flagged "double".
- `duration_sec` = exit − enter. Display as "52m 8s".

### 4.3 Workout type (activity) guess
- The place tells us the venue, not the workout. Guess: a place saved as a Pilates studio → Reformer Pilates; a gym → Gym / weights; otherwise the activity chosen when the place was saved. The chip the user picks is stored as `workout_label`; the `activity_key` stays the place's activity (so "Lagree" and "Hot Pilates" are labels on a Pilates activity, "Legs" is a label on Gym, and "Other" keeps the place's activity with the label "Other"). Goals and streaks count by `activity_key`.
- The session sheet shows chips to fix it in one tap: studio → Reformer / Mat / Hot Pilates / Other; gym → Legs / Upper / Cardio / Full body / Other. Remember the last pick per place and use it as the next guess.
- "Edit workout type" is available on the session sheet and on any session in Profile → History for 7 days.

### 4.4 Trust
- Every logged session gets **"Not me? Remove"** for 24 h. Removing soft-deletes it, adds place+weekday+hour to a per-user suppression list, and logs `session_removed`.
- **Add a session** (manual) from Profile → History: activity, place, date, duration. `source = manual`, shown with an "unverified" label, counts toward goals. Limit 1 per week with a friendly message.
- **Verified**: if HealthKit is authorized and a workout overlaps the visit window by ≥ 15 min, set `verified = true` and store `health_workout_id`; show a small check on the card. Optional, off by default (milestone 9).
- If no location update has been received for 6 h during 7 am–11 pm, show a "Tracking may be off" banner on Home (once per day max).

### 4.5 Goals, streaks, milestones
- Week = Monday 00:00 to Sunday 23:59 in the user's timezone; store `week_key` (ISO week) on every session.
- `weekly_goal = sum(user_activities.goal)`. `weekly_count` = number of counted sessions that week.
- Streak: consecutive weeks with `weekly_count >= weekly_goal`, counted backwards from the last completed week, plus the current week if already met. Store `streaks.current`, `streaks.best`.
- Streak freezes: Plus feature, not active yet; keep the column.
- Milestones fire when lifetime counted sessions reach 1, 10, 25, 50, 100, 250. Show a one-time celebration screen on 1, 10, 25, 50, 100.
- Compute on the server (Supabase Edge Function on session insert + a nightly job) **and** client-side for instant UI updates. All week math reads "now" from one `clock()` helper so the Debug screen can offset it (§17).

## 5. The app — five tabs

Tab bar: Home · Studios · **[camera]** · Friends · Profile. The center camera is a raised accent circle (62 px) that opens Post.

### 5.1 Home [11-home]
- Header: logo left; bell (notifications) and avatar right.
- **Your week** card: ring (weekly_count/weekly_goal), "1 of 3 sessions", per-activity line "Pilates 1/2 · Yoga 0/1", streak chip with the flame icon "6 wk".
- **Today** card (dark): only on a usual day. "Tuesday is a Reformer day" · "Usually around 6 pm · Priya already went" (name a friend who has logged today, if any).
- **Keep going** checklist for new users (hide when all done): Add 3 friends · Post your first sticker · Go to a session (auto-checks) · Connect Apple Watch (optional).
- **Latest** card: last session with a camera button → Post.
- Banners (max one): location permission missing ("Sessions only count while the app is open — turn on Always", with a Settings link), tracking may be off, offline.

### 5.2 Studios [12-studios]
- Dark header card for the primary place: name, "You've been 14", "Next milestone 25", "Regulars 42" (people with ≥ 3 sessions here in the last 30 days).
- **Regulars this week**: everyone who logged a session at this place this week, ranked by count, shown as first name + last initial, you highlighted. Only users with `show_on_board = true` appear.
- Toggle "Show me on the studio board" (default on).
- "Add a studio or gym" → same search/pin flow as onboarding step 4. Switching between saved places if the user has more than one.
- A place page is reachable by QR/deep link (`classstreak.app/s/<place_id>`) for the front desk; a new user who scans lands on this page after onboarding with the place pre-saved.

### 5.3 Post (center button) [17-post], [18-on-your-story], [22-sticker-default]
- Opens the camera (`expo-camera`) with the **sticker already on the viewfinder** for today's most recent session (or the last one if none today; if none in 7 days, prompt "Add a session" first). Camera-roll button lets the user pick a photo instead.
- Sticker: frosted rounded box (blur 10 px, 42% ink tint, 1 px white/28% border) containing: small label "Workout type" over "Reformer Pilates" (30 px, 800), one row of three label/value pairs — Time 52m 8s · This week 2/2 · Streak 6 wk — then the logo in white. No studio name. Draggable and pinch-scalable. Only one style (S0) exists in this build; the sticker-style button opens a small sheet that says "More styles coming". The sticker's "This week" fraction is the **total** weekly progress (count/goal), not one activity's.
- Compose photo + sticker into one image (`react-native-view-shot`). Sharing: use `react-native-share` (not `expo-sharing`, which cannot attach text) so the share sheet carries the image **and** the invite link as the message; Instagram ignores the text, so before opening the sheet copy the invite link to the clipboard and show "Link copied — paste it as a link sticker". Buttons: "Share to your story" (share sheet), "Close friends only" (same share sheet — the label is only a hint, iOS does not let us pick the audience), "Just save it" (camera roll + attach to the session so it shows in the feed).
- The person in the screenshots is placeholder art; the real screen uses the live camera.

### 5.4 Friends [13-friends-league], [14-friends-activity]
Segmented control at top: **League** · **Activity**. Header has a "+" for adding friends: from contacts (hashed phone match), share link, scan a friend's QR, or type a friend code.

**League (version E):**
1. "Everyone at once" card: five avatars, big session counts, a crown on everyone tied for the lead, a progress bar (you vs leader), line "Priya & Jess lead · you're 1 behind".
2. Nudge card when a friend's usual day is passing and nothing is logged: "Maya usually goes Tuesdays · Nothing logged yet today" + **Nudge**.
3. **When they went** (subtitle: everyone's goal is different): one row per friend — avatar, name, seven day dots (filled = a session that day; dashed = a usual day that hasn't happened yet), and "sessions/goal" (3/3, 3/4, 2/3, 2/2, 1/2).
- Sorting: sessions desc, then goal completion. Friend cap (3 free) is designed but **not enforced** until Plus exists.

**Activity (Venmo-style feed):**
- Items, newest first: "**Priya** went to Reformer · Club Pilates Summerlin · 1 day ago". Photo (if attached) below. Reaction row: four emoji buttons with counts — 🔥 👏 💀 🫡 — one reaction per person per item, tap again to remove. Below: "2 comments" · "Add a comment", then the latest comment ("**Jess** killed it, see you Thursday").
- Nudge items inline ("**Maya** usually goes Tuesdays · Nothing logged yet · 7:40 pm" + Nudge). Milestone items ("**Priya** hit 50 classes"), goal items ("**You** hit your goal · 3 of 3").
- Comments: plain text, 240 chars, report and delete. Realtime updates via Supabase Realtime.

### 5.5 Profile [15-profile]
- Name; three chips: **Goal · 3 a week** (accent, loud), Sessions 14, Usual days Tue · Thu · Sat. Tap any to edit.
- **Streak card**: flame + "6 weeks in a row" + "Every week you hit your goal, the streak grows by 1." Eight week cells with dates: check = goal hit, × = missed, last cell = this week in progress ("1/3"). Caption "Check = you hit 3 sessions that week. This week: 1 of 3 so far. Miss a week and it starts over."
- **Sessions per week, last 12 weeks** bar chart.
- **Class milestones**: 1 · 10 · 25 · 50 · 100 (earned = filled), "11 to your 25th", progress bar.
- Plus row: "Your stats by studio and by day · ClassStreak+ · 14 days free" → the placeholder Plus screen (§9).
- Sub-pages: History (all sessions; edit type / remove / add manual), Places, Goals, Usual days, Look, Notifications, Apple Health, Account (sign out, delete account, version number — 5 taps opens Debug).

### 5.6 Session logged (sheet) [16-session-logged]
Triggered by the local notification after a session closes, and openable from Home → Latest. Contents: "Just now · Club Pilates Summerlin" · "You went to class." · dark card with the sticker layout (type, Time · This week · Streak, logo) · "Workout type" chips with the guessed one selected ("We guessed from the studio. Fix it if we're wrong.") · **Post it with a photo** → Post · Edit workout type · Not me? Remove. Edits within 10 minutes update the feed item silently.

### 5.7 Widgets [20-widget]
- Small: streak + this week's progress. Medium: streak, progress bar, "Priya is at 3. Go get her." Lock-screen: streak number. Milestone 9; skip if the native target won't build.

## 6. Reminders and nudges

| Trigger | Copy | Cap |
|---|---|---|
| Usual day, at usual time (Morning 8 am, Midday 12 pm, Evening 5 pm) and no session yet | "It's Tuesday. Reformer at 6? Priya already went today. One more keeps your streak at 6." (drop the friend clause if no friend logged today) | 1/day |
| Session logged | "Reformer · 52m 8s. 2/2 this week 🔥" → opens the session sheet | per session |
| Friend nudged you | "Maya nudged you. Tuesday's not over." | 1 per friend per day |
| Reaction / comment on your session | batched hourly: "Priya and 2 others reacted" | |
| Streak at risk (Sat 10 am if goal not met) | "2 days left to keep your 6-week streak." | 1/week |
| Weekly recap (Sun 6 pm) | "Week 38: 3 of 3. Streak 7. You beat Jess by 1." | 1/week |
| Milestone | "Class 25. Say it on your story." | per milestone |
Quiet hours 10 pm–7 am local. Each can be turned off in Profile → Notifications. Local notifications (`expo-notifications`) for the ones that only need this phone; friend-to-friend ones (nudge, reactions, comments, friend requests) go to the in-app inbox until APNs exists (see "Things you cannot set up" #2). Notification permission is requested the first time Home opens after account creation, with a one-line explainer; camera permission on the first Post; contacts permission on the first tap of "Contacts". The onboarding copy "one permission" refers to location — the only permission asked during onboarding.

## 7. Friends, privacy and visibility
- Friendship is mutual; requests must be accepted.
- Friends see: your sessions (activity, duration, place name if `share_place_name`, relative time — never exact time), photos and notes you attach, your goal and weekly counts, your streak, your usual days (for nudges). Never coordinates or live location.
- `share_place_name` defaults on; one global toggle in Profile turns it off ("Friends see 'Reformer · 52 min' only").
- Studio boards show first name + last initial and are visible to anyone on that place page; `show_on_board` opt-out.
- Gender is never shown to anyone. Delete account removes everything.

## 8. Sharing and growth
- Every share carries `classstreak.app/j/<invite_code>`. Universal links don't survive an install, so: (1) the link opens a tiny static web page (host it in `web/` for Vercel or Supabase Storage) that shows the invite code, copies it to the clipboard on tap, and links to the App Store / TestFlight; (2) on first launch the app reads the clipboard and, if it holds a ClassStreak code, pre-fills it; (3) the create-account screen has an "I have a friend code" field. Any of the three creates the accepted friendship. Universal links still open the app directly when it is already installed.
- Weekly recap card (Sunday) and milestone cards are generated as images the same way as the sticker.
- Studio QR (§5.2) is the offline growth channel; generate a printable QR for each place page.

## 9. Money — ClassStreak+ (placeholder) [19-plus]
Build the paywall screen exactly as in the screenshot ("See yourself better." with the four locked rows — Unlimited friends (Free stops at 3) · Your stats · Every sticker style · Two streak freezes a month — and the button labeled "Start 14 days free"). Tapping the button shows a toast "Coming soon" and closes the screen. No RevenueCat, no purchases; nothing is locked except the 1 manual session/week. Keep `subscriptions` in the data model. Pricing to confirm later: $29.99/year or $4.99/month with a 14-day trial.

## 10. Data model (Postgres / Supabase)

```sql
users(id uuid pk, auth_id, first_name, last_name, gender text null, tz, theme text default 'blush',
      share_place_name bool default true, show_on_board bool default true, health_verify bool default false,
      invite_code text unique, plus_until timestamptz null, expo_push_token text null,
      phone_hash text null, is_demo bool default false, created_at)
venues(id uuid pk, google_place_id text unique null, name, lat, lng)                -- one row per physical studio/gym
inbox(id uuid pk, user_id, kind text /* nudge|reaction|comment|friend_request|milestone */, from_user null,
      session_id null, body text, read_at null, created_at)
activities(key text pk, label, min_minutes int, default_goal int)           -- seeded (§2, §4.2)
user_activities(user_id, activity_key, goal int, pk(user_id, activity_key))
usual_days(user_id, weekday int, time_of_day text)                          -- morning|midday|evening
places(id uuid pk, user_id, venue_id, name, google_place_id null, activity_key, lat, lng, radius_m int,
       share_name bool default true, enabled bool default true, created_at)     -- a place is one user's saved copy of a venue
sessions(id uuid pk, user_id, place_id null, venue_id null, activity_key, workout_label text null /* Lagree, Legs, Upper… */,
         started_at, ended_at, duration_sec int, source text /* geofence|manual|seed|simulated */,
         verified bool default false, health_workout_id text null, counted bool, week_key text,
         photo_url null, note text null, removed_at null, created_at)
suppressions(user_id, place_id, weekday int, hour int)
friendships(user_a uuid, user_b uuid, status text /* pending|accepted */, requested_by, created_at, pk(user_a,user_b))
reactions(session_id, user_id, emoji text, created_at, pk(session_id, user_id))
comments(id uuid pk, session_id, user_id, body text, created_at, deleted_at null)
nudges(id uuid pk, from_user, to_user, sent_on date, created_at, unique(from_user, to_user, sent_on))
streaks(user_id pk, current int, best int, last_week_key, freezes_used_month int)
milestones(user_id, count int, earned_at, pk(user_id, count))
subscriptions(user_id pk, product, status, renews_at)
```
Row-level security controls rows, not columns, so friends never read `sessions` directly. Expose a `friend_feed` **view** (security invoker) that returns, for accepted friends only, sessions from the day the friendship was accepted onward with: activity, workout_label, duration, place name only if both the user's `share_place_name` and the place's `share_name` are true, a relative time bucket (`today`, `yesterday`, `N days ago`), photo, note, reaction and comment counts — and no lat/lng, no exact timestamps, no simulated sessions. A `venue_board` view returns first name + last initial and this week's count for users with `show_on_board` at a venue. Removing a friend hides everything both ways immediately. Migrations in `supabase/migrations/`; Edge Functions in `supabase/functions/`.

## 11. Tech stack
- **App:** Expo SDK (latest stable), TypeScript, expo-router, `expo-location` + `expo-task-manager`, `expo-notifications`, `expo-camera`, `react-native-view-shot`, `expo-sharing`, `expo-contacts`, `react-native-maps`, `react-native-svg`, `@expo-google-fonts/fraunces`, `@expo-google-fonts/manrope`, AsyncStorage or MMKV, `expo-dev-client`.
- **Backend:** Supabase — Auth (email/password), Postgres with RLS, Realtime, Edge Functions, `pg_cron`. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env`; ship `.env.example`.
- **Places:** Google Places API (New) Text Search behind `EXPO_PUBLIC_GOOGLE_PLACES_KEY` (read from `.env`, gitignored; see "Things you cannot set up" #1), pin-on-map fallback. Type → activity mapping: gym / fitness_center → Gym; yoga_studio → Yoga; names containing pilates / lagree / reformer / solidcore / core → Reformer Pilates; otherwise the user picks.
- **Push:** Expo Push (store `expo_push_token`).
- **Build:** EAS development build (`eas.json`), documented; sideload via SideStore for now.
- **iOS config (app.json):** `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` = "ClassStreak checks whether you're at a studio or gym you saved, so your sessions count without you doing anything.", `NSCameraUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSContactsUsageDescription`, `UIBackgroundModes: ["location", "fetch", "remote-notification"]`.
- Later, not now: RevenueCat, Sign in with Apple/Google, Branch. Add a thin `track(event, props)` wrapper that logs to console so PostHog can be wired later.

## 12. Design system

### 12.1 Themes (three token sets — the whole app repaints when `users.theme` changes)
| Token | Blush (default) | Sage | Clay |
|---|---|---|---|
| paper (background) | #FBF0F2 | #F1F5EE | #FAF6F1 |
| card | #FFFFFF | #FFFFFF | #FFFFFF |
| ink (text, dark cards) | #3B1D2E | #1F3A2E | #2E2A26 |
| accent (buttons, streak) | #CF2E66 | #2F7A5B | #B0522F |
| tint (chips, selected) | #F5B8C8 | #CFE3D3 | #F2D9CC |

All three accents pass 4.5:1 with white text (Blush 4.95, Sage 5.2, Clay 5.1). Do not lighten them.
| muted (secondary text) | #7A5A68 | #5C6E64 | #6F655D |
| line (borders) | #F0D9DF | #DDE6DA | #EADFD6 |

### 12.2 Type
- Display / headlines and the wordmark: **Fraunces** 600. 36–42 screen titles, 26 card headlines, 30/34 big numbers.
- Body / UI: **Manrope** 400–800. 15–16 body, 13 captions, 12 labels, 11 tab labels. Tabular numerals.

### 12.3 Components
- Cards: white, 1 px line border, radius 22 (18 for inner cards), padding 14–16.
- Primary button: accent, white text, 54 px tall, pill. Dark variant (ink). Secondary: white, 1.5 px line border, 50 px, pill.
- Chips: tint background, pill, 13 px 700. Accent chip (white text) for the loud goal chip.
- Tab bar: white, top hairline, five slots, center camera 62 px accent circle raised 32 px with a 5 px white ring.
- Toggle: 48×28 pill, accent when on. Inputs: 54 px, radius 16, 1.5 px border (ink when focused).
- Reactions: four system emoji 🔥 👏 💀 🫡. Everything else uses stroke icons (1.8 px, round caps): home, storefront, camera, friends, person, flame, pin, check, chevron, search, lock, trophy, star, share, comment, clock, edit, crown, bell, x, watch, plus, link, QR, contacts, mail; activity icons: reformer bed, mat, spring, barre, yoga figure, bike, bolt, glove, dumbbell.
- Avatars: initials on tint; your own avatar on accent.

### 12.4 Motion and accessibility
Count-up on the week ring (300 ms), scale-bounce on reactions with light haptic, flame pulse on streak increment, confetti only on milestones. Respect Reduce Motion. Dynamic Type to XXL, VoiceOver labels on every card, 44 pt targets, 4.5:1 contrast.

### 12.5 Brand [00-brand]
Mark: rounded flame outline, 2 px stroke; accent on light, white on dark. Wordmark: "ClassStreak" in Fraunces 600, mixed case, never uppercase. App icon: the flame alone, white on the accent square. Generate icon and splash from this.

## 13. Analytics
`track(event, props)` wrapper (console for now). Events: `onboarding_step{n}`, `activities_selected{n}`, `place_saved{activity, radius}`, `usual_days_set{days, time}`, `permission_result{always|when_in_use|denied}`, `theme_selected`, `account_created`, `session_logged{activity, duration, counted, source}`, `session_removed`, `workout_type_edited`, `sticker_shared{destination}`, `friend_request_sent{method}`, `friend_added`, `reaction`, `comment`, `nudge_sent`, `reminder_opened`, `paywall_viewed{placement}`, `milestone{count}`.

## 14. Milestones and acceptance (build all, in order)

1. **Foundation** — Expo app on top of the existing repo, theme tokens (three looks), design components, tab bar, the ten onboarding screens with local state and account creation last, places search with pin/radius and the no-key fallback. *Done when:* a fresh install walks through all ten screens matching the screenshots, answers survive killing the app mid-way, the email account is created and the answers land in Supabase, and switching Look repaints every screen.
2. **Detection** — geofences, visit open/close, session rules (§4.2), workout-type guess and chips, session sheet, "Not me? Remove", manual add, and the **Debug screen** (§17). *Done when:* the Debug screen's "walk in → wait 40 min → walk out" simulation produces the notification and the session sheet exactly as a real visit would, "drive-by" produces nothing, remove suppresses the slot, manual add shows "unverified".
3. **Goals, streaks, milestones, Home, Profile** — nightly rollup, celebration screens, seed data (§17). *Done when:* Home and Profile match the screenshots with the seed data, and a simulated session updates the ring, streak cells, bars and milestones immediately; "Advance clock 1 week" moves the streak correctly.
4. **Friends** — requests (contacts, link, QR, code), League version E, Activity feed with reactions and comments, Realtime. *Done when:* two accounts on two phones (me and my test friend) see each other's sessions within seconds, reactions and comments sync, and the League matches the screenshot with the three seed friends plus us.
5. **Post** — camera, frosted sticker composited on the photo, share sheet, save-to-session, recap and milestone cards. *Done when:* a session can be posted as an image with the sticker, the image lands in the feed, and the share sheet opens with the invite link in the text.
6. **Reminders and nudges** — usual-day local reminders, streak-at-risk, weekly recap, nudge pushes via Expo Push, quiet hours, notification settings. *Done when:* a nudge sent from one phone arrives on the other.
7. **Studios** — place page, Regulars this week, show-on-board toggle, add/switch places, QR/deep link that pre-saves the place. *Done when:* scanning the QR on a fresh install lands on the place page with the place saved.
8. **Plus placeholder** — paywall screen, "Coming soon" toast, Profile row, `subscriptions` table.
9. **Polish** — Apple Health verification, widgets (try; skip if the native target won't build), account deletion, permission strings, icon and splash, README, EAS profile. *Done when:* the app runs end to end on a development build and every screen in §16 exists.

## 15. Decisions already made (don't re-ask)
- Sign-up happens last, email/password only for now. Everything before it is held locally.
- Gym is a first-class activity, equal tile, listed last.
- Weekly goal = sum of activity goals; the streak counts the total.
- Free friend cap is 3 (not enforced yet). No crews, no pairs, no groups.
- League is version E; the Friends tab has exactly two sections, League and Activity.
- Workout type is guessed from the place and fixed with chips; never asked before a session.
- The default sticker is the frosted four-fact card with the logo; no studio name on it. S1–S11 are not built.
- Reactions are system emoji; everything else uses stroke icons.
- Three looks from day one; Blush is the default.
- No money-stakes features, no public profiles, no map of friends. iOS first, English first.

## 16. Screen index (screenshot file → spec)
| File | Spec |
|---|---|
| 00-brand | §12.5 |
| 01-welcome … 10-create-account | §3 rows 1–10 |
| 11-home | §5.1 |
| 12-studios | §5.2 |
| 13-friends-league, 14-friends-activity | §5.4 |
| 15-profile | §5.5 |
| 16-session-logged | §5.6 |
| 17-post, 18-on-your-story, 22-sticker-default | §5.3 |
| 19-plus | §9 |
| 20-widget | §5.7 |
| 21-reminder | §6 |

## 17. Debug screen and seed data (required)

**Why:** nobody can walk into a gym to test a build. The app needs a hidden page that *pretends* things happened, using the exact same code the real geofence uses, so the result on screen is identical.

**Where:** Profile → Account → tap the version number 5 times → "Debug".

**What it looks like:** a plain list of buttons in the app's style, with a log at the bottom.

Buttons:
- **Walk into [place]** — fires the same ENTER event the geofence would, for the selected saved place.
- **Walk out now** — fires EXIT now (this should be ignored if under the minimum).
- **Walk out 40 minutes later** — fires EXIT with a timestamp 40 minutes after ENTER, so a full session is logged and the notification + session sheet appear.
- **Drive past** — ENTER then EXIT 2 minutes later; nothing should be logged.
- **It's next week** — shifts the app's clock forward 7 days (through the `clock()` helper), so streaks and the weekly reset can be tested. "Reset clock" puts it back.
- **Run the nightly rollup now** — runs the server job on demand.
- **Load demo friends** / **Remove demo friends** — see seed data below.
- **Re-register geofences**, **Reset onboarding**, **Send me a test reminder**.

Log panel: location permission state, last GPS fix time, the list of registered geofence regions, and a live tail of every ENTER/EXIT (real or simulated) with what `evaluateVisit()` decided and why.

**Seed data** (an Edge Function `seed_demo` plus SQL in `supabase/seed/`):
- Three demo friends, already accepted: **Priya** (goal 3, usual days Mon/Wed/Fri), **Jess** (goal 4, Tue/Thu), **Maya** (goal 2, usual day Tuesday, hasn't gone yet this Tuesday — so the nudge card appears). Give them eight weeks of sessions so this week reads Priya 3/3, Jess 3/4, Maya 1/2, and a few reactions and comments on recent items ("**Jess** killed it, see you Thursday").
- The demo friends are marked `is_demo = true` so they can be removed with one button and never receive real pushes.
- **Do not seed a friend named Ifti.** Ifti is a real person who will create his own account and be my test friend on a second phone.
- Two demo places, so both test phones have a studio to walk into:
  - **Club Pilates Summerlin** (Las Vegas, NV) — Reformer Pilates, radius 100 m. Look up coordinates with the Places key if present; otherwise use a placeholder and note it in `DECISIONS.md` so I can fix the pin.
  - **Core Pilates Studio — Suwanee** (Suwanee, GA, near Lawrenceville) — Reformer Pilates, radius 100 m. Same coordinate rule. This is the studio my test friend will actually go to; it must appear pre-filled as a suggested place on his "Find your studio or gym" screen when the app runs on his phone (match by name in the search results, or offer it as a "Suggested" row above the results).
- The signed-in demo state for me: a 6-week streak at goal 3 with 1 session so far this week, which means **22 lifetime sessions** (3 earlier + 18 in the streak + 1 this week). The "14 sessions / 11 to your 25th" in the Profile screenshot is sample text; the app shows the real numbers.
- Seeded sessions have `source = 'seed'`; sessions created from the Debug screen have `source = 'simulated'`. Simulated sessions count for the signed-in user's own goals, streaks and Home/Profile (that's what they're for) but are **excluded** from studio boards and from friends' feeds unless the Debug toggle "Show simulated sessions to friends" is on. The clock offset lives only on the client; the rollup function accepts an `as_of` parameter that only the Debug screen sends.

## 18. Edge-case rules (so nothing has to be guessed)

- **Goal changes** take effect next Monday; the current week keeps the goal it started with. Historical weeks keep the goal they had.
- **Timezone changes** (user travels) apply to week boundaries from the next Monday; `users.tz` is updated on launch when the device timezone differs and the user confirms.
- **Edited or removed sessions** recompute that week's count, the streak and milestones retroactively; historical weeks can change.
- **Missing EXIT:** a visit still open after 4 hours is auto-closed at 4 hours, counted (it passed the minimum), and flagged "we guessed when you left" on the session sheet so the user can fix the duration.
- **Overnight visits** belong to the day they started.
- **Overlapping places:** on ENTER, attribute the visit to the place whose center is nearest; ignore ENTERs for other places while a visit is open.
- **Duplicate callbacks:** evaluation is idempotent per (place, `entered_at` ± 5 min).
- **Offline:** queue events and uploads locally; upload in order when online; the server evaluates with the original timestamps.
- **Suppressions** (from "Not me? Remove") expire after 90 days.
- **Usual days** are not tied to an activity. A usual day counts as "missed" at 9 pm local with no counted session; the nudge card and the friends' "dashed dot" appear from the usual time onward and clear at midnight. Reminder text is composed at send time from live data.
- **Studio boards** group by `venues`: a venue is a `google_place_id` when present, otherwise a name match within 150 m. Two users who saved the same studio share one board.
- **Contacts matching** needs a phone number, which onboarding does not collect: Profile → Account has an optional "Phone number" field; when present, store a salted hash and match against other users' hashes. With no number, the Contacts button explains that and offers the link, QR and code paths instead.
- **What friends can see:** sessions from the day the friendship was accepted onward, through the `friend_feed` view only. Photos and comments are visible to accepted friends only. Unfriending hides everything both ways at once. Place names show only when both the global and the per-place toggles are on.
- **Session sheet timing:** the local notification fires when EXIT is evaluated; if the app is already open, present the sheet directly.
- **Screens without screenshots** (sign in, forgot/reset password, map confirm, friend request, History, Places, Goals, Usual days, Notifications, Account, inbox, empty and error states): build them from the components in §12.3 — list rows, standard inputs, one primary button — and keep them as plain as the settings screens in the design.
- **Simulated data** never reaches studio boards or friends unless the Debug toggle in §17 is on, and is labeled "simulated" wherever it appears to the signed-in user.

---

# Screen notes (from the design)

Keyed to the screenshot files. These explain intent; the spec above has the details.

- **01-welcome** — the headline, a compare card ("Other apps" crossed out vs "ClassStreak: Just go. · ✓ 2/3 this week"), the three steps, the friends league. One button: Get started. No sign-up here; it comes last because people who have answered the questions convert better.
- **02-what-do-you-do** — nine equal tiles: Reformer, Mat and Hot Pilates, Yoga, Cycling, Barre, HIIT, Boxing, with Gym / weights last, same size as the rest. Pick many.
- **03-sessions-a-week** — one "how many a week" block per activity picked, the same 1–4+ rows each. Picked three or more? The first two show here; the rest get set up in the profile. The weekly goal is the total.
- **04-find-your-studio-or-gym** — studios and gyms in one search. The privacy card wording is exact: we only pay attention at this place, we note that you came and how long you stayed, everywhere else we're not looking.
- **05-usual-days** — days and a time of day. This turns on the reminder ("Reformer at 6? Priya already went") and lets friends nudge you when a usual day passes with nothing logged.
- **06-one-permission** — the sentence is bold with "three" underlined in the accent color, and the cards are numbered 1-2-3 so it reads as exactly three things. One primary button ("Turn on location") plus a quiet "Not now". This is the only permission asked during onboarding.
- **07-pick-your-look** — Blush, Sage or Clay. Three color sets in code, not three apps. Changeable in Profile.
- **08-your-name** — first name shows to friends; studio boards show first name + last initial.
- **09-how-you-identify** — optional, skippable, private.
- **10-create-account** — "Save your streak." with a summary of everything just set up, then the account form. Email and password only for now; the Apple and Google buttons in the picture come later.
- **11-home** — Home is about you: this week's ring (Pilates 1/2 · Yoga 0/1), today's usual-day card, the new-user checklist, the latest session. Friends live on the Friends tab.
- **12-studios** — your studio's page: everyone who logged a session there this week, shown as first name + last initial; the front-desk QR lands here; one toggle takes you off the board.
- **13-friends-league** — version E: the "everyone at once" card, the nudge, then "When they went" — each friend's week as day dots with their own goal ("everyone's goal is different"). A dashed dot is a usual day that hasn't happened yet.
- **14-friends-activity** — Venmo-style feed. Reactions on their own row, then "2 comments · Add a comment", then the latest comment, so nothing wraps or overlaps.
- **15-profile** — name, then the goal as the loud chip (Goal · 3 a week) next to sessions and usual days. The streak reads as weeks with dates; milestones say what they count.
- **16-session-logged** — the studio name is in the header line ("Just now · Club Pilates Summerlin"), not on the sticker. The workout type is guessed from the place (studio → Reformer; gym → Legs / Upper / Cardio); tap a chip or "Edit workout type" to fix it.
- **17-post** — the center camera. The frosted sticker sits on the photo; the person in the picture is placeholder art. Drag it anywhere.
- **18-on-your-story** — the same frosted sticker on the photo with the "Join me" link.
- **19-plus** — a placeholder screen for now: build it as pictured, with the button labeled "Start 14 days free" exactly as shown; tapping it shows a "Coming soon" toast and closes. Monetization is not final.
- **20-widget** — streak, this week's progress, the friend just ahead.
- **21-reminder** — what the usual-day notification looks like.
- **22-sticker-default** — the frosted box: workout type headline, Time · This week · Streak, logo. No studio name.

# Screenshots in `design/`
These are hand-taken screenshots of the design canvas (not exports), so each one may show a label strip with the screen name at the top and a little canvas background around the phone. Use the phone frame only.

00-brand, 01-welcome, 02-what-do-you-do, 03-sessions-a-week, 04-find-your-studio-or-gym, 05-usual-days, 06-one-permission, 07-pick-your-look, 08-your-name, 09-how-you-identify, 10-create-account, 11-home, 12-studios, 13-friends-league, 14-friends-activity, 15-profile, 16-session-logged, 17-post, 18-on-your-story, 19-plus, 20-widget, 21-reminder, 22-sticker-default.
Do not include any other artboards (W1–W10, League A–D, S1–S11); they are alternatives that were not chosen.
