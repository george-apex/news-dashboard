"""
ALICE Stage 1.5 — Entity Resolution & Financial Relevance Scoring
Runs between Stage 1 (sweep) and Stage 2 (market data fetch)
No delegation consumed — runs natively inside ALICE orchestration.

Steps:
1. Receive articles[] from sweep-agent (Stage 1 output)
2. Entity resolution: look up each entity in ENTITY_REGISTRY
3. Tier assignment: count articles per entity, check for Tier 1 sources
4. Financial relevance scoring: compute 0-100 per article
5. Market data refs: build [{ticker, entity, tier}] array per article
6. Instrument list construction: baseline + news-discovered candidates
7. Sweep metadata update
8. Pass instrument_list to Stage 2, enriched articles to Stage 3
"""

import json
import logging
from typing import Optional

logger = logging.getLogger("alice-stage1.5")

ENTITY_REGISTRY = {
    "NVIDIA": {"ticker": "NVDA", "sector": "Semiconductors", "tier": "baseline"},
    "Microsoft": {"ticker": "MSFT", "sector": "Technology", "tier": "baseline"},
    "Alphabet": {"ticker": "GOOGL", "sector": "Technology", "tier": "baseline"},
    "Google": {"ticker": "GOOGL", "sector": "Technology", "tier": "baseline"},
    "Apple": {"ticker": "AAPL", "sector": "Technology", "tier": "baseline"},
    "Amazon": {"ticker": "AMZN", "sector": "Consumer", "tier": "baseline"},
    "Meta": {"ticker": "META", "sector": "Technology", "tier": "baseline"},
    "Tesla": {"ticker": "TSLA", "sector": "Automotive", "tier": "baseline"},
    "AMD": {"ticker": "AMD", "sector": "Semiconductors", "tier": "baseline"},
    "Intel": {"ticker": "INTC", "sector": "Semiconductors", "tier": "baseline"},
    "IBM": {"ticker": "IBM", "sector": "Technology", "tier": "baseline"},
    "TSMC": {"ticker": "TSM", "sector": "Semiconductors", "tier": "expanded"},
    "ASML": {"ticker": "ASML", "sector": "Semiconductors", "tier": "expanded"},
    "ARM Holdings": {"ticker": "ARM", "sector": "Semiconductors", "tier": "expanded"},
    "Micron": {"ticker": "MU", "sector": "Semiconductors", "tier": "expanded"},
    "Qualcomm": {"ticker": "QCOM", "sector": "Semiconductors", "tier": "expanded"},
    "Arista Networks": {"ticker": "ANET", "sector": "Technology", "tier": "expanded"},
    "Dell": {"ticker": "DELL", "sector": "Technology", "tier": "expanded"},
    "Super Micro": {"ticker": "SMCI", "sector": "Technology", "tier": "expanded"},
    "Cloudflare": {"ticker": "NET", "sector": "Technology", "tier": "expanded"},
    "Datadog": {"ticker": "DDOG", "sector": "Technology", "tier": "expanded"},
    "PayPal": {"ticker": "PYPL", "sector": "Fintech", "tier": "expanded"},
    "Block": {"ticker": "SQ", "sector": "Fintech", "tier": "expanded"},
    "Square": {"ticker": "SQ", "sector": "Fintech", "tier": "expanded"},
    "Coinbase": {"ticker": "COIN", "sector": "Fintech", "tier": "expanded"},
    "SPDR Gold": {"ticker": "GLD", "sector": "Commodities", "tier": "expanded"},
    "OpenAI": {"ticker": "", "sector": "AI", "tier": "non_tradeable"},
    "Anthropic": {"ticker": "", "sector": "AI", "tier": "non_tradeable"},
    "Mistral": {"ticker": "", "sector": "AI", "tier": "non_tradeable"},
    "DeepMind": {"ticker": "", "sector": "AI", "tier": "non_tradeable"},
    "Huawei": {"ticker": "", "sector": "Technology", "tier": "non_tradeable"},
    "Siemens": {"ticker": "", "sector": "Industrial", "tier": "non_tradeable"},
    "BlackRock": {"ticker": "", "sector": "Financial", "tier": "non_tradeable"},
    "Goldman Sachs": {"ticker": "", "sector": "Financial", "tier": "non_tradeable"},
    "JPMorgan": {"ticker": "", "sector": "Financial", "tier": "non_tradeable"},
    "Bloomberg": {"ticker": "", "sector": "Financial", "tier": "non_tradeable"},
    "Oracle": {"ticker": "", "sector": "Technology", "tier": "non_tradeable"},
}

