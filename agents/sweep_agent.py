"""
Sweep Agent — APEX:E3 News Intelligence Pipeline
Stage 1: Fetch news from 7 sources × 7 topics, filter, deduplicate, score, extract entities.

Changes from v3:
- Corroboration: title-similarity + source diversity (was URL-based)
- Source type mapping: maps internal names to SourceType enum values
"""

import os
import re
import json
import hashlib
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
import feedparser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sweep-agent")

UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL", "")
UPSTASH_REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_TOKEN", "")

TOPICS = [
    "capital_markets", "ai_industry", "ai_sovereignty", "open_weight",
    "agentic_ai", "ai_fintech", "ai_regulation",
]

SOURCE_TYPE_MAP = {
    "google_news": "rss",
    "gdelt": "api",
    "hacker_news": "api",
    "reddit": "reddit",
    "arxiv": "arxiv",
    "publisher": "rss",
    "tavily": "tavily",
}

TIER1_DOMAINS = {
    "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com",
    "marketwatch.com", "techcrunch.com", "theverge.com", "arstechnica.com",
    "venturebeat.com", "apnews.com",
}

BLOCKED_DOMAINS = {
    "facebook.com", "twitter.com", "x.com", "youtube.com", "instagram.com",
    "tiktok.com", "reddit.com", "wikipedia.org", "linkedin.com",
}

ENTITY_PATTERNS = {
    "company": [
        "NVIDIA", "Microsoft", "Alphabet", "Google", "Apple", "Amazon", "Meta",
        "Tesla", "AMD", "Intel", "IBM", "TSMC", "ASML", "ARM Holdings",
        "Micron", "Qualcomm", "Arista Networks", "Dell", "Super Micro",
        "Cloudflare", "Datadog", "PayPal", "Block", "Square", "Coinbase",
        "OpenAI", "Anthropic", "Mistral", "DeepMind", "Huawei", "Siemens",
        "BlackRock", "Goldman Sachs", "JPMorgan", "Bloomberg", "Oracle",
    ],
    "technology": [
        "AI", "AGI", "GPT", "LLM", "LLaMA", "Gemini", "blockchain",
        "quantum", "machine learning", "deep learning", "neural network",
        "transformer", "generative AI", "large language model",
    ],
    "country": [
        "US", "UK", "China", "EU", "India", "Japan", "Germany", "France",
        "South Korea", "Israel",
    ],
}


def redis_pipe(commands):
    """Execute Redis pipeline via Upstash REST API."""
    if not UPSTASH_REDIS_URL:
        logger.warning("No Redis URL configured, skipping write")
        return []
    url = f"{UPSTASH_REDIS_URL}/pipeline"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}", "Content-Type": "application/json"}
    resp = requests.post(url, json=commands, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def redis_hgetall(key):
    url = f"{UPSTASH_REDIS_URL}/hgetall/{key}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            result = resp.json().get("result")
            if result and len(result) > 0:
                return {result[i]: result[i + 1] for i in range(0, len(result), 2)}
    except Exception:
        pass
    return {}


def redis_set(key, value, ex=None):
    url = f"{UPSTASH_REDIS_URL}/set/{key}/{requests.utils.quote(str(value), safe='')}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}"}
    if ex:
        url += f"?ex={ex}"
    try:
        requests.post(url, headers=headers, timeout=10)
    except Exception as e:
        logger.error(f"Redis SET error: {e}")


def redis_zcard(key):
    url = f"{UPSTASH_REDIS_URL}/zcard/{key}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("result", 0)
    except Exception:
        pass
    return 0


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_domain(url):
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc.replace("www.", "")
    except Exception:
        return ""


def is_blocked(url):
    domain = get_domain(url).lower()
    return any(b in domain for b in BLOCKED_DOMAINS)


def is_too_old(date_str, max_hours=48):
    try:
        dt = parse_date_to_iso(date_str)
        if not dt:
            return True
        age = datetime.now(timezone.utc) - dt
        return age.total_seconds() > max_hours * 3600
    except Exception:
        return True


