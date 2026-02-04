import { logger } from '@/lib/logger';
import { createPublicClient, http, formatUnits, type PublicClient, type Chain } from 'viem';
import { polygon, mainnet, arbitrum, optimism, base } from 'viem/chains';

/**
 * Multi-chain price data interface
 */
export interface PriceData {
  price: string;
  timestamp: number;
  source: string;
  confidence: number; // 0-1 confidence score
  chainId?: number; // Which chain this price came from
}

/**
 * Chain-specific oracle configuration
 */
interface ChainOracleConfig {
  chainlink: {
    enabled: boolean;
    feedAddress?: string;
    aggregatorAbi?: any[];
  };
  fallbacks: {
    enabled: boolean;
    coingecko: boolean;
    coinmarketcap: boolean;
    binance: boolean;
  };
}

/**
 * Multi-chain price oracle configuration
 */
interface PriceOracleConfig {
  chains: Record<number, ChainOracleConfig>; // chainId -> config
  defaultChain: number; // Default chain for RING/USD price
  fallbacks: {
    coingecko: boolean;
    coinmarketcap: boolean;
    binance: boolean;
  };
  cache: {
    enabled: boolean;
    ttl: number; // Time to live in seconds
  };
}

/**
 * Cached price entry with chain awareness
 */
interface CachedPrice {
  data: PriceData;
  expiresAt: number;
  chainId: number;
}

/**
 * Multi-Chain Price Oracle Service (Recaster)
 * Provides decentralized price feeds across multiple blockchains
 * Designed for Ring-powered projects with ErlangOTP scalability in mind
 */
export class PriceOracleService {
  private static instance: PriceOracleService;
  private config: PriceOracleConfig;
  private clients: Map<number, PublicClient> = new Map(); // chainId -> viem client
  private priceCache: Map<string, CachedPrice> = new Map();

  private constructor(config?: Partial<PriceOracleConfig>) {
    // Multi-chain configuration for different networks
    const defaultChains: Record<number, ChainOracleConfig> = {
      // Polygon (primary for RING)
      137: {
        chainlink: {
          enabled: !!process.env.POLYGON_CHAINLINK_RING_USD_FEED,
          feedAddress: process.env.POLYGON_CHAINLINK_RING_USD_FEED,
          aggregatorAbi: this.getAggregatorAbi(),
        },
        fallbacks: {
          enabled: true,
          coingecko: true,
          coinmarketcap: !!process.env.COINMARKETCAP_API_KEY,
          binance: true,
        },
      },
      // Ethereum
      1: {
        chainlink: {
          enabled: !!process.env.ETHEREUM_CHAINLINK_RING_USD_FEED,
          feedAddress: process.env.ETHEREUM_CHAINLINK_RING_USD_FEED,
          aggregatorAbi: this.getAggregatorAbi(),
        },
        fallbacks: {
          enabled: true,
          coingecko: true,
          coinmarketcap: !!process.env.COINMARKETCAP_API_KEY,
          binance: true,
        },
      },
      // Arbitrum
      42161: {
        chainlink: {
          enabled: !!process.env.ARBITRUM_CHAINLINK_RING_USD_FEED,
          feedAddress: process.env.ARBITRUM_CHAINLINK_RING_USD_FEED,
          aggregatorAbi: this.getAggregatorAbi(),
        },
        fallbacks: {
          enabled: false, // Limited fallbacks for L2
          coingecko: true,
          coinmarketcap: false,
          binance: false,
        },
      },
      // Optimism
      10: {
        chainlink: {
          enabled: !!process.env.OPTIMISM_CHAINLINK_RING_USD_FEED,
          feedAddress: process.env.OPTIMISM_CHAINLINK_RING_USD_FEED,
          aggregatorAbi: this.getAggregatorAbi(),
        },
        fallbacks: {
          enabled: false,
          coingecko: true,
          coinmarketcap: false,
          binance: false,
        },
      },
      // Base
      8453: {
        chainlink: {
          enabled: !!process.env.BASE_CHAINLINK_RING_USD_FEED,
          feedAddress: process.env.BASE_CHAINLINK_RING_USD_FEED,
          aggregatorAbi: this.getAggregatorAbi(),
        },
        fallbacks: {
          enabled: false,
          coingecko: true,
          coinmarketcap: false,
          binance: false,
        },
      },
    };

    this.config = {
      chains: defaultChains,
      defaultChain: 137, // Polygon as default
      fallbacks: {
        coingecko: true,
        coinmarketcap: !!process.env.COINMARKETCAP_API_KEY,
        binance: true,
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes default TTL
      },
      ...config,
    };

    // Initialize viem clients for configured chains
    this.initializeClients();
  }

