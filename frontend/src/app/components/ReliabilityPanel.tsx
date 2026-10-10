
"use client";

import { useCallback, useEffect, useState } from "react";
import ReliabilityChart, {
  type ReliabilityRecord,
} from "./ReliabilityChart";

type ReliabilityResponse = {
  window_hours: number;
  count: number;
  data: ReliabilityRecord[];
};

const TIME_WINDOWS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
] as const;

export default function ReliabilityPanel() {
  const [hours, setHours] = useState(24);

  const [data, setData] = useState<ReliabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    null
  );

  const fetchReliability = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analytics/tube/reliability?hours=${hours}`,
          {
            cache: "no-store",
            signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Analytics request failed: ${response.status}`
          );
        }

        const result: ReliabilityResponse =
          await response.json();

        if (signal?.aborted) return;

        setData(result.data);
        setLastUpdated(new Date());
      } catch (err) {
        if (signal?.aborted) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to retrieve reliability analytics."
        );
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [hours]
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetchReliability(controller.signal);

    // Refresh analytics every 60 seconds.
    const interval = setInterval(() => {
      void fetchReliability(controller.signal);
    }, 60_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchReliability]);

  const totalObservations = data.reduce(
    (sum, line) => sum + line.total_observations,
    0
  );

  return (
    <section className="mt-8 rounded-2xl border border-slate-800 bg-[#111b2e] p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
            Historical analytics
          </p>

          <h3 className="text-xl font-semibold">
            Underground service observations
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Percentage of observations not reporting Good
            Service within the selected time window.
          </p>
        </div>

        <span className="rounded-full border border-slate-700 bg-[#0b1424] px-3 py-2 text-xs text-slate-400">
          {totalObservations.toLocaleString("en-GB")} observations
        </span>
      </div>

      {/* TIME WINDOW FILTERS */}

      <div className="mb-6 flex flex-wrap gap-2">
        {TIME_WINDOWS.map((window) => {
          const selected = hours === window.hours;

          return (
            <button
              key={window.hours}
              type="button"
              onClick={() => setHours(window.hours)}
              aria-pressed={selected}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                  : "border-slate-700 bg-[#0b1424] text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {window.label}
            </button>
          );
        })}
      </div>

      {/* ERROR STATE */}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* CHART */}

      {!error && (
        <div
          className={`transition-opacity ${
            loading ? "opacity-40" : "opacity-100"
          }`}
          aria-busy={loading}
        >
          <ReliabilityChart data={data} />
        </div>
      )}

      {loading && (
        <p className="mt-3 text-xs text-cyan-400">
          Loading analytics...
        </p>
      )}

      {/* FOOTER */}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
        <p className="max-w-2xl text-xs text-slate-500">
          Includes planned closures and other service
          statuses. Percentages represent available
          observations, not incident counts or guaranteed
          coverage of the selected period.
        </p>

        {lastUpdated && (
          <span className="text-xs text-slate-500">
            Updated{" "}
            {lastUpdated.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </section>
  );
}
