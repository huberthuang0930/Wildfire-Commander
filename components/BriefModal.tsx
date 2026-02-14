"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BriefModalProps {
  open: boolean;
  onClose: () => void;
  briefMarkdown: string | null;
  incidentName: string;
}

export default function BriefModal({
  open,
  onClose,
  briefMarkdown,
  incidentName,
}: BriefModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!briefMarkdown) return;
    try {
      await navigator.clipboard.writeText(briefMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = briefMarkdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow || !briefMarkdown) return;

    // Convert markdown to simple HTML
    const html = briefMarkdown
      .replace(/^# (.+)/gm, "<h1>$1</h1>")
      .replace(/^## (.+)/gm, "<h2>$1</h2>")
      .replace(/^### (.+)/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)/gm, "<li>$1</li>")
      .replace(/\| (.+)/g, "<tr><td>$1</td></tr>")
      .replace(/\n\n/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Incident Brief: ${incidentName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #c62828; border-bottom: 2px solid #c62828; padding-bottom: 8px; }
            h2 { color: #e65100; margin-top: 24px; }
            h3 { color: #333; margin-top: 16px; }
            li { margin: 4px 0; }
            table { border-collapse: collapse; width: 100%; }
            td { border: 1px solid #ddd; padding: 6px 12px; }
            strong { color: #333; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            Incident Brief: {incidentName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {briefMarkdown ? (
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-950 rounded-md p-4 border border-zinc-800">
              {briefMarkdown}
            </pre>
          ) : (
            <p className="text-zinc-500 text-sm">Generating brief...</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs border-zinc-700 text-zinc-400 hover:text-white"
          >
            {copied ? "Copied!" : "Copy"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs border-zinc-700 text-zinc-400 hover:text-white"
          >
            Print
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
