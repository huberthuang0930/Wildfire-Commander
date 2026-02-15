# Flashpoint - Project Overview

## 🎯 Project Purpose

A **specialized wildfire Incident Commander (IC) decision support system** for the critical **0-3 hour initial attack window**. This is not a generic chatbot—it's an **incident-aware, tool-grounded, RAG-backed assistant** that helps ICs make rapid, evidence-based decisions during the most critical phase of wildfire response.

---

## 🏗️ Architecture Overview

### **Tech Stack**
- **Framework**: Next.js 16.1.6 (App Router, React 19, TypeScript)
- **UI**: Tailwind CSS + shadcn/ui components
- **Maps**: Mapbox GL JS + Deck.gl for data overlays
- **AI**: Anthropic Claude (via `@anthropic-ai/sdk`) for chat and insights
- **Data Sources**: 
  - NASA FIRMS (satellite fire detection)
  - CAL FIRE (official incident data)
  - Open-Meteo (weather)
  - NWS (fire weather alerts)
  - NWCG doctrine (RAG knowledge base)

### **Core Design Principles**
1. **Incident-Aware**: Every operation is scoped to a selected incident (live or scenario)
2. **Tool-Grounded**: AI responses cite actual tool outputs, not hallucinations
3. **RAG-Backed**: Doctrine and checklists retrieved from knowledge base
4. **Deterministic Fallback**: If AI fails, system falls back to rule-based recommendations
5. **Preflight Automation**: Chatbot auto-runs data pipeline when context is missing

---

## 📁 Project Structure

```
flashpoint/
├── app/
│   ├── page.tsx                    # Main orchestration page (map + panels)
│   └── api/                        # Next.js API routes
│       ├── chat/route.ts           # Chat backend (tool-use loop)
│       ├── weather/route.ts        # Weather data endpoint
│       ├── spread/route.ts         # Fire spread computation
│       ├── recommendations/route.ts # Action cards generation
│       ├── brief/route.ts          # Printable incident brief
│       ├── fires/live/route.ts    # Live FIRMS incident fetching
│       ├── kb/search/route.ts     # RAG knowledge base search
│       └── ... (other endpoints)
├── components/
│   ├── MapView.tsx                 # Mapbox map with Deck.gl overlays
│   ├── ChatPanel.tsx               # Chat UI with structured responses
│   ├── IncidentPanel.tsx          # Incident details sidebar
│   ├── ActionCards.tsx            # Action card display
│   ├── ExplainPanel.tsx           # Spread explanation
│   └── ... (other UI components)
├── lib/
│   ├── chat/
│   │   ├── types.ts               # Chat message & context types
│   │   └── tools.ts               # Tool definitions & execution
│   ├── spread.ts                  # Fire spread rate & envelope computation
│   ├── recommendations.ts         # Action card generation logic
│   ├── risk.ts                    # Risk scoring algorithm
│   ├── kb.ts                      # RAG lexical search (local JSON index)
│   ├── historical-data.ts         # Historical incident matching
│   ├── iap-matching.ts            # IAP (Incident Action Plan) similarity
│   ├── terrain.ts                 # Terrain analysis & scoring
│   ├── openmeteo.ts              # Weather fetching
│   ├── firms.ts                  # FIRMS satellite data processing
│   ├── calfire.ts                # CAL FIRE API integration
│   └── types.ts                   # Core TypeScript interfaces
├── scripts/
│   ├── rag_sync.ts                # Download & convert RAG sources (PDF→MD)
│   └── ingest_kb.ts               # Build knowledge base index
├── data/
│   ├── kb_index.json              # RAG chunk index (local)
│   └── iap/                       # Historical IAP data
└── rag_sources.yaml               # RAG source configuration

```

---

## 🔑 Key Features

### **1. Live Fire Detection & Enrichment**
- **Source**: NASA FIRMS satellite hotspots (VIIRS)
- **Process**: Clusters hotspots into incidents, enriches with CAL FIRE data, NWS alerts
- **Output**: `EnrichedIncident[]` with perimeter, containment, weather context
- **API**: `GET /api/fires/live`

