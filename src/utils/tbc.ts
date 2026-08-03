export const TBC_VALUE = "[To be confirmed]";

export function isTbcValue(value: string): boolean {
  return value.trim().toLowerCase() === TBC_VALUE.toLowerCase();
}

export function toTbcValue(): string {
  return TBC_VALUE;
}
