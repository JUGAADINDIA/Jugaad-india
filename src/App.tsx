CREATE OR REPLACE FUNCTION public.notify_match_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_id uuid;
BEGIN
  SELECT user_id
  INTO customer_id
  FROM public.requests
  WHERE id = NEW.request_id;

  IF customer_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (user_id, title, message, type, request_id, match_id)
    VALUES
      (
        customer_id,
        '🧰 JUGAAD mil gaya!',
        'Provider ne aapka kaam pakad liya hai.',
        'match_created',
        NEW.request_id,
        NEW.id
      );
  END IF;

  INSERT INTO public.notifications
    (user_id, title, message, type, request_id, match_id)
  SELECT
    id,
    '🤝 Kaam pakda gaya!',
    'Ek provider ne customer ka kaam accept kiya hai.',
    'match_created',
    NEW.request_id,
    NEW.id
  FROM public.profiles
  WHERE lower(role) = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_match_created
ON public.matches;

CREATE TRIGGER trigger_notify_match_created
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.notify_match_created();
