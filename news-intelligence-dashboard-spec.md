# News Intelligence Dashboard — Technical Specification for AI Coder

## Build Target

A Next.js dashboard deployed on Vercel, using Upstash Redis for data storage. The dashboard visualizes news intelligence data collected by the **g-research-agent v3**. The AI coder builds the **frontend, API routes, and Redis schema**. The agent-to-Redis data pipeline is handled separately — the coder assumes Redis is already populated and must only read from it (plus trigger sweeps).

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 14+ |
| Language | TypeScript | 5+ |
| Styling | Tailwind CSS | 3+ |
| UI Components | shadcn/ui + Radix UI | latest |
| Charts | Recharts | 2+ |
| State | Zustand | 4+ |
| Data fetching | SWR (polling for real-time) | 2+ |
| Redis client | `@upstash/redis` | latest |
| PDF export | `@react-pdf/renderer` or `jspdf` + `html2canvas` | latest |
| Theme | `next-themes` | latest |
| Icons | `lucide-react` | latest |
| Date handling | `date-fns` | 3+ |
| Deployment | Vercel | — |

### Environment Variables

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
G_RESEARCH_AGENT_API_URL=https://<agent-endpoint>/api
NEXT_PUBLIC_APP_URL=https://<vercel-domain>
```

---

## 2. Data Model

### 2.1 Article

```typescript
interface Article {
  id: string;                    // UUID, also the Redis key suffix
  title: string;
  url: string;
  date: string;                  // ISO 8601
  source: string;                // e.g. "BBC", "TechCrunch", "r/MachineLearning"
  source_type: 'rss' | 'api' | 'reddit' | 'arxiv' | 'tavily';
  relevance_score: number;       // 0–100
  corroboration_score: 'high' | 'medium' | 'low';
  source_count: number;          // independent sources covering same story
  sentiment_score: number;      // -1.0 to +1.0
  entities: Entity[];
  topic: Topic;
  summary: string | null;        // 2–3 sentences, null for non-top results
  fetched_at: string;            // ISO 8601 — when agent stored it
  sweep_id: string;              // links to the sweep that collected it
}

interface Entity {
  name: string;
  type: 'company' | 'person' | 'technology';
}

type Topic =
  | 'capital_markets'
  | 'ai_industry'
  | 'ai_sovereignty'
  | 'open_weight'
  | 'agentic_ai'
  | 'ai_fintech'
  | 'ai_regulation';
```

### 2.2 Sweep History

```typescript
interface SweepRecord {
  id: string;                    // UUID
  started_at: string;            // ISO 8601
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  topics: Topic[];               // topics swept
  article_count: number;
  error: string | null;
  triggered_by: 'manual' | 'scheduled';
  pdf_report_url: string | null;
  linkedin_post: string | null;
}
```

### 2.3 Entity Stats (aggregated)

```typescript
interface EntityStat {
  name: string;
  type: 'company' | 'person' | 'technology';
  mention_count: number;
  avg_sentiment: number;         // -1.0 to +1.0
  topics: Topic[];
  first_seen: string;            // ISO 8601
  last_seen: string;             // ISO 8601
  trend_direction: 'up' | 'down' | 'stable';  // vs previous period
}
```

### 2.4 Topic Stats (aggregated)

```typescript
interface TopicStat {
  topic: Topic;
  article_count: number;
  avg_sentiment: number;
  avg_relevance: number;
  high_corroboration_count: number;
  top_entities: string[];
  last_updated: string;          // ISO 8601
}
```

### 2.5 LinkedIn Post Draft

```typescript
interface LinkedInPost {
  id: string;
  sweep_id: string;
  topic: Topic;
  content: string;
  created_at: string;
  status: 'draft' | 'published';
}
```

---

## 3. Redis Schema

All keys are prefixed with `nid:` (news intelligence dashboard).

### 3.1 Article Storage

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:article:{id}` | Full article object (HSET all fields) |
| Sorted Set | `nid:articles:by_date` | score = epoch timestamp, member = article id |
| Sorted Set | `nid:articles:by_relevance` | score = relevance_score, member = article id |
| Sorted Set | `nid:articles:by_sentiment` | score = sentiment_score*100, member = article id |
| Set | `nid:articles:topic:{topic}` | Article IDs for a given topic |
| Set | `nid:articles:source_type:{source_type}` | Article IDs for a given source type |
| Set | `nid:articles:source:{source}` | Article IDs for a specific source (URL-encoded) |
| Set | `nid:articles:sweep:{sweep_id}` | Article IDs collected in a specific sweep |
| Set | `nid:articles:corr:{high\|medium\|low}` | Article IDs by corroboration level |