  static getInstance(config?: Partial<PriceOracleConfig>): PriceOracleService {
    if (!PriceOracleService.instance) {
      PriceOracleService.instance = new PriceOracleService(config);
    }
    return PriceOracleService.instance;
  }

  /**
   * Get Chainlink aggregator ABI
   */
  private getAggregatorAbi() {
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
   * Initialize viem clients for configured chains
   */
  private initializeClients() {
    const chainConfigs: Record<number, Chain> = {
      1: mainnet,
      137: polygon,
      42161: arbitrum,
      10: optimism,
      8453: base,
    };

    for (const [chainId, chainConfig] of Object.entries(this.config.chains)) {
      const chain = chainConfigs[parseInt(chainId)];
      if (chain && chainConfig.chainlink.enabled) {
        const rpcUrl = this.getChainRpcUrl(parseInt(chainId));
        const client = createPublicClient({
          chain,
          transport: http(rpcUrl),
        }) as any;
        this.clients.set(parseInt(chainId), client);
        logger.info(`Initialized price oracle client for chain ${chainId}`, { chain: chain.name });
      }
    }
  }

  /**
   * Get RPC URL for a specific chain
   */
  private getChainRpcUrl(chainId: number): string {
    const rpcUrls: Record<number, string> = {
      1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      8453: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    };
    return rpcUrls[chainId] || 'https://polygon-rpc.com';
  }

  /**
   * Get current RING/USD price with multi-chain fallback sources
   */
  async getRingUsdPrice(chainId?: number): Promise<PriceData> {
    const targetChain = chainId || this.config.defaultChain;
    const cacheKey = `RING_USD_${targetChain}`;

    // Check cache first
    if (this.config.cache.enabled) {
      const cached = this.getCachedPrice(cacheKey, targetChain);
      if (cached) {
        logger.info('Returning cached RING price', { price: cached.price, source: cached.source, chainId: targetChain });
        return cached;
      }
    }

    // Try primary source (Chainlink) for the specified chain
    let priceData: PriceData | null = null;
    const chainConfig = this.config.chains[targetChain];

    if (chainConfig?.chainlink.enabled) {
      try {
        priceData = await this.getChainlinkPrice(targetChain);
        if (priceData) {
          logger.info('Got RING price from Chainlink', { price: priceData.price, chainId: targetChain });
        }
      } catch (error) {
        logger.warn('Chainlink price fetch failed', { error, chainId: targetChain });
      }
    }

    // Try fallback sources if primary failed
    if (!priceData) {
      priceData = await this.getFallbackPrice();
    }

    // If still no price, try other chains
    if (!priceData && chainId === undefined) {
      for (const [otherChainId, otherConfig] of Object.entries(this.config.chains)) {
        if (parseInt(otherChainId) !== targetChain && otherConfig.chainlink.enabled) {
          try {
            priceData = await this.getChainlinkPrice(parseInt(otherChainId));
            if (priceData) {
              logger.info('Got RING price from alternative chain', {
                price: priceData.price,
                originalChain: targetChain,
                fallbackChain: otherChainId
              });
              break;
            }
          } catch (error) {
            // Continue to next chain
          }
        }
      }
    }

    // If still no price, use default/last known price
    if (!priceData) {
      logger.error('All price sources failed, using default price', { chainId: targetChain });
      priceData = {
        price: '1.00', // Default $1 USD per RING
        timestamp: Date.now(),
        source: 'default',
        confidence: 0.1,
        chainId: targetChain,
      };
    }

    // Cache the result
    if (this.config.cache.enabled && priceData.confidence > 0.5) {
      this.setCachedPrice(cacheKey, priceData, targetChain);
    }

    return priceData;
  }

  /**
   * Convert RING amount to USD
   */
  async convertRingToUsd(ringAmount: string): Promise<{
    usd_amount: string;
    ring_amount: string;
    rate: string;
    timestamp: number;
    confidence: number;
  }> {
    const priceData = await this.getRingUsdPrice();
    const ringValue = parseFloat(ringAmount);
    const rate = parseFloat(priceData.price);
    const usdValue = (ringValue * rate).toFixed(6);

    logger.info('Converted RING to USD', { 
      ringAmount, 
      usdAmount: usdValue, 
      rate: priceData.price,
      source: priceData.source 
    });

    return {
      usd_amount: usdValue,
      ring_amount: ringAmount,
      rate: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
    };
  }

  /**
   * Convert USD amount to RING
   */
  async convertUsdToRing(usdAmount: string): Promise<{
    ring_amount: string;
    usd_amount: string;
    rate: string;
    timestamp: number;
    confidence: number;
  }> {
    const priceData = await this.getRingUsdPrice();
    const usdValue = parseFloat(usdAmount);
    const rate = parseFloat(priceData.price);
    const ringValue = (usdValue / rate).toFixed(6);

    logger.info('Converted USD to RING', { 
      usdAmount, 
      ringAmount: ringValue, 
      rate: priceData.price,
      source: priceData.source 
    });

    return {
      ring_amount: ringValue,
      usd_amount: usdAmount,
      rate: priceData.price,
      timestamp: priceData.timestamp,
      confidence: priceData.confidence,
    };
  }

  /**
   * Get historical prices for a date range
   */
  async getHistoricalPrices(
    startDate: Date,
    endDate: Date,
    interval: 'hourly' | 'daily' = 'daily'
  ): Promise<PriceData[]> {
    // TODO: Implement historical price fetching
    // This would typically require specialized APIs like CoinGecko Pro
    logger.info('Historical price request (not implemented)', { startDate, endDate, interval });
    
    return [];
  }

  /**
   * Get price from Chainlink oracle for specific chain
   */
  private async getChainlinkPrice(chainId: number): Promise<PriceData | null> {
    const chainConfig = this.config.chains[chainId];
    if (!chainConfig?.chainlink.enabled || !chainConfig.chainlink.feedAddress) {
      return null;
    }

    const client = this.clients.get(chainId);
    if (!client) {
      logger.warn('No viem client available for chain', { chainId });
      return null;
    }

    try {
      const roundData = await client.readContract({
        address: chainConfig.chainlink.feedAddress as `0x${string}`,
        abi: chainConfig.chainlink.aggregatorAbi || this.getAggregatorAbi(),
        functionName: 'latestRoundData',
      } as any);

      // Extract values from tuple return: [roundId, answer, startedAt, updatedAt, answeredInRound]
      const roundDataTuple = roundData as any[];
      const [, answer, , updatedAt] = roundDataTuple as [bigint, bigint, bigint, bigint, bigint];

      // Chainlink prices are typically with 8 decimals
      const price = (Number(answer) / 1e8).toFixed(6);
      const timestamp = Number(updatedAt) * 1000;

      // Check if price is fresh (within last hour)
      const priceAge = Date.now() - timestamp;
      const maxAge = 60 * 60 * 1000; // 1 hour
      const confidence = priceAge < maxAge ? 0.9 : 0.7;

      return {
        price,
        timestamp,
        source: 'chainlink',
        confidence,
        chainId,
      };

    } catch (error) {
      logger.error('Chainlink price fetch failed', { error, chainId });
      return null;
    }
  }

  /**
   * Get price from fallback sources
   */
  private async getFallbackPrice(): Promise<PriceData | null> {
    // Try CoinGecko first
    if (this.config.fallbacks.coingecko) {
      try {
        const coingeckoPrice = await this.getCoinGeckoPrice();
        if (coingeckoPrice) return coingeckoPrice;
      } catch (error) {
        logger.warn('CoinGecko price fetch failed', { error });
      }
    }

    // Try CoinMarketCap
    if (this.config.fallbacks.coinmarketcap) {
      try {
        const cmcPrice = await this.getCoinMarketCapPrice();
        if (cmcPrice) return cmcPrice;
      } catch (error) {
        logger.warn('CoinMarketCap price fetch failed', { error });
      }
    }

    // Try Binance
    if (this.config.fallbacks.binance) {
      try {
        const binancePrice = await this.getBinancePrice();
        if (binancePrice) return binancePrice;
      } catch (error) {
        logger.warn('Binance price fetch failed', { error });
      }
    }

    return null;
  }

  /**
   * Get price from CoinGecko
   */
  private async getCoinGeckoPrice(): Promise<PriceData | null> {
    try {
      // Note: CoinGecko might not have RING token yet
      // This is a placeholder implementation
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ring-token&vs_currencies=usd&include_last_updated_at=true',
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
      
      if (data['ring-token']?.usd) {
        return {
          price: data['ring-token'].usd.toString(),
          timestamp: data['ring-token'].last_updated_at * 1000,
          source: 'coingecko',
          confidence: 0.8,
        };
      }

      return null;
    } catch (error) {
      logger.error('CoinGecko API call failed', { error });
      return null;
    }
  }

  /**
   * Get price from CoinMarketCap
   */
  private async getCoinMarketCapPrice(): Promise<PriceData | null> {
    const apiKey = process.env.COINMARKETCAP_API_KEY;
    if (!apiKey) return null;

    try {
      // Note: CoinMarketCap might not have RING token yet
      // This is a placeholder implementation
      const response = await fetch(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=RING',
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
      
      if (data.data?.RING?.quote?.USD?.price) {
        return {
          price: data.data.RING.quote.USD.price.toString(),
          timestamp: new Date(data.data.RING.quote.USD.last_updated).getTime(),
          source: 'coinmarketcap',
          confidence: 0.8,
        };
      }

      return null;
    } catch (error) {
      logger.error('CoinMarketCap API call failed', { error });
      return null;
    }
  }

  /**
   * Get price from Binance
   */
  private async getBinancePrice(): Promise<PriceData | null> {
    try {
      // Note: Binance might not have RING token yet
      // This is a placeholder for RING/USDT pair
      const response = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=RINGUSDT'
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
        };
      }

      return null;
    } catch (error) {
      logger.error('Binance API call failed', { error });
      return null;
    }
  }

