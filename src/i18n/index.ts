import type { UIStrings } from "./types";

export { tplStr } from "./format";

const modules = import.meta.glob<{ default: UIStrings }>("./lang/*.ts", {
  eager: true,
});

const translations: Record<string, UIStrings> = {};
for (const [path, mod] of Object.entries(modules)) {
  const locale = path.slice("./lang/".length, -".ts".length);
  translations[locale] = mod.default;
}

/** UI strings for a locale. Unknown locales fall back to zh-CN, then English. */
export function useTranslations(locale?: string | null): UIStrings {
  const requested = (locale || "zh-CN").toLowerCase();
  const match = Object.entries(translations).find(
    ([key]) => key.toLowerCase() === requested
  );
  return match?.[1] ?? translations["zh-CN"] ?? translations["en"];
}
