-- ==============================================================================
-- SMARTNEST AI — ENQUIRIES & TWO-WAY MESSAGING SCHEMA (SUPABASE POSTGRESQL)
-- ==============================================================================

-- 1. ENQUIRIES TABLE
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  property_title TEXT NOT NULL,
  property_price NUMERIC DEFAULT 0,
  property_location TEXT DEFAULT 'Coimbatore',
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'responded' | 'closed'
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enquiries_seller ON enquiries(seller_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_buyer ON enquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_prop ON enquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);

-- 2. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  enquiry_id TEXT,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_email TEXT,
  property_id TEXT NOT NULL,
  property_title TEXT NOT NULL,
  property_image TEXT,
  property_price NUMERIC DEFAULT 0,
  property_location TEXT,
  status TEXT DEFAULT 'active',
  unread_for_buyer BOOLEAN DEFAULT false,
  unread_for_seller BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_seller ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_property ON conversations(property_id);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_role TEXT NOT NULL, -- 'buyer' | 'seller'
  sender_name TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT DEFAULT 'delivered', -- 'delivered' | 'read'
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at ASC);

-- Enable RLS
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow public/anon access if used with anon key, or authenticated user access
CREATE POLICY "Allow select on enquiries" ON enquiries FOR SELECT USING (true);
CREATE POLICY "Allow insert on enquiries" ON enquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on enquiries" ON enquiries FOR UPDATE USING (true);

CREATE POLICY "Allow select on conversations" ON conversations FOR SELECT USING (true);
CREATE POLICY "Allow insert on conversations" ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on conversations" ON conversations FOR UPDATE USING (true);

CREATE POLICY "Allow select on messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow insert on messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on messages" ON messages FOR UPDATE USING (true);