### **2. Fire Spread Modeling**
- **Algorithm**: Physics-based spread rate calculation
  - Base rate: 0.6 km/h
  - Wind factor: `1 + windSpeedMps / 10`
  - Humidity factor: 1.4 (<20%), 1.2 (<30%), 1.0 (≥30%)
  - Fuel factor: grass (1.3), chaparral (1.2), brush (1.1), mixed (1.0)
- **Output**: 1h/2h/3h spread envelopes (cone polygons)
- **Wind Shift Support**: Dynamic direction changes at specified times
- **API**: `POST /api/spread`

### **3. Action Card Generation**
- **Types**: Tactics, Resources, Evacuation
- **Scoring**: Multi-factor (risk, asset proximity, terrain, IAP similarity)
- **Features**:
  - Asset-at-risk detection within envelopes
  - Time-to-impact estimation
  - Historical IAP matching (similar past incidents)
  - Terrain-based tactical recommendations
- **API**: `POST /api/recommendations`

### **4. Specialized Chatbot** 🤖
The centerpiece feature—an **incident-aware, tool-grounded assistant**.

#### **Architecture**
- **Backend**: `POST /api/chat` implements Claude tool-use loop
- **Tools Available**:
  - `get_weather(lat, lon)` → `/api/weather`
  - `compute_spread(incident, weather, horizonHours, windShift?)` → `/api/spread`
  - `get_action_cards(...)` → `/api/recommendations`
  - `get_historical_analogs(lat, lon, month, wind, humidity)` → historical matching
  - `kb_search(query)` → `/api/kb/search` (RAG)
  - `generate_brief(...)` → `/api/brief`

#### **Preflight Automation**
When user asks an operational question (e.g., "Do we need evac warnings?"), the chatbot:
1. Checks if weather/spread/cards are already computed
2. If missing, **automatically calls tools** to gather context
3. Then generates response using that context

#### **Structured Output**
Chatbot returns JSON with:
- `decision`: IC-ready decision statement
- `evidence[]`: Array of cited facts (with `[tool:...]` or `[KB:...]` citations)
- `actions_0_3h[]`: Prioritized action list
- `uncertainties[]`: Missing information or risks

#### **Grounding Validation**
- Server-side validator ensures all `[tool:...]` citations are backed by actual tool calls
- Ungrounded claims are filtered out or converted to uncertainties
- Prevents AI hallucinations

#### **Deterministic Fallback**
If Claude API fails (e.g., credit exhaustion):
- Returns fallback response using deterministic action cards
- UI shows banner: "AI temporarily unavailable; using deterministic engine"

### **5. RAG Knowledge Base (Doctrine Retrieval)**
- **Sources**: NWCG IRPG, FIRESCOPE FOG, ICO, 10/18 Watchouts, 6MFS topics
- **Ingestion Pipeline**:
  1. `npm run rag:sync` → Downloads PDFs/HTML from `rag_sources.yaml`, converts to markdown
  2. `npm run ingest-kb` → Chunks markdown, builds `data/kb_index.json`
- **Search**: Lexical token matching (simple but effective for doctrine)
- **API**: `POST /api/kb/search` returns top-K chunks with citations

### **6. Historical Incident Matching**
- **Database**: Historical incidents with fuel, weather, outcome data
- **Matching**: Similarity scoring (fuel, weather, size, terrain)
- **Use Case**: "Find analog fires" → cites similar past incidents with lessons learned

### **7. IAP (Incident Action Plan) Matching**
- **Data**: Real IAPs from past incidents (ICS-202, ICS-203, ICS-204 sections)
- **Matching**: Similarity scoring based on fuel, weather, size, relevant sections
- **Output**: Relevant IAP snippets for tactics/resources/evacuation cards

### **8. Terrain Analysis**
- **Metrics**: Slope, aspect, elevation, tactical value
- **Integration**: Used in spread computation and action card scoring

---

## 🔄 Data Flow