### 3.2 Sweep History

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:sweep:{id}` | Full sweep record |
| Sorted Set | `nid:sweeps:by_date` | score = epoch timestamp, member = sweep id |

### 3.3 Entity Index

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:entity:{name}` | EntityStat object (name URL-encoded) |
| Sorted Set | `nid:entities:by_mentions` | score = mention_count, member = entity name |
| Set | `nid:entity:{name}:articles` | Article IDs mentioning this entity |
| Set | `nid:entities:topic:{topic}` | Entity names appearing in a topic |
| Sorted Set | `nid:entities:trend` | score = delta mention_count vs prev period, member = entity name |

### 3.4 Topic Stats

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:topic:stats:{topic}` | TopicStat object |
| String | `nid:topic:stats:updated` | ISO timestamp of last stats refresh |

### 3.5 Trend Data (Time Series)

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Sorted Set | `nid:trend:topic:{topic}:daily` | score = epoch day, member = JSON `{date, count, avg_sentiment}` |
| Sorted Set | `nid:trend:sentiment:daily` | score = epoch day, member = JSON `{date, avg_sentiment, article_count}` |
| Sorted Set | `nid:trend:sources:daily` | score = epoch day, member = JSON `{date, source_type, count}` |
| Sorted Set | `nid:trend:entities:daily` | score = epoch day, member = JSON `{date, entity_name, count}` |

### 3.6 LinkedIn Posts

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:linkedin:{id}` | Full LinkedIn post draft |
| Sorted Set | `nid:linkedin:by_date` | score = epoch timestamp, member = post id |
| Set | `nid:linkedin:sweep:{sweep_id}` | Post IDs for a sweep |

### 3.7 Source Quality

| Redis Structure | Key Pattern | Purpose |
|---|---|---|
| Hash | `nid:source:quality:{source}` | `{source, total_articles, avg_relevance, avg_sentiment, source_type}` |
| Sorted Set | `nid:sources:by_quality` | score = avg_relevance, member = source name |

### 3.8 TTL / Cleanup

- Article hashes: no TTL (keep historical).
- Trend data sorted sets: no TTL.
- Sweep records: no TTL.
- Optional: `nid:articles:recent` sorted set with 7-day TTL for quick "latest" queries.

---

## 4. API Routes

All routes live under `/app/api/`. Return JSON. Use standard HTTP status codes.

### 4.1 Articles

#### `GET /api/articles`

Fetch articles with filtering, sorting, pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `topic` | Topic \| comma-separated | — | Filter by topic(s) |
| `source` | string | — | Filter by source name |
| `source_type` | source_type | — | Filter by source_type |
| `sentiment_min` | number | — | Min sentiment (-1.0) |
| `sentiment_max` | number | — | Max sentiment (1.0) |
| `corroboration` | `high\|medium\|low` | — | Filter by corroboration level |
| `date_from` | ISO date | — | Start date filter |
| `date_to` | ISO date | — | End date filter |
| `min_relevance` | number | 0 | Minimum relevance score |
| `entity` | string | — | Filter by entity name |
| `sort` | `date\|relevance\|sentiment` | `date` | Sort field |
| `order` | `asc\|desc` | `desc` | Sort direction |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page (max 100) |

**Response:**

```json
{
  "articles": Article[],
  "total": number,
  "page": number,
  "limit": number,
  "has_more": boolean
}
```

**Redis read strategy:** Start from the most selective filter (e.g., topic set or corroboration set), intersect with date-range slice from `nid:articles:by_date`, then HGETALL each article and apply remaining in-memory filters.

---

#### `GET /api/articles/:id`

Single article detail.

**Response:** `Article`

---

### 4.2 Topics

#### `GET /api/topics/stats`

Aggregated stats for all 7 topics.

**Response:**

```json
{
  "topics": TopicStat[],
  "last_updated": string
}
```

**Redis:** Read all 7 `nid:topic:stats:{topic}` hashes.

---

### 4.3 Entities

#### `GET /api/entities`

Trending entities with filtering.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `type` | `company\|person\|technology` | — | Filter by entity type |
| `topic` | Topic | — | Filter by topic |
| `sort` | `mentions\|trend\|sentiment` | `mentions` | Sort field |
| `limit` | number | 20 | Max results |

**Response:**

```json
{
  "entities": EntityStat[]
}
```

---

#### `GET /api/entities/trending`

Top trending entities (highest `trend_direction: up`).

**Response:**

```json
{
  "entities": (EntityStat & { trend_delta: number })[]
}
```

---

### 4.4 Trends

#### `GET /api/trends/sentiment`

Sentiment trend over time.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `topic` | Topic | — | Filter by topic |
| `date_from` | ISO date | 7d ago | Start date |
| `date_to` | ISO date | now | End date |
| `granularity` | `day\|hour` | `day` | Time bucket |

**Response:**

```json
{
  "data": { "date": string, "avg_sentiment": number, "article_count": number }[]
}
```

---

#### `GET /api/trends/topic-distribution`

Article count by topic for a date range.

**Response:**

