import { http, HttpResponse } from 'msw'
import { analyzeDocument, analyzeSegment } from '@/lib/markdown'
import { seedConflicts, seedDocument, seedHistory } from '@/lib/seed'
import type { GlossaryTerm, ReviewBlockDetail, Segment } from '@/lib/types'

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
    const body = await request.json() as {
      action: string
      segmentIds: string[]
      reason?: string
      segments?: Segment[]
      glossary?: GlossaryTerm[]
    }
    await new Promise((resolve) => setTimeout(resolve, 280))
    // 确认类操作必须按当前术语表逐条复查；退回类操作不拦截。
    const shouldCheck = body.action.includes('confirm') && Array.isArray(body.segments) && Array.isArray(body.glossary)
    const passed: string[] = []
    const blocked: ReviewBlockDetail[] = []
    for (const segmentId of body.segmentIds) {
      const segment = body.segments?.find((item) => item.id === segmentId)
      if (!segment) continue
      const issues = shouldCheck ? analyzeSegment(segment, body.glossary ?? []) : []
      if (issues.length) {
        blocked.push({ segmentId, index: segment.index, issues })
      } else {
        passed.push(segmentId)
      }
    }
    return HttpResponse.json({
      accepted: true,
      action: body.action,
      segmentIds: body.segmentIds,
      reason: body.reason,
      passed,
      blocked,
      reviewedAt: Date.now(),
    })
  }),
]
