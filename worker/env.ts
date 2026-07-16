export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_TEXT_MODEL: string;
  OPENAI_IMAGE_MODEL: string;
  SESSION_SECRET: string;
  APP_ENV: string;
  ASSETS?: Fetcher;
}

export type Variables = { userId: string };
