import { logger } from '@/lib/logger';
import { createPublicClient, http, type PublicClient, type Chain } from 'viem';
import { polygon, mainnet, arbitrum, optimism, base } from 'viem/chains';
import { getSystemConfigSnapshot, NativeChainConfig } from '@/lib/ring-config-core';
import { getNativeChain } from '@/lib/ring-config-chain';
import { getEvmRpcUrl } from '@/lib/ring-config-chain';
import type { NativeTokenPriceOracleConfig } from '@/lib/ring-config-types';

// Get global config snapshot for token symbol/decimals.
// TODO: Refactor to support per-chain symbol/decimals using React 19's use() for fresh reads in server components or Next16 route handlers.
const ringSnapshot = getSystemConfigSnapshot();
const nativeTokenSymbol = ringSnapshot.tokens?.nativeToken?.tokenSymbol || 'RING';
const nativeTokenDecimals = ringSnapshot.tokens?.nativeToken?.tokenDecimals || 8;

/**
 * Interface for USD price data for native tokens - includes contextual (source/trust/chain) info.
 */
export interface PriceData {
  price: string;                   // Price of native token in USD (string for precision)
  timestamp: number;               // Millisecond epoch timestamp
  source: string;                  // Source name, e.g., 'chainlink', 'coingecko'
  confidence: number;              // [0-1] Trustworthiness/confidence score
  chainId?: number;                // Chain reference (optional)
  tokenDecimals?: number;          // Explicit decimals of price token
}

/**
 * Extended per-chain oracle config with on-chain/fallback/caching toggles.
 */
type PriceOracleChainConfig = NativeChainConfig & {
  chainlink: {
    enabled: boolean;              // Enable Chainlink for this chain?
    feedAddress?: string;          // Price Feed contract (if known)
    aggregatorAbi?: any[];         // STUB: Type properly for ABI safety - TODO: Import canonical Chainlink aggregator ABI and type it
  };
  fallbacks: {
    enabled: boolean;              // Enable fallback strategies for this chain
    coingecko: boolean;
    coinmarketcap: boolean;
    binance: boolean;
  };
  cache?: {                        // Optional per-chain cache config
    enabled?: boolean | true;      
    ttl?: number;                  
  };
};

/**
 * In-memory price cache object structure.
 */
interface CachedPrice {
  data: PriceData;                 // The price data itself
  expiresAt: number;               // Expiry timestamp (ms epoch)
  chainId: number;                 // Reference chainId
}

/**
 * Build and normalize oracle config from config SSOT (system-of-truth).
 */
