# ClassStreak — Change request 1 (after my first walkthrough)

I went through the build. It matches the design, so this isn't about it looking wrong — it's about problems I need fixed before I use it every day or give it to my test friend. Read all of it, then work through it screen by screen, in this order. Keep `DECISIONS.md` going for anything you had to choose.

## The bar

Three things every screen has to hit before I'll call it done:

1. **Easy to understand.** A new person should never wonder what a screen is for or what a button will do.
2. **Smooth.** Buttons should feel pressed (a small scale-down, ~0.97, 120 ms, with a light haptic), screens should slide or fade in (~200 ms), checkmarks and counters should pop or count up. Subtle. Never an animation on every tap, never anything that slows you down. Just enough that using it feels good.
3. **Positive and alive.** This app is about showing up and cheering people on. Right now it looks flat and dull — every screen is text in a box. Make it feel encouraging and a bit creative: expressive headlines, celebratory moments, warm empty states, small illustrations or shapes where they help. Stay inside the design system (§12 of PRD.md); "creative" doesn't mean new colors or fonts. Look at well-made React Native apps and open-source UI examples (Reanimated/Moti-style motion, polished onboarding flows) and bring that level of finish. Don't ask me to pick — do it, then I'll react.

Also: the **back arrow doesn't work** on the onboarding screens. Fix it everywhere.

## Colors

- **Default look is now Clay**, not Blush. New users get Clay after onboarding and can change it in Profile.
- **Sage looks bad** — muddy and hard on the eyes. Replace its tokens with these (all pass 4.5:1 with white on the accent): paper `#F4F8F5`, card `#FFFFFF`, ink `#1E2E27`, accent `#22795A`, tint `#D5EBDD`, muted `#5F7369`, line `#DCE8E0`. Update the "Pick your look" preview to match.

---

## Welcome (first screen)

- **Headline:** replace "Go to class. It counts itself." with **"Go to the gym or a class. Forget the tracking."**
- **Subline** (make it bigger, ~17 px): **"Other apps make you write every workout down. This one does it for you — without breaking a sweat."**
- **Compare card:** keep it, but the three crossed-out lines under "Other apps" are too small — bump them to 14 px.
- **Move the "Three steps" card off this page.** It becomes its own screen (next section). The Welcome page now has two cards: the compare card and the friends card.
- **Friends card** — make the point sharper and show it, don't just say it:
  - Title: **"Your friends will know if you skipped — and cheer you on."**
  - Subline: "A weekly league with the people who'd actually notice."
  - Replace the mini league list with a mini Activity item: *"Maya usually goes Tuesdays · nothing logged yet"* with a **Nudge** button, and under it a comment from a friend: *"Priya: you got this — go tomorrow 💪"*. That's the whole idea in one picture.
- Button stays "Get started" → goes to the new How it works screen.

## New screen: How it works (between Welcome and "What do you do?")

Same layout style as Welcome. Headline **"How it works."** Three big numbered steps, each with one plain sentence that actually explains it:

1. **Save your studio or gym.** "Drop a pin on the place you go. That's the only spot we ever pay attention to."
2. **Go.** "When you arrive, the clock starts. When you leave, it stops. That's your session — no typing."
3. **It's counted.** "Sessions add up to your weekly goal and your streak, and your friends see them."

One line under the steps: "We'll ask for your location once, on the next few screens." Button: **Continue** → What do you do?

## What do you do? (1 of 7)

- Add a **Custom** option: a full-width, shorter tile under the 3×3 grid (same style as the tiles, about half the height). Tapping it opens a text field; whatever they type becomes a new tile with a check, and it's treated as its own activity everywhere else (goals, usual days, sessions, feed). People do all kinds of things — we can't list them all.
- Keep the "Any gym counts for Gym…" sentence under it.

## How many sessions a week? (2 of 7)

- Works as designed. One fix: when the user has picked more than two activities and the card says "set up the rest in your profile," make sure the Profile → Goals page really does show only the picked ones (see Profile below).

## Find your studio or gym (3 of 7)

- People have more than one place. Let them **add multiple studios or gyms here**, not just one. After saving one, show it in a "Your places" list at the top and an **"Add another"** button. Continue is enabled after the first.
- **"Use this place" feels like it does nothing.** When tapped: press animation, light haptic, the button turns into a confirmed state ("Saved ✓") for a moment, and the place slides into the "Your places" list. Right now it's completely static and I couldn't tell if it worked.

## When do you usually go? (4 of 7)

- Make this **per activity**. If I picked Reformer Pilates and Gym, I get a Reformer block (days + Morning/Midday/Evening) and a Gym block, because they're on different days and times. One activity = one block, same as the sessions screen.
- The "I don't have set days" button stays, and applies to all.

## One permission (the location screen)

