export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { ExportPdfBody } from '@/types'
import { getRedisClient, keys } from '@/lib/redis'
import { readArticleKeys } from '@/lib/redis/queries'
import { TOPICS, TOPIC_LABELS } from '@/lib/utils/constants'

export async function POST(request: NextRequest) {
  try {
    const body: ExportPdfBody = await request.json()
    const redis = getRedisClient()

    const { default: jsPDF } = await import('jspdf')

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    let y = 20

    const addPageIfNeeded = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage()
        y = 20
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.text('News Intelligence Report', pageWidth / 2, y, { align: 'center' })
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toISOString()}`, pageWidth / 2, y, { align: 'center' })
    y += 8
    doc.text(`Scope: ${body.scope} | Date Range: ${body.date_from || 'N/A'} - ${body.date_to || 'N/A'}`, pageWidth / 2, y, { align: 'center' })
    if (body.topic) { y += 6; doc.text(`Topic: ${TOPIC_LABELS[body.topic] || body.topic}`, pageWidth / 2, y, { align: 'center' }) }
    if (body.sweep_id) { y += 6; doc.text(`Sweep: ${body.sweep_id}`, pageWidth / 2, y, { align: 'center' }) }
    y += 12

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary Statistics', margin, y)
    y += 8

    let totalArticles = 0
    let totalHighCorr = 0
    let sentimentSum = 0
    let sentimentCount = 0
    const topicStatsData: Record<string, Record<string, string>> = {}

    const statsPipeline = redis.pipeline()
    for (const topic of TOPICS) {
      statsPipeline.hgetall(keys.topicStats(topic))
    }
    const statsResults = await statsPipeline.exec<Record<string, string>[]>()
    for (let i = 0; i < TOPICS.length; i++) {
      const data = statsResults[i]
      if (data && Object.keys(data).length > 0) {
        topicStatsData[TOPICS[i]] = data
        const count = Number(data.article_count || 0)
        totalArticles += count
        totalHighCorr += Number(data.high_corroboration_count || 0)
        if (data.avg_sentiment) {
          sentimentSum += Number(data.avg_sentiment) * count
          sentimentCount += count
        }
      }
    }

    const avgSentiment = sentimentCount > 0 ? (sentimentSum / sentimentCount).toFixed(2) : 'N/A'

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Total Articles: ${totalArticles}`, margin, y); y += 6
    doc.text(`High Corroboration: ${totalHighCorr}`, margin, y); y += 6
    doc.text(`Average Sentiment: ${avgSentiment}`, margin, y); y += 6
    doc.text(`Active Topics: ${TOPICS.length}`, margin, y); y += 12

    addPageIfNeeded(60)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Topic Distribution', margin, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Topic', margin, y)
    doc.text('Articles', margin + 60, y)
    doc.text('Avg Sentiment', margin + 95, y)
    doc.text('Avg Relevance', margin + 135, y)
    y += 2
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    for (const topic of TOPICS) {
      addPageIfNeeded(8)
      const data = topicStatsData[topic]
      const label = TOPIC_LABELS[topic] || topic
      if (data && Object.keys(data).length > 0) {
        doc.text(label, margin, y)
        doc.text(String(data.article_count || 0), margin + 60, y)
        doc.text(Number(data.avg_sentiment || 0).toFixed(2), margin + 95, y)
        doc.text(Number(data.avg_relevance || 0).toFixed(1), margin + 135, y)
      } else {
        doc.text(label, margin, y)
        doc.text('0', margin + 60, y)
        doc.text('—', margin + 95, y)
        doc.text('—', margin + 135, y)
      }
      y += 6
    }
    y += 8

    addPageIfNeeded(60)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Top 10 Articles', margin, y)
    y += 8

    const articleIds = await redis.zrange(keys.articlesByRelevance(), 0, 9, { rev: true }) as string[]
    if (articleIds.length > 0) {
      const dataMap = await readArticleKeys(articleIds)
      const articles = articleIds.filter((id) => dataMap.has(id)).map((id) => dataMap.get(id)!)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('#', margin, y)
      doc.text('Title', margin + 8, y)
      doc.text('Source', margin + 100, y)
      doc.text('Sent.', margin + 140, y)
      doc.text('Rel.', margin + 160, y)
      doc.text('Corr.', margin + 175, y)
      y += 2
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      articles.slice(0, 10).forEach((a, i) => {
        addPageIfNeeded(10)
        const d = a as Record<string, any>
        const title = (d.title || '').substring(0, 45)
        doc.text(`${i + 1}`, margin, y)
        doc.text(title, margin + 8, y)
        doc.text((d.source || '').substring(0, 15), margin + 100, y)
        doc.text(Number(d.sentiment_score || 0).toFixed(2), margin + 140, y)
        doc.text(String(d.relevance_score || 0), margin + 160, y)
        doc.text(d.corroboration_score || '—', margin + 175, y)
        y += 6
      })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('No articles found.', margin, y)
    }
    y += 8

    addPageIfNeeded(60)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Top Entities', margin, y)
    y += 8

    const entityNames = await redis.zrange(keys.entitiesByMentions(), 0, 9, { rev: true }) as string[]
    if (entityNames.length > 0) {
      const pipeline = redis.pipeline()
      for (const name of entityNames) pipeline.hgetall(keys.entity(name))
      const entityResults = await pipeline.exec<Record<string, string>[]>()
      const entities = entityResults.filter((r) => r && Object.keys(r).length > 0)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Entity', margin, y)
      doc.text('Type', margin + 55, y)
      doc.text('Mentions', margin + 85, y)
      doc.text('Avg Sentiment', margin + 115, y)
      doc.text('Trend', margin + 155, y)
      y += 2
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      entities.forEach((e) => {
        addPageIfNeeded(8)
        doc.text((e.name || '').substring(0, 25), margin, y)
        doc.text(e.type || '—', margin + 55, y)
        doc.text(String(e.mention_count || 0), margin + 85, y)
        doc.text(Number(e.avg_sentiment || 0).toFixed(2), margin + 115, y)
        doc.text(e.trend_direction || '—', margin + 155, y)
        y += 6
      })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('No entity data found.', margin, y)
    }
    y += 8

    addPageIfNeeded(60)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Source Quality', margin, y)
    y += 8

    const sourceNames = await redis.zrange(keys.sourcesByQuality(), 0, 9, { rev: true }) as string[]
    if (sourceNames.length > 0) {
      const pipeline = redis.pipeline()
      for (const name of sourceNames) pipeline.hgetall(keys.sourceQuality(name))
      const srcResults = await pipeline.exec<Record<string, string>[]>()
      const sources = srcResults.filter((r) => r && Object.keys(r).length > 0)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Source', margin, y)
      doc.text('Type', margin + 55, y)
      doc.text('Articles', margin + 85, y)
      doc.text('Avg Relevance', margin + 115, y)
      doc.text('Avg Sentiment', margin + 155, y)
      y += 2
      doc.line(margin, y, pageWidth - margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      sources.forEach((s) => {
        addPageIfNeeded(8)
        doc.text((s.source || '').substring(0, 25), margin, y)
        doc.text(s.source_type || '—', margin + 55, y)
        doc.text(String(s.total_articles || 0), margin + 85, y)
        doc.text(Number(s.avg_relevance || 0).toFixed(1), margin + 115, y)
        doc.text(Number(s.avg_sentiment || 0).toFixed(2), margin + 155, y)
        y += 6
      })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('No source data found.', margin, y)
    }

    const date = new Date().toISOString().split('T')[0]
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="news-intelligence-${date}.pdf"`,
      },
    })
  } catch (error) {
    console.error('POST /api/export/pdf error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