function buildConfigFromRingConfig(): NativeTokenPriceOracleConfig {
  const ringConfig = getSystemConfigSnapshot();
  if (!ringConfig.nativeTokenPriceOracle) {
    throw new Error("Missing nativeTokenPriceOracle config from ring-config.json");
  }
  const oracleConfig = ringConfig.nativeTokenPriceOracle as NativeTokenPriceOracleConfig;

  // Default cache parameters for safety.
  const defaultCacheConfig = { enabled: true as const, ttl: 300 * 1000 };

  // Helper: ensure per-chain 'cache' exists and is correct.
  function ensureCache<T extends PriceOracleChainConfig>(c: T): T {
    if (!c.cache) {
      c.cache = { ...defaultCacheConfig };
    } else {
      c.cache = {
        enabled: typeof c.cache.enabled === 'boolean' ? c.cache.enabled : true,
        ttl: typeof c.cache.ttl === 'number' && c.cache.ttl > 0 ? c.cache.ttl : 300 * 1000,
      };
    }
    return c;
  }

  // Merge legacy JSON `evm.aggregatorAddress` into typed chains[137] when feed unset/zero.
  const legacyEvmFeed = (oracleConfig as { evm?: { aggregatorAddress?: string } })?.evm?.aggregatorAddress
  const configured137 = oracleConfig?.chains?.[137]?.chainlink?.feedAddress
  const isZeroFeed = (a?: string) =>
    !a || a === '0x0000000000000000000000000000000000000000'
  const polygonFeed =
    (!isZeroFeed(configured137) ? configured137 : undefined) ||
    (!isZeroFeed(legacyEvmFeed) ? legacyEvmFeed : undefined) ||
    process.env.POLYGON_CHAINLINK_TOKEN_USD_FEED

  // TODO: Externalize hardcoded chain list. Use dynamic registration or loadable config (Next16 config, Edge middleware, remote fetch).
  const defaultChains: Record<number, PriceOracleChainConfig> = {
    137: ensureCache({
      ...(oracleConfig?.chains?.[137] || {}),
      chainlink: {
        enabled: !!polygonFeed && !isZeroFeed(polygonFeed),
        feedAddress: polygonFeed,
        aggregatorAbi: [], // STUB: Patch with canonical ABI for price feeds. TODO: Import/verify Chainlink AggregatorV3 ABI, assign here.
      },
      fallbacks: {
        enabled: true,
        coingecko: oracleConfig?.chains?.[137]?.fallbacks?.coingecko ?? true,
        coinmarketcap: oracleConfig?.chains?.[137]?.fallbacks?.coinmarketcap ?? !!process.env.COINMARKETCAP_API_KEY,
        binance: oracleConfig?.chains?.[137]?.fallbacks?.binance ?? true,
      },
      cache: oracleConfig?.chains?.[137]?.cache,
    }),
    1: ensureCache({
      ...(oracleConfig?.chains?.[1] || {}),
      chainlink: {
        enabled: !!oracleConfig?.chains?.[1]?.chainlink?.feedAddress || !!process.env.ETHEREUM_CHAINLINK_TOKEN_USD_FEED,
        feedAddress: oracleConfig?.chains?.[1]?.chainlink?.feedAddress || process.env.ETHEREUM_CHAINLINK_TOKEN_USD_FEED,
        aggregatorAbi: [], // STUB: Patch with canonical ABI for price feeds
      },
      fallbacks: {
        enabled: true,
        coingecko: oracleConfig?.chains?.[1]?.fallbacks?.coingecko ?? true,
        coinmarketcap: oracleConfig?.chains?.[1]?.fallbacks?.coinmarketcap ?? !!process.env.COINMARKETCAP_API_KEY,
        binance: oracleConfig?.chains?.[1]?.fallbacks?.binance ?? true,
      },
      cache: oracleConfig?.chains?.[1]?.cache,
    }),
    42161: ensureCache({
      ...(oracleConfig?.chains?.[42161] || {}),
      chainlink: {
        enabled: !!oracleConfig?.chains?.[42161]?.chainlink?.feedAddress || !!process.env.ARBITRUM_CHAINLINK_TOKEN_USD_FEED,
        feedAddress: oracleConfig?.chains?.[42161]?.chainlink?.feedAddress || process.env.ARBITRUM_CHAINLINK_TOKEN_USD_FEED,
        aggregatorAbi: [], // STUB: Patch with canonical ABI for price feeds
      },
      fallbacks: {
        enabled: false,
        coingecko: oracleConfig?.chains?.[42161]?.fallbacks?.coingecko ?? true,
        coinmarketcap: oracleConfig?.chains?.[42161]?.fallbacks?.coinmarketcap ?? false,
        binance: oracleConfig?.chains?.[42161]?.fallbacks?.binance ?? false,
      },
      cache: oracleConfig?.chains?.[42161]?.cache,
    }),
    10: ensureCache({
      ...(oracleConfig?.chains?.[10] || {}),
      chainlink: {
        enabled: !!oracleConfig?.chains?.[10]?.chainlink?.feedAddress || !!process.env.OPTIMISM_CHAINLINK_TOKEN_USD_FEED,
        feedAddress: oracleConfig?.chains?.[10]?.chainlink?.feedAddress || process.env.OPTIMISM_CHAINLINK_TOKEN_USD_FEED,
        aggregatorAbi: [], // STUB: Patch with canonical ABI for price feeds
      },
      fallbacks: {
        enabled: false,
        coingecko: oracleConfig?.chains?.[10]?.fallbacks?.coingecko ?? true,
        coinmarketcap: oracleConfig?.chains?.[10]?.fallbacks?.coinmarketcap ?? false,
        binance: oracleConfig?.chains?.[10]?.fallbacks?.binance ?? false,
      },
      cache: oracleConfig?.chains?.[10]?.cache,
    }),
    8453: ensureCache({
      ...(oracleConfig?.chains?.[8453] || {}),
      chainlink: {
        enabled: !!oracleConfig?.chains?.[8453]?.chainlink?.feedAddress || !!process.env.BASE_CHAINLINK_TOKEN_USD_FEED,
        feedAddress: oracleConfig?.chains?.[8453]?.chainlink?.feedAddress || process.env.BASE_CHAINLINK_TOKEN_USD_FEED,
        aggregatorAbi: [], // STUB: Patch with canonical ABI for price feeds
      },
      fallbacks: {
        enabled: false,
        coingecko: oracleConfig?.chains?.[8453]?.fallbacks?.coingecko ?? true,
        coinmarketcap: oracleConfig?.chains?.[8453]?.fallbacks?.coinmarketcap ?? false,
        binance: oracleConfig?.chains?.[8453]?.fallbacks?.binance ?? false,
      },
      cache: oracleConfig?.chains?.[8453]?.cache,
    }),
  };

  return {
    chains: defaultChains,
    // Prefer explicit defaultChain, else config, else fallback to 137
    defaultChain: typeof oracleConfig?.defaultChain === 'number'
      ? oracleConfig.defaultChain
      : (typeof getNativeChain() === 'number' ? getNativeChain() : 137),
  } as NativeTokenPriceOracleConfig;
}

