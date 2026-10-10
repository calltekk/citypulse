
from fastapi import FastAPI
from fastapi import HTTPException
from psycopg import OperationalError

from app.database import check_database
import httpx

from app.services.tfl import get_line_status
from fastapi import Query
from app.database import get_tube_history
from app.database import get_latest_tube_status
from app.database import get_tube_reliability

app = FastAPI(
    title="CityPulse API",
    description="Real-time urban intelligence platform",
    version="0.1.0"
)


@app.get("/")
async def root():
    return {
        "application": "CityPulse",
        "message": "London is coming online"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "citypulse-api"
    }


@app.get("/api/v1/database/status")
async def database_status():
    try:
        result = await check_database()

        return {
            "status": "connected",
            **result
        }

    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )


@app.get("/api/v1/transport/tube/status")
async def tube_status():
    try:
        data = await get_line_status()

        return {
            "source": "Transport for London",
            "lines": data
        }

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve TfL data"
        )


@app.get("/api/v1/transport/tube/history")
async def tube_history(
    limit: int = Query(default=100, ge=1, le=500)
):
    try:
        records = await get_tube_history(limit)

        return {
            "count": len(records),
            "data": records
        }

    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )


@app.get("/api/v1/transport/tube/latest")
async def latest_tube_status():
    try:
        records = await get_latest_tube_status()

        return {
            "count": len(records),
            "data": records
        }

    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )


@app.get("/api/v1/analytics/tube/reliability")
async def tube_reliability(
    hours: int = Query(default=24, ge=1, le=168)
):
    try:
        records = await get_tube_reliability(hours)

        return {
            "window_hours": hours,
            "count": len(records),
            "data": records
        }

    except OperationalError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable"
        )
