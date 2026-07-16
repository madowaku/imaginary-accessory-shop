import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Env, Variables } from './env';
import {
  editTryOn, generateCollection, generateProductImage, moderateImage, moderateText,
  type Category, type GeneratedAccessory,
} from './services/openai';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const createShopSchema = z.object({
  shopName: z.string().min(2).max(30),
  theme: z.string().min(10).max(300),
  moodTags: z.array(z.string().min(1).max(20)).max(3),
  categories: z.array(z.enum(['earrings', 'necklace', 'headpiece'])).length(3),
});

const purchaseSchema = z.object({ accessoryId: z.string().min(1) });

type AccessoryRow = {
  id: string; shop_id: string; name: string; category: Category; short_description: string;
  lore: string; impossible_feature: string; price: number; image_prompt: string;
  placement_instruction: string; image_r2_key: string | null; generation_status: string;
  generation_attempts: number; sort_order: number;
};

type ShopRow = {
  id: string; owner_user_id: string; name: string; description: string; theme_prompt: string;
  mood_tags_json: string; share_slug: string | null; status: string; sales_count: number;
};

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

app.onError((error, c) => {
  console.error(JSON.stringify({ event: 'request_error', category: errorCategory(error), message: error.message.slice(0, 240) }));
  if (error instanceof HTTPError) return c.json({ error: '匿名セッションを確認できません。再読み込みしてください。', code: 'unauthorized' }, 401);
  if (error instanceof z.ZodError) return c.json({ error: '入力内容を確認してください。', code: 'validation' }, 400);
  return c.json({ error: '処理に失敗しました。少し待ってから、もう一度お試しください。', code: errorCategory(error) }, 500);
});

app.use('/api/*', async (c, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    const expected = new URL(c.req.url).origin;
    if (origin && origin !== expected) return c.json({ error: '不正な送信元です。' }, 403);
  }
  await next();
});

