import DOMPurify from "dompurify";

/** Sanitize HTML and harden links (target=_blank + rel). */
export function sanitizeHTML(dirty: string): string {
  // 1) Sanitize with a strict allowlist
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "a", "p", "ul", "ol", "li", "br"],
    ALLOWED_ATTR: { a: ["href", "target", "rel"] },
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "link", "meta"],
    KEEP_CONTENT: true,
  });

  // 2) Harden links
  const div = document.createElement("div");
  div.innerHTML = clean;
  div.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    // Allow http(s), mailto, tel; strip others
    if (!/^https?:|^mailto:|^tel:/i.test(href)) a.removeAttribute("href");
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  return div.innerHTML;
}
