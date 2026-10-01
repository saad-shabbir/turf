// Only this server-side function uses the service key. The user ID comes from Auth verification.
Deno.serve(async(request:Request)=>{
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 const authorization=request.headers.get("authorization");if(!authorization)return new Response("Sign in required",{status:401});
 const body=await request.json().catch(()=>({}));if(body.confirm!=="DELETE")return new Response("Confirmation required",{status:400});
 const origin=Deno.env.get("SUPABASE_URL")!;const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const user=await fetch(origin+"/auth/v1/user",{headers:{authorization,apikey:Deno.env.get("SUPABASE_ANON_KEY")!}});
 if(!user.ok)return new Response("Sign in again before deleting",{status:401});const {id}=await user.json();
 if(typeof id!=="string"||!/^[0-9a-f-]{36}$/.test(id))return new Response("Invalid account",{status:401});
 const prepared=await fetch(origin+"/rest/v1/rpc/cs_prepare_delete",{method:"POST",headers:{authorization,apikey:Deno.env.get("SUPABASE_ANON_KEY")!,"Content-Type":"application/json"},body:"{}"});
 if(!prepared.ok)return new Response("Could not pause account for deletion",{status:409});
 const headers={authorization:"Bearer "+key,apikey:key,"Content-Type":"application/json"};
 const removeTree=async(prefix:string):Promise<void>=>{
  for(let page=0;page<100;page++){
   const response=await fetch(origin+"/storage/v1/object/list/classstreak-photos",{method:"POST",headers,body:JSON.stringify({prefix,limit:100,offset:0})});if(!response.ok)throw new Error("Storage cleanup failed");
   const items=await response.json() as {name:string;id:string|null}[];if(!items.length)return;
   const files:string[]=[];for(const item of items){if(item.name.includes("/")||item.name==="..")throw new Error("Invalid storage path");const path=prefix+"/"+item.name;if(item.id)files.push(path);else await removeTree(path);}
   if(files.length){const removed=await fetch(origin+"/storage/v1/object/classstreak-photos",{method:"DELETE",headers,body:JSON.stringify({prefixes:files})});if(!removed.ok)throw new Error("Storage cleanup failed");}
  }throw new Error("Storage cleanup incomplete");
 };
 try{await removeTree(id);}catch{return new Response("Deletion paused. Please try deleting again to finish photo cleanup.",{status:503});}
 const deleted=await fetch(origin+"/auth/v1/admin/users/"+id,{method:"DELETE",headers});
 if(!deleted.ok)return new Response("Deletion paused. Please try again to finish.",{status:503});
 return Response.json({deleted:true});
});
