"""
EasyBillsPay — Supabase Database Adapter
=========================================
Drop-in replacement for MongoDB Motor operations.
All methods are async-compatible and return dicts without _id.
"""

import os
import logging
from supabase import create_client, Client
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

_client: Client = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized")
    return _client


# ============================================================
# Generic CRUD helpers
# ============================================================

async def find_one(table: str, filters: dict, exclude_fields: list = None) -> dict | None:
    """Find a single record matching all filters."""
    sb = get_supabase()
    query = sb.table(table).select("*")
    for k, v in filters.items():
        query = query.eq(k, v)
    result = query.limit(1).execute()
    if result.data:
        row = result.data[0]
        if exclude_fields:
            for f in exclude_fields:
                row.pop(f, None)
        return row
    return None


async def find_many(table: str, filters: dict = None, exclude_fields: list = None,
                    order_by: str = None, order_desc: bool = False, limit: int = 10000) -> list:
    """Find multiple records matching filters."""
    sb = get_supabase()
    query = sb.table(table).select("*")
    if filters:
        for k, v in filters.items():
            if isinstance(v, dict):
                # Handle special operators like $in
                if "$in" in v:
                    query = query.in_(k, v["$in"])
                elif "$ne" in v:
                    query = query.neq(k, v["$ne"])
            else:
                query = query.eq(k, v)
    if order_by:
        query = query.order(order_by, desc=order_desc)
    query = query.limit(limit)
    result = query.execute()
    rows = result.data or []
    if exclude_fields:
        for row in rows:
            for f in exclude_fields:
                row.pop(f, None)
    return rows


async def insert_one(table: str, data: dict) -> dict:
    """Insert a single record. Returns the inserted row."""
    sb = get_supabase()
    # Remove None values to let DB defaults work
    clean = {k: v for k, v in data.items() if v is not None}
    # Convert datetime objects to ISO strings
    for k, v in clean.items():
        if isinstance(v, datetime):
            clean[k] = v.isoformat()
    result = sb.table(table).insert(clean).execute()
    if result.data:
        return result.data[0]
    return clean


async def update_one(table: str, filters: dict, updates: dict) -> bool:
    """Update a single record matching filters."""
    sb = get_supabase()
    # Handle $set and $inc operators from MongoDB syntax
    set_data = {}
    inc_data = {}

    if "$set" in updates:
        set_data = updates["$set"]
    elif "$inc" in updates:
        inc_data = updates["$inc"]
    else:
        set_data = updates

    if inc_data:
        # For increment operations, fetch current value first then update
        current = await find_one(table, filters)
        if not current:
            return False
        for field, amount in inc_data.items():
            set_data[field] = (current.get(field, 0) or 0) + amount

    if not set_data:
        return False

    query = sb.table(table).update(set_data)
    for k, v in filters.items():
        query = query.eq(k, v)
    result = query.execute()
    return bool(result.data)


async def update_many(table: str, filters: dict, updates: dict) -> int:
    """Update multiple records matching filters. Returns count."""
    sb = get_supabase()
    set_data = updates.get("$set", updates)

    query = sb.table(table).update(set_data)
    for k, v in filters.items():
        query = query.eq(k, v)
    result = query.execute()
    return len(result.data) if result.data else 0


async def delete_one(table: str, filters: dict) -> bool:
    """Delete a single record matching filters."""
    sb = get_supabase()
    query = sb.table(table).delete()
    for k, v in filters.items():
        query = query.eq(k, v)
    result = query.execute()
    return bool(result.data)


async def delete_many(table: str, filters: dict) -> int:
    """Delete multiple records matching filters. Returns count."""
    sb = get_supabase()
    query = sb.table(table).delete()
    for k, v in filters.items():
        query = query.eq(k, v)
    result = query.execute()
    return len(result.data) if result.data else 0


async def count_documents(table: str, filters: dict = None) -> int:
    """Count records matching filters."""
    sb = get_supabase()
    query = sb.table(table).select("id", count="exact")
    if filters:
        for k, v in filters.items():
            query = query.eq(k, v)
    result = query.execute()
    return result.count if result.count is not None else len(result.data or [])


async def find_with_fields(table: str, filters: dict = None, fields: list = None, limit: int = 10000) -> list:
    """Find records returning only specified fields."""
    sb = get_supabase()
    select_str = ",".join(fields) if fields else "*"
    query = sb.table(table).select(select_str)
    if filters:
        for k, v in filters.items():
            query = query.eq(k, v)
    result = query.limit(limit).execute()
    return result.data or []
