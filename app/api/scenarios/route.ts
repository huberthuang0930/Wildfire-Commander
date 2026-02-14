import { NextResponse } from "next/server";
import { getAllScenarios } from "@/lib/scenarios";

export async function GET() {
  try {
    const scenarios = getAllScenarios();
    return NextResponse.json({ scenarios });
  } catch (error) {
    console.error("Error loading scenarios:", error);
    return NextResponse.json(
      { error: "Failed to load scenarios" },
      { status: 500 }
    );
  }
}
