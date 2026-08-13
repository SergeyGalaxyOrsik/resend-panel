"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildEmailDocument } from "@/lib/email-html"
import { cn } from "@/lib/utils"

/**
 * Tall enough to read from while the frame measures itself, and the height left
 * behind if measurement never runs. The frame scrolls at that point rather than
 * cropping the message, so a scripting failure can never swallow content.
 */
const INITIAL_HEIGHT = 420

/** Past this, a wide message reads better scrolled than shrunk into illegibility. */
const MIN_SCALE = 0.55

/** Room to give back when a message is too wide even at `MIN_SCALE`. */
const SCROLLBAR_ALLOWANCE = 16

type EmailBodyProps = {
  html: string
  /**
   * The plain-text part, used only when a message carries no HTML. Older rows
   * predate the webhook's text-to-HTML fallback, and a blank sheet where a
   * message should be is the worst way to fail.
   */
  text?: string
  /** Names the frame for screen readers; the subject is what a reader expects. */
  title: string
  className?: string
}

/**
 * Renders a message inside a sandboxed frame. The sandbox withholds
 * `allow-scripts`, so nothing in the message can execute, while `allow-same-origin`
 * lets this component reach in to size the frame to its content: a mail reader
 * should not have a scrollbar inside a scrollbar.
 */
export function EmailBody({ html, text, title, className }: EmailBodyProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const contentObserverRef = useRef<ResizeObserver | null>(null)
  const [height, setHeight] = useState(INITIAL_HEIGHT)

  const srcDoc = useMemo(() => buildEmailDocument(html, text), [html, text])

  /**
   * Sizes the frame to the message, scaling a too-wide layout down to fit. Mail
   * built on a fixed 600px table has no way to reflow, so the choice is to scale
   * it or to hand the reader a horizontal scrollbar; scaling wins until the text
   * would get too small to read.
   */
  const fit = useCallback(() => {
    const frame = frameRef.current
    const doc = frame?.contentDocument
    const outer = doc?.getElementById("__mail")
    const inner = doc?.getElementById("__mail-fit")
    if (!frame || !outer || !inner) return

    // Last run's scale is still applied, so measure from a clean slate.
    outer.style.height = ""
    outer.style.overflowX = ""
    outer.style.overflowY = ""
    inner.style.width = ""
    inner.style.marginRight = ""
    inner.style.transform = ""

    const available = frame.clientWidth
    const natural = inner.scrollWidth
    let rendered = inner.scrollHeight

    if (available > 0 && natural > available + 2) {
      const scale = Math.max(available / natural, MIN_SCALE)
      inner.style.width = `${natural}px`
      inner.style.transformOrigin = "0 0"
      inner.style.transform = `scale(${scale})`
      // A transform is visual only, so the element goes on claiming its full
      // width; without this the frame would scroll long past the message's end.
      inner.style.marginRight = `${-(natural - natural * scale)}px`

      // The laid-out height is untouched by the transform for the same reason.
      rendered = inner.scrollHeight * scale

      // Too wide even at MIN_SCALE: keep the overflow reachable behind a
      // scrollbar, with room of its own, rather than cropping it away.
      const stillWider = natural * scale > available + 1
      rendered += stillWider ? SCROLLBAR_ALLOWANCE : 0
      outer.style.height = `${Math.ceil(rendered)}px`
      outer.style.overflowY = "hidden"
      outer.style.overflowX = stillWider ? "auto" : "hidden"
    }

    // The extra pixel absorbs sub-pixel rounding that would otherwise leave the
    // frame one hair too short and show a scrollbar over the whole message.
    setHeight(Math.ceil(rendered) + 1)
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    let settleFrame = 0
    let settling = false

    /**
     * Measuring writes to the frame's DOM, which the content observer would read
     * back as a change. The settle flag lets our own writes pass without
     * bouncing between the two.
     */
    const measure = () => {
      settling = true
      fit()
      cancelAnimationFrame(settleFrame)
      settleFrame = requestAnimationFrame(() => {
        settling = false
      })
    }

    const observeContent = () => {
      const inner = frame.contentDocument?.getElementById("__mail-fit")
      if (!inner) return
      contentObserverRef.current?.disconnect()
      // Images and webfonts land after load and change the height under us.
      const observer = new ResizeObserver(() => {
        if (!settling) measure()
      })
      observer.observe(inner)
      contentObserverRef.current = observer
    }

    const handleLoad = () => {
      measure()
      observeContent()
    }

    frame.addEventListener("load", handleLoad)

    // A cached frame can finish loading before this effect runs.
    if (frame.contentDocument?.readyState === "complete") handleLoad()

    // The reading pane resizes with the window and the sidebar.
    const frameObserver = new ResizeObserver(() => measure())
    frameObserver.observe(frame)

    return () => {
      frame.removeEventListener("load", handleLoad)
      frameObserver.disconnect()
      contentObserverRef.current?.disconnect()
      contentObserverRef.current = null
      cancelAnimationFrame(settleFrame)
    }
  }, [fit, srcDoc])

  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={srcDoc}
      // No `allow-scripts`: the message cannot run anything. `allow-same-origin`
      // is what lets the reader measure it, and is only safe *because* scripts
      // are withheld. The popup grants let a clicked link open in a new tab.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      style={{ height }}
      className={cn("block w-full border-0 bg-white", className)}
    />
  )
}
