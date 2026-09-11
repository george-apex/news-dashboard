"""
Wrangler Agent — APEX:E3 News Intelligence Pipeline
Stage 4: Generate LinkedIn posts from high-relevance articles + dynamic market data, verify pipeline

Changes from v3:
- get_top_articles: filter by financial_relevance > 75
- get_market_data: dynamic (reads market_data_refs from articles)
- write_linkedin_post: adds topic, financial_relevance, referenced_tickers
- verify_pipeline: adds v5 checks (financial_relevance ZSets, entity:articles ZSet, article v5 fields, sweep metadata)
"""

import os
import json
import time
import uuid
import logging
from datetime import datetime, timezone

import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wrangler-agent")

UPSTASH_REDIS_URL = os.environ.get("UPSTASH_REDIS_URL", "")
UPSTASH_REDIS_TOKEN = os.environ.get("UPSTASH_REDIS_TOKEN", "")


def redis_pipe(commands):
    if not UPSTASH_REDIS_URL:
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


def redis_zrevrange(key, start, stop):
    url = f"{UPSTASH_REDIS_URL}/zrevrange/{key}/{start}/{stop}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("result", [])
    except Exception:
        pass
    return []


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


def get_top_articles(count=10, min_financial_relevance=75):
    article_ids = redis_zrevrange("nid:articles:high_relevance", 0, count * 3 - 1)
    articles = []
    for item in article_ids:
        aid = item if isinstance(item, str) else (item[0] if isinstance(item, list) else str(item))
        data = redis_hgetall(f"nid:article:{aid}")
        if data:
            try:
                fr = int(data.get("financial_relevance", 0))
            except (ValueError, TypeError):
                fr = 0
            if fr >= min_financial_relevance:
                articles.append(data)
        if len(articles) >= count:
            break
    return articles


def get_market_data_for_articles(articles):
    tickers = set()
    for article in articles:
        refs = article.get("market_data_refs", "[]")
        if isinstance(refs, str):
            try:
                refs = json.loads(refs)
            except Exception:
                refs = []
        for ref in refs:
            if isinstance(ref, dict) and ref.get("ticker"):
                tickers.add(ref["ticker"])

    result = {}
    for ticker in tickers:
        data = redis_hgetall(f"nid:marketdata:{ticker}")
        if data:
            result[ticker] = data

    macro = redis_hgetall("nid:marketdata:macro")
    if macro:
        result["macro"] = macro
    return result


def write_linkedin_post(content, angle, sweep_id, source_url, source_title, source_id,
                        topic, financial_relevance=0, referenced_tickers=None):
    post_id = str(uuid.uuid4())
    now = now_iso()
    epoch = str(int(time.time()))

    redis_pipe([
        ["HSET", f"nid:linkedin:{post_id}",
         "id", post_id,
         "content", content,
         "angle", angle,
         "sweep_id", sweep_id,
         "topic", topic,
         "status", "draft",
         "created_at", now,
         "source_article_url", source_url,
         "source_article_title", source_title,
         "source_article_id", source_id,
         "financial_relevance", str(financial_relevance),
         "referenced_tickers", json.dumps(referenced_tickers or []),
         ],
        ["ZADD", "nid:linkedin:by_date", epoch, post_id],
    ])
    return post_id


def verify_pipeline(sweep_id):
    checks = {}
    checks["articles_by_date"] = redis_zcard("nid:articles:by_date")
    checks["articles_by_relevance"] = redis_zcard("nid:articles:by_relevance")
    checks["articles_by_financial_relevance"] = redis_zcard("nid:articles:by_financial_relevance")
    checks["articles_high_relevance"] = redis_zcard("nid:articles:high_relevance")
    checks["entities_by_mentions"] = redis_zcard("nid:entities:by_mentions")
    checks["entities_by_financial_relevance"] = redis_zcard("nid:entities:by_financial_relevance")

    top_entities = redis_zrevrange("nid:entities:by_mentions", 0, 0)
    if top_entities:
        entity_name = top_entities[0] if isinstance(top_entities[0], str) else top_entities[0][0]
        checks["entity_articles_zset_exists"] = redis_zcard(f"nid:entity:{entity_name}:articles")

    top_article_ids = redis_zrevrange("nid:articles:by_relevance", 0, 0)
    if top_article_ids:
        aid = top_article_ids[0] if isinstance(top_article_ids[0], str) else top_article_ids[0][0]
        article_data = redis_hgetall(f"nid:article:{aid}")
        checks["first_article_has_market_data_refs"] = "market_data_refs" in (article_data or {})
        checks["first_article_financial_relevance"] = (article_data or {}).get("financial_relevance", "0")
        checks["first_article_has_market_data"] = (article_data or {}).get("has_market_data", "false")

    sweep_data = redis_hgetall(f"nid:sweep:{sweep_id}")
    checks["sweep_instrument_count"] = (sweep_data or {}).get("instrument_count", "0")
    checks["sweep_entities_resolved"] = (sweep_data or {}).get("entities_resolved", "0")

    logger.info(f"Pipeline verification for sweep {sweep_id}: {json.dumps(checks)}")
    return checks


def run_wrangler(sweep_id, max_posts=3):
    logger.info(f"Wrangler starting for sweep {sweep_id}")

    articles = get_top_articles(count=max_posts * 2, min_financial_relevance=75)
    if not articles:
        logger.warning("No high-relevance articles found for LinkedIn post generation")
        return {"posts_created": 0}

    market_data = get_market_data_for_articles(articles)
    posts_created = 0

    for article in articles[:max_posts]:
        title = article.get("title", "")
        url = article.get("url", "")
        aid = article.get("id", "")
        topic = article.get("topic", "")
        fr = 0
        try:
            fr = int(article.get("financial_relevance", 0))
        except (ValueError, TypeError):
            pass

        tickers = []
        refs = article.get("market_data_refs", "[]")
        if isinstance(refs, str):
            try:
                refs = json.loads(refs)
            except Exception:
                refs = []
        for ref in refs:
            if isinstance(ref, dict) and ref.get("ticker"):
                tickers.append(ref["ticker"])

        content = f"Key development: {title}"
        angle = "market_intelligence"

        write_linkedin_post(
            content=content,
            angle=angle,
            sweep_id=sweep_id,
            source_url=url,
            source_title=title,
            source_id=aid,
            topic=topic,
            financial_relevance=fr,
            referenced_tickers=tickers,
        )
        posts_created += 1

    verify_pipeline(sweep_id)

    return {"posts_created": posts_created}


if __name__ == "__main__":
    sweep_id = os.environ.get("SWEEP_ID", "test")
    result = run_wrangler(sweep_id)
    print(json.dumps(result, indent=2))