```json
{
  "data": { "topic": Topic, "count": number, "avg_sentiment": number }[]
}
```

---

#### `GET /api/trends/sources`

Source breakdown (count, avg relevance, avg sentiment) per source or source_type.

**Response:**

```json
{
  "data": {
    "source": string,
    "source_type": string,
    "count": number,
    "avg_relevance": number,
    "avg_sentiment": number
  }[]
}
```

---

### 4.5 Sweeps

#### `GET /api/sweeps`

List sweep history.

**Query Parameters:** `page`, `limit`

**Response:**

```json
{
  "sweeps": SweepRecord[],
  "total": number
}
```

---

#### `POST /api/sweeps/trigger`

Trigger a news sweep via the g-research-agent.

**Request Body:**

```json
{
  "topics": Topic[],           // optional, defaults to all 7
  "generate_pdf": boolean,     // optional, default false
  "generate_linkedin": boolean // optional, default false
}
```

**Behavior:**
1. Create a `SweepRecord` with `status: "running"` in Redis.
2. Call `POST {G_RESEARCH_AGENT_API_URL}/sweep` with the request body.
3. Return the sweep ID immediately (202 Accepted).
4. **Polling:** The frontend polls `GET /api/sweeps/:id` every 5s to check status.

**Response (202):**

```json
{
  "sweep_id": string,
  "status": "running"
}
```

---

#### `GET /api/sweeps/:id`

Get sweep status.

**Response:** `SweepRecord`

---

### 4.6 LinkedIn Posts

#### `GET /api/linkedin`

List LinkedIn post drafts.

**Query Parameters:** `sweep_id` (optional), `limit`

**Response:**

```json
{
  "posts": LinkedInPost[]
}
```

---

#### `GET /api/linkedin/:id`

Get single post.

**Response:** `LinkedInPost`

---

### 4.7 Export

#### `POST /api/export/pdf`

Generate a PDF export of current dashboard state.

**Request Body:**

```json
{
  "scope": "dashboard" | "topic" | "sweep",
  "topic": Topic,              // required if scope="topic"
  "sweep_id": string,          // required if scope="sweep"
  "date_from": string,
  "date_to": string
}
```

**Response (200):** Binary PDF with `Content-Type: application/pdf`.

**Implementation:** Use `@react-pdf/renderer` on the server side. Build a multi-section PDF: summary stats, topic distribution table, sentiment chart (rendered as image), top articles table, top entities table.

---

### 4.8 Corroboration Heatmap Data

#### `GET /api/heatmap/corroboration`

Data for the corroboration heatmap (topic × time bucket).

**Query Parameters:** `date_from`, `date_to`, `granularity`

**Response:**

```json
{
  "rows": Topic[],
  "cols": string[],         // date labels
  "cells": {
    [topic]: {
      [date]: { count: number, high_corr_count: number, avg_relevance: number }
    }
  }
}
```

**Redis:** For each topic, read `nid:trend:topic:{topic}:daily` and aggregate.

---

### 4.9 Source Quality

#### `GET /api/sources/quality`

**Response:**

```json
{
  "sources": {
    "source": string,
    "source_type": string,
    "total_articles": number,
    "avg_relevance": number,
    "avg_sentiment": number
  }[]
}
```

---

## 5. Visualizations

### 5.1 Topic Distribution — Donut Chart

- **Type:** Donut/Pie (Recharts `PieChart`)
- **Data:** `GET /api/trends/topic-distribution`
- **Display:** Article count per topic. Center shows total article count. Hover shows count + percentage.
- **Colors:** Each topic gets a fixed color (see Section 8 color map).
- **Click:** Filters the news feed to that topic.

### 5.2 Sentiment Trends — Line/Area Chart

- **Type:** Area chart with gradient fill (Recharts `AreaChart`)
- **Data:** `GET /api/trends/sentiment`
- **X-axis:** Date (formatted by granularity).
- **Y-axis:** Average sentiment (-1.0 to +1.0). Zero line drawn. Area above zero in green, below in red (use two stacked areas or clip-path).
- **Secondary Y-axis (optional):** Article count as a bar overlay.
- **Legend:** "Avg Sentiment", "Article Volume".
- **Tooltip:** Date, sentiment value, article count.
- **Filter:** Topic selector dropdown above chart.

### 5.3 Source Breakdown — Horizontal Stacked Bar

- **Type:** Horizontal stacked bar chart (Recharts `BarChart` layout="vertical")
- **Data:** `GET /api/trends/sources`
- **Display:** Each source as a row. Segments colored by `source_type` (rss, api, reddit, arxiv, tavily).
- **Bar length:** Total article count.
- **Hover:** Source name, count, avg relevance, avg sentiment.
- **Click:** Filters feed by source.

### 5.4 Entity Network Graph

