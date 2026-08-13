import { MailFolderView } from "@/components/mail/mail-folder-view"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams

  return <MailFolderView folder="search" query={q ?? ""} />
}
