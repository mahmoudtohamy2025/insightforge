-- A4 (B1): seed starter segments on signup so a new user can run a focus group immediately.
--
-- A focus group requires >= 2 segments (enforced in FocusGroupStudio + simulate-focus-group).
-- Previously signup created 0 segments, so new users dead-ended in Focus Group Studio.
-- This extends handle_new_user() to seed 3 generic starter segments into the freshly
-- created workspace. The seed is wrapped in an exception block: if it fails for any
-- reason it must NOT block account creation (the user can always create segments by hand).
--
-- Body below is identical to migration 20260308155823 plus the seeding block.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_name TEXT;
  ws_slug TEXT;
  ws_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'researcher');

  -- Create default workspace
  ws_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'My') || '''s Workspace'
  );
  ws_slug := lower(regexp_replace(ws_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Ensure slug uniqueness by appending random suffix
  ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (gen_random_uuid(), ws_name, ws_slug, new.id)
  RETURNING id INTO ws_id;

  -- Add user as owner of the workspace
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (ws_id, new.id, 'owner');

  -- Seed 3 starter segments so the user can immediately run a focus group (needs >= 2).
  -- Best-effort: never let seeding failure block signup.
  BEGIN
    INSERT INTO public.segment_profiles (workspace_id, name, description, demographics, psychographics, created_by)
    VALUES
      (ws_id, 'Budget-Conscious Millennials',
       'Value-driven 28-40s who research before buying and respond to clear ROI and deals.',
       '{"age_range":"28-40","gender":"mixed","location":"United States","income_level":"middle"}'::jsonb,
       '{"values":["value for money","practicality","deal-seeking"],"interests":["personal finance","reviews","sustainability"]}'::jsonb,
       new.id),
      (ws_id, 'Affluent Early Adopters',
       'Tech-savvy 25-40 urban professionals with higher income who pay a premium for innovation and convenience.',
       '{"age_range":"25-40","gender":"mixed","location":"Urban US","income_level":"high"}'::jsonb,
       '{"values":["innovation","status","convenience"],"interests":["technology","productivity","premium brands"]}'::jsonb,
       new.id),
      (ws_id, 'Practical Gen X Parents',
       'Time-pressed 41-55 parents who prioritise reliability, family value and anything that saves time.',
       '{"age_range":"41-55","gender":"mixed","location":"Suburban US","income_level":"middle-high"}'::jsonb,
       '{"values":["reliability","family","time-saving"],"interests":["family activities","home","value brands"]}'::jsonb,
       new.id);
  EXCEPTION WHEN OTHERS THEN
    -- Swallow: starter segments are a convenience, not a signup prerequisite.
    NULL;
  END;

  RETURN new;
END;
$$;
