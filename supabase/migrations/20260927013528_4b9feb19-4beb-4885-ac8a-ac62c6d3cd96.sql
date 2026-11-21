insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, confirmation_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'teste.comanda@tmp.local', extensions.crypt('Teste@2026', extensions.gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Teste Comanda"}', '', '', '');

update public.profiles p set role = 'cashier', store_id = (select id from public.stores order by created_at limit 1)
where p.user_id = (select id from auth.users where email = 'teste.comanda@tmp.local');

insert into public.user_stores (user_id, store_id)
select u.id, s.id from auth.users u cross join public.stores s
where u.email = 'teste.comanda@tmp.local';
