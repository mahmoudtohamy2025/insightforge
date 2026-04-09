-- Referral system for participant marketplace
-- Track referral codes, relationships, and bonus payouts

CREATE TABLE IF NOT EXISTS participant_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES participant_profiles(id) ON DELETE SET NULL,
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'completed', 'paid')),
  -- Bonus tracking
  referrer_bonus_cents INTEGER DEFAULT 200,   -- $2.00 for referrer
  referred_bonus_cents INTEGER DEFAULT 200,   -- $2.00 for the new participant
  referrer_bonus_paid BOOLEAN DEFAULT FALSE,
  referred_bonus_paid BOOLEAN DEFAULT FALSE,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_up_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for fast lookup of referral codes and referrer history
CREATE INDEX IF NOT EXISTS idx_referrals_code ON participant_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON participant_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON participant_referrals(referred_id);

-- RLS
ALTER TABLE participant_referrals ENABLE ROW LEVEL SECURITY;

-- Participants can only see their own referral records (as referrer or referred)
CREATE POLICY "own_referrals" ON participant_referrals
  FOR SELECT USING (
    referrer_id IN (SELECT id FROM participant_profiles WHERE user_id = auth.uid())
    OR referred_id IN (SELECT id FROM participant_profiles WHERE user_id = auth.uid())
  );