- **Type:** Force-directed graph (use `react-force-graph-2d` or custom SVG with d3-force)
- **Data:** `GET /api/entities?limit=30`
- **Nodes:** Top 30 entities. Node size = mention_count. Node color = type (company=blue, person=green, technology=purple).
- **Edges:** Drawn between entities that co-occur in articles. Edge thickness = co-occurrence count. (If co-occurrence data is not in Redis, compute client-side from article entity lists via a dedicated `GET /api/entities/co-occurrence` endpoint.)
- **Interactions:** Drag nodes, click node to filter feed by entity, hover shows entity stats.
- **Legend:** Entity types.

#### `GET /api/entities/co-occurrence` (supplementary endpoint)

**Response:**

```json
{
  "nodes": { "id": string, "type": string, "mention_count": number }[],
  "links": { "source": string, "target": string, "weight": number }[]
}
```

### 5.5 Corroboration Heatmap

- **Type:** Grid heatmap (custom CSS grid or Recharts custom)
- **Data:** `GET /api/heatmap/corroboration`
- **Rows:** 7 topics.
- **Columns:** Date buckets (days by default).
- **Cell color:** Intensity based on `high_corr_count` (0 = dark/empty, higher = brighter). Use a sequential color scale (e.g., white → blue).
- **Cell content:** Number of high-corroboration articles.
- **Hover:** Topic, date, total count, high-corr count, avg relevance.
- **Click:** Opens a filtered feed view for that topic + date.

### 5.6 Trending Entities Bar Chart

- **Type:** Horizontal bar chart (Recharts `BarChart` layout="vertical")
- **Data:** `GET /api/entities/trending`
- **Display:** Top 15 trending entities (trend_direction = "up"), sorted by trend_delta.
- **Bar color:** Green for positive delta, red for negative.
- **Hover:** Entity name, type, mention_count, avg_sentiment.

### 5.7 Entity Cloud / Tag Cloud

- **Type:** Weighted tag cloud (custom component, use `d3-cloud` or simple CSS)
- **Data:** `GET /api/entities?sort=mentions&limit=50`
- **Display:** Font size = mention_count (log-scaled). Color = sentiment (red=negative, green=positive, gray=neutral within ±0.1).
- **Interactions:** Click entity → filters feed. Hover → tooltip with stats.

### 5.8 Timeline View

- **Type:** Vertical timeline list (custom component)
- **Data:** `GET /api/articles?sort=date&limit=100`
- **Display:** Chronological list of articles. Each entry shows: date/time, source badge, title, topic badge, sentiment indicator (colored dot), corroboration badge, relevance score bar.
- **Grouping:** Group by day with sticky date headers.
- **Scroll:** Infinite scroll or "Load more" button.

---

## 6. UI/UX Layout

### 6.1 Global Structure

