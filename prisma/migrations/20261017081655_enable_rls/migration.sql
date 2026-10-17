-- Enable RLS with no policies on every table.
-- The Supabase Data API (public key) can read nothing.
-- Prisma connects as the postgres role, which bypasses RLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Entry','Bullet','Skill','TargetProfile','Job','JobEvent','Interview','Contact',
    'JobContact','Reminder','Offer','TailoredResume','CoverLetter','PrepKit','AiCall','BonusCredit',
    'StripeEvent','UserMilestone','Referral','Lead','FreeToolRun','Feedback',
    'Testimonial','EmailLog'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
