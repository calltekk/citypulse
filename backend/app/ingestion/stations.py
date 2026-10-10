
import asyncio
import logging
import os

import httpx
import psycopg

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)

TFL_URL = "https://api.tfl.gov.uk/StopPoint/Mode/tube"

DATABASE_URL = os.environ["DATABASE_URL"]


async def fetch_stations() -> list[dict]:
    """Retrieve Underground station data from TfL."""

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(TFL_URL)
        response.raise_for_status()

        payload = response.json()

    if not isinstance(payload, dict):
        raise ValueError("Unexpected TfL response format")

    stations = payload.get("stopPoints")

    if not isinstance(stations, list):
        raise ValueError("TfL response has no stopPoints list")

    if not stations:
        raise ValueError("TfL returned no stations")

    logger.info(
        "Retrieved %s station records from TfL",
        len(stations),
    )

    return stations


def prepare_stations(stations: list[dict]) -> list[tuple]:
    """Validate and normalise station records."""

    prepared = []

    for station in stations:
        station_id = station.get("naptanId") or station.get("id")
        name = station.get("commonName")
        latitude = station.get("lat")
        longitude = station.get("lon")

        if not station_id or not name:
            continue

        if not isinstance(latitude, (int, float)):
            continue

        if not isinstance(longitude, (int, float)):
            continue

        if not (-90 <= latitude <= 90):
            continue

        if not (-180 <= longitude <= 180):
            continue

        if latitude == 0 and longitude == 0:
            continue

        prepared.append(
            (
                station_id,
                name,
                longitude,
                latitude,
            )
        )

    return prepared


async def save_stations(stations: list[tuple]) -> int:
    """Upsert stations into PostGIS."""

    if not stations:
        raise ValueError("No valid station records to save")

    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL
    ) as connection:

        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                CREATE EXTENSION IF NOT EXISTS postgis
                """
            )

            await cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS tube_stations (
                    station_id TEXT PRIMARY KEY,
                    station_name TEXT NOT NULL,
                    location GEOMETRY(Point, 4326) NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                        DEFAULT NOW()
                )
                """
            )

            await cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS
                    idx_tube_stations_location
                ON tube_stations
                USING GIST (location)
                """
            )

            for station_id, name, longitude, latitude in stations:
                await cursor.execute(
                    """
                    INSERT INTO tube_stations (
                        station_id,
                        station_name,
                        location,
                        updated_at
                    )
                    VALUES (
                        %s,
                        %s,
                        ST_SetSRID(
                            ST_MakePoint(%s, %s),
                            4326
                        ),
                        NOW()
                    )
                    ON CONFLICT (station_id)
                    DO UPDATE SET
                        station_name = EXCLUDED.station_name,
                        location = EXCLUDED.location,
                        updated_at = NOW()
                    """,
                    (
                        station_id,
                        name,
                        longitude,
                        latitude,
                    ),
                )

        await connection.commit()

    return len(stations)


async def main():
    logger.info("Starting Underground station ingestion")

    stations = await fetch_stations()
    prepared = prepare_stations(stations)

    logger.info(
        "Validated %s station records",
        len(prepared),
    )

    saved = await save_stations(prepared)

    logger.info(
        "Successfully upserted %s station records",
        saved,
    )


if __name__ == "__main__":
    asyncio.run(main())
