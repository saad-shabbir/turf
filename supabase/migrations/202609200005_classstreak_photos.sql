create function public.cs_can_write_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and split_part(path,'/',1)=auth.uid()::text and path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
 and exists(select 1 from classstreak.sessions s where s.id::text=split_part(path,'/',2) and s.user_id=classstreak.me() and s.removed_at is null)
$$;
create function public.cs_can_read_photo(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from classstreak.sessions s join classstreak.users u on u.id=s.user_id where s.id::text=split_part(path,'/',2) and u.auth_id::text=split_part(path,'/',1) and (s.photo_url=path or s.user_id=classstreak.me()) and classstreak.can_see_session(classstreak.me(),s.id))
$$;
-- Storage exists on hosted Supabase. Tests also apply these policies to its contract fixture.
do $$begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('classstreak-photos','classstreak-photos',false,10485760,array['image/jpeg']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  create policy cs_photos_read on storage.objects for select to authenticated using(bucket_id='classstreak-photos' and public.cs_can_read_photo(name));
  create policy cs_photos_insert on storage.objects for insert to authenticated with check(bucket_id='classstreak-photos' and public.cs_can_write_photo(name));
  create policy cs_photos_update on storage.objects for update to authenticated using(bucket_id='classstreak-photos' and public.cs_can_write_photo(name)) with check(bucket_id='classstreak-photos' and public.cs_can_write_photo(name));
  create policy cs_photos_delete on storage.objects for delete to authenticated using(bucket_id='classstreak-photos' and split_part(name,'/',1)=auth.uid()::text);
 end if;
end $$;
create function public.cs_attach_photo(session_id uuid,path text,note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=classstreak.me();uploaded boolean;begin
 if not public.cs_can_write_photo(path) or split_part(path,'/',2)<>session_id::text then raise exception 'FORBIDDEN';end if;
 if to_regclass('storage.objects') is null then raise exception 'STORAGE_NOT_READY';end if;
 execute 'select exists(select 1 from storage.objects where bucket_id=''classstreak-photos'' and name=$1)' into uploaded using path;
 if not uploaded then raise exception 'PHOTO_NOT_UPLOADED';end if;
 update classstreak.sessions set photo_url=path,note=cs_attach_photo.note where id=session_id and user_id=u and removed_at is null;
 return public.cs_snapshot();
end $$;
revoke all on function public.cs_can_read_photo(text),public.cs_can_write_photo(text),public.cs_attach_photo(uuid,text,text) from public,anon;
grant execute on function public.cs_can_read_photo(text),public.cs_can_write_photo(text),public.cs_attach_photo(uuid,text,text) to authenticated;
