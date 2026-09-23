type Value=string|number|boolean|number[];
const allowed=new Set(['onboarding_step','activities_selected','place_saved','usual_days_set','permission_result','theme_selected','account_created','session_logged','session_removed','workout_type_edited','sticker_shared','friend_request_sent','friend_added','reaction','comment','nudge_sent','reminder_opened','paywall_viewed','milestone']);
// Never pass names, coordinates, tokens, contact data, text or photos to analytics.
export function track(event:string,props:Record<string,Value>={}){if(allowed.has(event))console.info('[ClassStreak]',event,props);}
