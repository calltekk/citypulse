
import httpx

from fastapi import FastAPI, HTTPException, Query
from psycopg import OperationalError

from app.database import (
    check_database,
    get_tube_history,
    get_latest_tube_status,
    get_tube_reliability,
    get_tube_stations,
)
from app.services.tfl import get_line_status


app = FastAPI(
    title="CityPulse API",
    description="Real-time urban intelligence platform",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "application": "CityPulse",
        "message": "London is coming online",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "citypulse-api",
    }


@app.get("/api/v1/database/status")
async def database_status():
    try:
        result = await check_database()

        return {
            "status": "connected",
            **result,
        }

    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc


@app.get("/api/v1/transport/tube/status")
async def tube_status():
    try:
        data = await get_line_status()

        return {
            "source": "Transport for London",
            "lines": data,
        }

    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve TfL data",
        ) from exc


@app.get("/api/v1/transport/tube/history")
async def tube_history(
    limit: int = Query(default=100, ge=1, le=500),
):
    try:
        records = await get_tube_history(limit)

        return {
            "count": len(records),
            "data": records,
        }

    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc


@app.get("/api/v1/transport/tube/latest")
async def latest_tube_status():
    try:
        records = await get_latest_tube_status()

        return {
            "count": len(records),
            "data": records,
        }

    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc


@app.get("/api/v1/analytics/tube/reliability")
async def tube_reliability(
    hours: int = Query(default=24, ge=1, le=168),
):
    try:
        records = await get_tube_reliability(hours)

        return {
            "window_hours": hours,
            "count": len(records),
            "data": records,
        }

    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc


# --------------------------------------------
# GEOSPATIAL INTELLIGENCE
# --------------------------------------------

@app.get("/api/v1/transport/tube/stations")
async def tube_stations():
    """
    Return Underground station locations
    as a GeoJSON FeatureCollection.
    """
    try:
        return await get_tube_stations()

    except OperationalError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc
