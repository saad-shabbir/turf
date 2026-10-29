import type {PhotoKind} from './model.ts';
export const TWO_HOURS=2*3600000,THREE_HOURS=3*3600000;
// Credit a forgotten timer up to the later of the 2-hour mark and the last time
// the person used the app during the workout, never past 3 hours. The server's
// classstreak.credited_end uses the same rule.
export function creditedEnd(startedAt:number,lastActivity:number|null){
 return Math.min(startedAt+THREE_HOURS,Math.max(startedAt+TWO_HOURS,lastActivity??startedAt));
}
// The photo picker's default: nothing running means pre; running means mid,
// or post once it has run 30 minutes or the person is ending it now.
export function defaultPhotoKind(startedAt:number|null,now:number,ending=false):PhotoKind{
 if(startedAt===null)return 'pre';
 return ending||now-startedAt>=30*60000?'post':'mid';
}
// Which choices can change the timer in "Verify a workout" mode.
export function verifyChoices(running:boolean):PhotoKind[]{return running?['mid','post']:['pre'];}
