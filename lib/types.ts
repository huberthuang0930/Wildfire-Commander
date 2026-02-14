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

// ===== Terrain Types =====

export interface TerrainMetrics {
  elevation: number; // meters above sea level
  slope: number; // percentage (0-100+)
  slopeAngle: number; // degrees (0-90)
  aspect: string; // cardinal direction: "N", "NE", "E", "SE", "S", "SW", "W", "NW", or "flat"
  aspectDegrees: number; // degrees from north (0-360)
  nearbyRidgeline: boolean; // is there a ridgeline within 2km?
  ridgelineDistKm?: number; // distance to nearest ridgeline
  ridgelineDirection?: string; // direction to ridgeline: "N", "E", "S", "W"
  terrainType: "flat" | "gentle" | "moderate" | "steep" | "extreme"; // categorized slope
  notes: string[]; // tactical notes about terrain
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

// ===== IAP (Incident Action Plan) Types =====

export interface IAPSection {
  type: "ICS-202" | "ICS-203" | "ICS-204" | "ICS-205" | "ICS-220" | "general";
  content: string;
  extractedData?: {
    objectives?: string[];
    resources?: string[];
    airTactics?: string[];
  };
}

export interface IAPData {
  id: string;
  incidentName: string;
  dateCreated: string;
  location: {
    state: string;
    county?: string;
  };
  conditions: {
    fuel?: "grass" | "brush" | "mixed" | "chaparral";
    weather?: {
      windSpeedMps?: number;
      humidityPct?: number;
    };
    acres?: number;
  };
  sections: IAPSection[];
  tacticalLessons: string[];
  rawText?: string;
}

export interface IAPInsight {
  iapId: string;
  iapName: string;
  relevanceScore: number;
  tacticalSnippet: string;
  sectionType: string;
  reasoning: string[];
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
  iapInsights?: IAPInsight[]; // Optional IAP insights from similar historical incidents
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

// ===== NASA FIRMS Types =====

export interface FirmsHotspot {
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string; // "YYYY-MM-DD"
  acq_time: string; // "HHMM"
  satellite: string;
  instrument: string;
  confidence: string; // "nominal", "high", "low" or numeric
  version: string;
  bright_t31: number;
  frp: number; // Fire Radiative Power (MW)
  daynight: string; // "D" or "N"
}

export interface FireCluster {
  id: string;
  centroidLat: number;
  centroidLon: number;
  pointCount: number;
  maxFrp: number;
  maxBrightness: number;
  totalFrp: number;
  lastSeen: string; // ISO string
  radiusMeters: number;
  hotspots: FirmsHotspot[];
}

// ===== Enriched Incident (CAL FIRE + NWS + FIRMS) =====

export interface EnrichedIncident {
  incident: Incident;
  /** Source of this incident data */
  source: "calfire" | "arcgis" | "merged" | "firms";
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
  /** NASA FIRMS cluster metadata (when source is "firms") */
  firms: {
    pointCount: number;
    maxFrp: number;
    totalFrp: number;
    lastSeen: string;
    satellites: string[];
  } | null;
  nws: NwsEnrichment | null;
  /** Default resources for live incidents (estimated) */
  resources: Resources;
  /** Nearby assets (empty for live — could be populated later) */
  assets: Asset[];
}