```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Title "News Intelligence" | Theme Toggle │
│         | "Trigger Sweep" Button | Export PDF Button     │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ Sidebar  │            Main Content Area                  │
│ (Nav)    │                                              │
│          │                                              │
│ • Feed   │   (Changes based on selected view)           │
│ • Trends │                                              │
│ • Entities│                                             │
│ • Sources│                                              │
│ • Sweeps │                                              │
│ • Posts  │                                              │
│          │                                              │
├──────────┴──────────────────────────────────────────────┤
│  Footer: Last sweep time | Article count | Agent status  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Sidebar Navigation

Vertical sidebar, collapsible on mobile (hamburger menu). Items:

1. **Dashboard** — Overview (default view)
2. **News Feed** — Full article list with filters
3. **Trends** — Charts and timeline
4. **Entities** — Entity network, cloud, trending
5. **Sources** — Source quality breakdown
6. **Sweeps** — Sweep history and trigger
7. **LinkedIn Posts** — Post drafts and preview

Each nav item shows a count badge (e.g., total articles, pending sweeps, draft posts).

### 6.3 Page Layouts

#### Dashboard Overview (default landing)

Grid layout, 12 columns. Responsive: stacks to 1 column on mobile, 2 on tablet, 3+ on desktop.

```
┌──────────────────────────────────────────────────────┐
│  Row 1: KPI Cards (4 cards, 3 cols each on desktop)  │
│  [Total Articles] [High Corroboration] [Avg Sentiment]│
│  [Active Topics]                                      │
├───────────────────────┬──────────────────────────────┤
│  Row 2 (2 cols):      │  Row 2 (1 col):              │
│  Topic Distribution   │  Trending Stories            │
│  (Donut)              │  (top 5 high corr+relevance) │
│                       │                              │
├───────────────────────┴──────────────────────────────┤
│  Row 3: Sentiment Trends (full width area chart)      │
│        with topic selector                            │
├──────────────────────┬───────────────────────────────┤
│  Row 4 (1 col):      │  Row 4 (2 cols):              │
│  Entity Cloud        │  Source Breakdown             │
│                      │  (stacked bar)                │
├──────────────────────┴───────────────────────────────┤
│  Row 5: Corroboration Heatmap (full width)            │
├───────────────────────────────────────────────────────┤
│  Row 6: Trending Entities (bar) + Entity Network     │
│  (side by side, 50/50)                               │
└───────────────────────────────────────────────────────┘
```

**KPI Card spec:**
- White/dark card with large number, label, trend arrow (up/down vs previous period), and a small sparkline (optional).
- Click navigates to relevant filtered view.

**Trending Stories panel:**
- Vertical list of 5 cards. Each card: title, source, date, corroboration badge (colored: high=green, medium=amber, low=gray), relevance score bar, sentiment dot, summary (truncated 1 line).
- "View all" link → navigates to News Feed with `corroboration=high&sort=relevance`.

#### News Feed Page

```
┌──────────────────────────────────────────────────────┐
│  Filter Bar (sticky top):                             │
│  [Topic ▼] [Source Type ▼] [Sentiment range slider]  │
│  [Corroboration ▼] [Date range picker] [Search 🔍]   │
│  [Clear All]                                          │
├──────────────────────────────────────────────────────┤
│  Results: 1-50 of 1,234    Sort: [Date ▼] [Limit ▼] │
├──────────────────────────────────────────────────────┤
│  Article Cards (list, full width):                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ Title (clickable, opens url in new tab)         │  │
│  │ Source badge | Date | Topic badge               │  │
│  │ Sentiment: ● | Relevance: ████████░ 82          │  │
│  │ Corroboration: HIGH (4 sources)                 │  │
│  │ Entities: OpenAI, Sam Altman, GPT-5             │  │
│  │ Summary: "..." (2-3 lines, expandable)          │  │
│  └────────────────────────────────────────────────┘  │
│  ...                                                  │
├──────────────────────────────────────────────────────┤
│  [Load More] or Infinite scroll                       │
└──────────────────────────────────────────────────────┘
```

**Article Card spec:**
- Sentiment dot: green (>0.3), amber (-0.3 to 0.3), red (< -0.3).
- Relevance bar: colored gradient from gray to blue.
- Source badge: colored by source_type.
- Topic badge: colored per topic color map.
- Entity tags: small pill chips, clickable to filter.
- Summary: collapsed by default, click "..." to expand full summary.

#### Trends Page

Tabbed or stacked sections:
1. **Sentiment Over Time** — Large area chart with topic selector and granularity toggle.
2. **Topic Distribution** — Donut + accompanying table (topic, count, %, avg sentiment, avg relevance).
3. **Timeline View** — Full-width vertical timeline (Section 5.8 spec).
4. **Corroboration Heatmap** — Full-width heatmap with date range selector.

#### Entities Page

```
┌─────────────────────────────────┬─────────────────────┐
│  Entity Network Graph            │  Entity Cloud       │
│  (force-directed, interactive)   │  (tag cloud)        │
│  [full height]                   │                     │
├─────────────────────────────────┴─────────────────────┤
│  Trending Entities Bar Chart                           │
│  (horizontal bars, top 15)                             │
├────────────────────────────────────────────────────────┤
│  Entity Table: Name | Type | Mentions | Avg Sentiment  │
│  | Topics | Trend | Last Seen                           │
│  (sortable, paginated)                                 │
└────────────────────────────────────────────────────────┘
```

#### Sources Page

1. **Source Breakdown** — Horizontal stacked bar (Section 5.3).
2. **Source Quality Table** — Sortable table: source, source_type, total_articles, avg_relevance, avg_sentiment. Sparkline column showing recent daily article counts.
3. **Source Quality Distribution** — Scatter plot: X = avg_relevance, Y = avg_sentiment, bubble size = total_articles, color = source_type.

#### Sweeps Page

```
┌──────────────────────────────────────────────────────┐
│  Trigger Sweep Card:                                  │
│  [Topic checkboxes (all 7)]                          │
│  [✓ Generate PDF]  [✓ Generate LinkedIn Post]         │
│  [Trigger Sweep] button                               │
│  (When running: show progress spinner + sweep ID)    │
├──────────────────────────────────────────────────────┤
│  Sweep History Table:                                 │
│  Started | Completed | Status | Topics | Articles     │
│  | PDF | LinkedIn | Actions                           │
│  (sortable, paginated, status as colored badge)       │
│  Row click → sweep detail modal                       │
└──────────────────────────────────────────────────────┘
```

**Sweep detail modal:** Shows sweep metadata, list of articles collected (paginated), link to PDF (if generated), LinkedIn post preview (if generated), timeline of sweep execution.

#### LinkedIn Posts Page

```
┌──────────────────────────────────────┬───────────────┐
│  Post Drafts List (left panel):      │  Preview      │
│  ┌────────────────────────────────┐  │  (right panel)│
│  │ Post 1 — ai_industry — 2h ago   │  │               │
│  │ "AI industry sees surge in..."   │  │  Formatted    │
│  └────────────────────────────────┘  │  LinkedIn-     │
│  ┌────────────────────────────────┐  │  style preview │
│  │ Post 2 — agentic_ai — 5h ago   │  │  of selected   │
│  │ "Autonomous agents gain..."     │  │  post          │
│  └────────────────────────────────┘  │               │
│                                      │  [Copy] button │
│                                      │  [Export PDF]  │
└──────────────────────────────────────┴───────────────┘
```

**Post preview:** Renders the LinkedIn post in a card mimicking LinkedIn's post UI (avatar placeholder, name, timestamp, post text with hashtags highlighted, like/comment/share icons—non-functional).

### 6.4 Responsive Behavior

| Breakpoint | Layout |
|---|---|
| < 640px (mobile) | Single column. Sidebar → hamburger drawer. KPI cards stack vertically. Charts full width. Entity network collapses to bar chart. Heatmap scrolls horizontally. |
| 640–1024px (tablet) | 2-column grid. Sidebar collapsible. |
| > 1024px (desktop) | Full 12-column grid. Persistent sidebar. Side-by-side panels. |

### 6.5 Dark/Light Mode

- Use `next-themes` with `class` strategy.
- Toggle button in header (sun/moon icon).
- **Dark mode:** Background `#0a0a0a` / `#171717` for cards. Text `#fafafa`. Charts use lighter palette on dark backgrounds.
- **Light mode:** Background `#fafafa` / `#ffffff` for cards. Text `#0a0a0a`. Charts use standard palette.
- Store preference in localStorage. Default to system preference.
- All chart colors must work on both backgrounds — define in Tailwind config as CSS variables.

