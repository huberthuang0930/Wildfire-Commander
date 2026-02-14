import { NextRequest, NextResponse } from "next/server";
import { generateBriefMarkdown } from "@/lib/explain";
import { ActionCard, RiskScore, SpreadResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      incidentName,
      oneLiner,
      keyTriggers,
      cards,
      riskScore,
      spreadExplain,
    }: {
      incidentName: string;
      oneLiner: string;
      keyTriggers: string[];
      cards: ActionCard[];
      riskScore: RiskScore;
      spreadExplain: SpreadResult["explain"];
    } = body;

    if (!incidentName || !cards || !riskScore || !spreadExplain) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const markdown = generateBriefMarkdown(
      incidentName,
      oneLiner || "",
      keyTriggers || [],
      cards,
      riskScore,
      spreadExplain
    );

    return NextResponse.json({ markdown });
  } catch (error) {
    console.error("Error generating brief:", error);
    return NextResponse.json(
      { error: "Failed to generate brief" },
      { status: 500 }
    );
  }
}
