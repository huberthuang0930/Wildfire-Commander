'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export default function Legend() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs h-8 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5"
      >
        🗺️ Legend
        <ChevronDown className="w-3 h-3" />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-zinc-900/95 backdrop-blur-sm rounded-lg border border-zinc-700 shadow-2xl z-[9999] w-56 overflow-hidden">
          <div className="px-4 py-3 space-y-3">
            {/* Spread Forecast Section */}
            <div>
              <div className="text-zinc-400 text-[10px] font-medium mb-1.5 uppercase tracking-wide">
                Spread Forecast
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-white/40 flex-shrink-0" style={{ backgroundColor: 'rgba(255, 235, 59, 0.4)' }} />
                  <span className="text-zinc-200 text-xs">1 hour</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-white/40 flex-shrink-0" style={{ backgroundColor: 'rgba(255, 152, 0, 0.5)' }} />
                  <span className="text-zinc-200 text-xs">2 hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded border border-white/40 flex-shrink-0" style={{ backgroundColor: 'rgba(244, 67, 54, 0.6)' }} />
                  <span className="text-zinc-200 text-xs">3 hours</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-zinc-700" />

            {/* Fire Intensity Section */}
            <div>
              <div className="text-zinc-400 text-[10px] font-medium mb-1.5 uppercase tracking-wide">
                Fire Intensity
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/80 flex-shrink-0" style={{ backgroundColor: '#00C2FF' }} />
                  <span className="text-zinc-200 text-xs">Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/80 flex-shrink-0" style={{ backgroundColor: '#FF8C00' }} />
                  <span className="text-zinc-200 text-xs">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/80 flex-shrink-0" style={{ backgroundColor: '#FF4444' }} />
                  <span className="text-zinc-200 text-xs">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/80 flex-shrink-0" style={{ backgroundColor: '#FF6B00' }} />
                  <span className="text-zinc-200 text-xs">Critical</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