/**
 * NativeTokenPriceOracleService: Singleton class providing current/fallback/cached price data and multi-chain heuristics via on-chain, coingecko, CMC and Binance.
 *
 * TODO: Use React 19 use() and cache() to optimize price fetches across Server Components for static/dynamic use cases.
 * TODO: Provide context/environmental providers in Next16 for multitenant/test/sandbox support; e.g., via ServerActions or context registry.
 */
export class NativeTokenPriceOracleService {
  private static instance: NativeTokenPriceOracleService;
  private config: NativeTokenPriceOracleConfig & { chains: Record<number, PriceOracleChainConfig> };
  private clients: Map<number, PublicClient> = new Map(); // chainId to Viem public client
  private priceCache: Map<string, CachedPrice> = new Map(); // Internal cache for priceData

  // Service constructs as a singleton (private).
  private constructor(nativeTokenPriceOracleConfig?: Partial<NativeTokenPriceOracleConfig>) {
    // Merge user config over ringConfig for flexibility, include chains field.
    const ringConfig = buildConfigFromRingConfig();
    this.config = {
      ...ringConfig,
      ...nativeTokenPriceOracleConfig,
      chains: {
        ...(ringConfig.chains ?? {}),
        ...(nativeTokenPriceOracleConfig?.chains ?? {}),
      }
    } as NativeTokenPriceOracleConfig & { chains: Record<number, PriceOracleChainConfig> };

    // Initialize Viem clients on supported chains.
    this.initializeClients();
  }

  /**
   * Singleton accessor.
   * TODO: Add support for dependency injection via Next16 middleware/testing context for greater isolation/testability.
   */
  static getInstance(config?: Partial<NativeTokenPriceOracleConfig>): NativeTokenPriceOracleService {
    if (!NativeTokenPriceOracleService.instance) {
      NativeTokenPriceOracleService.instance = new NativeTokenPriceOracleService(config);
    }
    return NativeTokenPriceOracleService.instance;
  }

  /**
   * Returns a minimal Aggregator ABI for Chainlink price oracle reads.
   * // STUB: This just includes latestRoundData, not full canonical ABI. 
   * // TODO: Import and properly type/validate official AggregatorV3Interface ABI—replace static with import.
   */
  private getNativeTokenPriceOracleAggregatorAbi() {
    return [
      {
        inputs: [],
        name: "latestRoundData",
        outputs: [
          { internalType: "uint80", name: "roundId", type: "uint80" },
          { internalType: "int256", name: "answer", type: "int256" },
          { internalType: "uint256", name: "startedAt", type: "uint256" },
          { internalType: "uint256", name: "updatedAt", type: "uint256" },
          { internalType: "uint80", name: "answeredInRound", type: "uint80" },
        ],
        stateMutability: "view",
        type: "function",
      },
    ];
  }