### **Live Mode Flow**
```
1. User selects live incident from map/list
   ↓
2. Frontend calls /api/fires/live
   ↓
3. Backend:
   - Fetches FIRMS hotspots
   - Clusters into incidents
   - Enriches with CAL FIRE data
   - Adds NWS fire weather alerts
   ↓
4. Frontend displays incident on map
   ↓
5. User clicks incident → triggers data pipeline:
   - GET /api/weather?lat=X&lon=Y
   - POST /api/spread (with weather)
   - POST /api/recommendations (with spread)
   ↓
6. Map shows spread envelopes, action cards displayed
   ↓
7. User opens chat → asks question
   ↓
8. POST /api/chat:
   - Preflight: auto-runs missing tools
   - Claude tool-use loop
   - Returns structured response
```

### **Chat Tool-Use Loop**
```
1. User message + active incident context sent to /api/chat
   ↓
2. Preflight: If operational question, auto-call tools
   ↓
3. Claude API call with:
   - System prompt (forces structure, citations, tools)
   - Tool definitions
   - Message history
   ↓
4. Claude returns tool calls (if needed)
   ↓
5. Server executes tools (calls own endpoints)
   ↓
6. Tool results fed back to Claude
   ↓
7. Repeat until Claude returns final answer
   ↓
8. Server validates grounding, returns structured JSON
```

---

## 📊 Key Algorithms

### **Spread Rate Calculation**
```typescript
baseRate = 0.6 km/h
windFactor = 1 + windSpeedMps / 10
humidityFactor = humidity < 20% ? 1.4 : humidity < 30% ? 1.2 : 1.0
fuelFactor = lookup[incident.fuelProxy]  // grass: 1.3, chaparral: 1.2, etc.
rate = baseRate * windFactor * humidityFactor * fuelFactor
```

### **Spread Envelope (Cone)**
- Direction: `weather.windDirDeg`
- Distance: `rate * tHours` (km)
- Spread angle: 30° (15° each side of wind direction)
- Polygon: Generated using `@turf/turf` cone geometry

### **Action Card Scoring**
- **Risk Score**: Multi-factor (spread rate, asset proximity, weather severity)
- **IAP Similarity**: Fuel/weather/size matching with historical IAPs
- **Terrain Score**: Slope, aspect, tactical value
- **Final Rank**: Weighted combination

### **RAG Search (Lexical)**
- Tokenize query (lowercase, min 3 chars)
- Score chunks: `hits / sqrt(textLength / 500)`
- Return top-K with snippet highlighting

---

## 🛠️ API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/fires/live` | GET | Fetch live FIRMS incidents (enriched) |
| `/api/weather` | GET | Get weather for coordinates |
| `/api/spread` | POST | Compute spread envelopes |
| `/api/recommendations` | POST | Generate action cards |
| `/api/chat` | POST | Chatbot (tool-use loop) |
| `/api/kb/search` | POST | RAG knowledge base search |
| `/api/brief` | POST | Generate printable brief |
| `/api/ai-insights` | POST | Generate AI insights (legacy) |
| `/api/calfire/*` | GET | CAL FIRE data proxies |
| `/api/firms/hotspots` | GET | Raw FIRMS hotspot data |

---

## 🎨 UI Components

### **Main Page (`app/page.tsx`)**
- **Orchestrates**: All state, data fetching, component coordination
- **Features**:
  - Live incident polling (30s interval)
  - Change detection (risk score changes trigger banner)
  - Chat state management
  - Active incident context passing

### **MapView**
- Mapbox GL map with Deck.gl overlays
- Displays: Incidents, spread envelopes, assets, hotspots
- Interactions: Click incident → select, zoom, pan

### **ChatPanel**
- Message thread (user/assistant)
- Quick action chips: "Give me a 0-3h briefing", "Evac triggers?", etc.
- Structured response rendering:
  - Decision statement
  - Evidence list (with citations)
  - Actions (0-3h)
  - Uncertainties
- Expandable "Sources / Evidence" accordion

### **ActionCards**
- Displays ranked action cards (Tactics, Resources, Evacuation)
- Color-coded by priority/risk
- Click to expand details

### **ExplainPanel**
- Spread rate breakdown
- Factor explanations (wind, humidity, fuel)
- Notes (wind shifts, etc.)

---

## 🔧 Build & Deployment

