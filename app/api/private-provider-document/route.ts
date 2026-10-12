import { get } from '@vercel/blob'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { providerProfiles } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pathname = request.nextUrl.searchParams.get('path')
  if (!pathname || pathname.length > 500 || !pathname.startsWith('providers/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOperations = ['super_admin', 'operations'].includes(session.user.role)
  const profiles = await db
    .select({ nidDocumentUrl: providerProfiles.nidDocumentUrl, documentUrls: providerProfiles.documentUrls })
    .from(providerProfiles)
    .where(isOperations ? eq(providerProfiles.status, 'PENDING') : eq(providerProfiles.userId, session.user.id))
  const isAuthorizedDocument = profiles.some((profile) =>
    profile.nidDocumentUrl === pathname || (Array.isArray(profile.documentUrls) && profile.documentUrls.includes(pathname)),
  )
  if (!isAuthorizedDocument) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const result = await get(pathname, { access: 'private' })
    if (!result || result.statusCode === 304) return new NextResponse(null, { status: 404 })
    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Content-Disposition': 'attachment; filename="provider-document"',
        'Cache-Control': 'private, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Document unavailable.' }, { status: 404 })
  }
}