TIER1_DOMAINS = {
    "reuters.com", "bloomberg.com", "ft.com", "wsj.com", "cnbc.com",
    "marketwatch.com", "techcrunch.com", "theverge.com", "arstechnica.com",
    "venturebeat.com", "apnews.com",
}

BASELINE_TICKERS = {"NVDA", "MSFT", "GOOGL", "AAPL", "AMZN", "META", "TSLA", "AMD", "INTC", "IBM"}


def resolve_entity(name: str) -> Optional[dict]:
    """Look up entity in registry. Try exact match, then case-insensitive alias match."""
    if name in ENTITY_REGISTRY:
        return {"name": name, **ENTITY_REGISTRY[name]}
    lower = name.lower()
    for reg_name, reg_data in ENTITY_REGISTRY.items():
        if reg_name.lower() == lower:
            return {"name": reg_name, **reg_data}
    return None


def assign_tier(entity_name: str, mention_count: int, has_tier1_source: bool) -> str:
    """Assign data tier based on mention count and source quality."""
    resolved = resolve_entity(entity_name)
    if not resolved or not resolved.get("ticker"):
        return "none"
    if mention_count >= 3 or has_tier1_source:
        return "full"
    return "standard"


def compute_financial_relevance(article: dict) -> int:
    """Compute 0-100 financial relevance score per article.
    Rubric from plan Section 4.4:
    +20 per tradeable entity (max +60)
    +15 if price-sensitive event
    +10 if Tier 1 source
    +5 if corroboration is "high"
    -20 if broad concept with no companies
    -10 if product launch with no market implications
    """
    score = 0

    entities = article.get("entities", [])
    if isinstance(entities, str):
        try:
            entities = json.loads(entities)
        except Exception:
            entities = []

    tradeable_count = 0
    for e in entities:
        name = e if isinstance(e, str) else e.get("name", "")
        resolved = resolve_entity(name)
        if resolved and resolved.get("ticker"):
            tradeable_count += 1

    score += min(tradeable_count * 20, 60)

    title = (article.get("title", "") + " " + article.get("summary", "")).lower()

    price_sensitive_keywords = [
        "earnings", "revenue", "profit", "loss", "ipo", "acquisition", "merger",
        "regulatory", "ban", "fine", "lawsuit", "product launch", "antitrust",
        "sec ", "fed ", "interest rate", "downgrade", "upgrade", "price target",
        "guidance", "forecast", "outlook",
    ]
    if any(kw in title for kw in price_sensitive_keywords):
        score += 15

    domain = article.get("domain", article.get("source", "")).lower()
    if any(t1 in domain for t1 in TIER1_DOMAINS):
        score += 10

    if article.get("corroboration_score") == "high":
        score += 5

    broad_concept_keywords = [
        "future of ai", "ai ethics", "ai in society", "what is ai",
        "history of ai", "ai timeline", "ai overview",
    ]
    if any(kw in title for kw in broad_concept_keywords) and tradeable_count == 0:
        score -= 20

    product_no_impact = [
        "app update", "beta release", "feature preview", "early access",
    ]
    if any(kw in title for kw in product_no_impact) and tradeable_count == 0:
        score -= 10

    return max(0, min(100, score))


def is_tier1_source(article: dict) -> bool:
    domain = article.get("domain", article.get("source", "")).lower()
    return any(t1 in domain for t1 in TIER1_DOMAINS)