def parse_date_to_iso(date_str):
    if not date_str:
        return None
    formats = [
        "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S%z", "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT", "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def extract_entities(title, summary=""):
    text = f"{title} {summary}"
    found = []
    seen = set()
    for etype, names in ENTITY_PATTERNS.items():
        for name in names:
            if name.lower() in text.lower() and name.lower() not in seen:
                found.append({"name": name, "type": etype})
                seen.add(name.lower())
    return found


def compute_relevance(title, summary, topic, entities):
    score = 40
    if entities:
        score += min(len(entities) * 5, 20)
    for e in entities:
        if e["type"] == "company":
            score += 5
    if topic in ("capital_markets", "ai_fintech"):
        score += 10
    if any(kw in (title + summary).lower() for kw in ["earnings", "revenue", "ipo", "acquisition", "merger", "regulation", "ban", "fine", "lawsuit"]):
        score += 10
    return min(max(score, 0), 100)


def compute_sentiment(title, summary):
    text = f"{title} {summary}".lower()
    positive = ["surge", "soar", "rally", "gain", "profit", "growth", "boost", "rise", "upgrade", "beat", "record", "breakthrough", "launch", "innovation"]
    negative = ["crash", "plunge", "fall", "loss", "decline", "drop", "cut", "ban", "fine", "lawsuit", "regulate", "risk", "threat", "hack", "breach", "fail", "warning", "concern"]
    pos = sum(1 for w in positive if w in text)
    neg = sum(1 for w in negative if w in text)
    if pos + neg == 0:
        return 0.0
    return round((pos - neg) / (pos + neg), 3)


def fetch_google_news(topic, max_results=15):
    articles = []
    queries = {
        "capital_markets": "AI capital markets fintech regulation",
        "ai_industry": "artificial intelligence industry news",
        "ai_sovereignty": "AI sovereignty enterprise infrastructure",
        "open_weight": "open source AI model Llama Mistral",
        "agentic_ai": "agentic AI autonomous agents",
        "ai_fintech": "AI financial technology trading",
        "ai_regulation": "AI regulation compliance governance",
    }
    query = queries.get(topic, "artificial intelligence news")
    try:
        url = f"https://news.google.com/rss/search?q={requests.utils.quote(query)}&hl=en-US&gl=US&ceid=US:en"
        feed = feedparser.parse(url)
        for entry in feed.entries[:max_results]:
            articles.append({
                "title": entry.get("title", ""),
                "url": entry.get("link", ""),
                "date": parse_date_to_iso(entry.get("published", "")) and entry.get("published", ""),
                "source": entry.get("source", {}).get("title", get_domain(entry.get("link", ""))),
                "source_type": "google_news",
                "topic": topic,
                "summary": entry.get("summary", ""),
            })
    except Exception as e:
        logger.error(f"Google News fetch error for {topic}: {e}")
    return articles


def fetch_gdelt(topic, max_results=15):
    articles = []
    queries = {
        "capital_markets": "AI capital markets",
        "ai_industry": "artificial intelligence industry",
        "ai_sovereignty": "AI sovereignty",
        "open_weight": "open source AI",
        "agentic_ai": "agentic AI autonomous",
        "ai_fintech": "AI fintech financial",
        "ai_regulation": "AI regulation governance",
    }
    query = queries.get(topic, "artificial intelligence")
    try:
        url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={requests.utils.quote(query)}&mode=ArtList&maxrecords={max_results}&format=json&timespan=48h"
        resp = requests.get(url, timeout=15)
        data = resp.json()
        for item in data.get("articles", []):
            articles.append({
                "title": item.get("title", ""),
                "url": item.get("url", ""),
                "date": item.get("seendate", ""),
                "source": item.get("source", {}).get("title", get_domain(item.get("url", ""))),
                "source_type": "gdelt",
                "topic": topic,
                "summary": "",
            })
    except Exception as e:
        logger.error(f"GDELT fetch error for {topic}: {e}")
    return articles


def fetch_hacker_news(topic, max_results=10):
    articles = []
    try:
        url = "https://hn.algolia.com/api/v1/search?query=AI+artificial+intelligence&tags=story&hitsPerPage=20"
        resp = requests.get(url, timeout=15)
        data = resp.json()
        for hit in data.get("hits", [])[:max_results]:
            articles.append({
                "title": hit.get("title", ""),
                "url": hit.get("url", ""),
                "date": datetime.fromtimestamp(hit.get("created_at_i", 0), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if hit.get("created_at_i") else "",
                "source": "Hacker News",
                "source_type": "hacker_news",
                "topic": topic,
                "summary": hit.get("story_text", "")[:500] if hit.get("story_text") else "",
            })
    except Exception as e:
        logger.error(f"Hacker News fetch error: {e}")
    return articles


def fetch_reddit(topic, max_results=10):
    articles = []
    subreddits = {
        "capital_markets": "SecurityAnalysis+investing+stocks",
        "ai_industry": "artificial+MachineLearning",
        "ai_sovereignty": "artificial+dataprivacy",
        "open_weight": "LocalLLaMA+MachineLearning",
        "agentic_ai": "artificial+AutoGPT+LangChain",
        "ai_fintech": "fintech+algotrading",
        "ai_regulation": "artificial+technology+law",
    }
    sub = subreddits.get(topic, "artificial")
    try:
        url = f"https://www.reddit.com/r/{sub}/new.json?limit={max_results}"
        headers = {"User-Agent": "APEX-E3-NewsBot/3.0"}
        resp = requests.get(url, headers=headers, timeout=15)
        data = resp.json()
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            if not post.get("is_self", True) and post.get("url", "").startswith("http"):
                articles.append({
                    "title": post.get("title", ""),
                    "url": post.get("url", ""),
                    "date": datetime.fromtimestamp(post.get("created_utc", 0), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": f"reddit/r/{post.get('subreddit', 'unknown')}",
                    "source_type": "reddit",
                    "topic": topic,
                    "summary": post.get("selftext", "")[:500],
                })
    except Exception as e:
        logger.error(f"Reddit fetch error for {topic}: {e}")
    return articles


def fetch_arxiv(topic, max_results=8):
    articles = []
    queries = {
        "capital_markets": "all:\"financial AI\" OR all:\"algorithmic trading\"",
        "ai_industry": "all:\"artificial intelligence\" AND cat:cs.AI",
        "ai_sovereignty": "all:\"AI governance\" OR all:\"AI policy\"",
        "open_weight": "all:\"open source\" AND all:\"language model\"",
        "agentic_ai": "all:\"autonomous agents\" OR all:\"agentic AI\"",
        "ai_fintech": "all:\"fintech AI\" OR all:\"AI finance\"",
        "ai_regulation": "all:\"AI regulation\" OR all:\"AI ethics\"",
    }
    query = queries.get(topic, "all:\"artificial intelligence\"")
    try:
        url = f"http://export.arxiv.org/api/query?search_query={requests.utils.quote(query)}&start=0&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"
        resp = requests.get(url, timeout=15)
        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.content)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        for entry in root.findall("atom:entry", ns):
            title = entry.find("atom:title", ns).text.strip().replace("\n", " ")
            link = ""
            for link_el in entry.findall("atom:link", ns):
                if link_el.get("type") == "text/html":
                    link = link_el.get("href", "")
                    break
            if not link:
                link = entry.find("atom:id", ns).text
            published = entry.find("atom:published", ns).text
            summary = entry.find("atom:summary", ns).text.strip()[:500]
            authors = ", ".join([a.find("atom:name", ns).text for a in entry.findall("atom:author", ns)[:3]])
            articles.append({
                "title": title,
                "url": link,
                "date": published,
                "source": f"arXiv ({authors})",
                "source_type": "arxiv",
                "topic": topic,
                "summary": summary,
            })
    except Exception as e:
        logger.error(f"arXiv fetch error for {topic}: {e}")
    return articles


def fetch_tavily(topic, max_results=10):
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return []
    articles = []
    queries = {
        "capital_markets": "AI capital markets fintech latest news today",
        "ai_industry": "artificial intelligence industry latest news today",
        "ai_sovereignty": "AI sovereignty enterprise latest news today",
        "open_weight": "open source AI model latest news today",
        "agentic_ai": "agentic AI autonomous agents latest news today",
        "ai_fintech": "AI fintech financial technology latest news today",
        "ai_regulation": "AI regulation compliance governance latest news today",
    }
    query = queries.get(topic, "AI news today")
    try:
        resp = requests.post("https://api.tavily.com/search", json={
            "api_key": api_key,
            "query": query,
            "search_depth": "basic",
            "max_results": max_results,
            "include_raw_content": False,
        }, timeout=20)
        data = resp.json()
        for r in data.get("results", []):
            articles.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "date": r.get("published_date", now_iso()),
                "source": get_domain(r.get("url", "")),
                "source_type": "tavily",
                "topic": topic,
                "summary": r.get("content", "")[:500],
            })
    except Exception as e:
        logger.error(f"Tavily fetch error for {topic}: {e}")
    return articles


