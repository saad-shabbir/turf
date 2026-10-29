// Drains ClassStreak's push queue to Expo's push service. It holds no user input:
// a call only sends what the database already queued, so the scheduler and the
// database can wake it without a user token. Deploy with --no-verify-jwt.
// The service key stays inside this function; it is never sent to the app.
type Claimed={id:number;title:string;body:string;data:Record<string,unknown>;tokens:string[]};
type Ticket={status:'ok'|'error';message?:string;details?:{error?:string}};
const origin=Deno.env.get('SUPABASE_URL')!;const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={authorization:'Bearer '+key,apikey:key,'Content-Type':'application/json'};
const rpc=async(name:string,body:unknown)=>{const r=await fetch(`${origin}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(body)});if(!r.ok)throw new Error(`${name} ${r.status}`);return r.status===204?null:r.json();};
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 let sent=0;
 for(let round=0;round<5;round++){
  const claimed=await rpc('cs_push_claim',{max_items:100}) as Claimed[];if(!claimed.length)break;
  const results:{id:number;ok:boolean;error?:string;invalid_tokens:string[]}[]=[];
  for(const item of claimed){
   if(!item.tokens.length){results.push({id:item.id,ok:true,invalid_tokens:[]});continue;}
   const messages=item.tokens.map(to=>({to,title:item.title,body:item.body,data:item.data,sound:'default',...(item.data.kind==='friend_started'?{categoryId:'friend-started'}:item.data.kind==='workout_check'?{categoryId:'workout-check'}:{})}));
   try{
    const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',accept:'application/json'},body:JSON.stringify(messages)});
    const json=await response.json().catch(()=>({})) as {data?:Ticket[];errors?:{message:string}[]};
    if(!response.ok||!Array.isArray(json.data)){results.push({id:item.id,ok:false,error:json.errors?.[0]?.message??`HTTP ${response.status}`,invalid_tokens:[]});continue;}
    const invalid=item.tokens.filter((_,i)=>json.data![i]?.details?.error==='DeviceNotRegistered');
    const ok=json.data.some(t=>t.status==='ok');
    results.push({id:item.id,ok,error:ok?undefined:json.data[0]?.message,invalid_tokens:invalid});if(ok)sent++;
   }catch(error){results.push({id:item.id,ok:false,error:String(error).slice(0,200),invalid_tokens:[]});}
  }
  await rpc('cs_push_done',{results});
 }
 return Response.json({sent});
});
