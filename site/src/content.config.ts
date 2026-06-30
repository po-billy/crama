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
    thumb: z.string().optional(), // 카드용 유튜브식 썸네일(사진+텍스트 합성). 없으면 heroImage 사용
    thumbTitle: z.string().optional(), // 썸네일 위 짧은 카피(\n 으로 2줄, 둘째 줄은 강조색)
    audio: z.string().optional(), // 발행 시 생성한 오디오(MP3) URL — 있으면 고품질 음성 재생(백그라운드 청취)
    author: z.string().default('Crama 편집부'),
    series: z.string().optional(),      // 시리즈명 — 같은 값을 가진 글끼리 순서(pubDate)대로 묶임
    seriesOrder: z.number().optional(), // 시리즈 내 순서(지정 시 pubDate보다 우선)
    draft: z.boolean().default(false),
    affiliate: z.boolean().default(false),
    premium: z.boolean().default(false), // 멤버십 전용(소프트 페이월) — 결제 연동은 추후
  }),
});

export const collections = { blog };
