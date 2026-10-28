import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const places = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/places" }),
  schema: z.object({
    title: z.string(), // 地点名，如"里斯本"
    titleEn: z.string().optional(), // 英文名
    country: z.string(), // 国家，如"葡萄牙"
    countryCode: z.string().length(2), // ISO 两位代码，如 PT，后面地图点亮国家要用
    coords: z.tuple([z.number(), z.number()]), // [纬度, 经度]
    date: z.string().optional(), // "2026-03"；计划中的地点留空
    status: z.enum(["visited", "planned"]).default("visited"),
    summary: z.string(), // 一句话感受
    trip: z.string().optional(), // 所属旅程，后面画路线用
        trip: z.string().optional(),                // 所属旅程，后面画路线用
    order: z.number().optional(),               // 时间先后序号，数字越大越新
  }),
});

export const collections = { places };
