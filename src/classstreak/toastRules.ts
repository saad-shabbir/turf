export type ToastTone='success'|'info'|'error';
// Long enough to read: about 2.5 s for short confirmations and 5 s for errors,
// longer for long text, and twice as long with VoiceOver on.
export function toastDuration(text:string,tone:ToastTone,screenReader=false){
 const base=tone==='error'?5000:2500;
 const reading=Math.min(tone==='error'?9000:7000,1200+text.length*45);
 const ms=Math.max(base,reading);
 return screenReader?ms*2:ms;
}
// Storage errors stay on screen with their recovery steps instead of a toast.
export const isStorageProblem=(text:string)=>text.startsWith('Could not open this iPhone’s saved data')||text.startsWith("Could not open this iPhone's saved data");
