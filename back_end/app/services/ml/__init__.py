"""Aura 1.0 — predictive ML intelligence for CodeAtlas.

Public surface:
    analyze_repo(analysis, file_rows, file_count, folder_count, **kwargs)
    get_ml_service()
    AURA_NAME / AURA_VERSION / AURA_MODEL_ID
"""
from app.services.ml.model import (
    AURA_MODEL_ID,
    AURA_NAME,
    AURA_VERSION,
    analyze_repo,
    get_ml_service,
)

__all__ = [
    "AURA_MODEL_ID",
    "AURA_NAME",
    "AURA_VERSION",
    "analyze_repo",
    "get_ml_service",
]
