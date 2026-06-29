import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.08),transparent_35%),linear-gradient(180deg,rgba(250,250,250,1),rgba(244,244,245,1))] px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
