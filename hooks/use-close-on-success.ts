"use client"

import { useState } from "react"
import type { AuthState } from "@/lib/types"

/**
 * Dialog open state that closes itself once the server action reports success.
 *
 * `useActionState` hands back a fresh object on every run, so comparing identity is
 * enough to spot a new result. Adjusting state during render, rather than from an
 * effect, avoids the cascading render that `react-hooks/set-state-in-effect` warns about.
 */
export function useCloseOnSuccess(state: AuthState) {
  const [open, setOpen] = useState(false)
  const [seenState, setSeenState] = useState(state)

  if (state !== seenState) {
    setSeenState(state)
    if (state.success) {
      setOpen(false)
    }
  }

  return [open, setOpen] as const
}
