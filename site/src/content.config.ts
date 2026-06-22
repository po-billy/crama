import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

// 발행 글 컬렉션 — 자동화 파이프라인이 생성하는 md/mdx 의 frontmatter 스키마
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(['money', 'ai', 'income']),
    format: z.enum(['guide', 'column']).default('guide'), // 정보성(guide) vs 칼럼(column)
    tags: z.array(z.string()).default([]),
    lang: z.enum(['ko', 'en']).default('ko'),
    heroImage: z.string().optional(),
    audio: z.string().optional(), // 발행 시 생성한 오디오(MP3) URL — 있으면 고품질 음성 재생(백그라운드 청취)
    author: z.string().default('Crama 편집부'),
    draft: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    premium: z.boolean().default(false), // 멤버십 전용(소프트 페이월) — 결제 연동은 추후
  }),
});

export const collections = { blog };
