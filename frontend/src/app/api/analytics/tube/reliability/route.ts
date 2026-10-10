
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const hoursParam =
    request.nextUrl.searchParams.get("hours") ?? "24";

  const hours = Number(hoursParam);

  if (
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > 168
  ) {
    return NextResponse.json(
      {
        error: "hours must be an integer between 1 and 168",
      },
      { status: 400 }
    );
  }

  const apiUrl =
    process.env.CITYPULSE_API_URL ??
    "http://127.0.0.1:8000";

  try {
    const response = await fetch(
      `${apiUrl}/api/v1/analytics/tube/reliability?hours=${hours}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "CityPulse analytics API unavailable",
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error: "Unable to connect to CityPulse API",
      },
      { status: 502 }
    );
  }
}
