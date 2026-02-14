"use client";

import { ActionCard as ActionCardType } from "@/lib/types";
import ActionCardComponent from "./ActionCard";

interface ActionCardsProps {
  cards: ActionCardType[];
}

export default function ActionCards({ cards }: ActionCardsProps) {
  if (cards.length === 0) {
    return (
      <div className="text-zinc-500 text-sm p-4">
        Waiting for recommendations...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs uppercase tracking-wider text-zinc-400 font-semibold px-1">
        Action Cards
      </h2>
      {cards.map((card, i) => (
        <ActionCardComponent key={card.type} card={card} index={i} />
      ))}
    </div>
  );
}
