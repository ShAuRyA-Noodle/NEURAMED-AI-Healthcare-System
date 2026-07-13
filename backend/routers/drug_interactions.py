"""Drug-drug interaction endpoint — real retrieval-augmented, cite or abstain.

The heavy lifting lives in ml.ddi: normalize (RxNorm) -> retrieve FDA label
interaction text (openFDA) -> LLM EXPLAINS only the retrieved evidence with
citations -> pairs with no evidence are reported honestly, never fabricated as
"safe". If GROQ is unavailable, ml.ddi raises InferenceUnavailable and the
global handler returns a 503 — we never substitute a fake result here.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import List

from db.models import User
from utils.auth import require_user
from ml import ddi

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drugs", tags=["Drug Interactions"])


@router.post("/check-interactions")
async def check_interactions(
    drugs: List[str],
    current_user: User = Depends(require_user),
):
    if len(drugs) < 2:
        raise HTTPException(400, "Provide at least 2 drugs")
    if len(drugs) > 10:
        raise HTTPException(400, "Maximum 10 drugs at once")

    # Real RAG pipeline. InferenceUnavailable propagates to the global 503 handler.
    return ddi.check_interactions(drugs)