### 6.6 Loading & Empty States

- **Skeleton loaders:** Shimmer-style skeletons for each card/chart shape while data loads.
- **Empty state:** Centered illustration + "No articles found" + suggestion to trigger a sweep.
- **Error state:** Red-bordered card with error message + retry button.
- **SWR config:** `revalidateOnFocus: false`, `dedupingInterval: 10000`, refresh interval: 30s for dashboard, 60s for feed.

---

## 7. g-Research-Agent Integration Points

### 7.1 Trigger Sweep

```
POST {G_RESEARCH_AGENT_API_URL}/sweep
Content-Type: application/json

{
  "topics": ["ai_industry", "agentic_ai"],   // optional, defaults to all
  "generate_pdf": true,
  "generate_linkedin": true,
  "sweep_id": "uuid"                         // generated by dashboard, passed to agent
}

Response: 202 Accepted
{
  "sweep_id": "uuid",
  "status": "accepted",
  "estimated_duration_seconds": 120
}
```

The agent writes article data, sweep records, entity stats, topic stats, and trend data into the **same Upstash Redis instance** using the key schema defined in Section 3. The dashboard reads from Redis. The agent also writes `linkedin_post` and `pdf_report_url` fields to the sweep record when complete.

### 7.2 Sweep Status Polling

The dashboard polls `GET /api/sweeps/:id` (reads from Redis `nid:sweep:{id}`). The agent updates the sweep hash:
- `status` → `completed` or `failed`
- `completed_at` → timestamp
- `article_count` → final count
- `pdf_report_url` → URL if generated
- `linkedin_post` → post content if generated

### 7.3 Agent Writes to Redis (reference — not built by AI coder)

The agent writes using this contract:

| Action | Redis Commands |
|---|---|
| Store article | `HSET nid:article:{id} ...`, `ZADD nid:articles:by_date {ts} {id}`, `ZADD nid:articles:by_relevance {score} {id}`, `SADD nid:articles:topic:{topic} {id}`, `SADD nid:articles:source_type:{type} {id}`, `SADD nid:articles:sweep:{sweep_id} {id}`, `SADD nid:articles:corr:{level} {id}` |
| Update entity stats | `HSET nid:entity:{name} ...`, `ZADD nid:entities:by_mentions {count} {name}`, `SADD nid:entity:{name}:articles {id}` |
| Update topic stats | `HSET nid:topic:stats:{topic} ...` |
| Write trend point | `ZADD nid:trend:topic:{topic}:daily {epoch_day} {json}` |
| Complete sweep | `HSET nid:sweep:{id} status completed ...`, `ZADD nid:sweeps:by_date {ts} {id}` |

### 7.4 Source Configuration

The agent stores source configuration at `/workspace/news-sources.json`. The dashboard does **not** read this file directly. If a source management UI is needed in the future, a dedicated API endpoint on the agent would expose it.

---

## 8. Topic Color Map

Use consistently across all charts, badges, and filters:

