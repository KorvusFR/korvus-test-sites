const FLAGS = (process.env.NEXT_PUBLIC_CHAOS_FLAGS ?? "")
  .split(",")
  .map((f) => f.trim())
  .filter(Boolean);

export function getChaosFlags(): string[] {
  return FLAGS;
}

export function hasFlag(flag: string): boolean {
  return FLAGS.includes(flag);
}
