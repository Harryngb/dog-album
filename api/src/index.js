/**
 * 狗狗相册 API — Cloudflare Worker
 *
 * 功能：点赞、评论、弹幕
 * 依赖：D1 数据库 (binding: DB)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// ---------- Route handlers ----------

async function toggleLike(db, body) {
  const { photoId, visitorId } = body;
  if (!photoId || !visitorId) return error('Missing photoId or visitorId');

  const existing = await db.prepare(
    'SELECT id FROM likes WHERE photo_id = ? AND visitor_id = ?'
  ).bind(photoId, visitorId).first();

  if (existing) {
    await db.prepare('DELETE FROM likes WHERE id = ?').bind(existing.id).run();
  } else {
    await db.prepare('INSERT INTO likes (photo_id, visitor_id) VALUES (?, ?)').bind(photoId, visitorId).run();
  }

  const { count } = await db.prepare(
    'SELECT COUNT(*) as count FROM likes WHERE photo_id = ?'
  ).bind(photoId).first();

  return json({ photoId, liked: !existing, count });
}

async function getLikes(db, url) {
  const photoId = url.searchParams.get('photoId');
  const photoIds = url.searchParams.get('photoIds');
  const visitorId = url.searchParams.get('visitorId');

  // Batch query for gallery grid
  if (photoIds) {
    const ids = photoIds.split(',').filter(Boolean);
    if (ids.length === 0) return json({ counts: {} });

    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT photo_id, COUNT(*) as count FROM likes WHERE photo_id IN (${placeholders}) GROUP BY photo_id`
    ).bind(...ids).all();

    const counts = {};
    for (const id of ids) counts[id] = 0;
    for (const row of rows.results || []) counts[row.photo_id] = row.count;

    let liked = [];
    if (visitorId) {
      const likedRows = await db.prepare(
        `SELECT photo_id FROM likes WHERE photo_id IN (${placeholders}) AND visitor_id = ?`
      ).bind(...ids, visitorId).all();
      liked = (likedRows.results || []).map(r => r.photo_id);
    }

    return json({ counts, liked });
  }

  // Single photo query
  if (photoId) {
    const { count } = await db.prepare(
      'SELECT COUNT(*) as count FROM likes WHERE photo_id = ?'
    ).bind(photoId).first();
    let liked = false;
    if (visitorId) {
      const row = await db.prepare('SELECT 1 FROM likes WHERE photo_id = ? AND visitor_id = ?').bind(photoId, visitorId).first();
      liked = !!row;
    }
    return json({ photoId, count, liked });
  }

  return error('Missing photoId or photoIds');
}

async function getComments(db, url) {
  const photoId = url.searchParams.get('photoId');
  if (!photoId) return error('Missing photoId');
  const { results } = await db.prepare(
    'SELECT id, author, text, created_at FROM comments WHERE photo_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(photoId).all();
  return json({ comments: results || [] });
}

async function addComment(db, body) {
  const { photoId, text, author } = body;
  if (!photoId || !text) return error('Missing photoId or text');
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return error('Comment cannot be empty');
  const result = await db.prepare(
    'INSERT INTO comments (photo_id, author, text) VALUES (?, ?, ?)'
  ).bind(photoId, (author || '匿名').trim().slice(0, 30) || '匿名', trimmed).run();
  return json({ success: true, id: result.meta?.last_row_id });
}

async function getDanmaku(db, url) {
  const photoId = url.searchParams.get('photoId');
  if (!photoId) return error('Missing photoId');
  const { results } = await db.prepare(
    'SELECT id, text, color, created_at FROM danmaku WHERE photo_id = ? ORDER BY created_at DESC LIMIT 200'
  ).bind(photoId).all();
  return json({ danmaku: (results || []).reverse() }); // 按时间正序返回
}

async function addDanmaku(db, body) {
  const { photoId, text, color } = body;
  if (!photoId || !text) return error('Missing photoId or text');
  const trimmed = text.trim().slice(0, 100);
  if (!trimmed) return error('Danmaku cannot be empty');
  const result = await db.prepare(
    'INSERT INTO danmaku (photo_id, text, color) VALUES (?, ?, ?)'
  ).bind(photoId, trimmed, color || '#ffffff').run();
  return json({ success: true, id: result.meta?.last_row_id });
}

async function getReactions(db, url) {
  const photoId = url.searchParams.get('photoId');
  const photoIds = url.searchParams.get('photoIds');
  const visitorId = url.searchParams.get('visitorId');

  if (photoIds) {
    const ids = photoIds.split(',').filter(Boolean);
    if (ids.length === 0) return json({ reactions: {} });

    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.prepare(
      `SELECT photo_id, emoji, COUNT(*) as count FROM reactions WHERE photo_id IN (${placeholders}) GROUP BY photo_id, emoji`
    ).bind(...ids).all();

    const grouped = {};
    for (const id of ids) grouped[id] = {};
    for (const row of rows.results || []) {
      if (!grouped[row.photo_id]) grouped[row.photo_id] = {};
      grouped[row.photo_id][row.emoji] = row.count;
    }

    let myReactions = {};
    if (visitorId) {
      const myRows = await db.prepare(
        `SELECT photo_id, emoji FROM reactions WHERE photo_id IN (${placeholders}) AND visitor_id = ?`
      ).bind(...ids, visitorId).all();
      for (const row of myRows.results || []) {
        if (!myReactions[row.photo_id]) myReactions[row.photo_id] = [];
        myReactions[row.photo_id].push(row.emoji);
      }
    }

    return json({ reactions: grouped, myReactions });
  }

  if (photoId) {
    const { results } = await db.prepare(
      'SELECT emoji, COUNT(*) as count FROM reactions WHERE photo_id = ? GROUP BY emoji'
    ).bind(photoId).all();
    const counts = {};
    for (const row of results || []) counts[row.emoji] = row.count;

    let myReactions = [];
    if (visitorId) {
      const myRows = await db.prepare(
        'SELECT emoji FROM reactions WHERE photo_id = ? AND visitor_id = ?'
      ).bind(photoId, visitorId).all();
      myReactions = (myRows.results || []).map(r => r.emoji);
    }

    return json({ reactions: counts, myReactions });
  }

  return error('Missing photoId or photoIds');
}

async function toggleReaction(db, body) {
  const { photoId, emoji, visitorId } = body;
  if (!photoId || !emoji || !visitorId) return error('Missing required fields');

  const existing = await db.prepare(
    'SELECT id FROM reactions WHERE photo_id = ? AND emoji = ? AND visitor_id = ?'
  ).bind(photoId, emoji, visitorId).first();

  if (existing) {
    await db.prepare('DELETE FROM reactions WHERE id = ?').bind(existing.id).run();
  } else {
    await db.prepare('INSERT INTO reactions (photo_id, emoji, visitor_id) VALUES (?, ?, ?)').bind(photoId, emoji, visitorId).run();
  }

  const { count } = await db.prepare(
    'SELECT COUNT(*) as count FROM reactions WHERE photo_id = ? AND emoji = ?'
  ).bind(photoId, emoji).first();

  return json({ photoId, emoji, reacted: !existing, count });
}

// ============================================================
// Photo upload / list / serve
// ============================================================

const ALLOWED_EXT = ['.jpg','.jpeg','.png','.webp','.gif','.avif'];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

async function listPhotos(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, filename, caption, added_at FROM photos ORDER BY added_at DESC'
  ).all();

  const photos = (results || []).map(row => ({
    id: row.id,
    filename: row.filename,
    caption: row.caption || '',
    date: row.added_at ? row.added_at.slice(0, 10) : '',
    url: `/photos/${row.id}`,
  }));

  return json({ photos });
}

async function uploadPhoto(env, request) {
  let formData;
  try {
    formData = await request.formData();
  } catch (_) {
    return error('Invalid form data');
  }

  const file = formData.get('photo');
  if (!file || typeof file === 'string') return error('请选择一张照片');

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) return error('不支持的文件格式，请上传 JPG/PNG/WebP/AVIF/GIF');

  if (file.size > MAX_SIZE) return error('照片太大，请压缩到 20MB 以内');

  const id = crypto.randomUUID() + ext;
  const caption = (formData.get('caption') || '').trim().slice(0, 100);

  await env.PHOTOS.put(id, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  await env.DB.prepare(
    'INSERT INTO photos (id, filename, caption) VALUES (?, ?, ?)'
  ).bind(id, file.name, caption).run();

  return json({
    success: true,
    photo: {
      id,
      filename: file.name,
      caption,
      date: new Date().toISOString().slice(0, 10),
      url: `/photos/${id}`,
    },
  });
}

async function servePhoto(env, path) {
  const key = path.replace('/photos/', '');
  const object = await env.PHOTOS.get(key);
  if (!object) return error('照片未找到', 404);

  return new Response(object.body, {
    headers: {
      ...CORS,
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

// ---------- Router ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.DB;

    try {
      // Photo serving (not under /api)
      if (path.startsWith('/photos/') && request.method === 'GET') {
        return servePhoto(env, path);
      }

      switch (path) {
        case '/api/health':
          return json({ status: 'ok', time: new Date().toISOString() });

        case '/api/photos':
          if (request.method === 'GET') return listPhotos(env);
          return error('Method not allowed', 405);

        case '/api/photos/upload':
          if (request.method === 'POST') return uploadPhoto(env, request);
          return error('Method not allowed', 405);

        case '/api/likes':
          if (request.method === 'GET') return getLikes(db, url);
          return error('Method not allowed', 405);

        case '/api/like':
          if (request.method === 'POST') return toggleLike(db, await request.json());
          return error('Method not allowed', 405);

        case '/api/comments':
          if (request.method === 'GET') return getComments(db, url);
          if (request.method === 'POST') return addComment(db, await request.json());
          return error('Method not allowed', 405);

        case '/api/danmaku':
          if (request.method === 'GET') return getDanmaku(db, url);
          if (request.method === 'POST') return addDanmaku(db, await request.json());
          return error('Method not allowed', 405);

        case '/api/reactions':
          if (request.method === 'GET') return getReactions(db, url);
          return error('Method not allowed', 405);

        case '/api/reaction':
          if (request.method === 'POST') return toggleReaction(db, await request.json());
          return error('Method not allowed', 405);

        default:
          return error('Not found', 404);
      }
    } catch (err) {
      return error(err.message, 500);
    }
  },
};
