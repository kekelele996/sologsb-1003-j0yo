import { http, HttpResponse } from 'msw'
import { analyzeDocument, reviewCandidates } from '@/lib/markdown'
import { seedConflicts, seedDocument, seedHistory } from '@/lib/seed'
import type { GlossaryTerm, ReviewRequestPayload, ReviewResponse, Segment } from '@/lib/types'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export const handlers = [
  http.get('/api/document', () => HttpResponse.json(clone(seedDocument))),
  http.get('/api/history', () => HttpResponse.json(clone(seedHistory))),
  http.get('/api/conflicts', () => HttpResponse.json(clone(seedConflicts))),
  http.post('/api/check', async ({ request }) => {
    const body = await request.json() as { segments: Segment[]; glossary: GlossaryTerm[] }
    await new Promise((resolve) => setTimeout(resolve, 320))
    return HttpResponse.json({ checkedAt: Date.now(), issues: analyzeDocument(body.segments, body.glossary) })
  }),
  http.post('/api/draft', async ({ request }) => {
    const body = await request.json() as { documentId: string; segments: Segment[]; discussions: unknown[] }
    await new Promise((resolve) => setTimeout(resolve, 240))
    return HttpResponse.json({ saved: true, documentId: body.documentId, segmentCount: body.segments.length, savedAt: Date.now() })
  }),
  http.post('/api/review', async ({ request }) => {
    const body = await request.json() as ReviewRequestPayload
    await new Promise((resolve) => setTimeout(resolve, 280))
    const segments = body.segments ?? seedDocument.segments
    const glossary = body.glossary ?? seedDocument.glossary
    const result: ReviewResponse = {
      accepted: true,
      action: body.action,
      reviewedAt: Date.now(),
      passedIds: [],
      blocked: [],
    }
    // 退回操作不设质量闸门；确认（逐条/批量）前按当前术语表逐条复查。
    if (body.action === 'confirm' || body.action === 'bulk-confirm') {
      const { passed, blocked } = reviewCandidates(segments, body.segmentIds, glossary)
      result.passedIds = passed.map((segment) => segment.id)
      result.blocked = blocked.map(({ segment, issues }) => ({
        segmentId: segment.id,
        index: segment.index,
        reasons: issues.map((issue) => issue.message),
        issueTypes: issues.map((issue) => issue.type),
      }))
    } else {
      result.passedIds = [...body.segmentIds]
    }
    return HttpResponse.json(result)
  }),
]
