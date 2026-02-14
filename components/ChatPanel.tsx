"use client";

import { useMemo, useState } from "react";
import type { ChatMessage, AssistantStructured } from "@/lib/chat/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function tryParseStructured(content: string): AssistantStructured | null {
  try {
    let text = content.trim();
    // Strip one level of code fences if present
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    // If Claude ever wraps extra text, try extracting the first JSON object
    if (!text.startsWith("{")) {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) text = text.slice(start, end + 1);
    }

    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as any;
    if (typeof obj.decision !== "string") return null;
    return {
      decision: obj.decision,
      evidence: Array.isArray(obj.evidence) ? obj.evidence : [],
      actions_0_3h: Array.isArray(obj.actions_0_3h) ? obj.actions_0_3h : [],
      uncertainties: Array.isArray(obj.uncertainties) ? obj.uncertainties : [],
    } as AssistantStructured;
  } catch {
    return null;
  }
}

function EvidenceView({ structured }: { structured: AssistantStructured }) {
  const items = structured.evidence || [];
  return (
    <div className="space-y-1.5 text-[11px] text-zinc-300">
      {items.length === 0 && <div className="text-zinc-500">No evidence provided.</div>}
      {items.map((e: any, idx) => {
        if (typeof e === "string") {
          return (
            <div key={idx} className="border-l border-zinc-700 pl-2">
              {e}
            </div>
          );
        }
        return (
          <div key={idx} className="border-l border-zinc-700 pl-2">
            <div className="flex items-center gap-2">
              {e.cite && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400">
                  {e.cite}
                </Badge>
              )}
              <span className="font-medium text-zinc-200">{e.label}</span>
            </div>
            {e.details && <div className="text-zinc-400 mt-0.5">{e.details}</div>}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceSummary({ structured }: { structured: AssistantStructured }) {
  const top = (structured.evidence || []).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Evidence (top)</div>
      <div className="mt-1 space-y-1.5">
        {top.map((e: any, idx) => (
          <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-200">
            {e.cite && (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400 mt-[1px]"
              >
                {e.cite}
              </Badge>
            )}
            <span className="leading-snug">{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel(props: {
  mode: "scenario" | "live";
  activeIncidentName: string;
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
}) {
  const { mode, activeIncidentName, messages, isLoading, onSend } = props;
  const [input, setInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant") || null,
    [messages]
  );
  const lastStructured = useMemo(() => {
    if (!lastAssistant) return null;
    return lastAssistant.structured || tryParseStructured(lastAssistant.content);
  }, [lastAssistant]);

  const showFallbackBanner =
    (lastStructured?.uncertainties || []).some((u) => String(u).toLowerCase().includes("ai call failed")) ||
    (lastAssistant?.content || "").toLowerCase().includes("ai unavailable");

  const quickChips: Array<{ label: string; prompt: string }> = [
    { label: "0–3h briefing", prompt: "Give me a 0–3h briefing with decision, evidence, actions, uncertainties." },
    { label: "Evac triggers?", prompt: "Do we need evacuation warnings in the next 2 hours? Provide triggers and cite tools/doctrine." },
    { label: "Resource justification", prompt: "What resource requests should we make in the next hour, and why? Cite tools." },
    { label: "What changed?", prompt: "What changed since the last refresh that could affect decisions in the next 0–3 hours? Cite tools." },
    { label: "Find analog fires", prompt: "Find similar historical fires and summarize the key lessons applicable in the next 0–3 hours. Cite analog IDs." },
  ];

  function submit(text: string) {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setInput("");
  }

  return (
    <Card className="bg-zinc-900/90 border-zinc-700 text-white backdrop-blur-sm">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">💬</span>
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Chat Ops
              </h3>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-700 text-zinc-400">
                {mode.toUpperCase()}
              </Badge>
            </div>
            <div className="text-[10px] text-zinc-500 mt-0.5 truncate">
              Active: {activeIncidentName || "None selected"}
            </div>
          </div>
        </div>

        {showFallbackBanner && (
          <div className="text-[11px] text-amber-200 bg-amber-900/30 border border-amber-700/40 rounded-md px-2 py-1">
            AI temporarily unavailable; using deterministic engine + KB citations where possible.
          </div>
        )}

        {/* Quick chips */}
        <div className="flex flex-wrap gap-1.5">
          {quickChips.map((c) => (
            <Button
              key={c.label}
              variant="outline"
              size="sm"
              onClick={() => submit(c.prompt)}
              className="h-7 text-[11px] border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={isLoading}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {/* Thread */}
        <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
          {messages.length === 0 && (
            <div className="text-xs text-zinc-500 text-center py-6">
              Ask a question about the active incident. The assistant will cite tools and KB snippets.
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const structured = m.structured || (!isUser ? tryParseStructured(m.content) : null);
            const expanded = !!expandedIds[m.id];
            return (
              <div key={m.id} className={isUser ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[92%] rounded-lg px-2.5 py-2 text-xs leading-snug ${
                    isUser ? "bg-blue-700/40 border border-blue-600/30" : "bg-zinc-800/50 border border-zinc-700/60"
                  }`}
                >
                  {structured && !isUser ? (
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Decision</div>
                        <div className="text-zinc-200">{structured.decision}</div>
                      </div>
                      <EvidenceSummary structured={structured} />
                      <div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wide">0–3h actions</div>
                        <ul className="list-disc list-inside text-zinc-200 space-y-0.5">
                          {(structured.actions_0_3h || []).slice(0, 6).map((a, idx) => (
                            <li key={idx}>{a}</li>
                          ))}
                        </ul>
                      </div>
                      {(structured.uncertainties || []).length > 0 && (
                        <div>
                          <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Uncertainties</div>
                          <ul className="list-disc list-inside text-zinc-300 space-y-0.5">
                            {(structured.uncertainties || []).slice(0, 5).map((u, idx) => (
                              <li key={idx}>{u}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setExpandedIds((prev) => ({ ...prev, [m.id]: !prev[m.id] }))
                          }
                          className="h-6 px-2 text-[11px] text-zinc-400 hover:text-white"
                        >
                          {expanded ? "Hide" : "Sources / Evidence"} →
                        </Button>
                        {expanded && (
                          <div className="mt-1 space-y-2">
                            <EvidenceView structured={structured} />
                            {Array.isArray(m.trace) && m.trace.length > 0 && (
                              <div className="text-[10px] text-zinc-500 border-t border-zinc-700 pt-2">
                                <div className="uppercase tracking-wide mb-1">Tool trace</div>
                                <div className="space-y-1">
                                  {m.trace.slice(0, 10).map((t, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2">
                                      <span className="truncate">{t.tool}</span>
                                      {t.ms != null && <span className="shrink-0">{t.ms} ms</span>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="text-left">
              <div className="inline-block max-w-[92%] rounded-lg px-2.5 py-2 text-xs bg-zinc-800/50 border border-zinc-700/60 text-zinc-300">
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(input);
            }}
            placeholder="Ask about the current incident…"
            className="flex-1 h-9 rounded-md bg-zinc-950/60 border border-zinc-700 px-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            disabled={isLoading}
          />
          <Button
            onClick={() => submit(input)}
            className="h-9 px-3 text-xs bg-blue-600 hover:bg-blue-700"
            disabled={isLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

