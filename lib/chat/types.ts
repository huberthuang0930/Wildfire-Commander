export type ChatRole = "user" | "assistant";

export type ToolTraceItem = {
  tool: string;
  input: unknown;
  output: unknown;
  ms?: number;
};

export type AssistantEvidenceItem = {
  label: string;
  cite: string; // e.g. "[tool:get_weather]" or "KB:doc#chunk" or "[H123]"
  details?: string;
};

export type AssistantStructured = {
  decision: string;
  evidence: AssistantEvidenceItem[];
  actions_0_3h: string[];
  uncertainties: string[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  createdAt: number;
  content: string;
  structured?: AssistantStructured;
  trace?: ToolTraceItem[];
};

export type ActiveIncidentContext = {
  mode: "scenario" | "live";
  incidentId: string;
  name: string;
  lat: number;
  lon: number;

  // Optional scenario knobs used for grounding (prevents "invented" wind shifts)
  windShiftEnabled?: boolean;
  windShift?: unknown;

  // Optional core objects if client already has them
  incident?: unknown;
  resources?: unknown;
  assets?: unknown;

  // Optional computed objects already available on client
  weather?: unknown;
  nws?: unknown;
  spread?: unknown;
  cards?: unknown;
  analogs?: unknown;
};

export type ChatRequestBody = {
  messages: ChatMessage[];
  active: ActiveIncidentContext;
};

export type ChatResponseBody = {
  assistant: ChatMessage;
  active: ActiveIncidentContext;
};

