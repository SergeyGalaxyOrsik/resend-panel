/**
 * Inbound email HTML is a foreign document. It ships its own <style> blocks,
 * table layouts and fonts, all authored for a mail client rather than for this
 * panel. Inlining it lets those rules escape into the app (every link in the
 * sidebar picking up a newsletter's underline, list rows losing their clamp),
 * and it hands a stranger a <script> tag inside an authenticated session.
 *
 * So the reader never inlines a message. These helpers turn one into a
 * standalone document that `components/email-body.tsx` hands to a sandboxed
 * iframe, where the sender's CSS can only reach the sender's own sheet.
 */

/** Removed with their contents: nothing inside them is worth rendering. */
const DROPPED_ELEMENTS = [
  "script",
  "noscript",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "title",
]

/** Removed as tags only; their children are ordinary content. */
const DROPPED_TAGS = ["link", "meta", "base", "form"]

const EVENT_ATTRIBUTE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const SRCDOC_ATTRIBUTE = /\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const ACTIVE_URL_ATTRIBUTE =
  /\s(?:href|src|action|formaction|background|xlink:href|poster)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*'|(?:javascript|vbscript|data:text\/html)[^\s>]*)/gi

function dropElement(html: string, tag: string) {
  return html
    .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "")
}

/**
 * Strips the parts of a message that must not reach the reader even inside the
 * sandbox. The iframe (no `allow-scripts`) and its CSP are what actually stop
 * execution; this is the third layer, so it stays conservative and only rewrites
 * inside tags, never inside text.
 */
export function sanitizeEmailHtml(html: string) {
  let out = html
  for (const tag of DROPPED_ELEMENTS) out = dropElement(out, tag)
  for (const tag of DROPPED_TAGS) {
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "")
  }

  return out.replace(/<[a-zA-Z][^>]*>/g, (tag) =>
    tag
      .replace(EVENT_ATTRIBUTE, "")
      .replace(SRCDOC_ATTRIBUTE, "")
      .replace(ACTIVE_URL_ATTRIBUTE, "")
  )
}

/**
 * Emails arrive either as a full document or as a body fragment. Both are
 * reduced to the same three pieces so the reader can rebuild one clean document:
 * the sender's own <style> blocks, whatever they styled <body> with (a great
 * many emails carry their background there), and the markup itself.
 */
function splitEmailHtml(html: string) {
  const bodyOpen = html.match(/<body\b([^>]*)>/i)
  const bodyAttributes = bodyOpen ? bodyOpen[1]! : ""

  const headStyles: string[] = []
  const headSection = html.split(/<body\b[^>]*>/i)[0] ?? ""
  if (bodyOpen) {
    for (const match of headSection.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)) {
      headStyles.push(match[0])
    }
  }

  let body = html
  if (bodyOpen) {
    const afterOpen = html.slice(html.indexOf(bodyOpen[0]) + bodyOpen[0].length)
    const closeIndex = afterOpen.search(/<\/body\s*>/i)
    body = closeIndex === -1 ? afterOpen : afterOpen.slice(0, closeIndex)
  }

  body = body.replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "")

  return { headStyles: headStyles.join("\n"), bodyAttributes, body }
}

/**
 * A message built by a marketing tool arrives as nested tables that carry their
 * own padding and background, so the reader gives it the full sheet. A message
 * that is really just text needs the reader to set it like a letter instead.
 */
function isDesignedEmail(body: string) {
  return /<table[\s>]/i.test(body)
}

/**
 * Reader defaults. Element selectors only, and emitted before the sender's own
 * CSS, so anything the email declares for itself wins on both specificity and
 * order. Table display is deliberately left untouched: forcing `display: block`
 * on a table is what collapses a mail layout into a ragged column.
 */
