import asyncio
import logging
import os
import signal
from datetime import datetime, timezone

import httpx
import psycopg

from app.services.tfl import get_line_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

logger = logging.getLogger("citypulse.ingestion")

DATABASE_URL = os.environ["DATABASE_URL"]
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "60"))


async def ingest_tube_status():
    lines = await get_line_status()
    records = []

    for line in lines:
        for status in line.get("lineStatuses", []):
            records.append((
                line["id"],
                line["name"],
                status["statusSeverityDescription"],
                status.get("reason")
            ))

    if not records:
        raise ValueError("TfL returned no Tube status records")

    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.executemany(
                """
                INSERT INTO tube_status_snapshots
                    (line_id, line_name, status, reason)
                VALUES (%s, %s, %s, %s)
                """,
                records
            )

    logger.info(
        "Ingested %s Tube status records at %s",
        len(records),
        datetime.now(timezone.utc).isoformat()
    )


async def main():
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    logger.info(
        "CityPulse ingestion worker started (interval=%ss)",
        POLL_INTERVAL
    )

    while not stop_event.is_set():
        try:
            await ingest_tube_status()

        except (httpx.HTTPError, psycopg.Error, ValueError):
            logger.exception("Ingestion cycle failed")

        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=POLL_INTERVAL
            )
        except asyncio.TimeoutError:
            pass

    logger.info("CityPulse ingestion worker stopped")


if __name__ == "__main__":
    asyncio.run(main())