| Topic | Color (hex) |
|---|---|
| `capital_markets` | `#3b82f6` (blue) |
| `ai_industry` | `#8b5cf6` (purple) |
| `ai_sovereignty` | `#ef4444` (red) |
| `open_weight` | `#10b981` (emerald) |
| `agentic_ai` | `#f59e0b` (amber) |
| `ai_fintech` | `#06b6d4` (cyan) |
| `ai_regulation` | `#ec4899` (pink) |

**Source type colors:**

| Source Type | Color (hex) |
|---|---|
| `rss` | `#6366f1` (indigo) |
| `api` | `#14b8a6` (teal) |
| `reddit` | `#f97316` (orange) |
| `arxiv` | `#a855f7` (purple) |
| `tavily` | `#64748b` (slate) |

**Sentiment colors:**

| Range | Color |
|---|---|
| > 0.3 | `#10b981` (green) |
| -0.3 to 0.3 | `#f59e0b` (amber) |
| < -0.3 | `#ef4444` (red) |

---

## 9. File Structure

```
/app
  /api
    /articles
      route.ts                    # GET /api/articles
      /[id]
        route.ts                  # GET /api/articles/:id
    /topics
      /stats
        route.ts                  # GET /api/topics/stats
    /entities
      route.ts                    # GET /api/entities
      /trending
        route.ts                  # GET /api/entities/trending
      /co-occurrence
        route.ts                  # GET /api/entities/co-occurrence
    /trends
      /sentiment
        route.ts                  # GET /api/trends/sentiment
      /topic-distribution
        route.ts                  # GET /api/trends/topic-distribution
      /sources
        route.ts                  # GET /api/trends/sources
    /sweeps
      route.ts                    # GET /api/sweeps, POST /api/sweeps/trigger
      /[id]
        route.ts                  # GET /api/sweeps/:id
    /linkedin
      route.ts                    # GET /api/linkedin
      /[id]
        route.ts                  # GET /api/linkedin/:id
    /heatmap
      /corroboration
        route.ts                  # GET /api/heatmap/corroboration
    /sources
      /quality
        route.ts                  # GET /api/sources/quality
    /export
      /pdf
        route.ts                  # POST /api/export/pdf
  /dashboard
    page.tsx                      # Dashboard overview
  /feed
    page.tsx                      # News feed
  /trends
    page.tsx                      # Trends page
  /entities
    page.tsx                      # Entities page
  /sources
    page.tsx                      # Sources page
  /sweeps
    page.tsx                      # Sweeps page
  /posts
    page.tsx                      # LinkedIn posts page
  layout.tsx                     # Root layout (sidebar, header, theme provider)
  page.tsx                        # Redirect to /dashboard

/components
  /layout
    Sidebar.tsx
    Header.tsx
    Footer.tsx
    ThemeToggle.tsx
  /charts
    TopicDonut.tsx
    SentimentTrendChart.tsx
    SourceBreakdownChart.tsx
    EntityNetworkGraph.tsx
    CorroborationHeatmap.tsx
    TrendingEntitiesChart.tsx
    EntityCloud.tsx
    TimelineView.tsx
    SourceScatterPlot.tsx
  /cards
    KPICard.tsx
    ArticleCard.tsx
    TrendingStoryCard.tsx
    SweepCard.tsx
    LinkedInPostCard.tsx
    SweepTriggerCard.tsx
  /filters
    FilterBar.tsx
    TopicFilter.tsx
    SourceFilter.tsx
    SentimentSlider.tsx
    CorroborationFilter.tsx
    DateRangePicker.tsx
    SearchInput.tsx
  /tables
    SweepHistoryTable.tsx
    EntityTable.tsx
    SourceQualityTable.tsx
  /ui
    (shadcn/ui components)
  /common
    Skeleton.tsx
    EmptyState.tsx
    ErrorState.tsx
    Badge.tsx
    SentimentDot.tsx
    RelevanceBar.tsx
    TopicBadge.tsx
    SourceBadge.tsx

/lib
  /redis
    client.ts                     # Upstash Redis client singleton
    queries.ts                    # All Redis read query functions
    keys.ts                       # Key builder functions (type-safe)
    types.ts                      # Redis-serialized types
  /api
    client.ts                     # SWR fetcher + API client functions
  /utils
    colors.ts                     # Topic/source/sentiment color maps
    format.ts                     # Date formatting, number formatting
    constants.ts                  # Topic list, source types, etc.
  /hooks
    useArticles.ts                # SWR hook for articles
    useTopicStats.ts              # SWR hook for topic stats
    useEntities.ts                # SWR hook for entities
    useTrends.ts                  # SWR hook for trend data
    useSweeps.ts                  # SWR hook for sweeps
    useTheme.ts                   # Re-export from next-themes

/stores
  filters.ts                      # Zustand store for filter state
  ui.ts                           # Zustand store for UI state (sidebar open, etc.)

/types
  index.ts                        # All TypeScript interfaces (Article, SweepRecord, etc.)
```

---