function readerStyles(designed: boolean) {
  return `
:root { color-scheme: light; }
html { -webkit-text-size-adjust: 100%; background: #ffffff; }
body {
  margin: 0;
  background: #ffffff;
  color: #1f1f1f;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.65;
  overflow-wrap: break-word;
}
#__mail, #__mail-fit { display: flow-root; }
${
  designed
    ? "#__mail-fit { padding: 0; }"
    : `#__mail-fit { padding: 24px 26px; max-width: 70ch; }
p { margin: 0 0 1em; }
p:last-child { margin-bottom: 0; }`
}
img { max-width: 100%; height: auto; border: 0; }
a { color: #14508c; text-decoration: underline; text-underline-offset: 2px; }
pre { overflow-x: auto; }
blockquote {
  margin: 1em 0;
  padding: 0 0 0 1em;
  border-left: 2px solid rgba(0, 0, 0, 0.12);
  color: #5c5c5c;
}
hr { border: 0; border-top: 1px solid rgba(0, 0, 0, 0.1); }
`.trim()
}

/**
 * The last resort for a message stored without an HTML part: its text, escaped
 * and given paragraphs so it reads as a letter rather than one run-on line.
 */
function textToParagraphs(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}">${url}</a>`
  )

  return linked
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br />")}</p>`)
    .join("")
}

/**
 * A message's HTML plus everything the sandbox needs: a CSP that permits only
 * passive content, a base target so links leave for a new tab instead of trying
 * to navigate the reader, and the reader's own defaults ahead of the sender's.
 */
export function buildEmailDocument(html: string, fallbackText = "") {
  const source = html?.trim() ? html : textToParagraphs(fallbackText)
  const { headStyles, bodyAttributes, body } = splitEmailHtml(sanitizeEmailHtml(source))
  const designed = isDesignedEmail(body)

  const csp = [
    "default-src 'none'",
    "img-src http: https: data: cid:",
    "style-src 'unsafe-inline' http: https:",
    "font-src http: https: data:",
    "media-src http: https: data:",
    "form-action 'none'",
  ].join("; ")

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>${readerStyles(designed)}</style>
${headStyles}
</head>
<body${bodyAttributes}>
<div id="__mail"><div id="__mail-fit">${body}</div></div>
</body>
</html>`
}

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  zwnj: "",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»",
}

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity[1] === "x" || entity[1] === "X"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Longer than any list row can show, short enough to keep the payload small. */
const PREVIEW_LENGTH = 200

/**
 * Whether a string is really markup. Requires a complete tag rather than a bare
 * `<`, so plain prose comparing two values ("if x < a and y > b") is left alone.
 */
const MARKUP = /<\s*\/?\s*(?:!doctype|html|head|body|meta|title|style|table|tbody|tr|td|div|p|br|span|img|center|font)\b[^>]*>/i

/** Reduces markup to the words a reader would actually see. */
function stripMarkup(value: string) {
  return sanitizeEmailHtml(value)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    // Conditional comments (`<!--[if !mso]>`) are all over mail built for Outlook.
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
}

/**
 * The one-line summary under a subject in the thread list. Mail-to-text
 * conversions leave bracketed URLs and `[image: Logo]` markers everywhere, which
 * is most of what a raw preview ends up showing.
 *
 * The text part cannot be trusted to be text: older rows hold the HTML body in
 * that column, so whichever part is used gets stripped when it turns out to be
 * markup, rather than only on the fall back to `html`.
 */
export function buildPreviewText(text: string, html = "") {
  const source = text.trim() ? text : html
  const plain = MARKUP.test(source) ? stripMarkup(source) : source

  const cleaned = decodeEntities(plain)
    .replace(/\[\s*image:[^\]]*\]/gi, " ")
    .replace(/\[\s*(?:https?:\/\/|mailto:)[^\]]*\]/gi, " ")
    .replace(/<\s*(?:https?:\/\/|mailto:)[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned.length > PREVIEW_LENGTH
    ? `${cleaned.slice(0, PREVIEW_LENGTH).trimEnd()}…`
    : cleaned
}
