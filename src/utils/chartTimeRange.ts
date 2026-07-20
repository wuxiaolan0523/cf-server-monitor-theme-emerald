export interface ChartTimeRange {
  label: string
  hours: number
}

export const DEFAULT_CHART_TIME_RANGE: ChartTimeRange = { label: '10M', hours: 0.167 }

export const CHART_TIME_RANGES: readonly ChartTimeRange[] = [
  DEFAULT_CHART_TIME_RANGE,
  { label: '30M', hours: 0.5 },
  { label: '1H', hours: 1 },
  { label: '6H', hours: 6 },
  { label: '12H', hours: 12 },
  { label: '24H', hours: 24 },
]

export function getAvailableChartTimeRanges(maxHours: number): ChartTimeRange[] {
  return CHART_TIME_RANGES.filter(range => range.hours <= maxHours)
}
