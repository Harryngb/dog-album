-- Cloudflare D1 数据库表结构
-- 部署命令: npx wrangler d1 execute dog-album-db --file=schema.sql

CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(photo_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT NOT NULL,
    visitor_id TEXT DEFAULT '',
    author TEXT DEFAULT '匿名',
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS danmaku (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT NOT NULL,
    visitor_id TEXT DEFAULT '',
    text TEXT NOT NULL,
    color TEXT DEFAULT '#ffffff',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(photo_id, emoji, visitor_id)
);

CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    caption TEXT DEFAULT '',
    added_at TEXT DEFAULT (datetime('now'))
);

-- 索引加速
CREATE INDEX IF NOT EXISTS idx_likes_photo ON likes(photo_id);
CREATE INDEX IF NOT EXISTS idx_comments_photo ON comments(photo_id);
CREATE INDEX IF NOT EXISTS idx_danmaku_photo ON danmaku(photo_id);
CREATE INDEX IF NOT EXISTS idx_reactions_photo ON reactions(photo_id);