### **Scripts**
- `npm run dev` - Development server
- `npm run build` - Production build (TypeScript check + Next.js build)
- `npm run rag:sync` - Download & convert RAG sources
- `npm run ingest-kb` - Build knowledge base index

### **Environment Variables**
- `ANTHROPIC_API_KEY` - Claude API key
- `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token
- `FIRMS_MAP_KEY` - NASA FIRMS API key (optional)
- `AI_INSIGHTS_ENABLED` - Feature flag for AI insights
- `AI_MODEL` - Claude model (default: `claude-3-5-sonnet-20241022`)

### **Vercel Deployment**
- **Build Command**: `next build` (default)
- **Output Directory**: Next.js default (`.next`)
- **Root Directory**: `./` (project root)
- **Fixed Issues**:
  - TypeScript errors (nullable cache type in `iap-matching.ts`)
  - Missing type declarations (`@types/turndown`, `@types/pdf-parse`)

---

## 🐛 Recent Fixes

1. **Missing `/api/weather` route** → Restored `app/api/weather/route.ts`
2. **TypeScript build errors** → Fixed nullable return type in `iap-matching.ts`
3. **Missing dependencies** → Added `@types/turndown`, `pdf-parse` types
4. **Chat grounding** → Added server-side validation to filter ungrounded evidence
5. **Wind shift context** → Fixed preflight tool calls to pass `windShift` from active context

---

## 📚 Key Files & Responsibilities

| File | Responsibility |
|------|---------------|
| `app/page.tsx` | Main orchestration, state management, data fetching |
| `app/api/chat/route.ts` | Chat backend, tool-use loop, grounding validation |
| `lib/chat/tools.ts` | Tool definitions & execution (calls own endpoints) |
| `lib/spread.ts` | Fire spread rate & envelope computation |
| `lib/recommendations.ts` | Action card generation & scoring |
| `lib/kb.ts` | RAG lexical search (local JSON index) |
| `lib/iap-matching.ts` | Historical IAP similarity matching |
| `lib/historical-data.ts` | Historical incident matching |
| `components/ChatPanel.tsx` | Chat UI with structured response rendering |
| `components/MapView.tsx` | Mapbox map with Deck.gl overlays |
| `scripts/rag_sync.ts` | Download & convert RAG sources (PDF→MD, HTML→MD) |
| `scripts/ingest_kb.ts` | Build knowledge base chunk index |

---

## 🎯 What Makes This "Specialized" (Not a Generic Chatbot)

1. **Incident Context**: Every chat request includes full incident context (weather, spread, assets, resources)
2. **Tool Grounding**: All facts must cite tool outputs (`[tool:get_weather]`) or KB (`[KB:irpg#12]`)
3. **Preflight Automation**: Auto-runs data pipeline when context is missing
4. **Structured Output**: IC-ready format (decision, evidence, actions, uncertainties)
5. **Deterministic Fallback**: Works even if AI fails
6. **Doctrine RAG**: Answers questions using NWCG/FIRESCOPE doctrine
7. **Historical Learning**: Cites similar past incidents
8. **Safety Guardrails**: Never pretends to be dispatch; frames as decision support

---

## 🚀 Next Steps / Future Enhancements

- [ ] Upgrade RAG to vector embeddings (Supabase pgvector or local sqlite-vss)
- [ ] Add more RAG sources (LLC incident reviews, SAFENET protocols)
- [ ] Real-time incident updates via WebSocket
- [ ] Multi-user collaboration (shared incident views)
- [ ] Export briefs to PDF
- [ ] Mobile-responsive UI
- [ ] Integration with real dispatch systems (if available)

---

## 📝 Summary

This is a **production-ready prototype** for a specialized wildfire IC assistant. It combines:
- **Real-time data** (FIRMS, CAL FIRE, weather)
- **Physics-based modeling** (spread computation)
- **AI-powered insights** (Claude with tool-use)
- **Doctrine grounding** (RAG knowledge base)
- **Historical learning** (IAP & incident matching)
- **Deterministic fallbacks** (works even if AI fails)

The chatbot is the centerpiece—it's not a generic LLM wrapper, but a **tool-grounded, incident-aware assistant** that helps ICs make rapid, evidence-based decisions during the critical 0-3 hour window.
