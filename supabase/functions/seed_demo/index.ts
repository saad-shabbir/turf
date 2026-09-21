// Auth is forwarded to PostgREST. No service-role key or caller-supplied owner is used.
Deno.serve(async(request:Request)=>{
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 const authorization=request.headers.get("authorization");if(!authorization)return new Response("Sign in required",{status:401});
 const body=await request.json().catch(()=>({}));
 const response=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/cs_seed_demo",{method:"POST",headers:{authorization,apikey:Deno.env.get("SUPABASE_ANON_KEY")!,"Content-Type":"application/json"},body:JSON.stringify({remove_demo:body.remove_demo===true,demo_places:Array.isArray(body.demo_places)?body.demo_places:[]})});
 return new Response(await response.text(),{status:response.status,headers:{"Content-Type":"application/json"}});
});
