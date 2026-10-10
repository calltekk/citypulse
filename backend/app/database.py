
import os

import psycopg


DATABASE_URL = os.environ["DATABASE_URL"]


async def check_database():
    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                "SELECT current_database(), PostGIS_Version()"
            )

            database_name, postgis_version = await cursor.fetchone()

            return {
                "database": database_name,
                "postgis_version": postgis_version
            }


async def get_tube_history(limit: int = 100):
    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    line_id,
                    line_name,
                    status,
                    reason,
                    observed_at
                FROM tube_status_snapshots
                ORDER BY observed_at DESC, id DESC
                LIMIT %s
                """,
                (limit,)
            )

            rows = await cursor.fetchall()

            return [
                {
                    "line_id": row[0],
                    "line_name": row[1],
                    "status": row[2],
                    "reason": row[3],
                    "observed_at": row[4]
                }
                for row in rows
            ]


async def get_latest_tube_status():
    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT DISTINCT ON (line_id)
                    line_id,
                    line_name,
                    status,
                    reason,
                    observed_at
                FROM tube_status_snapshots
                ORDER BY line_id, observed_at DESC, id DESC
                """
            )

            rows = await cursor.fetchall()

            return [
                {
                    "line_id": row[0],
                    "line_name": row[1],
                    "status": row[2],
                    "reason": row[3],
                    "observed_at": row[4]
                }
                for row in rows
            ]


async def get_tube_reliability(hours: int = 24):
    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    line_id,
                    line_name,
                    COUNT(*) AS total_observations,
                    COUNT(*) FILTER (
                        WHERE status = 'Good Service'
                    ) AS good_observations,
                    COUNT(*) FILTER (
                        WHERE status <> 'Good Service'
                    ) AS other_observations,
                    ROUND(
                        100.0 * COUNT(*) FILTER (
                            WHERE status <> 'Good Service'
                        ) / NULLIF(COUNT(*), 0),
                        2
                    ) AS other_percentage
                FROM tube_status_snapshots
                WHERE observed_at >= NOW() - (%s * INTERVAL '1 hour')
                GROUP BY line_id, line_name
                ORDER BY other_percentage DESC, line_name
                """,
                (hours,)
            )

            rows = await cursor.fetchall()

            return [
                {
                    "line_id": row[0],
                    "line_name": row[1],
                    "total_observations": row[2],
                    "good_observations": row[3],
                    "other_observations": row[4],
                    "other_percentage": float(row[5]),
                }
                for row in rows
            ]


async def get_tube_stations():
    """Return Underground station locations as GeoJSON."""

    async with await psycopg.AsyncConnection.connect(
        DATABASE_URL,
        connect_timeout=5
    ) as connection:
        async with connection.cursor() as cursor:
            await cursor.execute(
                """
                SELECT
                    station_id,
                    station_name,
                    ST_X(location) AS longitude,
                    ST_Y(location) AS latitude
                FROM tube_stations
                ORDER BY station_name, station_id
                """
            )

            rows = await cursor.fetchall()

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        row[2],
                        row[3],
                    ],
                },
                "properties": {
                    "station_id": row[0],
                    "station_name": row[1],
                },
            }
            for row in rows
        ],
    }
