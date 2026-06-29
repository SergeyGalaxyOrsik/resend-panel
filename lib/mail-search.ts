export function normalizeMailSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function matchesMailSearch(values: string[], query: string): boolean {
  const normalized = normalizeMailSearchQuery(query)
  if (!normalized) return true
  return values.some((value) => value.toLowerCase().includes(normalized))
}

export function threadMatchesSearch(
  thread: { subject: string; participants: string[] },
  query: string
): boolean {
  return matchesMailSearch([thread.subject, ...thread.participants], query)
}

export function messageMatchesSearch(
  message: {
    subject: string
    fromEmail: string
    to: string[]
    cc: string[]
    bcc: string[]
  },
  query: string
): boolean {
  return matchesMailSearch(
    [message.subject, message.fromEmail, ...message.to, ...message.cc, ...message.bcc],
    query
  )
}
