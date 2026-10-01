export type CaptureStatus={matches:boolean;active:boolean;started_at:string|null;stopped_at:string|null;server_time:string};
export function captureHoldReason(event:{source:string;observed_at:string},status:CaptureStatus):string|null{
 if(event.source!=="geofence")return null;
 const at=Date.parse(event.observed_at),now=Date.parse(status.server_time);
 if(!Number.isFinite(at)||!Number.isFinite(now))return null;
 if(!status.matches)return "Previous tracking setup";
 if(at<now-30*86400000)return "Outside the 30-day upload window";
 if(status.started_at&&at<Date.parse(status.started_at)-300000)return "Before this tracking setup";
 if(!status.active&&status.stopped_at&&at>Date.parse(status.stopped_at))return "Recorded after tracking was paused";
 return null;
}
