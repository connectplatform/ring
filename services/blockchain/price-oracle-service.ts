import { ethers } from 'ethers';
import { logger } from '@/lib/logger';

/**
 * Price data interface
 */
export interface PriceData {
  price: string;
  timestamp: number;
  source: string;
  confidence: number; // 0-1 confidence score
}

/**
 * Price oracle configuration
 */
interface PriceOracleConfig {
  chainlink: {
    enabled: boolean;
    feedAddress?: string;
    provider?: ethers.Provider;
  };
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
 * Cached price entry
 */
interface CachedPrice {
  data: PriceData;
  expiresAt: number;
}

/**
 * Service for fetching RING token price from various oracle sources
 */
export class PriceOracleService {
  private static instance: PriceOracleService;
  private config: PriceOracleConfig;
  private priceCache: Map<string, CachedPrice> = new Map();
  private provider?: ethers.Provider;

  private constructor(config?: Partial<PriceOracleConfig>) {
    this.config = {
      chainlink: {
        enabled: !!process.env.CHAINLINK_RING_USD_FEED,
        feedAddress: process.env.CHAINLINK_RING_USD_FEED,
      },
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

    // Initialize blockchain provider if needed
    if (this.config.chainlink.enabled) {
      this.initializeProvider();
    }
  }

  static getInstance(config?: Partial<PriceOracleConfig>): PriceOracleService {
    if (!PriceOracleService.instance) {
      PriceOracleService.instance = new PriceOracleService(config);
    }
    return PriceOracleService.instance;
  }

  /**
   * Get current RING/USD price with fallback sources
   */
  async getRingUsdPrice(): Promise<PriceData> {
    const cacheKey = 'RING_USD';
    
    // Check cache first
    if (this.config.cache.enabled) {
      const cached = this.getCachedPrice(cacheKey);
      if (cached) {
        logger.info('Returning cached RING price', { price: cached.price, source: cached.source });
        return cached;
      }
    }

    // Try primary source (Chainlink)
    let priceData: PriceData | null = null;

    if (this.config.chainlink.enabled) {
      try {
        priceData = await this.getChainlinkPrice();
        if (priceData) {
          logger.info('Got RING price from Chainlink', { price: priceData.price });
        }
      } catch (error) {
        logger.warn('Chainlink price fetch failed', { error });
      }
    }

    // Try fallback sources if primary failed
    if (!priceData) {
      priceData = await this.getFallbackPrice();
    }

    // If still no price, use default/last known price
    if (!priceData) {
      logger.error('All price sources failed, using default price');
      priceData = {
        price: '1.00', // Default $1 USD per RING
        timestamp: Date.now(),
        source: 'default',
        confidence: 0.1,
      };
    }

    // Cache the result
    if (this.config.cache.enabled && priceData.confidence > 0.5) {
      this.setCachedPrice(cacheKey, priceData);
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
   * Initialize blockchain provider for Chainlink
   */
  private initializeProvider() {
    try {
      const rpcUrl = process.env.POLYGON_RPC_URL;
      if (!rpcUrl) {
        logger.warn('No Polygon RPC URL configured for price oracle');
        return;
      }

      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      logger.info('Initialized blockchain provider for price oracle');
    } catch (error) {
      logger.error('Failed to initialize blockchain provider', { error });
    }
  }

  /**
   * Get price from Chainlink oracle
   */
  private async getChainlinkPrice(): Promise<PriceData | null> {
    if (!this.provider || !this.config.chainlink.feedAddress) {
      return null;
    }

    try {
      // Chainlink Price Feed ABI (minimal)
      const aggregatorV3InterfaceABI = [
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

      const priceFeed = new ethers.Contract(
        this.config.chainlink.feedAddress,
        aggregatorV3InterfaceABI,
        this.provider
      );

      const roundData = await priceFeed.latestRoundData();
      
      // Chainlink prices are typically with 8 decimals
      const price = (roundData.answer.toNumber() / 1e8).toFixed(6);
      const timestamp = roundData.updatedAt.toNumber() * 1000;
      
      // Check if price is fresh (within last hour)
      const priceAge = Date.now() - timestamp;
      const maxAge = 60 * 60 * 1000; // 1 hour
      const confidence = priceAge < maxAge ? 0.9 : 0.7;

      return {
        price,
        timestamp,
        source: 'chainlink',
        confidence,
      };

    } catch (error) {
      logger.error('Chainlink price fetch failed', { error });
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
   * Get cached price if still valid
   */
  private getCachedPrice(key: string): PriceData | null {
    const cached = this.priceCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.priceCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cached price with TTL
   */
  private setCachedPrice(key: string, data: PriceData): void {
    this.priceCache.set(key, {
      data,
      expiresAt: Date.now() + (this.config.cache.ttl * 1000),
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
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ key: string; expiresAt: number; source: string }>;
  } {
    const entries = Array.from(this.priceCache.entries()).map(([key, cached]) => ({
      key,
      expiresAt: cached.expiresAt,
      source: cached.data.source,
    }));

    return {
      size: this.priceCache.size,
      entries,
    };
  }
}

// Export singleton instance
export const priceOracleService = PriceOracleService.getInstance();