- **"Nothing to track" is wrong** — we are tracking their location. Change the headline to **"One permission. Nothing to log."** Keep the sentence under it ("Turn on location and all **three** of these just happen.").
- The **"Pick 'Always'"** line is the most important thing on the screen and it's buried at the bottom in tiny text. Move it **directly under that sentence**, styled as a proper callout (not a footnote), and word it: **Choose "ALWAYS" so it works while your phone is in your bag.** ("ALWAYS" in caps, in quotes, in the accent color.)
- **The sticker preview in card 2 looks bad** — it's misaligned and cramped. Rebuild it as a clean, centered mini version of the real sticker.
- At the bottom, add a text link: **"How we handle your location"** → opens a short page that explains, in plain words: we only keep location data while you're inside a place you saved; we note when you arrived and when you left; everywhere else we're not looking and nothing is stored; how that keeps you honest; how to turn it off. Simple, friendly, no legal tone.

## Pick your look (5 of 7)

- Clay is pre-selected as the default (see Colors). Sage uses the new tokens.

## Your name (6 of 7)

- Add "(optional)" after the Last name label. Everything else stays.

## Create account (last step)

- Keep as is.

---

## Home

- The **"6 wk" flame bubble** on the top-right of the week card looks bad. Redesign it: make the streak a clean chip that sits inside the card's bottom row (flame icon + "6-week streak"), not a floating circle.
- **"Pilates 1/2 · Yoga 0/1"** is too small — bring it up to 15 px, it's the useful part.
- "Latest" card: the camera button should animate on press (see the bar).

## Studios

- The board says **"No one is on this week's board yet"** and Regulars is 0. Seed it: the demo people (Priya, Jess, Maya) plus 4–5 extra demo names who are *not* my friends should have sessions at Club Pilates Summerlin this week, so the "Regulars this week" list and the Regulars count look real when I open the app on my phone. Same for Core Pilates Studio — Suwanee on my friend's build.

## Friends — League

- Make it **interactive**. Tapping a row should expand it (smooth, ~200 ms) to show that person's week in detail: which activity on which day, roughly when, how long. Tapping my own row shows mine. Tap again to collapse.
- **Color the day dots by activity** — e.g., Jess did Yoga on Monday and Tuesday and Pilates on Wednesday, so those dots are different colors. Add a small legend under the list. Use the activity accent colors from the design system.

## Friends — Activity

- **Reactions need a selected state.** When I press the fire button it should visibly turn on (accent tint background, accent border, count goes up); pressing again turns it off and the count goes down. Right now nothing tells me it worked.
- Add a **"+"** after the four reactions that opens the system emoji picker so people can react with their own emoji. Custom reactions show as extra buttons on that item.
- **Comments didn't work** in the demo. Make sure "Add a comment" opens a composer, posting works, the new comment shows under the item, and the count updates.
- (The emoji themselves look rough in the Windows preview — that's fine, iPhone renders them properly. Don't replace them.)

## Profile

- **The header looks boring and badly arranged** — the goal pill, the Sessions square and the Usual days rectangle don't line up or belong together. Redesign it: avatar + name on one line, then **one card with three columns** — Goal (loud, accent), Sessions, Usual days — equal width, aligned, tappable. Same information, actually designed.
- **Streak card:** the explanation text ("Check = you hit your goal…") looks like it was typed into a Google Doc. Style it as a small info line with an icon, lighter and shorter. Make the week checks **interactive**: tap one and it lights up for a second (scale + glow), and shows that week's number of sessions.
- **Sessions per week (12-week bars):** tapping any bar currently opens the same "1 of 3 this week, 6 weeks in a row" screen, which makes no sense. Tapping a bar should show **that week** — its dates and the sessions in it. If that's not ready, make the bars not tappable.
- **Milestones:** tapping the first milestone opens a page that just says "milestone = 1". That's the opposite of what this app is. Milestone pages should be a celebration: a proper trophy graphic, confetti on first open, a big **"Congrats on your first class!"** (10th / 25th / 50th / 100th — each with its own line), the date it happened, and a **Share** button that makes a milestone card like the sticker. Trophies should have a small bounce when tapped.
- **Profile → Goals:** show **only the activities I picked**, each with its 1–4+ rows (e.g., Reformer Pilates 2, Yoga 1). Under them an **"Add more"** button that reveals the rest (Mat Pilates, Hot Pilates, Cycling, Barre, HIIT, Boxing, Gym / weights) plus **Custom**, where typing a name creates a new activity tile. The **"Save for next week" button doesn't work** — fix it so it saves and shows a confirmation.
- **Profile → Usual days:** per activity, like onboarding (days + time for each). **Fix the layout** — the buttons are badly arranged and look bad. Selecting a day should feel alive (fill animation, tiny scale), not just a color swap. The "ClassStreak" header on this page isn't centered — fix.

## Everywhere

- Camera button in the tab bar: press animation (scale + haptic), like a real shutter.
- Any button that saves something must confirm it (state change, toast, or check), so nothing feels like it did nothing.
- Empty states get a warm line and a small visual, never just "nothing here yet."

## Done when

- I can go through onboarding on my phone with the back arrow working, add two places, set days per activity, land on Home with Clay.
- Home, Studios, Friends and Profile look populated with demo data on my phone (Studios board included).
- Reactions toggle, custom emoji works, comments post.
- Milestone pages celebrate. Goals and Usual days save. Bars and checks do something sensible when tapped.
- The app feels smoother and warmer than it did before this list, without feeling busy.