  /**
   * Get cached price if still valid (with chain awareness)
   */
  private getCachedPrice(key: string, chainId: number): PriceData | null {
    const cached = this.priceCache.get(key);
    if (!cached || cached.chainId !== chainId) return null;

    if (Date.now() > cached.expiresAt) {
      this.priceCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached price with TTL (with chain awareness)
   */
  private setCachedPrice(key: string, data: PriceData, chainId: number): void {
    this.priceCache.set(key, {
      data,
      expiresAt: Date.now() + (this.config.cache.ttl * 1000),
      chainId,
    });
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price oracle cache cleared');
  }

  /**
   * Get price for a specific chain (for Ring-powered projects)
   */
  async getPriceForChain(chainId: number, tokenSymbol: string = 'RING'): Promise<PriceData> {
    const cacheKey = `${tokenSymbol}_USD_${chainId}`;

    // Check cache first
    if (this.config.cache.enabled) {
      const cached = this.getCachedPrice(cacheKey, chainId);
      if (cached) {
        return cached;
      }
    }

    // For now, only support RING token across chains
    if (tokenSymbol !== 'RING') {
      throw new Error(`Token ${tokenSymbol} not supported. Only RING is currently supported.`);
    }

    return await this.getRingUsdPrice(chainId);
  }

  /**
   * Get prices across all configured chains (for Ring-powered projects)
   */
  async getMultiChainPrices(tokenSymbol: string = 'RING'): Promise<Record<number, PriceData>> {
    const results: Record<number, PriceData> = {};

    for (const [chainIdStr, chainConfig] of Object.entries(this.config.chains)) {
      const chainId = parseInt(chainIdStr);
      try {
        if (chainConfig.chainlink.enabled || chainConfig.fallbacks.enabled) {
          const priceData = await this.getPriceForChain(chainId, tokenSymbol);
          results[chainId] = priceData;
        }
      } catch (error) {
        logger.warn(`Failed to get price for chain ${chainId}`, { error });
        // Continue with other chains
      }
    }

    return results;
  }

  /**
   * Get best price across all chains (highest confidence, then lowest latency)
   */
  async getBestPrice(tokenSymbol: string = 'RING'): Promise<PriceData & { chainId: number }> {
    const multiChainPrices = await this.getMultiChainPrices(tokenSymbol);

    let bestPrice: (PriceData & { chainId: number }) | null = null;

    for (const [chainId, priceData] of Object.entries(multiChainPrices)) {
      if (!bestPrice ||
          priceData.confidence > bestPrice.confidence ||
          (priceData.confidence === bestPrice.confidence &&
           Date.now() - priceData.timestamp < Date.now() - bestPrice.timestamp)) {
        bestPrice = { ...priceData, chainId: parseInt(chainId) };
      }
    }

    if (!bestPrice) {
      throw new Error(`No price data available for ${tokenSymbol}`);
    }

    return bestPrice;
  }

  /**
   * Get cache statistics with chain awareness
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

// Export singleton instance
export const priceOracleService = PriceOracleService.getInstance();
