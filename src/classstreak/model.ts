export const activities = [
  { key: "reformer", label: "Reformer Pilates", short: "Pilates", icon: "reformer", minutes: 35, goal: 2 },
  { key: "mat", label: "Mat Pilates", short: "Mat Pilates", icon: "mat", minutes: 35, goal: 2 },
  { key: "hot", label: "Hot Pilates", short: "Hot Pilates", icon: "flame", minutes: 35, goal: 2 },
  { key: "yoga", label: "Yoga", short: "Yoga", icon: "yoga", minutes: 35, goal: 1 },
  { key: "cycling", label: "Cycling", short: "Cycling", icon: "bike", minutes: 30, goal: 2 },
  { key: "barre", label: "Barre", short: "Barre", icon: "barre", minutes: 35, goal: 2 },
  { key: "hiit", label: "HIIT", short: "HIIT", icon: "bolt", minutes: 30, goal: 2 },
  { key: "boxing", label: "Boxing", short: "Boxing", icon: "glove", minutes: 30, goal: 2 },
  { key: "gym", label: "Gym / weights", short: "Gym", icon: "dumbbell", minutes: 25, goal: 3 },
] as const;
export type ActivityKey = (typeof activities)[number]["key"];
export type ThemeName = "blush" | "sage" | "clay";
export type TimeOfDay = "morning" | "midday" | "evening";
export type Source = "geofence" | "manual" | "seed" | "simulated";
export const activity = (key: string) => activities.find(a => a.key === key) ?? activities[0];
export type Goal = { activity_key: ActivityKey; goal: number };
export type Place = { id: string; venue_id?: string; name: string; google_place_id?: string; activity_key: ActivityKey; lat: number; lng: number; radius_m: number; enabled: boolean; share_name: boolean; last_workout_label?: string };
export type Session = { id: string; user_id: string; place_id: string | null; venue_id?: string; activity_key: ActivityKey; workout_label: string; started_at: string; ended_at: string; duration_sec: number; source: Source; counted: boolean; verified: boolean; estimated: boolean; week_key: string; day_key: string; place_name?: string; photo_url?: string | null; note?: string; removed_at?: string | null };
export type Profile = { id: string; first_name: string; last_name: string; gender: string | null; tz: string; theme: ThemeName; share_place_name: boolean; show_on_board: boolean; share_simulated: boolean; health_verify: boolean; invite_code: string; phone_set?: boolean; notification_preferences: Record<string, boolean>; tracking_consent: boolean; created_at: string };
export type Week = { week_key: string; goal: number; goals: Goal[]; tz: string };
export type Friend = { id: string; first_name: string; status: "pending" | "accepted"; requested_by: string; weekly_count: number; weekly_goal: number; streak: number; days: number[]; usual_days: number[]; is_demo: boolean; time_of_day?: TimeOfDay; nudge_available?: boolean };
export type FeedItem = { id: string; user_id: string; first_name: string; activity_key: ActivityKey; workout_label: string; duration_sec: number; place_name: string | null; relative_time: string; source: Source; photo_url: string | null; note: string | null; reactions: { emoji: string; count: number; mine: boolean }[]; comments: { id: string; user_id: string; first_name: string; body: string }[] };
export type InboxItem = { id: string; kind: string; body: string; read_at: string | null; session_id: string | null };
export type Snapshot = { achievements?:{id:string;user_id:string;first_name:string;count:number;source:Source}[]; profile: Profile; goals: Goal[]; pending_goals: Goal[]; usual_days: { weekday: number; time_of_day: TimeOfDay }[]; places: Place[]; sessions: Session[]; weeks: Week[]; friends: Friend[]; feed: FeedItem[]; inbox: InboxItem[]; server_time: string };
export type Draft = { step: number; selected: ActivityKey[]; goals: Record<string, number>; place: Place | null; days: number[]; time: TimeOfDay; theme: ThemeName; first_name: string; last_name: string; gender: string | null; invite_code: string; location_consent: boolean };
export const newDraft = (): Draft => ({ step: 0, selected: [], goals: {}, place: null, days: [], time: "evening", theme: "blush", first_name: "", last_name: "", gender: null, invite_code: "", location_consent: false });
export function draftGoals(selected: ActivityKey[], previous: Record<string, number>): Record<string, number> {
  return Object.fromEntries(selected.map((key, i) => [key, i < 2 ? (previous[key] || activity(key).goal) : (previous[key] ?? 0)]));
}
export const weekDays = ["M", "T", "W", "T", "F", "S", "S"];
export const fullDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const timeLabel = { morning: "Morning", midday: "Midday", evening: "Evening" };
export function durationLabel(seconds: number, precise = false) {
  const minutes = Math.floor(seconds / 60);
  return precise ? `${minutes}m ${Math.floor(seconds % 60)}s` : `${minutes} min`;
}
export function safeMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Please try again.";
  const known: Record<string, string> = {
    AUTH_REQUIRED: "Please sign in again.", SETUP_REQUIRED: "Finish setting up your account.",
    PLACE_LIMIT: "You can track up to 12 saved places.", MANUAL_LIMIT: "You can add one manual session each week.",
    INVITE_INVALID: "That code isn't available. Check it and try again.", TOO_LATE: "The editing window has closed.",
    FORBIDDEN: "That item is no longer available.", NETWORK: "You're offline. Your saved visits will sync when you reconnect.",
    BACKEND_NOT_CONFIGURED: "The account service isn't configured for this build.",
    PERMISSION_REQUIRED: "Allow location access in iPhone Settings to start automatic tracking.",
    CAPTURE_EXPIRED:'These visits belong to a previous tracking setup. Open Account to review tracking.',
    ACCOUNT_DELETING:'Account deletion is pending. Use Delete account again to finish.',
    PLACE_REQUIRED:'Save a studio or gym before starting automatic tracking.',
    TRY_TOMORROW:"You have reached today’s limit. Please try again tomorrow.",PHONE_COUNTRY_CODE:"Include your country code, for example +1 for a US number.",NUDGE_UNAVAILABLE:"A nudge is not available for this friend right now.",
  };
  return known[raw] ?? (raw.length < 180 && !/token|secret|password=|sql|constraint/i.test(raw) ? raw : "That didn't work. Please try again.");
}
