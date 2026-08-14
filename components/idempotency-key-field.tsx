"use client"

import { useEffect, useRef } from "react"

/**
 * One key per composer instance, sent with the message so a double-click, a
 * browser retry, or a resend after a failed attempt all resolve to the same
 * send instead of a second delivery.
 *
 * The value is written onto the DOM node after mount rather than rendered: a
 * value invented during render would differ between the server pass and
 * hydration, and React would report the mismatch. Because the input is
 * uncontrolled, the key then survives a failed submit and its re-render, which
 * is exactly the case worth protecting.
 */
export function IdempotencyKeyField() {
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (field.current && !field.current.value) {
      field.current.value = crypto.randomUUID()
    }
  }, [])

  return <input ref={field} type="hidden" name="idempotencyKey" defaultValue="" />
}