app.post('/api/session/bootstrap', async (c) => {
  const existing = await findSessionUser(c);
  if (existing) return c.json(existing);
  const userId = `usr_${crypto.randomUUID()}`;
  const sessionId = `ses_${crypto.randomUUID()}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 2_592_000;
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO users (id) VALUES (?)').bind(userId),
    c.env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').bind(sessionId, userId, expiresAt),
  ]);
  const signature = await sign(sessionId, c.env.SESSION_SECRET);
  const production = c.env.APP_ENV === 'production';
  setCookie(c, production ? '__Host-mm_session' : 'mm_session', `${sessionId}.${signature}`, {
    httpOnly: true, secure: production, sameSite: 'Lax', path: '/', maxAge: 2_592_000,
  });
  return c.json({ id: userId, displayName: 'Mirage Visitor', balance: 1000, demoMode: !c.env.OPENAI_API_KEY }, 201);
});

app.get('/api/me', async (c) => {
  const user = await requireUser(c);
  return c.json(user);
});

app.post('/api/shops/generate', async (c) => {
  const user = await requireUser(c);
  const input = createShopSchema.parse(await c.req.json());
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM shops WHERE owner_user_id = ?').bind(user.id).first<{ count: number }>();
  if ((count?.count ?? 0) >= 3) return c.json({ error: '作成できるショップは3店までです。' }, 409);
  if (await moderateText(c.env, `${input.shopName}\n${input.theme}\n${input.moodTags.join(' ')}`)) {
    return c.json({ error: 'この内容では生成できませんでした。表現を変更してお試しください。' }, 422);
  }
  const generated = await generateCollection(c.env, input.shopName, input.theme, input.moodTags, input.categories);
  const shopId = `shop_${crypto.randomUUID()}`;
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(`INSERT INTO shops (id, owner_user_id, name, description, theme_prompt, mood_tags_json) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(shopId, user.id, input.shopName, generated.description, input.theme, JSON.stringify(input.moodTags)),
  ];
  const accessories = generated.accessories.map((item, index) => {
    const id = `acc_${crypto.randomUUID()}`;
    statements.push(c.env.DB.prepare(`INSERT INTO accessories (id, shop_id, name, category, short_description, lore, impossible_feature, price, image_prompt, placement_instruction, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, shopId, item.name, item.category, item.shortDescription, item.lore, item.impossibleFeature, item.price, item.imagePrompt, item.placementInstruction, index));
    return { id, ...item, generationStatus: 'pending' };
  });
  await c.env.DB.batch(statements);
  return c.json({
    shop: { id: shopId, name: input.shopName, description: generated.description, theme: input.theme, moodTags: input.moodTags },
    accessories, demoMode: generated.demo,
  }, 201);
});

app.get('/api/shops/:id/draft', async (c) => {
  const user = await requireUser(c);
  const shop = await c.env.DB.prepare('SELECT * FROM shops WHERE id = ? AND owner_user_id = ?').bind(c.req.param('id'), user.id).first<ShopRow>();
  if (!shop) return c.json({ error: 'ショップが見つかりません。' }, 404);
  return c.json(await hydrateShop(c.env, shop));
});

app.post('/api/accessories/:id/image', async (c) => {
  const user = await requireUser(c);
  const item = await c.env.DB.prepare(`SELECT a.* FROM accessories a JOIN shops s ON s.id = a.shop_id WHERE a.id = ? AND s.owner_user_id = ?`).bind(c.req.param('id'), user.id).first<AccessoryRow>();
  if (!item) return c.json({ error: '商品が見つかりません。' }, 404);
  if (item.generation_attempts >= 3) return c.json({ error: 'この商品の生成回数上限に達しました。' }, 409);
  await c.env.DB.prepare(`UPDATE accessories SET generation_status = 'generating', generation_attempts = generation_attempts + 1, updated_at = unixepoch() WHERE id = ?`).bind(item.id).run();
  try {
    const generated = await generateProductImage(c.env, toGenerated(item));
    const extension = generated.contentType === 'image/svg+xml' ? 'svg' : 'webp';
    const key = `products/${item.shop_id}/${item.id}.${extension}`;
    await c.env.IMAGES.put(key, generated.bytes, { httpMetadata: { contentType: generated.contentType, cacheControl: 'public, max-age=86400' } });
    await c.env.DB.prepare(`UPDATE accessories SET image_r2_key = ?, generation_status = 'completed', updated_at = unixepoch() WHERE id = ?`).bind(key, item.id).run();
    return c.json({ id: item.id, generationStatus: 'completed', imageUrl: `/media/products/${key.slice('products/'.length)}`, demoMode: generated.demo });
  } catch (error) {
    await c.env.DB.prepare(`UPDATE accessories SET generation_status = 'failed', updated_at = unixepoch() WHERE id = ?`).bind(item.id).run();
    throw error;
  }
});

app.post('/api/shops/:id/publish', async (c) => {
  const user = await requireUser(c);
  const shop = await c.env.DB.prepare('SELECT * FROM shops WHERE id = ? AND owner_user_id = ?').bind(c.req.param('id'), user.id).first<ShopRow>();
  if (!shop) return c.json({ error: 'ショップが見つかりません。' }, 404);
  const missing = await c.env.DB.prepare(`SELECT COUNT(*) AS count FROM accessories WHERE shop_id = ? AND generation_status != 'completed'`).bind(shop.id).first<{ count: number }>();
  if ((missing?.count ?? 0) > 0) return c.json({ error: 'すべての商品画像を完成させてください。' }, 409);
  const slug = shop.share_slug ?? `${slugify(shop.name)}-${crypto.randomUUID().slice(0, 7)}`;
  await c.env.DB.prepare(`UPDATE shops SET status = 'published', share_slug = ?, published_at = unixepoch(), updated_at = unixepoch() WHERE id = ?`).bind(slug, shop.id).run();
  return c.json({ shareSlug: slug, url: `/shops/${slug}` });
});

app.get('/api/public/shops/:slug', async (c) => {
  const shop = await c.env.DB.prepare(`SELECT * FROM shops WHERE share_slug = ? AND status = 'published'`).bind(c.req.param('slug')).first<ShopRow>();
  if (!shop) return c.json({ error: '公開ショップが見つかりません。' }, 404);
  return c.json(await hydrateShop(c.env, shop));
});

app.post('/api/purchases', async (c) => {
  const user = await requireUser(c);
  const { accessoryId } = purchaseSchema.parse(await c.req.json());
  const item = await c.env.DB.prepare(`SELECT a.*, s.status FROM accessories a JOIN shops s ON s.id = a.shop_id WHERE a.id = ? AND s.status = 'published'`).bind(accessoryId).first<AccessoryRow & { status: string }>();
  if (!item) return c.json({ error: '商品が見つかりません。' }, 404);
  const existing = await c.env.DB.prepare('SELECT id FROM purchases WHERE buyer_user_id = ? AND accessory_id = ?').bind(user.id, item.id).first();
  if (existing) return c.json({ error: 'この商品は購入済みです。' }, 409);
  const purchaseId = `pur_${crypto.randomUUID()}`;
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`INSERT OR IGNORE INTO purchases (id, buyer_user_id, shop_id, accessory_id, accessory_name_snapshot, price_snapshot) SELECT ?, ?, a.shop_id, a.id, a.name, a.price FROM accessories a JOIN users u ON u.id = ? WHERE a.id = ? AND u.balance >= a.price`).bind(purchaseId, user.id, user.id, item.id),
    c.env.DB.prepare(`UPDATE users SET balance = balance - (SELECT price_snapshot FROM purchases WHERE id = ?), updated_at = unixepoch() WHERE id = ? AND EXISTS (SELECT 1 FROM purchases WHERE id = ?)`).bind(purchaseId, user.id, purchaseId),
    c.env.DB.prepare(`UPDATE shops SET sales_count = sales_count + 1, updated_at = unixepoch() WHERE id = (SELECT shop_id FROM purchases WHERE id = ?)`).bind(purchaseId),
  ]);
  if ((batch[0].meta.changes ?? 0) === 0) return c.json({ error: '残高が不足しているか、この商品は購入済みです。' }, 409);
  const balance = await c.env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(user.id).first<{ balance: number }>();
  return c.json({ purchaseId, accessoryId: item.id, balance: balance?.balance ?? user.balance - item.price }, 201);
});

app.get('/api/purchases', async (c) => {
  const user = await requireUser(c);
  const rows = await c.env.DB.prepare(`SELECT p.id, p.accessory_id AS accessoryId, p.accessory_name_snapshot AS name, p.price_snapshot AS price, a.image_r2_key AS imageKey FROM purchases p JOIN accessories a ON a.id = p.accessory_id WHERE p.buyer_user_id = ? ORDER BY p.created_at DESC`).bind(user.id).all();
  return c.json({ purchases: rows.results });
});

app.post('/api/try-ons', async (c) => {
  const user = await requireUser(c);
  const form = await c.req.formData();
  const accessoryId = String(form.get('accessoryId') ?? '');
  const photo = form.get('photo');
  if (!(photo instanceof File)) return c.json({ error: '写真を選択してください。' }, 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) return c.json({ error: 'JPEG、PNG、WebPのみ使用できます。' }, 415);
  if (photo.size > 10 * 1024 * 1024) return c.json({ error: '写真は10MB以下にしてください。' }, 413);
  const item = await c.env.DB.prepare(`SELECT a.* FROM accessories a JOIN purchases p ON p.accessory_id = a.id WHERE a.id = ? AND p.buyer_user_id = ?`).bind(accessoryId, user.id).first<AccessoryRow>();
  if (!item) return c.json({ error: '購入した商品のみ試着できます。' }, 403);
  const today = Math.floor(Date.now() / 1000) - 86_400;
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM try_ons WHERE user_id = ? AND created_at >= ?').bind(user.id, today).first<{ count: number }>();
  if ((count?.count ?? 0) >= 3) return c.json({ error: '試着は1日3回までです。' }, 429);
  if (!item.image_r2_key) return c.json({ error: '商品画像がありません。' }, 409);
  const tryOnId = `try_${crypto.randomUUID()}`;
  const sourceKey = `try-on-source/${user.id}/${tryOnId}/source`;
  const sourceBytes = await photo.arrayBuffer();
  await c.env.IMAGES.put(sourceKey, sourceBytes, { httpMetadata: { contentType: photo.type } });
  await c.env.DB.prepare(`INSERT INTO try_ons (id, user_id, accessory_id, source_r2_key, status) VALUES (?, ?, ?, ?, 'moderating')`).bind(tryOnId, user.id, item.id, sourceKey).run();
  try {
    if (await moderateImage(c.env, sourceBytes, photo.type)) {
      await c.env.IMAGES.delete(sourceKey);
      await c.env.DB.prepare(`UPDATE try_ons SET status = 'failed', error_code = 'moderation_blocked', source_r2_key = NULL, source_deleted_at = unixepoch() WHERE id = ?`).bind(tryOnId).run();
      return c.json({ error: 'この内容では生成できませんでした。画像を変更してお試しください。' }, 422);
    }
    await c.env.DB.prepare(`UPDATE try_ons SET status = 'generating', generation_attempts = 1 WHERE id = ?`).bind(tryOnId).run();
    const productObject = await c.env.IMAGES.get(item.image_r2_key);
    if (!productObject) throw new Error('PRODUCT_IMAGE_MISSING');
    const result = await editTryOn(c.env, new Blob([sourceBytes], { type: photo.type }), new Blob([await productObject.arrayBuffer()], { type: productObject.httpMetadata?.contentType ?? 'image/webp' }), toGenerated(item));
    const extension = result.contentType === 'image/webp' ? 'webp' : photo.type.split('/')[1] || 'jpg';
    const resultKey = `try-on-result/${user.id}/${tryOnId}/result.${extension}`;
    await c.env.IMAGES.put(resultKey, result.bytes, { httpMetadata: { contentType: result.contentType, cacheControl: 'private, no-store' } });
    await c.env.DB.prepare(`UPDATE try_ons SET result_r2_key = ?, status = 'completed', source_r2_key = NULL, source_deleted_at = unixepoch(), completed_at = unixepoch() WHERE id = ?`).bind(resultKey, tryOnId).run();
    await c.env.IMAGES.delete(sourceKey);
    return c.json({ id: tryOnId, status: 'completed', resultUrl: `/media/try-ons/${tryOnId}`, demoMode: result.demo }, 201);
  } catch (error) {
    await c.env.DB.prepare(`UPDATE try_ons SET status = 'failed', error_code = ? WHERE id = ?`).bind(errorCategory(error), tryOnId).run();
    throw error;
  }
});

app.get('/api/try-ons/:id', async (c) => {
  const user = await requireUser(c);
  const row = await c.env.DB.prepare(`SELECT t.id, t.status, t.error_code AS errorCode, a.name AS accessoryName, s.name AS shopName FROM try_ons t JOIN accessories a ON a.id = t.accessory_id JOIN shops s ON s.id = a.shop_id WHERE t.id = ? AND t.user_id = ?`).bind(c.req.param('id'), user.id).first();
  if (!row) return c.json({ error: '試着結果が見つかりません。' }, 404);
  return c.json({ ...row, resultUrl: `/media/try-ons/${c.req.param('id')}` });
});

app.get('/media/products/*', async (c) => {
  const key = `products/${c.req.path.slice('/media/products/'.length)}`;
  const object = await c.env.IMAGES.get(key);
  if (!object) return c.notFound();
  return objectResponse(object, 'public, max-age=86400');
});

app.get('/media/try-ons/:id', async (c) => {
  const user = await requireUser(c);
  const row = await c.env.DB.prepare(`SELECT result_r2_key FROM try_ons WHERE id = ? AND user_id = ? AND status = 'completed'`).bind(c.req.param('id'), user.id).first<{ result_r2_key: string }>();
  if (!row?.result_r2_key) return c.notFound();
  const object = await c.env.IMAGES.get(row.result_r2_key);
  if (!object) return c.notFound();
  return objectResponse(object, 'private, no-store');
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'mirage-market' }));

async function hydrateShop(env: Env, shop: ShopRow) {
  const items = await env.DB.prepare('SELECT * FROM accessories WHERE shop_id = ? ORDER BY sort_order').bind(shop.id).all<AccessoryRow>();
  return {
    shop: {
      id: shop.id, name: shop.name, description: shop.description, theme: shop.theme_prompt,
      moodTags: JSON.parse(shop.mood_tags_json), shareSlug: shop.share_slug, status: shop.status, salesCount: shop.sales_count,
    },
    accessories: items.results.map((item) => ({
      id: item.id, name: item.name, category: item.category, shortDescription: item.short_description,
      lore: item.lore, impossibleFeature: item.impossible_feature, price: item.price,
      generationStatus: item.generation_status,
      imageUrl: item.image_r2_key ? `/media/products/${item.image_r2_key.slice('products/'.length)}` : null,
    })),
  };
}

async function findSessionUser(c: AppContext) {
  const production = c.env.APP_ENV === 'production';
  const value = getCookie(c, production ? '__Host-mm_session' : 'mm_session');
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 0) return null;
  const sessionId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!(await safeEqual(signature, await sign(sessionId, c.env.SESSION_SECRET)))) return null;
  const row = await c.env.DB.prepare(`SELECT u.id, u.display_name, u.balance FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > unixepoch()`).bind(sessionId).first<{ id: string; display_name: string; balance: number }>();
  return row ? { id: row.id, displayName: row.display_name, balance: row.balance, demoMode: !c.env.OPENAI_API_KEY } : null;
}

async function requireUser(c: AppContext) {
  const user = await findSessionUser(c);
  if (!user) throw new HTTPError('UNAUTHORIZED');
  return user;
}

class HTTPError extends Error {}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function toGenerated(item: AccessoryRow): GeneratedAccessory {
  return {
    name: item.name, category: item.category, shortDescription: item.short_description,
    lore: item.lore, impossibleFeature: item.impossible_feature, price: item.price,
    imagePrompt: item.image_prompt, placementInstruction: item.placement_instruction,
  };
}

function slugify(input: string) {
  const ascii = input.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  return ascii || 'mirage';
}

function objectResponse(object: R2ObjectBody, cacheControl: string) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', cacheControl);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

function errorCategory(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNAUTHORIZED')) return 'unauthorized';
  if (message.includes('OPENAI_429')) return 'openai_rate_limit';
  if (message.includes('OPENAI_4')) return 'openai_request';
  if (message.includes('OPENAI_5')) return 'openai_upstream';
  if (error instanceof z.ZodError) return 'validation';
  return 'internal';
}

export default app;