## 10. Key Implementation Notes

### 10.1 Redis Query Helper Pattern

```typescript
// lib/redis/keys.ts
export const keys = {
  article: (id: string) => `nid:article:${id}`,
  articlesByDate: () => 'nid:articles:by_date',
  articlesByRelevance: () => 'nid:articles:by_relevance',
  articlesByTopic: (topic: Topic) => `nid:articles:topic:${topic}`,
  articlesBySourceType: (type: string) => `nid:articles:source_type:${type}`,
  articlesByCorroboration: (level: string) => `nid:articles:corr:${level}`,
  articlesBySweep: (sweepId: string) => `nid:articles:sweep:${sweepId}`,
  sweep: (id: string) => `nid:sweep:${id}`,
  sweepsByDate: () => 'nid:sweeps:by_date',
  entity: (name: string) => `nid:entity:${encodeURIComponent(name)}`,
  entitiesByMentions: () => `nid:entities:by_mentions',
  entityArticles: (name: string) => `nid:entity:${encodeURIComponent(name)}:articles`,
  topicStats: (topic: Topic) => `nid:topic:stats:${topic}`,
  trendTopicDaily: (topic: Topic) => `nid:trend:topic:${topic}:daily`,
  trendSentimentDaily: () => 'nid:trend:sentiment:daily',
  linkedin: (id: string) => `nid:linkedin:${id}`,
  linkedinByDate: () => 'nid:linkedin:by_date',
  sourceQuality: (source: string) => `nid:source:quality:${encodeURIComponent(source)}`,
  sourcesByQuality: () => 'nid:sources:by_quality',
};
```

### 10.2 Filter State (Zustand)

```typescript
interface FilterState {
  topics: Topic[];
  sourceType: string | null;
  source: string | null;
  sentimentMin: number;
  sentimentMax: number;
  corroboration: 'high' | 'medium' | 'low' | null;
  dateFrom: string | null;
  dateTo: string | null;
  minRelevance: number;
  entity: string | null;
  search: string;
  sort: 'date' | 'relevance' | 'sentiment';
  order: 'asc' | 'desc';
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearAll: () => void;
  toQueryParams: () => string;  // serialize for API calls
}
```

### 10.3 Real-Time Updates

- Dashboard overview: SWR `refreshInterval: 30000` (30s).
- News feed: SWR `refreshInterval: 60000` (60s). Revalidate on manual refresh button click.
- Active sweep: When a sweep is running, poll `GET /api/sweeps/:id` every 5s. Stop polling when `status !== 'running'`.
- No WebSocket needed — polling is sufficient for this use case.

### 10.4 PDF Export

- Use `@react-pdf/renderer` server-side in `/api/export/pdf` route.
- PDF sections: Title page (dashboard title, date range, generated timestamp), Summary stats table, Topic distribution table, Sentiment summary, Top 10 articles table (title, source, date, sentiment, relevance, corroboration), Top 10 entities table, Source quality table.
- Return as binary response with `Content-Disposition: attachment; filename="news-intelligence-{date}.pdf"`.

### 10.5 Performance

- Redis pipeline reads: When fetching article lists, use `pipeline()` to batch HGETALL calls.
- Limit `ZRANGE` results to pagination bounds.
- Client-side: virtualize long lists (use `@tanstack/react-virtual`) for feed with >100 items.
- Chart data: cache SWR responses with `dedupingInterval: 30000`.
- Entity network: limit to 30 nodes, 100 links max to prevent rendering lag.

### 10.6 Accessibility

- All interactive elements keyboard-navigable.
- Charts have `aria-label` describing the data.
- Color is never the sole indicator — always pair with text/badges.
- Contrast ratios meet WCAG AA in both themes.

---

## 11. Build Checklist

- [ ] Next.js project with App Router, TypeScript, Tailwind, shadcn/ui
- [ ] Upstash Redis client + key builders + query helpers
- [ ] All API routes (Section 4) implemented with proper error handling
- [ ] All TypeScript types defined (Section 2)
- [ ] Sidebar + header + footer layout with responsive behavior
- [ ] Dashboard overview page with all 6 row sections
- [ ] News feed page with filter bar + article cards + pagination
- [ ] Trends page (sentiment chart, topic distribution, timeline, heatmap)
- [ ] Entities page (network graph, cloud, trending bar, entity table)
- [ ] Sources page (breakdown bar, quality table, scatter plot)
- [ ] Sweeps page (trigger card + history table + detail modal)
- [ ] LinkedIn posts page (list + preview panel)
- [ ] Dark/light mode with next-themes
- [ ] All 8 visualizations implemented (Section 5)
- [ ] PDF export endpoint functional
- [ ] Sweep trigger calls agent API, polls status
- [ ] Skeleton loaders, empty states, error states
- [ ] Mobile responsive at all breakpoints
- [ ] Deployed to Vercel