  /**
   * Initialize viem public clients for all configured chains.
   * // TODO: For Next.js/React19, can use app router server context, or a cache()d version with request-local instance.
   */
  private initializeClients() {
    // Registry for known chain objects
    const chainConfigs: Record<number, Chain> = {
      1: mainnet,
      137: polygon,
      42161: arbitrum,
      10: optimism,
      8453: base,
    };

    // Setup: for every enabled chain, build a viem client using preferred rpcUrl if present.
    for (const [chainIdStr, chainConfig] of Object.entries(this.config.chains)) {
      const chainId = parseInt(chainIdStr);
      const chain = chainConfigs[chainId];
      if (chain) {
        const rpcUrl = this.getChainRpcUrl(chainId);
        // TODO: Next.js—introduce runtime RPC probe/auto-rotate and snapshot/fallback on static props in SSG/ISR routes.
        const client = createPublicClient({
          chain,
          transport: http(rpcUrl),
        }) as PublicClient;
        this.clients.set(chainId, client);
        logger.info(`Initialized price oracle client for chain ${chainId}`, { chain: chain.name });
      }
    }
  }

  /**
   * Returns custom RPC url for a given chain if provided, else defaults to Polygon public endpoint.
   * // TODO: Provide full rpcUrl lookup per chain (SSOT), load from env or config file.
   */
  private getChainRpcUrl(chainId: number): string {
    const url = this.config.chains?.[chainId]?.rpcUrl;
    if (typeof url === 'string' && url.length > 0)
      return url;
    return getEvmRpcUrl();
  }

  /**
   * Main entry: gets native token price for a chain (caching, multi-fallback aware).
   * Always returns PriceData (even lowest-confidence fallback).
   * // TODO: Switch to React 19 use() + cache() for live SSR cache if used in server components.
   */
  async getNativeTokenUsdPrice(chainIdInput?: number): Promise<PriceData> {
    let targetChainId: number;
    // Choose which chain to fetch for (input > config > fallback)
    if (typeof chainIdInput === "number") {
      targetChainId = chainIdInput;
    } else if (typeof this.config.defaultChain === "number") {
      targetChainId = this.config.defaultChain;
    } else if (typeof (this.config.defaultChain as any)?.chainId === "number") {
      targetChainId = (this.config.defaultChain as any).chainId;
    } else {
      targetChainId = 137; // fallback
    }
    const cacheKey = `${nativeTokenSymbol}_USD_${targetChainId}`;

    // Use cached value if valid.
    const cacheObj = this.config.chains[targetChainId]?.cache;
    if (cacheObj?.enabled) {
      const cached = this.getCachedPrice(cacheKey, targetChainId);
      if (cached) {
        logger.info(`Returning cached ${nativeTokenSymbol}/USD price`, { price: cached.price, source: cached.source, chainId: targetChainId });
        return cached;
      }
    }

    // Try Chainlink if enabled and configured.
    let priceData: PriceData | null = null;
    const chainConfig = this.config.chains[targetChainId];

    if (chainConfig?.chainlink?.enabled) {
      try {
        priceData = await this.getChainlinkPrice(targetChainId);
        if (priceData) {
          logger.info(`Got ${nativeTokenSymbol}/USD price from Chainlink`, { price: priceData.price, chainId: targetChainId });
        }
      } catch (error) {
        logger.warn('Chainlink price fetch failed', { error, chainId: targetChainId });
      }
    }

    // If on-chain fetch failed, fall back to public APIs by config order.
    if (!priceData) {
      priceData = await this.getFallbackPrice(targetChainId);
    }

    // If still not available and no specific chain requested, try all other chains' Chainlink feeds.
    if (!priceData && typeof chainIdInput !== "number") {
      for (const [otherChainIdStr, otherConfig] of Object.entries(this.config.chains)) {
        const otherChainId = parseInt(otherChainIdStr, 10);
        if (otherChainId !== targetChainId && otherConfig.chainlink?.enabled) {
          try {
            priceData = await this.getChainlinkPrice(otherChainId);
            if (priceData) {
              logger.info(`Got ${nativeTokenSymbol}/USD price from alternative chain`, {
                price: priceData.price,
                originalChain: targetChainId,
                fallbackChain: otherChainId,
              });
              break;
            }
          } catch (_err) { }
        }
      }
    }

    // As last-resort: return stub lowest-confidence fallback.
    if (!priceData) {
      logger.error('All price sources failed, using default price', { chainId: targetChainId });
      priceData = {
        price: '1.00', // STUB: Hardcoded fallback. TODO: Remove static fallback, instead throw/report/trigger retry pipeline.
        timestamp: Date.now(),
        source: 'default',
        confidence: 0.1,
        chainId: targetChainId,
        tokenDecimals: nativeTokenDecimals,
      };
    } else {
      // Always attach decimals for client-side consistency
      priceData.tokenDecimals = nativeTokenDecimals;
    }

    // Only cache >0.5 confidence
    if (cacheObj?.enabled && priceData.confidence > 0.5) {
      this.setCachedPrice(cacheKey, priceData, targetChainId);
    }

    return priceData;
  }

