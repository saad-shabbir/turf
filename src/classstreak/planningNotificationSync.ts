import type {Reminder} from './reminder-plan.ts';

export type ReminderTransport={list:()=>Promise<{identifier:string;content?:{data?:Record<string,unknown>}}[]>;cancel:(id:string)=>Promise<void>;schedule:(reminder:Reminder,fingerprint:string)=>Promise<void>};
export const plannedNotificationId=(id:string)=>/^(usual|risk|recap|plan):/.test(id);
export const reminderFingerprint=(reminder:Reminder)=>JSON.stringify([reminder.at.toISOString(),reminder.title,reminder.body,reminder.pane]);
// Reconcile against the OS, not only a cached fingerprint: OS schedules can be
// removed by permissions changes or a previous partial scheduling failure.
export async function reconcilePlannedNotifications(planned:Reminder[],transport:ReminderTransport){
 const wanted=new Map(planned.map(r=>[r.id,r]));const existing=(await transport.list()).filter(n=>plannedNotificationId(n.identifier));
 for(const n of existing){const r=wanted.get(n.identifier);if(!r||n.content?.data?.planning_fingerprint!==reminderFingerprint(r))await transport.cancel(n.identifier);else wanted.delete(n.identifier);}
 for(const reminder of wanted.values())await transport.schedule(reminder,reminderFingerprint(reminder));
}
