import type { Env } from '../env';

export type Category = 'earrings' | 'necklace' | 'headpiece';

export interface GeneratedAccessory {
  name: string;
  category: Category;
  shortDescription: string;
  lore: string;
  impossibleFeature: string;
  price: number;
  imagePrompt: string;
  placementInstruction: string;
}

export interface GeneratedCollection {
  description: string;
  accessories: GeneratedAccessory[];
}

const collectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['description', 'accessories'],
  properties: {
    description: { type: 'string', minLength: 10, maxLength: 100 },
    accessories: {
      type: 'array', minItems: 3, maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'category', 'shortDescription', 'lore', 'impossibleFeature', 'price', 'imagePrompt', 'placementInstruction'],
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: ['earrings', 'necklace', 'headpiece'] },
          shortDescription: { type: 'string' },
          lore: { type: 'string' },
          impossibleFeature: { type: 'string' },
          price: { type: 'integer', minimum: 200, maximum: 500 },
          imagePrompt: { type: 'string' },
          placementInstruction: { type: 'string' },
        },
      },
    },
  },
};

const demoItems: GeneratedAccessory[] = [
  {
    name: '欠けた月の耳飾り', category: 'earrings',
    shortDescription: '思い出すたび、片方だけ光る。',
    lore: '月の裏側に落ちた記憶から作られた耳飾り。',
    impossibleFeature: '小さな月が耳の周囲を公転する', price: 300,
    imagePrompt: 'A matching pair of silver crescent earrings with miniature moons orbiting them, floating without visible supports.',
    placementInstruction: 'Attach one matching earring naturally to each visible ear; miniature moons float around the ears.',
  },
  {
    name: '余白を泳ぐ首飾り', category: 'necklace',
    shortDescription: '言えなかった言葉が、光の魚になる。',
    lore: '胸元に残った沈黙をすくい、透明な水へ戻す首飾り。',
    impossibleFeature: '鎖の内側だけに無重力の海が満ちている', price: 420,
    imagePrompt: 'An elegant transparent necklace containing a tiny zero-gravity ocean with luminous fish made of words.',
    placementInstruction: 'Drape the necklace naturally around the neck and upper chest; keep the floating ocean inside its arc.',
  },
  {
    name: '明日を隠す光冠', category: 'headpiece',
    shortDescription: 'まだ選ばなかった未来だけを照らす。',
    lore: '夜明け直前の可能性を細い光輪へ編んだ冠。',
    impossibleFeature: '見る角度ごとに異なる未来の影を落とす', price: 500,
    imagePrompt: 'A delicate floating halo headpiece woven from dawn light, casting several impossible future-shaped shadows.',
    placementInstruction: 'Float the thin halo just above and around the head, following the original camera angle and lighting.',
  },
];

export function demoCollection(theme: string): GeneratedCollection {
  return {
    description: theme.includes('月') ? '失くした気持ちを、身につけられる形に。' : '想像だけが触れられる品を、あなたのために。',
    accessories: demoItems,
  };
}

