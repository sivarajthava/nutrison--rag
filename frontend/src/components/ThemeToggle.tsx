"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTriggerIcon = () => {
    if (theme === "system") {
      return <Monitor className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (resolvedTheme === "dark") {
      return <Moon className="w-4 h-4 text-blue-400" />;
    }
    return <Sun className="w-4 h-4 text-amber-500" />;
  };

  const options: Array<{ id: "light" | "dark" | "system"; label: string; icon: React.ReactNode }> = [
    {
      id: "light",
      label: "Light",
      icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
    },
    {
      id: "dark",
      label: "Dark",
      icon: <Moon className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      id: "system",
      label: "System",
      icon: <Monitor className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />,
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/80 dark:border-slate-800 flex items-center justify-center shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        title={`Current theme: ${theme} (${resolvedTheme})`}
        aria-label="Toggle theme selection menu"
        aria-expanded={isOpen}
      >
        {getTriggerIcon()}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-1.5 z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Appearance
          </div>
          <div className="space-y-0.5">
            {options.map((opt) => (
              <button
                key={opt.id}
                role="menuitem"
                type="button"
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                  theme === opt.id
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.icon}
                  <span>{opt.label}</span>
                </div>
                {theme === opt.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
