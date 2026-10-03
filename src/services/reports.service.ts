import * as apiaryService from './apiaryService.js';
import * as boxService from './boxService.js';
import * as reviewReportService from './reviewReportService.js';
import * as manejoService from './manejoService.js';
import type { Apiary, Box, ReviewReport, ManejoReport } from '../types/mobile-models.js';

export interface ReportsStatsParams {
  fromIso: string;
  toIso: string;
  searchTerm?: string;
  chartFilter: 'apiarios' | 'caixas' | 'revisoes' | 'manejos';
}

export interface ReportsStatsResponse {
  apiaries: Apiary[];
  boxes: Box[];
  revisions: ReviewReport[];
  manejos: ManejoReport[];
  metrics: {
    periodDays: number;
    totalApiaries: number;
    totalBoxes: number;
    totalRevisions: number;
    totalManejos: number;
    apiaryGrowthPercent: number;
    boxGrowthPercent: number;
    topLocations: Array<{ location: string; total: number }>;
    barsData: Array<{ label: string; value: number }>;
  };
}

function daysBetweenInclusive(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) && days > 0 ? days : 1;
}

function calcGrowth(current: number, baseline: number): number {
  if (baseline <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Number((((current - baseline) / baseline) * 100).toFixed(1));
}

function extractDateOnly(value: string): string {
  return value.includes('T') ? value.slice(0, 10) : value;
}

function isInWindow(isoDate: string, fromIso: string, toIso: string): boolean {
  const d = extractDateOnly(isoDate);
  const from = extractDateOnly(fromIso);
  const to = extractDateOnly(toIso);
  return d >= from && d <= to;
}

export async function getReportsStats(params: ReportsStatsParams, userId?: number): Promise<ReportsStatsResponse> {
  const [
    allApiaries,
    allBoxes,
    allRevisions,
    allManejos,
  ] = await Promise.all([
    apiaryService.listAllApiaries(userId),
    boxService.listRegisteredBoxes({}, userId),
    reviewReportService.listRevisionReports({}, userId),
    manejoService.listManejoReports({}, userId),
  ]);

  const { fromIso, toIso, searchTerm = '', chartFilter } = params;
  const s = searchTerm.trim().toLowerCase();

  // Filter apiaries
  const filteredApiaries = allApiaries.filter((item: Apiary) =>
    isInWindow(item.createdAt, fromIso, toIso)
  );

  // Filter boxes
  const filteredBoxes = allBoxes.filter((item: Box) =>
    isInWindow(item.createdAt, fromIso, toIso)
  );

  // Filter revisions
  const filteredRevisions = allRevisions.filter((item: ReviewReport) => {
    const inDate = isInWindow(item.createdAt, fromIso, toIso);
    if (!inDate) return false;
    if (!s) return true;
    return (
      item.caixaName.toLowerCase().includes(s) ||
      item.apiaryName.toLowerCase().includes(s) ||
      item.observacoes.toLowerCase().includes(s)
    );
  });

  // Filter manejos
  const filteredManejos = allManejos.filter((item: ManejoReport) => {
    const inDate = isInWindow(item.createdAt, fromIso, toIso);
    if (!inDate) return false;
    if (!s) return true;
    return (
      item.caixaName.toLowerCase().includes(s) ||
      item.apiaryName.toLowerCase().includes(s) ||
      item.observacoes.toLowerCase().includes(s)
    );
  });

  // Calculate Metrics
  const periodDays = daysBetweenInclusive(fromIso, toIso);
  const totalApiaries = filteredApiaries.length;
  const totalBoxes = filteredBoxes.length;
  const totalRevisions = filteredRevisions.length;
  const totalManejos = filteredManejos.length;

  const midpoint = Math.ceil(periodDays / 2);
  const sortedApiaries = [...filteredApiaries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const sortedBoxes = [...filteredBoxes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const apiaryBaseline = sortedApiaries.slice(0, Math.max(sortedApiaries.length - midpoint, 0)).length;
  const boxBaseline = sortedBoxes.slice(0, Math.max(sortedBoxes.length - midpoint, 0)).length;

  // Top locations
  const locationCount = new Map<string, number>();
  for (const apiary of filteredApiaries) {
    const loc = apiary.location.trim() || 'Sem local definido';
    locationCount.set(loc, (locationCount.get(loc) ?? 0) + 1);
  }
  const topLocations = [...locationCount.entries()]
    .map(([location, total]) => ({ location, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Bars data calculation (4 intervals)
  const start = new Date(fromIso);
  const end = new Date(toIso);
  const spanMs = end.getTime() - start.getTime();
  const stepMs = Math.max(Math.floor(spanMs / 4), 1000 * 60 * 60 * 24);

  const labels = ['S1', 'S2', 'S3', 'S4'];
  const boundaries = [0, 1, 2, 3].map((index) => new Date(start.getTime() + stepMs * (index + 1)));

  let targetDates: string[] = [];
  if (chartFilter === 'apiarios') {
    targetDates = filteredApiaries.map((item: Apiary) => extractDateOnly(item.createdAt));
  } else if (chartFilter === 'caixas') {
    targetDates = filteredBoxes.map((item: Box) => extractDateOnly(item.createdAt));
  } else if (chartFilter === 'revisoes') {
    targetDates = filteredRevisions.map((item: ReviewReport) => extractDateOnly(item.createdAt));
  } else if (chartFilter === 'manejos') {
    targetDates = filteredManejos.map((item: ManejoReport) => extractDateOnly(item.createdAt));
  }

  const barsData = labels.map((label, index) => {
    const upperBoundary = boundaries[index] ?? end;
    const total = targetDates.filter((iso) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return false;
      if (index === 0) return date >= start && date <= upperBoundary;
      const lowerBoundary = boundaries[index - 1];
      return date > lowerBoundary && date <= upperBoundary;
    }).length;
    return { label, value: total };
  });

  return {
    apiaries: filteredApiaries,
    boxes: filteredBoxes,
    revisions: filteredRevisions,
    manejos: filteredManejos,
    metrics: {
      periodDays,
      totalApiaries,
      totalBoxes,
      totalRevisions,
      totalManejos,
      apiaryGrowthPercent: calcGrowth(totalApiaries, apiaryBaseline),
      boxGrowthPercent: calcGrowth(totalBoxes, boxBaseline),
      topLocations,
      barsData,
    },
  };
}
