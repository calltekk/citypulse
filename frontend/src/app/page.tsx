
import { Suspense } from "react";
import AutoRefresh from "./components/AutoRefresh";
import ReliabilityChart, {
  type ReliabilityRecord,
} from "./components/ReliabilityChart";

// ------------------------------------
// TYPES
// ------------------------------------

type TubeLine = {
  line_id: string;
  line_name: string;
  status: string;
  reason: string | null;
  observed_at: string;
};

type TubeResponse = {
  count: number;
  data: TubeLine[];
};

type ReliabilityResponse = {
  window_hours: number;
  count: number;
  data: ReliabilityRecord[];
};

// ------------------------------------
// TFL LINE COLOURS
// ------------------------------------

const LINE_COLOURS: Record<string, string> = {
  bakerloo: "#B36305",
  central: "#E32017",
  circle: "#FFD300",
  district: "#00782A",
  "hammersmith-city": "#F3A9BB",
  jubilee: "#A0A5A9",
  metropolitan: "#9B0056",
  northern: "#FFFFFF",
  piccadilly: "#003688",
  victoria: "#0098D4",
  "waterloo-city": "#95CDBA",
};

// ------------------------------------
// API FUNCTIONS
// ------------------------------------

const API_URL =
  process.env.CITYPULSE_API_URL ??
  "http://127.0.0.1:8000";

async function getTubeLines(): Promise<TubeLine[]> {
  const response = await fetch(
    `${API_URL}/api/v1/transport/tube/latest`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `CityPulse API returned ${response.status}`
    );
  }

  const result: TubeResponse = await response.json();

  return result.data;
}

async function getReliability(): Promise<ReliabilityRecord[]> {
  const response = await fetch(
    `${API_URL}/api/v1/analytics/tube/reliability?hours=24`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Reliability API returned ${response.status}`
    );
  }

  const result: ReliabilityResponse =
    await response.json();

  return result.data;
}

// ------------------------------------
// HELPERS
// ------------------------------------

function isGoodService(status: string): boolean {
  return status.toLowerCase() === "good service";
}

// ------------------------------------
// SERVER COMPONENT
// ------------------------------------

async function TubeDashboard() {
  let lines: TubeLine[] = [];
  let reliability: ReliabilityRecord[] = [];

  let error: string | null = null;
  let analyticsError: string | null = null;

  // Fetch both API endpoints concurrently.
  // A failure in one does not prevent the other from loading.
  const [tubeResult, reliabilityResult] =
    await Promise.allSettled([
      getTubeLines(),
      getReliability(),
    ]);

  if (tubeResult.status === "fulfilled") {
    lines = tubeResult.value;
  } else {
    error =
      "Unable to retrieve transport data from CityPulse API.";
  }

  if (reliabilityResult.status === "fulfilled") {
    reliability = reliabilityResult.value;
  } else {
    analyticsError =
      "Unable to load reliability analytics.";
  }

  // ------------------------------------
  // DASHBOARD METRICS
  // ------------------------------------

  const healthy = lines.filter((line) =>
    isGoodService(line.status)
  ).length;

  const otherStatuses = lines.length - healthy;

  const latestObservation = lines.reduce<string | null>(
    (latest, line) =>
      !latest || line.observed_at > latest
        ? line.observed_at
        : latest,
    null
  );

  const formattedTime = latestObservation
    ? new Date(latestObservation).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unavailable";

  return (
    <main className="min-h-screen bg-[#080e1b] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">

        {/* HEADER */}

        <header className="mb-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-cyan-400" />

              <h1 className="text-3xl font-bold tracking-tight">
                City
                <span className="text-cyan-400">
                  Pulse
                </span>
              </h1>
            </div>

            <p className="text-sm text-slate-400">
              London transport intelligence
            </p>
          </div>

          <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300">
            Last observation: {formattedTime}
          </div>
        </header>

        {/* NETWORK OVERVIEW */}

        <section className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Network overview
          </p>

          <h2 className="mb-7 text-3xl font-semibold">
            Underground status
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Lines monitored",
                value: lines.length,
              },
              {
                label: "Good service",
                value: healthy,
              },
              {
                label: "Other statuses",
                value: otherStatuses,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-800 bg-[#111b2e] p-6"
              >
                <p className="mb-3 text-sm text-slate-400">
                  {metric.label}
                </p>

                <p className="text-4xl font-semibold">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* TUBE LINE STATUS */}

        <section className="rounded-2xl border border-slate-800 bg-[#111b2e] p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">
              Tube lines
            </h3>

            <span className="text-xs text-slate-400">
              Latest stored observations
            </span>
          </div>

          {/* ERROR STATE */}

          {error && (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* EMPTY STATE */}

          {!error && lines.length === 0 && (
            <p className="text-sm text-slate-400">
              No Tube observations have been ingested yet.
            </p>
          )}

          {/* LINE CARDS */}

          <div className="space-y-3">
            {lines.map((line) => {
              const good = isGoodService(line.status);

              return (
                <div
                  key={line.line_id}
                  className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-[#0b1424] p-4"
                >
                  {/* TFL LINE COLOUR */}

                  <div
                    className="h-10 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        LINE_COLOURS[line.line_id] ??
                        "#64748b",
                    }}
                  />

                  {/* LINE INFORMATION */}

                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {line.line_name}
                    </p>

                    {line.reason && (
                      <p className="mt-1 text-xs text-slate-400">
                        {line.reason}
                      </p>
                    )}
                  </div>

                  {/* STATUS BADGE */}

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      good
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {line.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* HISTORICAL ANALYTICS */}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#111b2e] p-6">
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
              Historical analytics
            </p>

            <h3 className="text-xl font-semibold">
              Underground service observations
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Percentage of recorded observations not
              reporting Good Service over the last
              24 hours.
            </p>
          </div>

          {analyticsError ? (
            <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {analyticsError}
            </div>
          ) : (
            <ReliabilityChart data={reliability} />
          )}

          <p className="mt-4 text-xs text-slate-500">
            Includes planned closures and other service
            statuses. Percentages reflect available
            observations, not incident counts or
            guaranteed 24-hour coverage.
          </p>
        </section>

        {/* FOOTER */}

        <footer className="mt-10 text-center text-xs text-slate-500">
          CityPulse · Powered by TfL open data · Built
          with Next.js, FastAPI and PostgreSQL
        </footer>
      </div>
    </main>
  );
}

// ------------------------------------
// LOADING COMPONENT
// ------------------------------------

function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e1b] text-slate-100">
      <div className="text-center">
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />

        <h1 className="text-2xl font-semibold">
          City
          <span className="text-cyan-400">
            Pulse
          </span>
        </h1>

        <p className="mt-3 text-sm text-slate-400">
          Connecting to London transport intelligence...
        </p>
      </div>
    </main>
  );
}

// ------------------------------------
// MAIN ROUTE
// ------------------------------------

export default function Home() {
  return (
    <>
      <AutoRefresh />

      <Suspense fallback={<DashboardLoading />}>
        <TubeDashboard />
      </Suspense>
    </>
  );
}