def fetch_publisher_feeds(topic, max_results=10):
    articles = []
    feeds = [
        "https://feeds.reuters.com/reuters/technologyNews",
        "https://feeds.reuters.com/reuters/businessNews",
        "https://techcrunch.com/feed/",
        "https://www.theverge.com/rss/index.xml",
    ]
    for feed_url in feeds:
        try:
            feed = feedparser.parse(feed_url)
            for entry in feed.entries[:max_results]:
                articles.append({
                    "title": entry.get("title", ""),
                    "url": entry.get("link", ""),
                    "date": parse_date_to_iso(entry.get("published", "")) and entry.get("published", ""),
                    "source": entry.get("source", {}).get("title", get_domain(feed_url)),
                    "source_type": "publisher",
                    "topic": topic,
                    "summary": entry.get("summary", "")[:500],
                })
        except Exception as e:
            logger.error(f"Publisher feed error {feed_url}: {e}")
    return articles


def run_sweep(topics=None, triggered_by="scheduled"):
    """Main sweep function. Fetches, filters, deduplicates, scores, extracts entities."""
    sweep_topics = topics or TOPICS
    sweep_id = str(uuid.uuid4())
    started_at = now_iso()

    logger.info(f"Starting sweep {sweep_id} for topics: {sweep_topics}")

    all_articles = []

    for topic in sweep_topics:
        fetchers = [
            fetch_google_news(topic),
            fetch_gdelt(topic),
            fetch_hacker_news(topic),
            fetch_reddit(topic),
            fetch_arxiv(topic),
            fetch_tavily(topic),
            fetch_publisher_feeds(topic),
        ]
        for fetch_fn in fetchers:
            try:
                all_articles.extend(fetch_fn)
            except TypeError:
                all_articles.extend(fetch_fn)

    logger.info(f"Fetched {len(all_articles)} raw articles")

    filtered = []
    seen_urls = set()
    for a in all_articles:
        url = a.get("url", "")
        if not url or not a.get("title"):
            continue
        if is_blocked(url):
            continue
        url_hash = hashlib.md5(url.encode()).hexdigest()
        if url_hash in seen_urls:
            continue
        seen_urls.add(url_hash)

        a["id"] = url_hash
        a["domain"] = get_domain(url)

        raw_st = a.get("source_type", "rss")
        a["source_type"] = SOURCE_TYPE_MAP.get(raw_st, raw_st)

        if not a.get("date"):
            a["date"] = now_iso()
        else:
            parsed = parse_date_to_iso(a["date"])
            if parsed:
                a["date"] = parsed.strftime("%Y-%m-%dT%H:%M:%SZ")
            else:
                a["date"] = now_iso()

        if is_too_old(a["date"]):
            continue

        a["entities"] = extract_entities(a.get("title", ""), a.get("summary", ""))
        a["relevance_score"] = compute_relevance(a.get("title", ""), a.get("summary", ""), a.get("topic", ""), a["entities"])
        a["sentiment_score"] = compute_sentiment(a.get("title", ""), a.get("summary", ""))

        if a["relevance_score"] < 30:
            continue

        filtered.append(a)

    logger.info(f"After filtering: {len(filtered)} articles")

    # Compute corroboration: title similarity + source diversity
    from difflib import SequenceMatcher
    for a in filtered:
        similar_domains = set()
        own_domain = a.get("domain", "") or get_domain(a.get("url", ""))
        if own_domain:
            similar_domains.add(own_domain)
        for other in filtered:
            if other.get("url") == a.get("url"):
                continue
            title_sim = SequenceMatcher(None,
                a.get("title", "").lower(),
                other.get("title", "").lower()).ratio()
            if title_sim > 0.5:
                other_domain = other.get("domain", "") or get_domain(other.get("url", ""))
                if other_domain:
                    similar_domains.add(other_domain)
        a["source_count"] = len(similar_domains)
        if len(similar_domains) >= 3:
            a["corroboration_score"] = "high"
        elif len(similar_domains) >= 2:
            a["corroboration_score"] = "medium"
        else:
            a["corroboration_score"] = "low"

    # Write temp data for redis-writer to pick up
    temp_key = f"nid:temp:sweep:{sweep_id}:articles"
    redis_set(temp_key, json.dumps(filtered), ex=3600)

    sweep_data = {
        "id": sweep_id,
        "started_at": started_at,
        "status": "running",
        "topics": json.dumps(sweep_topics),
        "article_count": len(filtered),
        "triggered_by": triggered_by,
        "error": "",
        "pipeline_stage": "news_completed",
    }

    pipe_cmds = [
        ["HMSET", f"nid:sweep:{sweep_id}"] + [str(v) for pair in sweep_data.items() for v in pair],
        ["ZADD", "nid:sweeps:by_date", str(int(time.time())), sweep_id],
    ]
    try:
        redis_pipe(pipe_cmds)
    except Exception as e:
        logger.error(f"Failed to write sweep: {e}")

    logger.info(f"Sweep {sweep_id} complete: {len(filtered)} articles written to temp key")
    return {"sweep_id": sweep_id, "article_count": len(filtered), "articles": filtered}


if __name__ == "__main__":
    result = run_sweep(triggered_by="manual")
    print(json.dumps({"sweep_id": result["sweep_id"], "article_count": result["article_count"]}, indent=2))
