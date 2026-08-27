// NoteForge — Editor route (§12): loads the document and mounts the client Editor.
import { notFound } from 'next/navigation'
import { getDocumentWithLatest } from '@/lib/server/storage'
import { Editor } from '@/components/editor/Editor'

export const dynamic = 'force-dynamic'

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getDocumentWithLatest(id)
  if (!data || !data.model) notFound()
  return (
    <Editor
      documentId={data.id}
      title={data.title}
      slug={data.slug}
      status={data.status}
      versionNumber={data.version?.number ?? 0}
      model={data.model}
    />
  )
}
