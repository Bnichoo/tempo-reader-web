import type { Clip } from "../types";

export type CitationStyle = "apa" | "mla" | "bibtex";

export type CitationMeta = {
  title?: string;
  author?: string;
  year?: string | number;
  container?: string; // journal/book/site
  publisher?: string;
  url?: string;
  accessed?: string; // ISO date
};

export function formatCitation(meta: CitationMeta, style: CitationStyle): string {
  const title = meta.title || "Untitled";
  const author = meta.author || "Unknown";
  const year = String(meta.year || new Date().getFullYear());
  const container = meta.container ? ` ${meta.container}` : "";
  const publisher = meta.publisher ? ` ${meta.publisher}` : "";
  const url = meta.url ? ` ${meta.url}` : "";
  const accessed = meta.accessed ? ` (accessed ${new Date(meta.accessed).toLocaleDateString()})` : "";
  if (style === "apa") {
    return `${author} (${year}). ${title}.${container ? ` ${container}.` : ""}${publisher ? ` ${publisher}.` : ""}${url}`.trim();
  }
  if (style === "mla") {
    return `${author}. "${title}."${container ? ` ${container}.` : ""}${publisher ? ` ${publisher},` : ""} ${year}.${url}${accessed}`.trim();
  }
  // bibtex minimal misc
  const key = (author.split(" ").pop() || "ref") + year;
  return `@misc{${key},
  title={${title}},
  author={${author}},
  year={${year}},${meta.url ? `
  url={${meta.url}},` : ""}${meta.publisher ? `
  howpublished={${meta.publisher}},` : ""}
}`;
}

export function buildMetaFromClip(c: Clip): CitationMeta {
  const words = (c.snippet || "").replace(/\s+/g, " ").trim().split(" ");
  const title = words.slice(0, 12).join(" ") || "Clip";
  const year = new Date(c.createdUtc).getFullYear();
  return { title, year };
}

