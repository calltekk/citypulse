
import httpx

TFL_BASE_URL = "https://api.tfl.gov.uk"


async def get_line_status():
    url = f"{TFL_BASE_URL}/Line/Mode/tube/Status"

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()

        return response.json()
