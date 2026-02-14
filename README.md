# InitialAttack IC Assist

> 3 decisions in 10 seconds for the first 0–3 hours of a wildfire.

A wildfire incident commander decision support tool that provides:
- **Map-first incident view** with Mapbox + Deck.gl GPU-accelerated overlays
- **Wind-driven spread projections** (1h / 2h / 3h cone envelopes)
- **3 ranked Action Cards** (Evacuation, Resources, Tactics) with Why + Confidence
- **Trigger-based updates** (wind shift, time-to-impact, communities at risk)
- **Scenario Mode** with 3 preloaded incidents for reliable demos
- **Exportable Incident Brief** (copy/print)
- **Live Mode** (NASA FIRMS satellite detections clustered into “fire events”)
- **Chat Ops** (incident-aware chatbot grounded in tools + local doctrine KB)

## Quick Start

```bash
# Install dependencies
npm install

# Set your Mapbox token
# Edit .env.local and replace 'your_mapbox_token_here' with your actual token
# Get one free at https://account.mapbox.com/

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox GL JS access token |
| `FIRMS_MAP_KEY` | For Live Mode | NASA FIRMS API key (satellite hotspots) |
| `ANTHROPIC_API_KEY` | For Chat/AI | Anthropic Claude API key |
| `AI_INSIGHTS_ENABLED` | Optional | Set `true` to enable AI insights panel |
| `AI_MODEL` | Optional | Model name (default: `claude-sonnet-4-5`) |

## Preloaded Scenarios

| Scenario | Location | Challenge |
|---|---|---|
| **Riverside Creek** | Palo Alto, CA | Wind shift at +90 min threatens community |
| **Summit Ridge** | LA County, CA | Chaparral on steep terrain, fast uphill run |
| **Valley Grassfire** | Sacramento, CA | Fast grass fire, multiple communities at risk |

## Architecture

- **Frontend:** Next.js App Router + React + TypeScript + Tailwind CSS + shadcn/ui
- **Map:** Mapbox GL JS (basemap) + Deck.gl (data layers)
- **Backend:** Next.js API route handlers (no database needed)
- **Weather:** Open-Meteo API (free, no key required)
- **Live incidents:** NASA FIRMS (hotspots) + clustering (+ optional NWS enrichment)
- **Tests:** Vitest

## Chat Ops + KB (local RAG)

The Chat tab is **incident-aware** and should cite sources:
- Computed facts: `[tool:TOOL_NAME]` (calls your own deterministic endpoints)
- Doctrine snippets: `[KB:doc#chunk]` (local knowledge base)

### Add doctrine sources

1) Put `.md` / `.txt` files into `kb_sources/`
2) Generate the index:

```bash
npm run ingest-kb
```

3) KB search endpoint:
- `POST /api/kb/search` `{ "query": "...", "k": 5 }`

## Live Mode (FIRMS)

Live Mode uses NASA FIRMS hotspot detections, clusters them into “fire events,” and renders them as a satellite activity layer.

Endpoint:
- `GET /api/fires/live`

## Project Structure

```
app/
  page.tsx              # Main orchestration page
  layout.tsx            # Dark theme layout
  api/
    scenarios/route.ts  # GET preloaded scenarios
    weather/route.ts    # GET weather from Open-Meteo
    spread/route.ts     # POST compute spread envelopes
    recommendations/    # POST generate action cards
    brief/route.ts      # POST generate incident brief

components/
  MapView.tsx           # Mapbox + Deck.gl map
  IncidentPanel.tsx     # Left sidebar: incident + weather
  ActionCards.tsx       # Right panel: 3 action cards
  ActionCard.tsx        # Individual card component
  ExplainPanel.tsx      # Risk score gauge + breakdown
  ControlsBar.tsx       # Top bar: scenario picker, controls
  ScenarioPicker.tsx    # Scenario dropdown
  BriefModal.tsx        # Printable incident brief dialog

lib/
  types.ts              # All TypeScript interfaces
  geo.ts                # Geospatial math (Haversine, cones)
  spread.ts             # Fire spread model
  risk.ts               # Risk scoring (0-100)
  recommendations.ts    # Heuristic action card generation
  explain.ts            # Human-readable explanations
  openmeteo.ts          # Open-Meteo weather API client
  scenarios.ts          # Scenario data loader

data/
  scenarios.json        # 3 preloaded scenarios

tests/
  spread.test.ts        # Spread model tests
  risk.test.ts          # Risk scoring tests
  recommendations.test.ts # Action card tests
```

## Fire Spread Model (Explainable)

```
baseRate      = 0.6 km/h
windFactor    = 1 + windSpeed(m/s) / 10
humidityFactor = humidity < 20% → 1.4 | < 30% → 1.2 | else → 1.0
fuelFactor    = grass → 1.3 | chaparral → 1.2 | brush → 1.1 | mixed → 1.0

spreadRate = baseRate × windFactor × humidityFactor × fuelFactor
```

## Risk Score (0–100)

```
35% × windSeverity      (0 at 0 m/s, 100 at 20+ m/s)
35% × humiditySeverity   (100 at 0%, 0 at 60%+)
30% × timeToImpact       (100 if < 30 min, 10 if > 180 min)
```

## Running Tests

```bash
npm test
```

## 90-Second Demo Script

1. **Open app** → Riverside Creek auto-loads with satellite map
2. **Point to map** → "Fire origin, wind-driven spread cones at 1, 2, 3 hours"
3. **Point to left panel** → "Live weather from Open-Meteo, risk score 72/100"
4. **Point to right panel** → "Three action cards ranked by priority"
5. **Click Evacuation card** → "Why: wind shift at 90 min pushes toward community"
6. **Toggle Wind Shift ON** → Watch envelopes shift, risk score updates
7. **Click Brief** → "One-click exportable incident brief"
8. **Switch to Summit Ridge** → Different scenario, different recommendations
9. **Key message:** "Simple, explainable, firefighter-friendly. First 3 hours only."

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Mapbox GL JS
- Deck.gl
- Open-Meteo API
- Vitest