  /**
   * Converts a raw native token amount (string) to USD by most recent price.
   */
  async convertNativeTokenToUsd(nativeTokenAmount: string): Promise<{
    usd_amount: number;
    token_amount: number;
    rate: string;
    timestamp: number;
    confidence: number;
  }> {
    const priceData = await this.getNativeTokenUsdPrice();
    // Convert input to token units using current decimals.
    const tokenAmount = Number(nativeTokenAmount) / Math.pow(10, nativeTokenDecimals);
    const rate = Number(priceData.price); // USD per native token
    let usdAmount = 0;
    if (!isNaN(tokenAmount) && !isNaN(rate) && rate > 0) {
      usdAmount = tokenAmount * rate;
    }
    logger.info(`Converted ${nativeTokenSymbol} to USD`, {
      nativeTokenAmount: tokenAmount,
      usdAmount,
      rate: priceData.price.toString(),
      source: priceData.source,
      decimals: nativeTokenDecimals,
    });
    return {
      usd_amount: usdAmount,
      token_amount: tokenAmount,
      rate: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
    };
  }

  /**
   * Converts a USD amount (string) to the equivalent native token value at most recent price.
   */
  async convertUsdToNativeToken(usdAmount: string): Promise<{
    token_amount: number;
    usd_amount: number;
    rate: string;
    timestamp: number;
    confidence: number;
  }> {
    const priceData = await this.getNativeTokenUsdPrice();
    const usdAmountParsed = Number(usdAmount);
    const rate = Number(priceData.price);
    let tokenAmount = 0;
    if (!isNaN(usdAmountParsed) && !isNaN(rate) && rate > 0) {
      tokenAmount = usdAmountParsed / rate;
    }
    logger.info(`Converted USD to ${nativeTokenSymbol}`, {
      usdAmount: usdAmountParsed,
      tokenAmount,
      rate: priceData.price.toString(),
      source: priceData.source,
      decimals: nativeTokenDecimals,
    });
    return {
      usd_amount: usdAmountParsed,
      token_amount: tokenAmount,
      rate: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
    };
  }

  /**
   * STUB: Historical pricing not yet implemented.
   * TODO: Step 1 - Support on-chain event query or external price API with time-bucket results.
   *       Step 2 - Query, map and transform raw historical reads to PriceData[] for plotting/analytics.
   */
  async getHistoricalPrices(
    startDate: Date,
    endDate: Date,
    interval: 'hourly' | 'daily' = 'daily'
  ): Promise<PriceData[]> {
    logger.info('Historical price request (not implemented)', { startDate, endDate, interval });
    return []; // STUB: Return nothing
  }

