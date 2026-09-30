# September 30: movement, planning, and departure recovery

This implements the user's September 30 request against the existing ClassStreak native app. It supersedes the earlier mockup-only restriction. No native dependencies, app identifiers, SQLCipher identifiers, or paid services change.

## Behavior

- Recover a missed departure from two fresh, accurate outside-location observations, separated by at least 30 seconds. End at the first observation and label it estimated. Preserve active visits during place re-registration/editing. Outside coordinates are never retained.
- Use a warm cream/charcoal default, quieter Sage/Blush options, Georgia headings on iOS and web, existing Manrope body fonts, rounded cards and generated equipment illustrations. This follows the supplied visual references; their exact font files are unknown.
- Retain five tabs. Home includes weekly progress, a calendar, recurring plans, one-day overrides, optional weights focus, and local reminders one hour before the selected time.
- Onboarding offers all selected activity goals, custom activities, usual days, Morning/Midday/Evening/Night and a precise-time picker. Plans are saved in owner-scoped encrypted storage on this device, not synced between phones.
- Studios show the user's rank separately above other regulars. A clearly labeled, opt-in example community has fictional portraits, bios, an Instagram placeholder, and local-only friend interactions.
- Home includes genuine friend activity plus an optional example feed with fictional workout photos, comments, likes and sticker treatments. No example action contacts another person.
- Stickers begin smaller, support drag/pinch and visible size/backdrop controls, and offer Soft glass, Just the type and Studio ticket. Bounds use the displayed sticker dimensions.
- History groups sessions by week, provides activity filters and illustrated exercise art. It remains under Profile.
- Onboarding no longer seeds demo data. Default account views exclude legacy sample/simulated sessions and fictional friends; generated samples remain available separately.

## Original generated assets

Created with the built-in image generation tool and copied into this repository:

- `assets/exercise-atlas.png`: 12 warm, dimensional equipment illustrations, transparent background. The supplied activity-picker screenshot was used only as style reference. UI clips individual atlas cells.
- `assets/community-portraits.png`: six fictional adult headshots, soft neutral backgrounds, cropped in the UI.
- `assets/community-workouts.png`: original Pilates studio and climbing gym sample photographs, with small UI-rendered stickers overlaid.

No third-party app screenshots or extracted proprietary image/font files are bundled.

## Release evidence

Automated database, native-adapter, typecheck, lint, visual and IPA checks are recorded in the validation documents and release status. The gallery renders the actual app components with clearly labeled local fixtures; camera, database, and notification adapters in the gallery are simulations.

The new departure guard and live studio endpoint require the accompanying incremental Supabase release. The prepared release script checks the baseline, preserves a revoked rollback copy, and does not reset existing users or tables. Do not describe it as deployed until a hosted audit confirms application.

Physical iPhone notification timing, geofence delivery after a real gym visit, and the native picker/export experience remain unverified until tested on the device. iOS background execution is still best effort, especially after force-quitting.
