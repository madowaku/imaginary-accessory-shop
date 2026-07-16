export type Category = 'earrings' | 'necklace' | 'headpiece';

export interface User {
  id: string;
  displayName: string;
  balance: number;
  demoMode: boolean;
}

export interface Accessory {
  id: string;
  name: string;
  category: Category;
  shortDescription: string;
  lore: string;
  impossibleFeature: string;
  price: number;
  generationStatus: 'pending' | 'generating' | 'completed' | 'failed';
  imageUrl?: string | null;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  theme: string;
  moodTags: string[];
  shareSlug?: string | null;
  status?: string;
  salesCount?: number;
}

export interface Collection {
  shop: Shop;
  accessories: Accessory[];
  demoMode?: boolean;
}
