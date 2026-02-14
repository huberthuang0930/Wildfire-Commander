// ===== Core Data Types =====

export interface Incident {
  id: string;
  name: string;
  lat: number;
  lon: number;
  startTimeISO: string;
  perimeter: {
    type: "Point";
    radiusMeters: number;
  };
  fuelProxy: "grass" | "brush" | "mixed" | "chaparral";
  notes: string;
}

export interface Weather {
  windSpeedMps: number;
  windGustMps: number;
  windDirDeg: number;
  temperatureC: number;
  humidityPct: number;
}

export interface Resources {
  enginesAvailable: number;
  dozersAvailable: number;
  airSupportAvailable: boolean;
  etaMinutesEngine: number;
  etaMinutesAir: number;
}

export interface Asset {
  id: string;
  type: "community" | "infrastructure" | "school" | "hospital";
  name: string;
  lat: number;
  lon: number;
  priority: "high" | "medium" | "low";
}

// ===== Spread Types =====

export interface WindShift {
  enabled: boolean;
  atMinutes: number;
  newDirDeg: number;
}

export interface SpreadEnvelope {
  tHours: number;
  polygon: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface SpreadResult {
  envelopes: SpreadEnvelope[];
  explain: {
    model: string;
    rateKmH: number;
    windFactor: number;
    humidityFactor: number;
    notes: string[];
  };
}

// ===== Risk Types =====

export interface RiskBreakdown {
  windSeverity: number;
  humiditySeverity: number;
  timeToImpactSeverity: number;
}

export interface RiskScore {
  total: number;
  breakdown: RiskBreakdown;
  label: "low" | "moderate" | "high" | "extreme";
}

// ===== Recommendation Types =====

export type CardType = "evacuation" | "resources" | "tactics";
export type Confidence = "high" | "medium" | "low";

export interface ActionCard {
  type: CardType;
  title: string;
  timing: string;
  confidence: Confidence;
  why: string[];
  actions: string[];
}

export interface Brief {
  oneLiner: string;
  keyTriggers: string[];
}

export interface RecommendationsResult {
  cards: ActionCard[];
  brief: Brief;
  riskScore: RiskScore;
}

// ===== Scenario Types =====

export interface Scenario {
  id: string;
  name: string;
  description: string;
  incident: Incident;
  resources: Resources;
  assets: Asset[];
  defaultWindShift?: WindShift;
}

export interface ScenariosData {
  scenarios: Scenario[];
}

// ===== CAL FIRE Types =====

export interface CalFireRawIncident {
  UniqueId: string;
  Name: string;
  Location: string;
  Latitude: number;
  Longitude: number;
  AcresBurned: number | null;
  PercentContained: number | null;
  Started: string;
  Updated: string;
  AdminUnit: string;
  County: string;
  ConditionStatement: string | null;
  SearchDescription: string | null;
  IsActive: boolean;
  Url: string;
  // There may be additional fields; these are the ones we use
  [key: string]: unknown;
}

// ===== NWS Types =====

export interface NwsForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  relativeHumidity?: { value: number };
}

export interface NwsAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  onset: string;
  expires: string;
  description: string;
  instruction: string | null;
  senderName: string;
}

export interface NwsEnrichment {
  forecastPeriods: NwsForecastPeriod[];
  alerts: NwsAlert[];
  forecastSummary: string;
  hasRedFlagWarning: boolean;
  hasWindAdvisory: boolean;
}

// ===== Enriched Incident (CAL FIRE + NWS) =====

export interface EnrichedIncident {
  incident: Incident;
  /** Source of this incident data */
  source: "calfire" | "arcgis" | "merged";
  calfire: {
    acres: number | null;
    containmentPct: number | null;
    county: string;
    isActive: boolean;
    url: string;
    updatedAt: string;
  } | null;
  /** ArcGIS perimeter data (when available from FIRIS/WFIGS) */
  perimeter: {
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    } | null;
    acres: number | null;
    displayStatus: string;
    source: string;
    incidentNumber: string | null;
  } | null;
  nws: NwsEnrichment | null;
  /** Default resources for live incidents (estimated) */
  resources: Resources;
  /** Nearby assets (empty for live — could be populated later) */
  assets: Asset[];
}