async function openAI(env: Env, path: string, init: RequestInit) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`https://api.openai.com/v1/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, ...(init.headers ?? {}) },
    });
    if (response.ok) return response;
    const text = await response.text();
    const transient = response.status === 429 || response.status >= 500;
    if (transient && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      continue;
    }
    throw new Error(`OPENAI_${response.status}:${text.slice(0, 240)}`);
  }
  throw new Error('OPENAI_RETRY_EXHAUSTED');
}

export async function moderateText(env: Env, input: string) {
  if (!env.OPENAI_API_KEY) return false;
  try {
    const response = await openAI(env, 'moderations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
    });
    const data = await response.json<{ results: Array<{ flagged: boolean }> }>();
    return Boolean(data.results[0]?.flagged);
  } catch (error) {
    if (!isTransientOpenAIError(error) || env.APP_ENV === 'production') throw error;
    console.warn(JSON.stringify({ event: 'openai_fallback', task: 'text_moderation', category: transientCategory(error) }));
    return false;
  }
}

export async function moderateImage(env: Env, bytes: ArrayBuffer, mime: string) {
  if (!env.OPENAI_API_KEY) return false;
  const base64 = arrayBufferToBase64(bytes);
  try {
    const response = await openAI(env, 'moderations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }],
      }),
    });
    const data = await response.json<{ results: Array<{ flagged: boolean }> }>();
    return Boolean(data.results[0]?.flagged);
  } catch (error) {
    if (!isTransientOpenAIError(error) || env.APP_ENV === 'production') throw error;
    console.warn(JSON.stringify({ event: 'openai_fallback', task: 'image_moderation', category: transientCategory(error) }));
    return false;
  }
}

export async function generateCollection(env: Env, shopName: string, theme: string, moodTags: string[], categories: Category[]) {
  if (!env.OPENAI_API_KEY) return { ...demoCollection(theme), demo: true };
  const prompt = `You create safe, original fictional wearable accessories for MIRAGE MARKET.\nShop: ${shopName}\nWorld: ${theme}\nMood: ${moodTags.join(', ')}\nCreate exactly three items, one per requested category: ${categories.join(', ')}. Each must clearly be wearable, have a different physically impossible feature, avoid real brands and existing characters, and cost 200-500 Mirage. Write all customer-facing text in Japanese. Image prompts and placement instructions should be precise English.`;
  try {
    const response = await openAI(env, 'responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OPENAI_TEXT_MODEL || 'gpt-5.6', input: prompt,
        text: { format: { type: 'json_schema', name: 'mirage_collection', strict: true, schema: collectionSchema } },
      }),
    });
    const data = await response.json<{ output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }>();
    const text = data.output_text ?? data.output?.flatMap((o) => o.content ?? []).find((c) => c.text)?.text;
    if (!text) throw new Error('OPENAI_EMPTY_RESPONSE');
    return { ...(JSON.parse(text) as GeneratedCollection), demo: false };
  } catch (error) {
    if (!isTransientOpenAIError(error)) throw error;
    console.warn(JSON.stringify({ event: 'openai_fallback', task: 'collection', category: transientCategory(error) }));
    return { ...demoCollection(theme), demo: true };
  }
}

export function productPrompt(item: GeneratedAccessory) {
  return `Create a premium product photograph of a fictional wearable accessory.\nProduct name: ${item.name}\nCategory: ${item.category}\nVisual concept: ${item.imagePrompt}\nRequirements: clearly wearable jewelry; show complete item; centered composition; dark neutral background; no person; no hands; no packaging; no logos; no text; physically impossible but visually believable; suitable as a virtual try-on reference.`;
}

export async function generateProductImage(env: Env, item: GeneratedAccessory) {
  if (!env.OPENAI_API_KEY) return { bytes: demoSvg(item.name, item.category), contentType: 'image/svg+xml', demo: true };
  try {
    const response = await openAI(env, 'images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OPENAI_IMAGE_MODEL || 'gpt-image-2', prompt: productPrompt(item),
        size: '1024x1024', quality: 'medium', output_format: 'webp', output_compression: 85,
      }),
    });
    const data = await response.json<{ data: Array<{ b64_json?: string }> }>();
    const base64 = data.data[0]?.b64_json;
    if (!base64) throw new Error('OPENAI_EMPTY_IMAGE');
    return { bytes: base64ToArrayBuffer(base64), contentType: 'image/webp', demo: false };
  } catch (error) {
    if (!isTransientOpenAIError(error)) throw error;
    console.warn(JSON.stringify({ event: 'openai_fallback', task: 'product_image', category: transientCategory(error) }));
    return { bytes: demoSvg(item.name, item.category), contentType: 'image/svg+xml', demo: true };
  }
}

export async function editTryOn(env: Env, photo: Blob, product: Blob, item: GeneratedAccessory) {
  if (!env.OPENAI_API_KEY) return { bytes: await photo.arrayBuffer(), contentType: photo.type, demo: true };
  const prompt = `Edit the first image by adding the fictional accessory shown in the second reference image.\nAccessory: ${item.name}\nPlacement: ${item.placementInstruction}\nPreserve identity, facial features, expression, skin tone, hairstyle, clothing, body shape, background, camera angle and lighting. Do not beautify, change age or gender presentation, add makeup, other jewelry, text or logos. The result must look like the same person genuinely wearing an impossible accessory.`;
  const form = new FormData();
  form.set('model', env.OPENAI_IMAGE_MODEL || 'gpt-image-2');
  form.set('prompt', prompt);
  form.set('size', '1024x1536');
  form.set('quality', 'medium');
  form.set('output_format', 'webp');
  form.set('output_compression', '88');
  form.append('image[]', photo, 'person.jpg');
  form.append('image[]', product, 'accessory.webp');
  try {
    const response = await openAI(env, 'images/edits', { method: 'POST', body: form });
    const data = await response.json<{ data: Array<{ b64_json?: string }> }>();
    const base64 = data.data[0]?.b64_json;
    if (!base64) throw new Error('OPENAI_EMPTY_EDIT');
    return { bytes: base64ToArrayBuffer(base64), contentType: 'image/webp', demo: false };
  } catch (error) {
    if (!isTransientOpenAIError(error)) throw error;
    console.warn(JSON.stringify({ event: 'openai_fallback', task: 'try_on', category: transientCategory(error) }));
    return { bytes: await photo.arrayBuffer(), contentType: photo.type, demo: true };
  }
}

function isTransientOpenAIError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('OPENAI_429') || /OPENAI_5\d\d/.test(message) || message.includes('OPENAI_RETRY_EXHAUSTED') || message.includes('billing_hard_limit_reached');
}

function transientCategory(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('OPENAI_429')) return 'rate_limit';
  if (message.includes('billing_hard_limit_reached')) return 'billing_limit';
  return 'upstream';
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToArrayBuffer(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function demoSvg(name: string, category: string) {
  const safe = name.replace(/[&<>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><radialGradient id="b"><stop stop-color="#39324f"/><stop offset="1" stop-color="#090910"/></radialGradient><filter id="g"><feGaussianBlur stdDeviation="8"/></filter></defs><rect width="100%" height="100%" fill="url(#b)"/><circle cx="512" cy="480" r="210" fill="none" stroke="#d8c5ff" stroke-width="8" opacity=".45"/><circle cx="512" cy="480" r="155" fill="none" stroke="#f5d89e" stroke-width="3" stroke-dasharray="12 22"/><circle cx="365" cy="350" r="28" fill="#f7e6bd" filter="url(#g)"/><circle cx="365" cy="350" r="18" fill="#fff5d9"/><text x="512" y="790" text-anchor="middle" fill="#fff" font-family="serif" font-size="38">${safe}</text><text x="512" y="838" text-anchor="middle" fill="#c8c2d4" font-family="sans-serif" font-size="20" letter-spacing="5">${category.toUpperCase()} · DEMO ARTIFACT</text></svg>`;
  return new TextEncoder().encode(svg).buffer;
}
