"""
Redis Writer Agent — APEX:E3 News Intelligence Pipeline
Stage 0: Write initial sweep status
Stage 3: Write enriched articles + market data + cross-references + entity profiles

Changes from v3:
- Articles get 5 new fields: market_data_refs, financial_relevance, has_market_data, resolved_entities, high_relevance
- Entity articles written as ZADD (was missing entirely — bug fix)
- Market data ticker articles ZADD
- Entity profiles with correlation, signal_strength, sector, tier
- Heatmap topic_entity
- All 8 macro indicators
- Dynamic market data with tier support
"""

import os
import json
import time
import math
import uuid
import logging
from datetime import datetime, timezone

import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("redis-writer")

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


def redis_get(key):
    url = f"{UPSTASH_REDIS_URL}/get/{key}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_TOKEN}"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("result")
    except Exception:
        pass
    return None


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


def write_initial_sweep(sweep_id, topics, triggered_by="scheduled"):
    now = now_iso()
    epoch = str(int(time.time()))
    commands = [
        ["HSET", f"nid:sweep:{sweep_id}",
         "id", sweep_id,
         "started_at", now,
         "status", "running",
         "topics", json.dumps(topics),
         "article_count", "0",
         "error", "",
         "triggered_by", triggered_by,
         "pipeline_stage", "news_fetching",
         ],
        ["ZADD", "nid:sweeps:by_date", epoch, sweep_id],
    ]
    redis_pipe(commands)
    logger.info(f"Initial sweep {sweep_id} written")