  /**
   * Reads price directly from Chainlink on-chain aggregator.
   * Returns null if not enabled/misconfigured/fails.
   */
  private async getChainlinkPrice(chainId: number): Promise<PriceData | null> {
    const chainConfig = this.config.chains[chainId];
    // Only proceed if enabled and configured.
    if (!chainConfig?.chainlink?.enabled || !chainConfig.chainlink.feedAddress) {
      logger.warn('Chainlink not enabled or feedAddress missing', { chainId });
      return null;
    }

    const client = this.clients.get(chainId);
    if (!client) {
      logger.warn('No viem client available for chain', { chainId });
      return null;
    }

    try {
      // Try to call latestRoundData in configured aggregator contract
      const roundData = await client.readContract({
        address: chainConfig.chainlink.feedAddress as `0x${string}`,
        abi: Array.isArray(chainConfig.chainlink.aggregatorAbi) && chainConfig.chainlink.aggregatorAbi.length > 0
          ? chainConfig.chainlink.aggregatorAbi
          : this.getNativeTokenPriceOracleAggregatorAbi(),
        functionName: 'latestRoundData',
      } as any);

      // STUB: Unpack result - canonical Chainlink return ([roundId, answer, startedAt, updatedAt, answeredInRound])
      const roundDataTuple = roundData as any[];
      const [, answer, , updatedAt] = roundDataTuple as [bigint, bigint, bigint, bigint, bigint];
      const asNum = Number(answer);
      if (!isFinite(asNum) || asNum <= 0) return null;

      // Chainlink always uses 8 decimals, but support config override for nonstandard feeds.
      const tokenDecimals = nativeTokenDecimals || 8;
      const divisor = Math.pow(10, tokenDecimals);

      const price = (asNum / divisor).toFixed(6);
      const timestamp = Number(updatedAt) * 1000;

      // Use confidence score: high if <1hr old, otherwise lower
      const priceAge = Date.now() - timestamp;
      const maxAge = 60 * 60 * 1000;
      const confidence = priceAge < maxAge ? 0.9 : 0.7;

      return {
        price,
        timestamp,
        source: 'chainlink',
        confidence,
        chainId,
        tokenDecimals: tokenDecimals,
      };

    } catch (error) {
      logger.error('Chainlink price fetch failed', { error, chainId });
      return null;
    }
  }

  /**
   * Try fallback APIs for a chain: order is coingecko, coinmarketcap, binance (if enabled by config).
   * Returns first valid result or null.
   * // TODO: In React19/Next16 environments, consider using cache()+Promise.all for parallel fallback call with winner-take-first-use() on client/server.
   */
  private async getFallbackPrice(chainId: number): Promise<PriceData | null> {
    const chainConfig = this.config.chains[chainId];
    if (!chainConfig?.fallbacks?.enabled) return null;

    // 1) Try CoinGecko API
    if (chainConfig.fallbacks.coingecko) {
      try {
        const coingeckoPrice = await this.getCoinGeckoPrice(chainId);
        if (coingeckoPrice) return coingeckoPrice;
      } catch (error) {
        logger.warn('CoinGecko price fetch failed', { error, chainId });
      }
    }
    // 2) Try CoinMarketCap API
    if (chainConfig.fallbacks.coinmarketcap) {
      try {
        const cmcPrice = await this.getCoinMarketCapPrice(chainId);
        if (cmcPrice) return cmcPrice;
      } catch (error) {
        logger.warn('CoinMarketCap price fetch failed', { error, chainId });
      }
    }
    // 3) Try Binance API
    if (chainConfig.fallbacks.binance) {
      try {
        const binancePrice = await this.getBinancePrice(chainId);
        if (binancePrice) return binancePrice;
      } catch (error) {
        logger.warn('Binance price fetch failed', { error, chainId });
      }
    }

    return null;
  }

