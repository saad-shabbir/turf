import type {FriendProfile,Snapshot} from './model';

export type FriendProfileState={profile:FriendProfile|null;loading:boolean;sending:boolean;error:unknown|null;sent:boolean};
type Request=<T>(name:string,args:Record<string,unknown>)=>Promise<T>;

// One controller belongs to one mounted owner/peer screen. Late responses from
// a closed screen cannot change its successor or install an old account cache.
export function createFriendProfileSession({ownerId,peerId,request,onState,onSnapshot}:{ownerId:string;peerId:string;request:Request;onState:(state:FriendProfileState)=>void;onSnapshot:(snapshot:Snapshot)=>void}){
 let active=true,loadId=0;
 let state:FriendProfileState={profile:null,loading:true,sending:false,error:null,sent:false};
 const update=(patch:Partial<FriendProfileState>)=>{if(active){state={...state,...patch};onState(state);}};
 const load=async(preserveError=false)=>{
  if(!active)return;
  const id=++loadId;
  update({loading:true,...(!preserveError?{error:null}:{})});
  try{
   const profile=await request<FriendProfile>('cs_friend_profile',{peer:peerId});
   if(!active||id!==loadId)return;
   if(!profile||profile.id!==peerId)throw new Error('FORBIDDEN');
   update({profile,loading:false});
  }catch(error){if(active&&id===loadId)update({profile:null,loading:false,error});}
 };
 const nudge=async()=>{
  if(!active||state.sending||state.loading||!state.profile||state.profile.is_demo||state.profile.worked_out_today||state.profile.nudged_today||!state.profile.nudge_available)return;
  // Invalidate a preceding refresh before starting the write.
  ++loadId;
  update({sending:true,error:null,sent:false});
  try{
   const snapshot=await request<Snapshot>('cs_social',{action:'nudge',payload:{id:peerId}});
   if(!active)return;
   if(snapshot?.profile?.id!==ownerId)throw new Error('AUTH_REQUIRED');
   update({profile:{...state.profile!,nudge_available:false,nudged_today:true},sent:true});
   onSnapshot(snapshot);
   if(active)await load();
  }catch(error){
   if(!active)return;
   update({error});
   // A lost response might still have reached the server. Read availability
   // before allowing a retry; never report success from a failed request.
   await load(true);
  }finally{update({sending:false});}
 };
 return {load,nudge,dispose(){active=false;++loadId;}};
}