def run_stage_1_5(articles: list, sweep_id: str) -> dict:
    """Main Stage 1.5 processing.

    Returns:
        {
            "enriched_articles": [...],  # articles with v5 fields
            "instrument_list": [...],   # for Stage 2 market data fetch
            "sweep_metadata": {...},    # instrument_count, entities_resolved, etc.
        }
    """
    logger.info(f"Stage 1.5 starting: {len(articles)} articles, sweep {sweep_id}")

    entity_mention_counts = {}
    entity_has_tier1 = {}
    all_resolved = {}

    for a in articles:
        entities = a.get("entities", [])
        if isinstance(entities, str):
            try:
                entities = json.loads(entities)
            except Exception:
                entities = []
        for e in entities:
            name = e if isinstance(e, str) else e.get("name", "")
            if not name:
                continue
            entity_mention_counts[name] = entity_mention_counts.get(name, 0) + 1
            if is_tier1_source(a):
                entity_has_tier1[name] = True
            resolved = resolve_entity(name)
            if resolved:
                all_resolved[name] = resolved

    enriched_articles = []
    for a in articles:
        entities = a.get("entities", [])
        if isinstance(entities, str):
            try:
                entities = json.loads(entities)
            except Exception:
                entities = []

        resolved_entities = []
        market_data_refs = []
        for e in entities:
            name = e if isinstance(e, str) else e.get("name", "")
            if not name:
                continue
            resolved = resolve_entity(name)
            if resolved:
                tier = assign_tier(name, entity_mention_counts.get(name, 0), entity_has_tier1.get(name, False))
                resolved_entry = {
                    "name": resolved["name"],
                    "ticker": resolved.get("ticker", ""),
                    "sector": resolved.get("sector", ""),
                    "tier": tier,
                }
                resolved_entities.append(resolved_entry)
                if resolved.get("ticker"):
                    market_data_refs.append({
                        "ticker": resolved["ticker"],
                        "entity": resolved["name"],
                        "tier": tier,
                    })
            else:
                resolved_entities.append({
                    "name": name,
                    "ticker": "",
                    "sector": "",
                    "tier": "none",
                })

        financial_relevance = compute_financial_relevance(a)
        has_market_data = any(ref.get("ticker") for ref in market_data_refs) and financial_relevance > 60

        a["resolved_entities"] = resolved_entities
        a["market_data_refs"] = market_data_refs
        a["financial_relevance"] = financial_relevance
        a["has_market_data"] = has_market_data

        enriched_articles.append(a)

    instrument_tickers = {}
    for a in enriched_articles:
        for ref in a.get("market_data_refs", []):
            ticker = ref.get("ticker", "")
            if ticker and ticker not in instrument_tickers:
                instrument_tickers[ticker] = {
                    "ticker": ticker,
                    "entity_name": ref.get("entity", ticker),
                    "tier": ref.get("tier", "standard"),
                    "sector": next(
                        (r.get("sector", "") for r in all_resolved.values() if r.get("ticker") == ticker),
                        ""
                    ),
                }

    for ticker in BASELINE_TICKERS:
        if ticker not in instrument_tickers:
            matching = [(n, r) for n, r in all_resolved.items() if r.get("ticker") == ticker]
            entity_name = matching[0][0] if matching else ticker
            sector = matching[0][1].get("sector", "") if matching else ""
            instrument_tickers[ticker] = {
                "ticker": ticker,
                "entity_name": entity_name,
                "tier": "standard",
                "sector": sector,
            }

    instrument_list = list(instrument_tickers.values())

    tier_full = sum(1 for i in instrument_list if i["tier"] == "full")
    tier_standard = sum(1 for i in instrument_list if i["tier"] == "standard")
    entities_resolved = sum(1 for a in enriched_articles if a.get("resolved_entities"))

    sweep_metadata = {
        "instrument_count": len(instrument_list),
        "entities_resolved": entities_resolved,
        "market_data_tier_full": tier_full,
        "market_data_tier_standard": tier_standard,
    }

    logger.info(f"Stage 1.5 complete: {len(instrument_list)} instruments, "
                f"{entities_resolved} articles with resolved entities, "
                f"tier_full={tier_full}, tier_standard={tier_standard}")

    return {
        "enriched_articles": enriched_articles,
        "instrument_list": instrument_list,
        "sweep_metadata": sweep_metadata,
    }


if __name__ == "__main__":
    import sys
    articles_json = sys.stdin.read() if not sys.stdin.isatty() else "[]"
    articles = json.loads(articles_json)
    result = run_stage_1_5(articles, sweep_id="test")
    print(json.dumps(result, indent=2))
