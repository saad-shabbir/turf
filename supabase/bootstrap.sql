-- ADMIN ONLY. Replace the two placeholders with existing CONFIRMED Auth UUIDs.
-- Never run fixture/test/reset SQL on the hosted production project.
begin;
do $$
declare a uuid := 'REPLACE_WITH_FIRST_AUTH_UUID'; b uuid := 'REPLACE_WITH_SECOND_AUTH_UUID';
begin
 if a=b or (select count(*) from auth.users where id in(a,b) and email_confirmed_at is not null)<>2 then raise exception 'Two distinct confirmed Auth users required'; end if;
 insert into private.allowed_users(slot,user_id) values(1,a),(2,b);
 insert into public.profiles(user_id,display_name) values(a,'Participant 1'),(b,'Participant 2');
 insert into public.user_settings(user_id) values(a),(b);
end $$;
commit;
