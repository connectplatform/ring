/**
 * Polygon mainnet RPC URL resolution.
 * `polygon-rpc.com` no longer serves anonymous traffic — use Alchemy/Infura via env.
 */
export const POLYGON_RPC_PUBLIC_FALLBACK = 'https://rpc.ankr.com/polygon'

export function getPolygonRpcUrl(): string {
  return (
    process.env.POLYGON_RPC_URL ||
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
    POLYGON_RPC_PUBLIC_FALLBACK
  )
}
