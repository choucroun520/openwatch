-- ─── Invite codes table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  max_uses INTEGER NOT NULL DEFAULT 1,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 10 initial invite codes
INSERT INTO invite_codes (code, max_uses, notes) VALUES
  ('OW-DEALER-001', 1, 'Founding dealer slot 1'),
  ('OW-DEALER-002', 1, 'Founding dealer slot 2'),
  ('OW-DEALER-003', 1, 'Founding dealer slot 3'),
  ('OW-DEALER-004', 1, 'Founding dealer slot 4'),
  ('OW-DEALER-005', 1, 'Founding dealer slot 5'),
  ('OW-DEALER-006', 1, 'Founding dealer slot 6'),
  ('OW-DEALER-007', 1, 'Founding dealer slot 7'),
  ('OW-DEALER-008', 1, 'Founding dealer slot 8'),
  ('OW-DEALER-009', 1, 'Founding dealer slot 9'),
  ('OW-DEALER-010', 1, 'Founding dealer slot 10')
ON CONFLICT (code) DO NOTHING;
