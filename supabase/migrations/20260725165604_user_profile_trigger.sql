-- Migration 006: users-row trigger (closes the F01 deviation).
-- Creates the public.users row automatically when a phone user signs up.
-- The client-side ensureProfile() remains as a no-op fallback.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only phone signups get a patient row; provider/admin (email) users are
  -- provisioned through their own tables.
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.users (id, phone)
  VALUES (
    NEW.id,
    CASE WHEN NEW.phone LIKE '+%' THEN NEW.phone ELSE '+' || NEW.phone END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: any existing phone auth users missing a public.users row
INSERT INTO public.users (id, phone)
SELECT au.id,
       CASE WHEN au.phone LIKE '+%' THEN au.phone ELSE '+' || au.phone END
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
  AND au.phone IS NOT NULL
  AND au.phone <> ''
ON CONFLICT (id) DO NOTHING;
