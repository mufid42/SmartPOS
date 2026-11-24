"""Pengelompokan log audit ke kategori aktivitas yang tampil di UI.

Kategori diturunkan dari ``entity_type`` dan ``action`` yang sudah dicatat oleh
``record_audit``; tidak ada kolom baru di database.
"""

from typing import Any, Literal

from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import ColumnElement

from app.audit.models import AuditLog

ActivityCategory = Literal[
    "TRANSACTION",
    "PRODUCT",
    "INVENTORY",
    "EXPENSE",
    "SHIFT",
    "USER",
    "SETTINGS",
]

ACTIVITY_CATEGORIES: tuple[str, ...] = (
    "TRANSACTION",
    "PRODUCT",
    "INVENTORY",
    "EXPENSE",
    "SHIFT",
    "USER",
    "SETTINGS",
)


def category_for(entity_type: str, action: str) -> str:
    if entity_type == "SALE":
        return "TRANSACTION"
    if entity_type == "PRODUCT":
        return "INVENTORY" if action == "STOCK_ADJUST" else "PRODUCT"
    if entity_type == "EXPENSE":
        return "EXPENSE"
    if entity_type == "SHIFT":
        return "SHIFT"
    if entity_type == "MEMBER":
        return "USER"
    if entity_type == "BUSINESS":
        return "SETTINGS"
    return "SETTINGS"


def category_filter(category: str) -> ColumnElement[bool]:
    """Kondisi SQL yang setara dengan ``category_for``."""
    if category == "TRANSACTION":
        return AuditLog.entity_type == "SALE"
    if category == "PRODUCT":
        return and_(
            AuditLog.entity_type == "PRODUCT", AuditLog.action != "STOCK_ADJUST"
        )
    if category == "INVENTORY":
        return and_(
            AuditLog.entity_type == "PRODUCT", AuditLog.action == "STOCK_ADJUST"
        )
    if category == "EXPENSE":
        return AuditLog.entity_type == "EXPENSE"
    if category == "SHIFT":
        return AuditLog.entity_type == "SHIFT"
    if category == "USER":
        return AuditLog.entity_type == "MEMBER"
    if category == "SETTINGS":
        known = ("SALE", "PRODUCT", "EXPENSE", "SHIFT", "MEMBER")
        return or_(
            AuditLog.entity_type == "BUSINESS",
            AuditLog.entity_type.notin_(known),
        )
    raise ValueError(f"Kategori tidak dikenal: {category}")


_NAME_KEYS = {
    "PRODUCT": "name",
    "SALE": "transaction_number",
    "MEMBER": "full_name",
    "BUSINESS": "name",
    "EXPENSE": "category",
}


def entity_name_for(
    entity_type: str,
    before_data: dict[str, Any] | None,
    after_data: dict[str, Any] | None,
) -> str | None:
    key = _NAME_KEYS.get(entity_type)
    if key is None:
        return None
    for data in (after_data, before_data):
        if data and data.get(key):
            return str(data[key])
    return None
