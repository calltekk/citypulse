
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ReliabilityRecord = {
  line_id: string;
  line_name: string;
  total_observations: number;
  good_observations: number;
  other_observations: number;
  other_percentage: number;
};

type Props = {
  data: ReliabilityRecord[];
};

export default function ReliabilityChart({ data }: Props) {
  const chartData = [...data].sort(
    (a, b) => b.other_percentage - a.other_percentage
  );

  if (chartData.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No reliability observations available yet.
      </p>
    );
  }

  return (
    <div className="h-[430px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 35, bottom: 10, left: 30 }}
        >
          <CartesianGrid
            stroke="#243247"
            strokeDasharray="3 3"
            horizontal={false}
          />

          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
          />

          <YAxis
            type="category"
            dataKey="line_name"
            width={115}
            tick={{ fill: "#cbd5e1", fontSize: 12 }}
          />

          <Tooltip
            cursor={{ fill: "#1e293b" }}
            contentStyle={{
              backgroundColor: "#0b1424",
              border: "1px solid #334155",
              borderRadius: "12px",
              color: "#f8fafc",
            }}
            formatter={(value) => [
              `${Number(value ?? 0).toFixed(2)}%`,
              "Non-good-service observations",
            ]}
          />

          <Bar
            dataKey="other_percentage"
            name="Non-good-service observations"
            fill="#22d3ee"
            radius={[0, 5, 5, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
