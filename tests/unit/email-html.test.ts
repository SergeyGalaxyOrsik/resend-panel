import { describe, expect, it } from "vitest"
import { buildEmailDocument, buildPreviewText, sanitizeEmailHtml } from "@/lib/email-html"

describe("sanitizeEmailHtml", () => {
  it("removes scripts with their contents", () => {
    const out = sanitizeEmailHtml('<p>hi</p><script>fetch("/steal")</script>')
    expect(out).not.toContain("script")
    expect(out).not.toContain("steal")
    expect(out).toContain("<p>hi</p>")
  })

  it("removes the other executable containers", () => {
    for (const tag of ["iframe", "object", "embed", "applet", "frameset"]) {
      const out = sanitizeEmailHtml(`<${tag} src="x">payload</${tag}>`)
      expect(out).not.toContain(tag)
      expect(out).not.toContain("payload")
    }
  })

  it("strips inline event handlers in any casing or quoting", () => {
    const out = sanitizeEmailHtml(
      `<img src="a.png" onerror="alert(1)"><div ONCLICK='alert(2)'>x</div><a onmouseover=alert(3)>y</a>`
    )
    expect(out.toLowerCase()).not.toContain("onerror")
    expect(out.toLowerCase()).not.toContain("onclick")
    expect(out.toLowerCase()).not.toContain("onmouseover")
    expect(out).toContain('src="a.png"')
  })

  it("strips javascript:, vbscript: and data:text/html urls", () => {
    const out = sanitizeEmailHtml(
      `<a href="javascript:alert(1)">a</a><a href='VBScript:msgbox'>b</a><iframe src="data:text/html,x"></iframe><a href=javascript:alert(2)>c</a>`
    )
    expect(out.toLowerCase()).not.toContain("javascript:")
    expect(out.toLowerCase()).not.toContain("vbscript:")
    expect(out.toLowerCase()).not.toContain("data:text/html")
  })

  it("strips srcdoc, which would smuggle a whole document", () => {
    const out = sanitizeEmailHtml('<iframe srcdoc="<script>alert(1)</script>"></iframe>')
    expect(out.toLowerCase()).not.toContain("srcdoc")
  })

  it("drops link, meta, base and form tags but keeps their children", () => {
    const out = sanitizeEmailHtml('<form action="/x"><p>keep me</p></form><link rel="stylesheet">')
    expect(out).not.toContain("<form")
    expect(out).not.toContain("<link")
    expect(out).toContain("<p>keep me</p>")
  })

  it("leaves ordinary prose containing angle brackets alone", () => {
    const text = "if x < a and y > b then stop"
    expect(sanitizeEmailHtml(text)).toBe(text)
  })

  it("keeps the layout tags a mail actually needs", () => {
    const out = sanitizeEmailHtml('<table><tr><td style="padding:8px">cell</td></tr></table>')
    expect(out).toContain("<table>")
    expect(out).toContain('style="padding:8px"')
  })
})

describe("buildEmailDocument", () => {
  it("wraps the message in a document with a restrictive CSP", () => {
    const doc = buildEmailDocument("<p>hello</p>")
    expect(doc).toContain("<!doctype html>")
    expect(doc).toContain("default-src 'none'")
    expect(doc).toContain("form-action 'none'")
    expect(doc).toContain('<base target="_blank">')
    expect(doc).toContain("<p>hello</p>")
  })

  it("sanitizes before wrapping", () => {
    const doc = buildEmailDocument('<p onclick="alert(1)">hi</p><script>alert(2)</script>')
    expect(doc.toLowerCase()).not.toContain("onclick")
    expect(doc).not.toContain("alert(2)")
  })

  it("keeps the sender's own style block and body attributes", () => {
    const doc = buildEmailDocument(
      '<html><head><style>.x{color:red}</style></head><body bgcolor="#eee"><p class="x">hi</p></body></html>'
    )
    expect(doc).toContain(".x{color:red}")
    expect(doc).toContain('bgcolor="#eee"')
    // The outer document must not be nested inside the wrapper.
    expect(doc.match(/<body/g)).toHaveLength(1)
  })

  it("falls back to the text part, escaped, when there is no html", () => {
    const doc = buildEmailDocument("", "first line\nsecond\n\nnew paragraph <b>not bold</b>")
    expect(doc).toContain("&lt;b&gt;")
    expect(doc).toContain("<br />")
    expect(doc).toContain("<p>new paragraph")
  })

  it("links bare urls in the text fallback", () => {
    const doc = buildEmailDocument("", "see https://example.com/x for details")
    expect(doc).toContain('<a href="https://example.com/x">https://example.com/x</a>')
  })
})

describe("buildPreviewText", () => {
  it("uses the text part as-is", () => {
    expect(buildPreviewText("  Just a plain note  ")).toBe("Just a plain note")
  })

  it("strips markup when the text column actually holds html", () => {
    const preview = buildPreviewText("<table><tr><td><p>Welcome aboard</p></td></tr></table>")
    expect(preview).toBe("Welcome aboard")
  })

  it("falls back to the html part when the text one is empty", () => {
    expect(buildPreviewText("", "<div>From the html body</div>")).toBe("From the html body")
  })

  it("drops style blocks, comments, image markers and bracketed urls", () => {
    const preview = buildPreviewText(
      "<style>.a{color:red}</style><!--[if mso]>outlook<![endif]--><p>Hi [image: Logo] there [https://track.example/x]</p>"
    )
    expect(preview).toBe("Hi there")
  })

  it("decodes the entities mail is full of", () => {
    expect(buildPreviewText("Tom &amp; Jerry&nbsp;&mdash; a&hellip;")).toBe("Tom & Jerry — a…")
  })

  it("truncates long previews with an ellipsis", () => {
    const preview = buildPreviewText("word ".repeat(100))
    expect(preview.length).toBeLessThanOrEqual(201)
    expect(preview.endsWith("…")).toBe(true)
  })
})
