-- Add is_admin column to agents table
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_agents_is_admin ON agents(is_admin) WHERE is_admin = TRUE;

-- Optional: Set first agent or specific agent as admin
-- UPDATE agents SET is_admin = TRUE WHERE name = 'admin';
-- Or: UPDATE agents SET is_admin = TRUE WHERE id = (SELECT id FROM agents ORDER BY created_at ASC LIMIT 1);

-- Comment: To make an agent admin, run:
-- UPDATE agents SET is_admin = TRUE WHERE name = 'your_admin_username';
