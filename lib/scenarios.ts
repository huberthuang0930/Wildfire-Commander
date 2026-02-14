import { ScenariosData, Scenario } from "./types";
import scenariosJson from "@/data/scenarios.json";

/**
 * Load all scenarios from the static JSON data.
 */
export function getAllScenarios(): Scenario[] {
  const data = scenariosJson as ScenariosData;
  return data.scenarios;
}

/**
 * Get a single scenario by ID.
 */
export function getScenarioById(id: string): Scenario | undefined {
  return getAllScenarios().find((s) => s.id === id);
}
