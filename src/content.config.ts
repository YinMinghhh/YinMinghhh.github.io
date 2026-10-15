import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";

export const BLOG_PATH = "src/content/posts";

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        publish: z.literal(true),
        title: z.string(),
        slug: z
          .string()
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "slug must be an English or pinyin short link"
          ),
        date: z.coerce.date().optional(),
        pubDatetime: z.coerce.date().optional(),
        updated: z.coerce.date().optional().nullable(),
        modDatetime: z.coerce.date().optional().nullable(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        tags: z.array(z.string()).default([]),
        ogImage: image().or(z.string()).optional(),
        description: z.string().default(""),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().optional(),
      })
      .superRefine((data, ctx) => {
        if (!data.date && !data.pubDatetime) {
          ctx.addIssue({
            code: "custom",
            message: "date is required (YYYY-MM-DD)",
            path: ["date"],
          });
        }
      })
      .transform(data => ({
        ...data,
        pubDatetime: (data.pubDatetime ?? data.date) as Date,
        modDatetime: data.modDatetime ?? data.updated ?? null,
      })),
});

const pages = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