def write_articles_to_redis(articles, sweep_id):
    now = now_iso()
    now_epoch = str(int(time.time()))
    commands = []

    for a in articles:
        aid = a["id"]
        financial_relevance = int(a.get("financial_relevance", 0))

        commands.append(["HSET", f"nid:article:{aid}",
            "id", aid,
            "title", a.get("title", ""),
            "url", a.get("url", ""),
            "date", a.get("date", now),
            "source", a.get("source", "unknown"),
            "source_type", a.get("source_type", "rss"),
            "relevance_score", str(a.get("relevance_score", 0)),
            "corroboration_score", a.get("corroboration_score", "low"),
            "source_count", str(a.get("source_count", 1)),
            "sentiment_score", str(a.get("sentiment_score", 0.0)),
            "entities", json.dumps(a.get("entities", [])),
            "topic", a.get("topic", ""),
            "summary", a.get("summary", ""),
            "fetched_at", now,
            "sweep_id", sweep_id,
            "market_data_refs", json.dumps(a.get("market_data_refs", [])),
            "financial_relevance", str(financial_relevance),
            "has_market_data", str(a.get("has_market_data", False)).lower(),
            "resolved_entities", json.dumps(a.get("resolved_entities", [])),
            "high_relevance", "true" if financial_relevance > 60 else "false",
        ])

        try:
            epoch = str(int(datetime.strptime(a.get("date", now), "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).timestamp()))
        except Exception:
            epoch = now_epoch
        commands.append(["ZADD", "nid:articles:by_date", epoch, aid])
        commands.append(["ZADD", "nid:articles:by_relevance", str(a.get("relevance_score", 0)), aid])
        commands.append(["ZADD", "nid:articles:by_sentiment", str(a.get("sentiment_score", 0.0) * 100), aid])
        commands.append(["ZADD", "nid:articles:by_financial_relevance", str(financial_relevance), aid])
        commands.append(["SADD", f"nid:articles:topic:{a.get('topic', '')}", aid])
        commands.append(["SADD", f"nid:articles:source_type:{a.get('source_type', 'rss')}", aid])
        commands.append(["SADD", f"nid:articles:source:{a.get('source', 'unknown')}", aid])
        commands.append(["SADD", f"nid:articles:sweep:{sweep_id}", aid])
        commands.append(["SADD", f"nid:articles:corr:{a.get('corroboration_score', 'low')}", aid])

        if financial_relevance > 60:
            commands.append(["ZADD", "nid:articles:high_relevance", str(financial_relevance), aid])

        for ref in a.get("market_data_refs", []):
            entity_name = ref.get("entity", "")
            ticker = ref.get("ticker", "")
            if entity_name:
                commands.append(["ZADD", f"nid:entity:{entity_name}:articles",
                               str(a.get("relevance_score", 0)), aid])
            if ticker:
                commands.append(["ZADD", f"nid:marketdata:{ticker}:articles",
                               str(a.get("relevance_score", 0)), aid])

    for i in range(0, len(commands), 100):
        redis_pipe(commands[i:i + 100])

    return len(articles)


def write_entities_to_redis(articles):
    entity_data = {}
    for a in articles:
        ents = a.get("entities", [])
        if isinstance(ents, str):
            try:
                ents = json.loads(ents)
            except Exception:
                ents = []
        for e in ents:
            name = e if isinstance(e, str) else e.get("name", "")
            if not name:
                continue
            if name not in entity_data:
                entity_data[name] = {"mentions": 0, "sentiments": [], "topics": set(), "dates": [], "fr_scores": []}
            entity_data[name]["mentions"] += 1
            entity_data[name]["sentiments"].append(a.get("sentiment_score", 0.0))
            entity_data[name]["topics"].add(a.get("topic", ""))
            entity_data[name]["dates"].append(a.get("date", now_iso()))
            entity_data[name]["fr_scores"].append(int(a.get("financial_relevance", 0)))

    commands = []
    for name, data in entity_data.items():
        avg_sent = round(sum(data["sentiments"]) / max(len(data["sentiments"]), 1), 3)
        avg_fr = round(sum(data["fr_scores"]) / max(len(data["fr_scores"]), 1), 1)
        etype = "company"
        tech_names = ["AI", "AGI", "GPT", "LLM", "LLaMA", "Gemini", "blockchain", "quantum"]
        if name in tech_names:
            etype = "technology"
        dates_sorted = sorted(data["dates"])
        commands.append(["HSET", f"nid:entity:{name}",
            "name", name,
            "type", etype,
            "mention_count", str(data["mentions"]),
            "avg_sentiment", str(avg_sent),
            "topics", json.dumps(sorted(list(data["topics"]))),
            "first_seen", dates_sorted[0] if dates_sorted else now_iso(),
            "last_seen", dates_sorted[-1] if dates_sorted else now_iso(),
            "trend_direction", "stable",
        ])
        commands.append(["ZADD", "nid:entities:by_mentions", str(data["mentions"]), name])
        commands.append(["ZADD", "nid:entities:by_financial_relevance", str(avg_fr), name])

    for i in range(0, len(commands), 100):
        redis_pipe(commands[i:i + 100])

    return len(entity_data)


def write_entity_profiles(articles, market_data):
    from math import sqrt

    profile_data = {}
    for a in articles:
        refs = a.get("market_data_refs", [])
        if isinstance(refs, str):
            try:
                refs = json.loads(refs)
            except Exception:
                refs = []
        for ref in refs:
            name = ref.get("entity", "")
            if not name:
                continue
            if name not in profile_data:
                profile_data[name] = {
                    "mentions": 0, "sentiments": [], "topics": set(),
                    "headlines": [], "fr_scores": []
                }
            profile_data[name]["mentions"] += 1
            profile_data[name]["sentiments"].append(a.get("sentiment_score", 0.0))
            profile_data[name]["topics"].add(a.get("topic", ""))
            profile_data[name]["fr_scores"].append(int(a.get("financial_relevance", 0)))
            profile_data[name]["headlines"].append({
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "relevance_score": a.get("relevance_score", 0),
            })

    commands = []
    for name, data in profile_data.items():
        resolved = None
        for a in articles:
            for re_obj in a.get("resolved_entities", []):
                if isinstance(re_obj, dict) and re_obj.get("name") == name:
                    resolved = re_obj
                    break
            if resolved:
                break

        ticker = resolved.get("ticker", "") if resolved else ""
        sector = resolved.get("sector", "") if resolved else ""
        tier = resolved.get("tier", "none") if resolved else "none"

        avg_sent = round(sum(data["sentiments"]) / max(len(data["sentiments"]), 1), 3)

        top_headlines = sorted(data["headlines"], key=lambda x: x.get("relevance_score", 0), reverse=True)[:5]

        md = market_data.get(ticker, {}) if ticker else {}
        latest_price = md.get("price", md.get("latest_price", ""))
        price_change_pct = md.get("change_percent", md.get("price_change_pct", ""))
        price_change_direction = md.get("price_change_direction", "flat")
        if not price_change_direction:
            try:
                pct = float(price_change_pct) if price_change_pct else 0
                price_change_direction = "up" if pct > 0 else ("down" if pct < 0 else "flat")
            except Exception:
                price_change_direction = "flat"

        sentiment_trend = [round(s, 3) for s in data["sentiments"][-7:]]

        price_trend = []
        ohlcv = md.get("ohlcv_7d", "")
        if ohlcv:
            for entry in ohlcv.split(";"):
                parts = entry.split(",")
                if len(parts) >= 5:
                    try:
                        price_trend.append(float(parts[4]))
                    except Exception:
                        pass

        correlation_raw = 0.0
        if len(sentiment_trend) >= 3 and len(price_trend) >= 3:
            min_len = min(len(sentiment_trend), len(price_trend))
            s = sentiment_trend[:min_len]
            p = price_trend[:min_len]
            n = min_len
            sum_s = sum(s)
            sum_p = sum(p)
            sum_sp = sum(si * pi for si, pi in zip(s, p))
            sum_s2 = sum(si * si for si in s)
            sum_p2 = sum(pi * pi for pi in p)
            numerator = n * sum_sp - sum_s * sum_p
            denominator = sqrt((n * sum_s2 - sum_s ** 2) * (n * sum_p2 - sum_p ** 2))
            if denominator != 0:
                correlation_raw = round(numerator / denominator, 4)

        abs_corr = abs(correlation_raw)
        if abs_corr > 0.6:
            correlation = "aligned"
        elif abs_corr < 0.3:
            correlation = "divergent"
        else:
            correlation = "neutral"

        if abs_corr > 0.6 and data["mentions"] >= 5:
            signal_strength = "strong"
        elif abs_corr > 0.3:
            signal_strength = "moderate"
        else:
            signal_strength = "weak"

        commands.append(["HSET", f"nid:entity:profile:{name}",
            "name", name,
            "ticker", ticker,
            "latest_price", str(latest_price),
            "price_change_pct", str(price_change_pct),
            "price_change_direction", price_change_direction,
            "mention_count", str(data["mentions"]),
            "avg_sentiment", str(avg_sent),
            "top_headlines", json.dumps(top_headlines),
            "sentiment_trend", json.dumps(sentiment_trend),
            "price_trend", json.dumps(price_trend),
            "correlation", correlation,
            "correlation_raw", str(correlation_raw),
            "signal_strength", signal_strength,
            "sector", sector,
            "tier", tier,
            "topics", json.dumps(sorted(list(data["topics"]))),
            "updated_at", now_iso(),
        ])

    for i in range(0, len(commands), 100):
        redis_pipe(commands[i:i + 100])

    return len(profile_data)


def write_market_data_to_redis(market_data, sweep_id):
    commands = []
    now = now_iso()

    for ticker, md in market_data.get("stocks", {}).items():
        tier = md.get("tier", "standard")
        entity_name = md.get("entity_name", ticker)

        fields = [
            "entity_name", entity_name,
            "ticker", ticker,
            "latest_price", str(md.get("price", md.get("latest_price", ""))),
            "price_change_pct", str(md.get("change_percent", md.get("price_change_pct", ""))),
            "price_change_direction", md.get("price_change_direction", "flat"),
            "updated_at", now,
            "tier", tier,
        ]

        if tier == "full":
            fields.extend([
                "volume", str(md.get("volume", "")),
                "market_cap", str(md.get("market_cap", "")),
                "pe_ratio", str(md.get("pe_ratio", "")),
                "high_52w", str(md.get("high_52w", "")),
                "low_52w", str(md.get("low_52w", "")),
                "ohlcv_7d", md.get("ohlcv_7d", ""),
                "fundamentals", json.dumps(md.get("fundamentals", {})),
            ])

        commands.append(["HSET", f"nid:marketdata:{entity_name}"] + fields)

        if tier == "full" and md.get("ohlcv_7d"):
            commands.append(["SET", f"nid:marketdata:{entity_name}:ohlcv_7d", md["ohlcv_7d"]])

        commands.append(["ZADD", "nid:marketdata:by_entity", "0", entity_name])
        commands.append(["SADD", f"nid:marketdata:sweep:{sweep_id}", entity_name])

    macro = market_data.get("macro", {})
    commands.append(["HSET", "nid:marketdata:macro",
        "dgs10", str(macro.get("dgs10", "")),
        "dgs2", str(macro.get("dgs2", "")),
        "dgs5", str(macro.get("dgs5", "")),
        "dgs30", str(macro.get("dgs30", "")),
        "vix", str(macro.get("vix", "")),
        "fedfunds", str(macro.get("fedfunds", "")),
        "unemployment", str(macro.get("unemployment", "")),
        "cpi", str(macro.get("cpi", "")),
        "updated_at", now,
    ])

    for etf, sd in market_data.get("sectors", {}).items():
        commands.append(["HSET", f"nid:marketdata:sector:{etf}",
            "etf", etf,
            "sector", sd.get("sector", ""),
            "price", str(sd.get("price", "")),
            "change_percent", str(sd.get("change_percent", "")),
            "volume", str(sd.get("volume", "")),
            "fetched_at", now,
        ])

    for i in range(0, len(commands), 100):
        redis_pipe(commands[i:i + 100])

    return len(market_data.get("stocks", {}))


def write_heatmap_topic_entity(articles):
    heatmap = {}
    for a in articles:
        topic = a.get("topic", "")
        if not topic:
            continue
        ents = a.get("entities", [])
        if isinstance(ents, str):
            try:
                ents = json.loads(ents)
            except Exception:
                ents = []
        for e in ents:
            name = e if isinstance(e, str) else e.get("name", "")
            if not name:
                continue
            key = f"{topic}:{name}"
            if key not in heatmap:
                heatmap[key] = {"count": 0, "sentiments": []}
            heatmap[key]["count"] += 1
            heatmap[key]["sentiments"].append(a.get("sentiment_score", 0.0))

    if not heatmap:
        return 0

    args = ["nid:heatmap:topic_entity"]
    for key, data in heatmap.items():
        avg_sent = round(sum(data["sentiments"]) / max(len(data["sentiments"]), 1), 3)
        args.extend([key, json.dumps({"count": data["count"], "avg_sentiment": avg_sent})])

    redis_pipe([["HSET"] + args])
    return len(heatmap)


def write_topic_stats_to_redis(articles):
    topic_data = {}
    for a in articles:
        topic = a.get("topic", "")
        if not topic:
            continue
        if topic not in topic_data:
            topic_data[topic] = {"count": 0, "sentiments": [], "relevances": [], "high_corr": 0, "entities": set()}
        topic_data[topic]["count"] += 1
        topic_data[topic]["sentiments"].append(a.get("sentiment_score", 0.0))
        topic_data[topic]["relevances"].append(a.get("relevance_score", 0))
        if a.get("corroboration_score") == "high":
            topic_data[topic]["high_corr"] += 1
        for e in a.get("entities", []):
            name = e if isinstance(e, str) else e.get("name", "")
            if name:
                topic_data[topic]["entities"].add(name)

    commands = []
    for topic, data in topic_data.items():
        avg_sent = round(sum(data["sentiments"]) / max(len(data["sentiments"]), 1), 3)
        avg_rel = round(sum(data["relevances"]) / max(len(data["relevances"]), 1), 1)
        top_ents = sorted(data["entities"])[:5]
        commands.append(["HSET", f"nid:topic:stats:{topic}",
            "topic", topic,
            "article_count", str(data["count"]),
            "avg_sentiment", str(avg_sent),
            "avg_relevance", str(avg_rel),
            "high_corroboration_count", str(data["high_corr"]),
            "top_entities", json.dumps(top_ents),
            "last_updated", now_iso(),
        ])

    if commands:
        for i in range(0, len(commands), 100):
            redis_pipe(commands[i:i + 100])

    redis_pipe([["SET", "nid:topic:stats:updated", now_iso()]])
    return len(topic_data)


def write_trends_to_redis(articles):
    today_epoch = str(int(time.time()))
    today_day = str(int(time.time()) // 86400)
    commands = []

    topic_counts = {}
    source_type_counts = {}
    sentiment_sum = 0
    entity_counts = {}

    for a in articles:
        topic = a.get("topic", "")
        st = a.get("source_type", "")
        topic_counts[topic] = topic_counts.get(topic, 0) + 1
        source_type_counts[st] = source_type_counts.get(st, 0) + 1
        sentiment_sum += a.get("sentiment_score", 0.0)
        for e in a.get("entities", []):
            name = e if isinstance(e, str) else e.get("name", "")
            if name:
                entity_counts[name] = entity_counts.get(name, 0) + 1

    for topic, count in topic_counts.items():
        commands.append(["ZADD", f"nid:trend:topic:{topic}:daily", today_day, json.dumps({"date": now_iso()[:10], "count": count})])

    avg_sent = round(sentiment_sum / max(len(articles), 1), 3)
    commands.append(["ZADD", "nid:trend:sentiment:daily", today_day, json.dumps({"date": now_iso()[:10], "avg_sentiment": avg_sent})])
    commands.append(["ZADD", "nid:trend:sources:daily", today_day, json.dumps({"date": now_iso()[:10], "sources": source_type_counts})])

    top_entities = sorted(entity_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    commands.append(["ZADD", "nid:trend:entities:daily", today_day, json.dumps({"date": now_iso()[:10], "entities": dict(top_entities)})])

    if commands:
        redis_pipe(commands)
    return len(commands)


def write_source_quality_to_redis(articles):
    source_data = {}
    for a in articles:
        src = a.get("source", "unknown")
        if src not in source_data:
            source_data[src] = {"count": 0, "relevances": [], "sentiments": [], "source_type": a.get("source_type", "rss")}
        source_data[src]["count"] += 1
        source_data[src]["relevances"].append(a.get("relevance_score", 0))
        source_data[src]["sentiments"].append(a.get("sentiment_score", 0.0))

    commands = []
    for src, data in source_data.items():
        avg_rel = round(sum(data["relevances"]) / max(len(data["relevances"]), 1), 1)
        avg_sent = round(sum(data["sentiments"]) / max(len(data["sentiments"]), 1), 3)
        commands.append(["HSET", f"nid:source:quality:{src}",
            "source", src,
            "source_type", data["source_type"],
            "total_articles", str(data["count"]),
            "avg_relevance", str(avg_rel),
            "avg_sentiment", str(avg_sent),
        ])
        commands.append(["ZADD", "nid:sources:by_quality", str(avg_rel), src])

    if commands:
        for i in range(0, len(commands), 100):
            redis_pipe(commands[i:i + 100])
    return len(source_data)


def update_sweep_completed(sweep_id, article_count, instrument_count=0, entities_resolved=0, tier_full=0, tier_standard=0):
    now = now_iso()
    commands = [[
        "HSET", f"nid:sweep:{sweep_id}",
        "completed_at", now,
        "status", "completed",
        "article_count", str(article_count),
        "pipeline_stage", "completed",
        "instrument_count", str(instrument_count),
        "entities_resolved", str(entities_resolved),
        "market_data_tier_full", str(tier_full),
        "market_data_tier_standard", str(tier_standard),
    ]]
    redis_pipe(commands)


def cleanup_temp_keys(sweep_id):
    keys_to_del = [
        f"nid:temp:sweep:{sweep_id}:articles",
        f"nid:temp:sweep:{sweep_id}:market_data",
    ]
    commands = [["DEL", k] for k in keys_to_del]
    redis_pipe(commands)


def verify_writes(sweep_id):
    checks = {
        "articles_by_date": redis_zcard("nid:articles:by_date"),
        "articles_by_relevance": redis_zcard("nid:articles:by_relevance"),
        "articles_by_financial_relevance": redis_zcard("nid:articles:by_financial_relevance"),
        "articles_high_relevance": redis_zcard("nid:articles:high_relevance"),
        "entities_by_mentions": redis_zcard("nid:entities:by_mentions"),
        "entities_by_financial_relevance": redis_zcard("nid:entities:by_financial_relevance"),
    }
    logger.info(f"Verification for sweep {sweep_id}: {json.dumps(checks)}")
    return checks


def read_temp_and_write(sweep_id, articles, market_data):
    """Main entry point. Write enriched articles + market data + cross-references."""
    logger.info(f"Writing {len(articles)} articles and market data for sweep {sweep_id}")

    article_count = write_articles_to_redis(articles, sweep_id)
    entity_count = write_entities_to_redis(articles)
    write_entity_profiles(articles, market_data)
    write_heatmap_topic_entity(articles)
    write_topic_stats_to_redis(articles)
    write_trends_to_redis(articles)
    write_source_quality_to_redis(articles)

    md_count = 0
    if market_data:
        md_count = write_market_data_to_redis(market_data, sweep_id)

    instrument_count = len(market_data.get("stocks", {})) if market_data else 0
    entities_resolved = sum(1 for a in articles if a.get("resolved_entities"))
    tier_full = sum(1 for v in (market_data.get("stocks", {}).values() if market_data else []) if v.get("tier") == "full")
    tier_standard = sum(1 for v in (market_data.get("stocks", {}).values() if market_data else []) if v.get("tier") == "standard")

    update_sweep_completed(sweep_id, article_count, instrument_count, entities_resolved, tier_full, tier_standard)
    cleanup_temp_keys(sweep_id)
    verify_writes(sweep_id)

    return {
        "articles_written": article_count,
        "entities_written": entity_count,
        "market_data_written": md_count,
    }


if __name__ == "__main__":
    sweep_id = os.environ.get("SWEEP_ID", "test")
    articles_json = os.environ.get("ARTICLES", "[]")
    market_data_json = os.environ.get("MARKET_DATA", "{}")
    articles = json.loads(articles_json)
    market_data = json.loads(market_data_json)
    result = read_temp_and_write(sweep_id, articles, market_data)
    print(json.dumps(result, indent=2))
