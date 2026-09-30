import {read,write} from '../db/local';
import type {Snapshot} from './model';

const key=(owner:string)=>'cs:home_setup_dismissed:'+owner;
export const loadSetupDismissed=(owner:string)=>read<boolean>(key(owner),false);
export const dismissSetup=(owner:string)=>write(key(owner),true);

export function setupProgress(s:Snapshot){
 const friends=Math.min(3,s.friends.filter(f=>f.status==='accepted'&&!f.is_demo).length);
 const place=s.places.some(p=>p.enabled);
 const workout=s.sessions.some(x=>!x.removed_at&&(x.source==='geofence'||x.source==='manual'));
 return {friends,place,workout,done:Number(friends===3)+Number(place)+Number(workout)};
}