  /**
   * Fetch price from CoinGecko API.
   * // STUB: Uses static geckoId. 
   * TODO: Step 1 - Map per-chain CoinGecko id.
   *       Step 2 - Use fetch with React19's cache() for automatic request dedupe/rate limiting in RSC/server context.
   */
  private async getCoinGeckoPrice(chainId: number): Promise<PriceData | null> {
    try {
      // STUB: Hardcoded id, not multichain aware yet
      const geckoId = 'ring-token';
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(geckoId)}&vs_currencies=usd&include_last_updated_at=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();

      if (data[geckoId]?.usd) {
        return {
          price: data[geckoId].usd.toString(),
          timestamp: (data[geckoId].last_updated_at || Math.floor(Date.now()/1000)) * 1000,
          source: 'coingecko',
          confidence: 0.8,
          chainId,
          tokenDecimals: nativeTokenDecimals,
        };
      }
      return null;
    } catch (error) {
      logger.error('CoinGecko API call failed', { error });
      return null;
    }
  }

  /**
   * Query CoinMarketCap API (if API key configured).
   * // TODO: Rate limitable in React19 by wrapping in cache(), or throttle queue in dedicated queue util for Next16.
   */
  private async getCoinMarketCapPrice(chainId: number): Promise<PriceData | null> {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${nativeTokenSymbol}`,
        {
          headers: {
            'X-CMC_PRO_API_KEY': apiKey,
            'Accept': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(`CoinMarketCap API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.data?.[nativeTokenSymbol]?.quote?.USD?.price) {
        return {
          price: data.data[nativeTokenSymbol].quote.USD.price.toString(),
          timestamp: new Date(data.data[nativeTokenSymbol].quote.USD.last_updated).getTime(),
          source: 'coinmarketcap',
          confidence: 0.8,
          chainId,
          tokenDecimals: nativeTokenDecimals,
        };
      }

      return null;
    } catch (error) {
      logger.error('CoinMarketCap API call failed', { error });
      return null;
    }
  }

  /**
   * Query Binance REST for a symbol/USDT quote.
   * // STUB: Assumes symbol==nativeTokenSymbol everywhere.
   * TODO: Use per-chain symbol mapping, wrap in cache() for dedup.
   */
  private async getBinancePrice(chainId: number): Promise<PriceData | null> {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${nativeTokenSymbol.toUpperCase()}USDT`
      );

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.price) {
        return {
          price: data.price,
          timestamp: Date.now(),
          source: 'binance',
          confidence: 0.7,
          chainId,
          tokenDecimals: nativeTokenDecimals,
        };
      }
      return null;
    } catch (error) {
      logger.error('Binance API call failed', { error });
      return null;
    }
  }

  /**
   * Returns cached PriceData if valid and non-expired, else null.
   * Purges expired entries for safety.
   * // TODO: For React19/Next16, can move this to use() or a custom hook and expose as server state.
   */
  private getCachedPrice(key: string, chainId: number): PriceData | null {
    const cached = this.priceCache.get(key);
    // Must match chainId and not be expired
    if (!cached || cached.chainId !== chainId) return null;
    if (Date.now() > cached.expiresAt) {
      this.priceCache.delete(key); // Purge
      return null;
    }
    return cached.data;
  }

  /**
   * Save (or overwrite) cached result with expiry.
   */
  private setCachedPrice(key: string, data: PriceData, chainId: number): void {
    const ttl = this.config.chains[chainId]?.cache?.ttl;
    const finalTtl = typeof ttl === 'number' && ttl > 0 ? ttl : 300 * 1000;
    this.priceCache.set(key, {
      data,
      expiresAt: Date.now() + finalTtl,
      chainId,
    });
  }

  /**
   * Clears cache for all chains. 
   * // TODO: Accept chainId as arg to allow targeted cache purge per chain, not just full clear.
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price oracle cache cleared');
  }

  /**
   * Gets price for specified chain, using cache or fetching as needed.
   * Only supports nativeTokenSymbol, will throw for other keys.
   * // TODO: For Next16/React19: use async context or useOptimistic to "optimistically" fetch and return result as server/component state.
   */
  async getPriceForChain(chainId: number, tokenSymbol: string = nativeTokenSymbol): Promise<PriceData> {
    if (tokenSymbol !== nativeTokenSymbol) {
      throw new Error(`Token ${tokenSymbol} not supported. Only ${nativeTokenSymbol} is currently supported.`);
    }

    const cacheKey = `${nativeTokenSymbol}_USD_${chainId}`;
    const cacheObj = this.config.chains[chainId]?.cache;
    if (cacheObj?.enabled) {
      const cached = this.getCachedPrice(cacheKey, chainId);
      if (cached) {
        return cached;
      }
    }
    return await this.getNativeTokenUsdPrice(chainId);
  }

  /**
   * Returns prices for all supported chains (those with at least one source enabled).
   * // TODO: In React19/Next16, rewrite with Promise.allSettled()+use()/cache() for fast parallel fetching/SSR. 
   */
  async getMultiChainPrices(tokenSymbol: string = nativeTokenSymbol): Promise<Record<number, PriceData>> {
    const results: Record<number, PriceData> = {};

    for (const [chainIdStr, chainConfig] of Object.entries(this.config.chains)) {
      const chainId = parseInt(chainIdStr);
      try {
        if (chainConfig.chainlink?.enabled || chainConfig.fallbacks?.enabled) {
          // TODO: For dashboard/SSR, use Promise.allSettled or use() to parallelize these requests.
          const priceData = await this.getPriceForChain(chainId, tokenSymbol);
          results[chainId] = priceData;
        }
      } catch (error) {
        logger.warn(`Failed to get price for chain ${chainId}`, { error });
      }
    }
    return results;
  }

  /**
   * Find the "best" price across all chains: highest confidence then most recent.
   * Used for UX global/singular USD price context.
   * // TODO: Expose sort strat option, use higher-confidence or fresh-first basis (custom function arg).
   */
  async getBestPrice(tokenSymbol: string = nativeTokenSymbol): Promise<PriceData & { chainId: number }> {
    const multiChainPrices = await this.getMultiChainPrices(tokenSymbol);

    let bestPrice: (PriceData & { chainId: number }) | null = null;

    for (const [chainId, priceData] of Object.entries(multiChainPrices)) {
      if (!bestPrice ||
        priceData.confidence > bestPrice.confidence ||
        (
          priceData.confidence === bestPrice.confidence &&
          typeof priceData.timestamp === "number" && typeof bestPrice.timestamp === "number" &&
          priceData.timestamp > bestPrice.timestamp // Prefer newer
        )
      ) {
        bestPrice = { ...priceData, chainId: parseInt(chainId) };
      }
    }

    if (!bestPrice) {
      throw new Error(`No price data available for ${tokenSymbol}`);
    }
    return bestPrice;
  }

  /**
   * Read USD price from an arbitrary Chainlink AggregatorV3 feed on a given chain.
   * Used by treasury-swap allowlist entries (per-token chainlinkFeed).
   * Rejects zero/stale answers (default max age 1h).
   */
  async getUsdPriceFromFeed(
    feedAddress: string,
    chainId?: number,
    options?: { maxAgeMs?: number },
  ): Promise<PriceData> {
    const targetChainId = chainId ?? this.config.defaultChain ?? 137
    if (!feedAddress || feedAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('chainlink_feed_not_configured')
    }
    const client = this.clients.get(targetChainId)
    if (!client) {
      throw new Error(`No viem client for chain ${targetChainId}`)
    }

    const roundData = await client.readContract({
      address: feedAddress as `0x${string}`,
      abi: this.getNativeTokenPriceOracleAggregatorAbi(),
      functionName: 'latestRoundData',
    } as any)

    const roundDataTuple = roundData as [bigint, bigint, bigint, bigint, bigint]
    const [, answer, , updatedAt] = roundDataTuple
    const asNum = Number(answer)
    if (!Number.isFinite(asNum) || asNum <= 0) {
      throw new Error('chainlink_feed_zero_or_invalid')
    }

    // Chainlink USD feeds use 8 decimals
    const price = (asNum / 1e8).toFixed(8)
    const timestamp = Number(updatedAt) * 1000
    const maxAge = options?.maxAgeMs ?? 60 * 60 * 1000
    const priceAge = Date.now() - timestamp
    if (priceAge > maxAge) {
      throw new Error('chainlink_feed_stale')
    }

    return {
      price,
      timestamp,
      source: 'chainlink',
      confidence: 0.9,
      chainId: targetChainId,
      tokenDecimals: 8,
    }
  }

  /**
   * Expose cache detail/stats for inspector/debug.
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; expiresAt: number; source: string; chainId: number }>;
    chainsConfigured: number[];
  } {
    const entries = Array.from(this.priceCache.entries()).map(([key, cached]) => ({
      key,
      expiresAt: cached.expiresAt,
      source: cached.data.source,
      chainId: cached.chainId,
    }));

    return {
      size: this.priceCache.size,
      entries,
      chainsConfigured: Array.from(this.clients.keys()),
    };
  }
}

// Export singleton instance for global/facade use across application/server context.
// TODO: For Next.js 16+ app routers or React19 RSC, export a context provider for request-bound instance (see use() and createContext pattern).
export const nativeTokenPriceOracleService = NativeTokenPriceOracleService.getInstance();
