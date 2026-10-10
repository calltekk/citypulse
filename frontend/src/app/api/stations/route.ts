
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "http://localhost:8000/api/v1/transport/tube/stations",
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to retrieve stations" },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Station API proxy error:", error);

    return NextResponse.json(
      { error: "Station API unavailable" },
      { status: 503 }
    );
  }
}
