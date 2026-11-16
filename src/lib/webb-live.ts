export interface WebbVisit {
  visit: string;
  start: string;
  seconds: number;
  instrument: string;
  target: string;
  category: string;
  keywords: string;
}

export interface WebbStatus {
  launchIso: string;
  orbit: string;
  phase: string;
  distanceKm: number;
  mirrorDiameterM: number;
  mirrorSegments: number;
  warmSideC: number;
  coolSideC: number;
  source: string;
}

export interface WebbLiveData {
  fetchedAt?: string;
  schedule?: {
    reportUrl: string;
    sourceUrl: string;
    coversFrom: string;
    coversTo: string;
    observations: WebbVisit[];
  };
  status?: WebbStatus;
}

/// The moment a scheduled visit ends, in epoch milliseconds.
export function visitEnd(visit: WebbVisit): number {
  return Date.parse(visit.start) + visit.seconds * 1000;
}

/// The visits a reader could still be inside of: STScI's report covers a whole week and the
/// site rebuilds daily, so finished visits are dropped and the list is capped.
export function upcomingVisits(data: WebbLiveData, now: number, limit = 8): WebbVisit[] {
  return (data.schedule?.observations ?? []).filter((v) => visitEnd(v) > now).slice(0, limit);
}

/// Whole days since launch, the figure "Where Is Webb" calls days in space.
export function daysInSpace(launchIso: string, now: number): number {
  return Math.floor((now - Date.parse(launchIso)) / 86400000);
}

/// A visit's length as "13h 51m", "4h" or "23m".
export function visitLength(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m ? `${m}m` : ''}`.trim() : `${m}m`;
}

/// A UTC timestamp as "Mon 7 Sep, 05:20", the way the schedule reads.
export function utcStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
