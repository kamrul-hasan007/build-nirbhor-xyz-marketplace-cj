import { put } from '@vercel/blob'
import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const maximumFileBytes = 5 * 1024 * 1024
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Sign in to upload provider documents.' }, { status: 401 })

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > maximumFileBytes + 64 * 1024) return NextResponse.json({ error: 'Files must be 5 MB or smaller.' }, { status: 413 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a document to upload.' }, { status: 400 })
  if (file.size > maximumFileBytes) return NextResponse.json({ error: 'Files must be 5 MB or smaller.' }, { status: 413 })
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: 'Upload a PDF, JPEG, PNG, or WebP file.' }, { status: 415 })

  const safeName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100) || 'document'
  try {
    const blob = await put(`providers/${session.user.id}/${randomUUID()}-${safeName}`, file, {
      access: 'private',
      addRandomSuffix: false,
      contentType: file.type,
    })
    return NextResponse.json({ pathname: blob.pathname })
  } catch {
    return NextResponse.json({ error: 'Upload could not be completed. Please try again.' }, { status: 500 })
  }
}
