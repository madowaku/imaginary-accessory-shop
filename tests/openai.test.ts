import { describe, expect, it } from 'vitest';
import { demoCollection, productPrompt } from '../worker/services/openai';

describe('OpenAI prompt contracts', () => {
  it('creates three distinct demo accessories in allowed categories', () => {
    const result = demoCollection('月の裏側の店');
    expect(result.accessories).toHaveLength(3);
    expect(new Set(result.accessories.map((item) => item.category)).size).toBe(3);
    expect(result.accessories.every((item) => item.price >= 200 && item.price <= 500)).toBe(true);
  });

  it('keeps product images free of people and text', () => {
    const prompt = productPrompt(demoCollection('test').accessories[0]);
    expect(prompt).toContain('no person');
    expect(prompt).toContain('no text');
  });
});
