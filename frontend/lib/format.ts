import { formatEther } from "ethers";

export function formatEth(value: bigint, precision = 6): string {
  const asDecimal = Number.parseFloat(formatEther(value));

  if (!Number.isFinite(asDecimal)) {
    return "0";
  }

  return asDecimal.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

export function shortAddress(address: string | null | undefined): string {
  if (!address) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function formatDateTime(isoDate: string): string {
  const value = new Date(isoDate);

  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
