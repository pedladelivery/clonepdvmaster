DO $$
DECLARE new_id uuid := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'luizalvaro80@gmail.com') THEN
    SELECT id INTO new_id FROM auth.users WHERE email = 'luizalvaro80@gmail.com';
  ELSE
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      'luizalvaro80@gmail.com', crypt('Admin@2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrador"}'::jsonb, now(), now()
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), new_id, new_id::text,
      json_build_object('sub', new_id::text, 'email', 'luizalvaro80@gmail.com', 'email_verified', true, 'phone_verified', false)::jsonb,
      'email', now(), now(), now());
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, permissions)
  VALUES (new_id, 'Administrador', 'admin',
    '{"catalog":true,"customers":true,"suppliers":true,"sellers":true,"pending_sales":true,"sales":true,"returns":true,"stock":true,"financial":true,"reports":true,"settings":true}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin', full_name = 'Administrador', permissions = EXCLUDED.permissions;
END $$;