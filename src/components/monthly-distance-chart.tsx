"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { formatDistanceKmValue } from "@/lib/fuel-display";
import {
  buildMonthlyDistancesForYear,
  getMonthKey,
  getMonthlyDistanceYears,
  type MonthlyDistance,
  type MonthlyDistanceTotal,
} from "@/lib/fuel-stats";

type MonthlyDistanceChartProps = {
  totals: MonthlyDistanceTotal[];
};

const PADDING_LEFT = 52;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 36;
const CHART_HEIGHT = 180;

function totalsToMap(totals: MonthlyDistanceTotal[]): Map<string, number> {
  return new Map(totals.map((item) => [item.monthKey, item.distanceKm]));
}

function getDefaultDistanceYear(years: number[]): number {
  const currentYear = Number(getMonthKey(new Date()).split("-")[0]);

  if (years.includes(currentYear)) {
    return currentYear;
  }

  return years[0] ?? currentYear;
}

export function MonthlyDistanceChart({ totals }: MonthlyDistanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(360);

  const totalsMap = useMemo(() => totalsToMap(totals), [totals]);
  const availableYears = useMemo(
    () => getMonthlyDistanceYears(totalsMap),
    [totalsMap],
  );
  const [selectedYear, setSelectedYear] = useState(() =>
    getDefaultDistanceYear(availableYears),
  );

  const displayYear = availableYears.includes(selectedYear)
    ? selectedYear
    : getDefaultDistanceYear(availableYears);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.round(element.getBoundingClientRect().width);

      if (nextWidth > 0) {
        setChartWidth(nextWidth);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(
    () => buildMonthlyDistancesForYear(totalsMap, displayYear),
    [totalsMap, displayYear],
  );
  const comparisonYear = displayYear - 1;

  if (totals.length === 0) {
    return (
      <p className="text-sm text-slate-500">表示するデータがありません</p>
    );
  }

  return (
    <DistanceChart
      chartData={chartData}
      chartWidth={chartWidth}
      containerRef={containerRef}
      selectedYear={displayYear}
      comparisonYear={comparisonYear}
      availableYears={availableYears}
      onYearChange={setSelectedYear}
    />
  );
}

type DistanceChartProps = {
  chartData: MonthlyDistance[];
  chartWidth: number;
  containerRef: RefObject<HTMLDivElement | null>;
  selectedYear: number;
  comparisonYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
};

function DistanceChart({
  chartData,
  chartWidth,
  containerRef,
  selectedYear,
  comparisonYear,
  availableYears,
  onYearChange,
}: DistanceChartProps) {
  const currentValues = chartData.map((item) => item.distanceKm);
  const previousValues = chartData
    .map((item) => item.previousYearDistanceKm)
    .filter((value): value is number => value !== null);
  const maxValue = Math.max(...currentValues, ...previousValues, 1);
  const plotWidth = Math.max(chartWidth - PADDING_LEFT - PADDING_RIGHT, 120);
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const groupWidth = plotWidth / chartData.length;
  const barWidth = Math.min(groupWidth * 0.45, 28);

  const currentCoordinates = chartData.map((item, index) => {
    const centerX =
      PADDING_LEFT + groupWidth * index + groupWidth / 2 - barWidth / 2;
    const height = (item.distanceKm / maxValue) * plotHeight;
    const y = PADDING_TOP + plotHeight - height;

    return { x: centerX, y, height, item };
  });

  const previousCoordinates = chartData.flatMap((item, index) => {
    if (item.previousYearDistanceKm === null) {
      return [];
    }

    const centerX = PADDING_LEFT + groupWidth * index + groupWidth / 2;
    const y =
      PADDING_TOP +
      plotHeight -
      (item.previousYearDistanceKm / maxValue) * plotHeight;

    return [{ x: centerX, y, item }];
  });

  const previousPolyline = previousCoordinates
    .map((coord) => `${coord.x},${coord.y}`)
    .join(" ");

  const yTicks = [maxValue, maxValue / 2, 0];

  return (
    <div ref={containerRef} className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" aria-hidden="true" />
            {selectedYear}年
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="h-0.5 w-4 rounded-full bg-violet-400"
              aria-hidden="true"
            />
            {comparisonYear}年
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="distance-chart-year" className="text-xs text-slate-500">
            表示年
          </label>
          <select
            id="distance-chart-year"
            value={selectedYear}
            onChange={(event) => onYearChange(Number(event.target.value))}
            className="rounded-xl border border-border bg-surface px-2.5 py-1.5 text-base text-foreground outline-none focus:border-accent"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
        className="h-[11.25rem] w-full"
        role="img"
        aria-label={`${selectedYear}年の月別走行距離グラフ`}
      >
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP}
          x2={PADDING_LEFT}
          y2={PADDING_TOP + plotHeight}
          className="stroke-slate-200 dark:stroke-slate-600"
          strokeWidth="1"
        />
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP + plotHeight}
          x2={PADDING_LEFT + plotWidth}
          y2={PADDING_TOP + plotHeight}
          className="stroke-slate-200 dark:stroke-slate-600"
          strokeWidth="1"
        />

        {yTicks.map((value, tickIndex) => {
          const y = PADDING_TOP + plotHeight - (value / maxValue) * plotHeight;

          return (
            <g key={`y-tick-${tickIndex}`}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={PADDING_LEFT + plotWidth}
                y2={y}
                className="stroke-slate-100 dark:stroke-slate-700/80"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[10px]"
              >
                {formatDistanceKmValue(value)}
              </text>
            </g>
          );
        })}

        {currentCoordinates.map((coord) => (
          <rect
            key={`bar-${coord.item.monthKey}`}
            x={coord.x}
            y={coord.y}
            width={barWidth}
            height={coord.height}
            rx="3"
            className="fill-sky-500"
          />
        ))}

        {previousCoordinates.length > 1 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-violet-400"
            points={previousPolyline}
          />
        )}

        {previousCoordinates.map((coord) => (
          <circle
            key={`prev-${coord.item.monthKey}`}
            cx={coord.x}
            cy={coord.y}
            r="3"
            className="fill-violet-400"
          />
        ))}

        {chartData.map((item, index) => {
          const x = PADDING_LEFT + groupWidth * index + groupWidth / 2;
          const monthNumber = Number(item.monthKey.split("-")[1]);

          return (
            <text
              key={`label-${item.monthKey}`}
              x={x}
              y={CHART_HEIGHT - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {monthNumber}月
            </text>
          );
        })}
      </svg>

      <div className="flex justify-between px-1 text-[10px] text-slate-400">
        <span>走行距離（km）</span>
        <span>月</span>
      </div>
    </div>
  );
}
