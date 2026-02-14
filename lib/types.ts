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

// ===== AI Insights Types =====

export interface AIInsight {
  type: "warning" | "recommendation" | "context";
  message: string; // 15-25 words, firefighter-friendly
  confidence: "high" | "medium" | "low";
  reasoning: string[]; // Bullet points explaining WHY
  sources?: string[]; // IDs of similar historical incidents
}

export interface HistoricalIncident {
  id: string;
  name: string;
  date: string;
  location: string;
  fuel: "grass" | "brush" | "mixed" | "chaparral";
  weather: {
    windSpeedMps: number;
    humidityPct: number;
    temperatureC: number;
  };
  outcome: "contained" | "escaped" | "partial";
  containmentTimeHours: number;
  finalAcres: number;
  resources: {
    engines: number;
    dozers: number;
    airSupport: boolean;
  };
  keyLesson: string;
}
