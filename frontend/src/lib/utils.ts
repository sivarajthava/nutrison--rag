import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSimilarity(sim: number | null | undefined): string {
  if (sim === null || sim === undefined) return "N/A";
  return `${(sim * 100).toFixed(1)}%`;
}
