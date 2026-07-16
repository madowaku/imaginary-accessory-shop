PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Mirage Visitor',
  balance INTEGER NOT NULL DEFAULT 1000 CHECK (balance >= 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE shops (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  theme_prompt TEXT NOT NULL,
  mood_tags_json TEXT NOT NULL DEFAULT '[]',
  share_slug TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  published_at INTEGER,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE accessories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('earrings', 'necklace', 'headpiece')),
  short_description TEXT NOT NULL,
  lore TEXT NOT NULL,
  impossible_feature TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price BETWEEN 100 AND 1000),
  image_prompt TEXT NOT NULL,
  placement_instruction TEXT NOT NULL,
  image_r2_key TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  buyer_user_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  accessory_id TEXT NOT NULL,
  accessory_name_snapshot TEXT NOT NULL,
  price_snapshot INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (buyer_user_id) REFERENCES users(id),
  FOREIGN KEY (shop_id) REFERENCES shops(id),
  FOREIGN KEY (accessory_id) REFERENCES accessories(id),
  UNIQUE (buyer_user_id, accessory_id)
);

CREATE TABLE try_ons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  accessory_id TEXT NOT NULL,
  source_r2_key TEXT,
  result_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'moderating', 'generating', 'completed', 'failed')),
  error_code TEXT,
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  source_deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (accessory_id) REFERENCES accessories(id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX idx_shops_owner ON shops(owner_user_id);
CREATE INDEX idx_shops_slug ON shops(share_slug);
CREATE INDEX idx_accessories_shop ON accessories(shop_id);
CREATE INDEX idx_purchases_buyer ON purchases(buyer_user_id);
CREATE INDEX idx_try_ons_user ON try_ons(user_id);
