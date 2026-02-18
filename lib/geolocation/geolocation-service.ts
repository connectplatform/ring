/**
 * Ring Platform - PostGIS Geolocation Service
 * 
 * Provides high-performance geospatial queries using PostGIS for location-based features.
 * Reverse-propagated from ring-pet-friendly (2026-02-17) with generalized filter patterns.
 * 
 * Target Performance: <100ms p95 latency for nearby searches
 * 
 * Use Cases:
 * - Store delivery radius validation (delivery_location field already exists!)
 * - Entity location listings (find companies/organizations nearby)
 * - Opportunity locations (job sites, volunteer venues)
 * - Event/meetup venues
 * - Real estate listings
 * - Restaurant/cafe finders
 * - Any location-based Ring clone
 * 
 * Filter Pattern (Generic):
 * Use `filters?: Record<string, any>` for domain-specific queries.
 * 
 * Examples:
 * - Pet-friendly: { allows_dogs: true, allows_cats: true }
 * - Real estate: { property_type: 'apartment', bedrooms: 2 }
 * - Restaurants: { cuisine: 'italian', has_outdoor_seating: true }
 * - Events: { category: 'tech', is_free: true }
 * 
 * @note PostGIS requires raw SQL - this service uses PostgreSQL connection directly
 * @requires DB_BACKEND_MODE=k8s-postgres-fcm or supabase-fcm (PostgreSQL-based modes)
 * 
 * @see data/schema.sql for PostGIS extensions (lines 13-23)
 * @see types/geolocation.ts for type definitions
 */

import { Pool } from 'pg';
import type { 
  GeolocationPoint,
  NearbySearchParams,
  NearbyResult
} from '@/types/geolocation';

// PostgreSQL connection pool for raw SQL queries (PostGIS)
let pgPool: Pool | null = null;

function getPostgreSQLPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ring_platform',
      user: process.env.DB_USER || 'ring_user',
      password: process.env.DB_PASSWORD || '',
      max: 20, // Connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pgPool;
}

// ============================================================================
// GEOLOCATION SERVICE
// ============================================================================

export class GeolocationService {
  private pool: Pool;

  constructor() {
    this.pool = getPostgreSQLPool();
  }

  /**
   * Execute raw SQL query with PostGIS functions
   * @private
   */
  private async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      console.error('PostGIS query error:', error);
      throw error;
    }
  }

  /**
   * Find nearby locations within radius (GENERALIZED - works with ANY table with GEOGRAPHY column)
   * 
   * @param tableName - Table with location GEOGRAPHY column (e.g., 'entities', 'opportunities', 'store_products')
   * @param params - Search parameters (location, radius, filters)
   * @returns Array of locations with distance in meters
   * 
   * Performance: <100ms p95 with GIST spatial index
   * 
   * @example Pet-friendly places:
   * const nearby = await geoService.findNearbyLocations('places', {
   *   location: { latitude: 40.7484, longitude: -73.9857 },
   *   radius_meters: 5000,
   *   filters: { allows_dogs: true, place_type: 'cafe' },
   *   limit: 50
   * });
   * 
   * @example Real estate:
   * const properties = await geoService.findNearbyLocations('properties', {
   *   location: { latitude: 40.7484, longitude: -73.9857 },
   *   radius_meters: 10000,
   *   filters: { property_type: 'apartment', bedrooms: 2 },
   *   limit: 20
   * });
   * 
   * @example Restaurants:
   * const restaurants = await geoService.findNearbyLocations('restaurants', {
   *   location: { latitude: 40.7484, longitude: -73.9857 },
   *   radius_meters: 3000,
   *   filters: { cuisine: 'italian', has_outdoor_seating: true },
   *   limit: 30
   * });
   */
  async findNearbyLocations(tableName: string, params: NearbySearchParams): Promise<NearbyResult[]> {
    const { location, radius_meters, filters = {}, limit = 50 } = params;
    
    // Build WHERE conditions
    const conditions: string[] = [
      'deleted_at IS NULL',
      `ST_DWithin(
        location::geography,
        ST_MakePoint($1, $2)::geography,
        $3
      )`
    ];
    
    const queryParams: any[] = [location.longitude, location.latitude, radius_meters];
    let paramIndex = 4;
    
    // Apply generic filters from JSONB data column
    // Supports: string, number, boolean filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      
      if (typeof value === 'boolean') {
        conditions.push(`(data->>'${key}')::boolean = $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      } else if (typeof value === 'number') {
        conditions.push(`(data->>'${key}')::numeric = $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      } else if (typeof value === 'string') {
        conditions.push(`data->>'${key}' = $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      } else if (Array.isArray(value)) {
        // Array filter: data->'key' ?| array (JSONB containment)
        conditions.push(`data->'${key}' ?| $${paramIndex}`);
        queryParams.push(value);
        paramIndex++;
      }
    }
    
    const query = `
      SELECT 
        id,
        ST_AsText(location) as location_wkt,
        latitude,
        longitude,
        data,
        created_at,
        updated_at,
        ST_Distance(
          location::geography,
          ST_MakePoint($1, $2)::geography
        ) as distance_meters
      FROM ${tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY distance_meters ASC
      LIMIT $${paramIndex}
    `;
    
    queryParams.push(limit);
    
    const rows = await this.executeQuery(query, queryParams);
    
    return rows.map((row: any) => ({
      id: row.id,
      location: row.location_wkt,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      data: row.data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      distance_meters: parseFloat(row.distance_meters)
    }));
  }

  /**
   * LEGACY METHOD - For backward compatibility with ring-pet-friendly
   * Use findNearbyLocations('places', params) instead
   * 
   * @deprecated Use findNearbyLocations('places', params) for generic usage
   */
  async findNearbyPlaces(params: NearbySearchParams): Promise<NearbyResult[]> {
    return this.findNearbyLocations('places', params);
  }

  /**
   * Find nearby events/meetups within radius (GENERALIZED)
   * 
   * @param tableName - Table with location column (e.g., 'meetups', 'events', 'venues')
   * @param location - User location
   * @param radius_meters - Search radius in meters
   * @param filters - Generic filters applied to JSONB data column
   * @returns Array of events with distance
   * 
   * @example Events:
   * const events = await geoService.findNearbyEvents('events', location, 5000, {
   *   category: 'tech',
   *   is_free: true,
   *   start_after: new Date()
   * });
   * 
   * @example Pet meetups:
   * const meetups = await geoService.findNearbyEvents('meetups', location, 3000, {
   *   allowed_pet_types: ['dog', 'cat'],
   *   is_public: true
   * });
   */
  async findNearbyEvents(
    tableName: string,
    location: GeolocationPoint,
    radius_meters: number,
    filters?: Record<string, any>,
    limit: number = 50
  ): Promise<NearbyResult[]> {
    const conditions: string[] = [
      'deleted_at IS NULL',
      `ST_DWithin(
        location::geography,
        ST_MakePoint($1, $2)::geography,
        $3
      )`
    ];
    
    const queryParams: any[] = [location.longitude, location.latitude, radius_meters];
    let paramIndex = 4;
    
    // Apply generic filters from JSONB data column
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined) continue;
        
        if (typeof value === 'boolean') {
          conditions.push(`(data->>'${key}')::boolean = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        } else if (typeof value === 'number') {
          conditions.push(`(data->>'${key}')::numeric = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        } else if (typeof value === 'string') {
          conditions.push(`data->>'${key}' = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        } else if (Array.isArray(value)) {
          // Array containment: data->'key' ?| array
          conditions.push(`data->'${key}' ?| $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        } else if (value instanceof Date) {
          // Date comparison (assuming timestamp column)
          const columnName = key; // e.g., 'start_time', 'created_at'
          conditions.push(`${columnName} > $${paramIndex}`);
          queryParams.push(value.toISOString());
          paramIndex++;
        }
      }
    }
    
    const query = `
      SELECT 
        *,
        ST_AsText(location) as location_wkt,
        ST_Distance(
          location::geography,
          ST_MakePoint($1, $2)::geography
        ) as distance_meters
      FROM ${tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY distance_meters ASC
      LIMIT $${paramIndex}
    `;
    
    queryParams.push(limit);
    
    const rows = await this.executeQuery(query, queryParams);
    
    return rows.map((row: any) => ({
      id: row.id,
      location: row.location_wkt,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      data: row.data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      distance_meters: parseFloat(row.distance_meters),
      ...row // Include all other table-specific columns
    }));
  }

  /**
   * LEGACY METHOD - For backward compatibility with ring-pet-friendly
   * Use findNearbyEvents('meetups', location, radius, filters) instead
   * 
   * @deprecated Use findNearbyEvents for generic usage
   */
  async findNearbyMeetups(
    location: GeolocationPoint,
    radius_meters: number,
    filters?: Record<string, any>
  ): Promise<NearbyResult[]> {
    return this.findNearbyEvents('meetups', location, radius_meters, filters);
  }

  /**
   * Calculate distance between two points
   * 
   * @param point1 - First location
   * @param point2 - Second location
   * @returns Distance in meters
   */
  async calculateDistance(point1: GeolocationPoint, point2: GeolocationPoint): Promise<number> {
    const query = `
      SELECT ST_Distance(
        ST_MakePoint($1, $2)::geography,
        ST_MakePoint($3, $4)::geography
      ) as distance_meters
    `;
    
    const rows = await this.executeQuery<{ distance_meters: string }>(query, [
      point1.longitude,
      point1.latitude,
      point2.longitude,
      point2.latitude
    ]);
    
    if (rows.length === 0) {
      return 0;
    }
    
    return parseFloat(rows[0].distance_meters);
  }

  /**
   * Validate if delivery location is within entity's delivery radius
   * 
   * Works with ANY table that has:
   * - location GEOGRAPHY column
   * - data->>'delivery_radius_meters' field
   * 
   * @param tableName - Table name (e.g., 'entities', 'places', 'stores')
   * @param entityId - Entity/place/store ID
   * @param deliveryLocation - Customer delivery location
   * @returns Validation result with distance info
   * 
   * @example Store delivery validation:
   * const result = await geoService.isWithinDeliveryRadius(
   *   'entities',
   *   storeId,
   *   { latitude: 40.7484, longitude: -73.9857 }
   * );
   * if (result.valid) {
   *   // Process delivery
   * }
   */
  async isWithinDeliveryRadius(
    tableName: string,
    entityId: string,
    deliveryLocation: GeolocationPoint
  ): Promise<{ valid: boolean; distance_meters?: number; max_radius_meters?: number }> {
    const query = `
      SELECT 
        id,
        latitude,
        longitude,
        data->>'delivery_radius_meters' as delivery_radius,
        ST_Distance(
          location::geography,
          ST_MakePoint($1, $2)::geography
        ) as distance_meters
      FROM ${tableName}
      WHERE id = $3
        AND deleted_at IS NULL
    `;
    
    const rows = await this.executeQuery<any>(query, [
      deliveryLocation.longitude,
      deliveryLocation.latitude,
      entityId
    ]);
    
    if (rows.length === 0) {
      return { valid: false };
    }
    
    const entity = rows[0];
    const distance = parseFloat(entity.distance_meters);
    const maxRadius = entity.delivery_radius ? parseInt(entity.delivery_radius) : 10000; // Default 10km
    
    return {
      valid: distance <= maxRadius,
      distance_meters: distance,
      max_radius_meters: maxRadius
    };
  }

  /**
   * Get locations by bounding box (for map viewport rendering)
   * 
   * @param tableName - Table with location column
   * @param bounds - Map viewport bounds
   * @param filters - Optional filters applied to data column
   * @returns Locations within viewport
   * 
   * @example Map viewport query:
   * const visible = await geoService.getLocationsInBounds('entities', {
   *   north: 40.8,
   *   south: 40.7,
   *   east: -73.9,
   *   west: -74.0
   * }, { is_active: true, visible_on_map: true });
   */
  async getLocationsInBounds(
    tableName: string,
    bounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    },
    filters?: Record<string, any>
  ): Promise<NearbyResult[]> {
    const conditions: string[] = [
      'deleted_at IS NULL',
      `ST_Within(
        location::geography,
        ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
      )`
    ];
    
    const queryParams: any[] = [
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north
    ];
    let paramIndex = 5;
    
    // Apply generic filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value === null || value === undefined) continue;
        
        if (typeof value === 'boolean') {
          conditions.push(`(data->>'${key}')::boolean = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        } else if (typeof value === 'string') {
          conditions.push(`data->>'${key}' = $${paramIndex}`);
          queryParams.push(value);
          paramIndex++;
        }
      }
    }
    
    const query = `
      SELECT 
        *,
        ST_AsText(location) as location_wkt
      FROM ${tableName}
      WHERE ${conditions.join(' AND ')}
      LIMIT 200
    `;
    
    const rows = await this.executeQuery(query, queryParams);
    
    return rows.map((row: any) => ({
      id: row.id,
      location: row.location_wkt,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      data: row.data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...row // Include all table-specific columns
    }));
  }

  /**
   * LEGACY METHOD - For backward compatibility with ring-pet-friendly
   * Use getLocationsInBounds('places', bounds, filters) instead
   * 
   * @deprecated Use getLocationsInBounds for generic usage
   */
  async getPlacesInBounds(
    bounds: { north: number; south: number; east: number; west: number },
    filters?: Record<string, any>
  ): Promise<NearbyResult[]> {
    return this.getLocationsInBounds('places', bounds, filters);
  }

  /**
   * Geocode address to coordinates (requires Google Maps API)
   * 
   * @param address - Full address string
   * @returns GeolocationPoint or null
   */
  async geocodeAddress(address: string): Promise<GeolocationPoint | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return null;
    }
    
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return { latitude: lat, longitude: lng };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * 
   * @param location - GeolocationPoint
   * @returns Address object or null
   */
  async reverseGeocode(location: GeolocationPoint): Promise<{
    formatted_address: string;
    city?: string;
    country?: string;
  } | null> {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return null;
    }
    
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        
        // Extract city and country from address components
        const city = result.address_components.find((c: any) => 
          c.types.includes('locality')
        )?.long_name;
        
        const country = result.address_components.find((c: any) => 
          c.types.includes('country')
        )?.short_name; // ISO 3166-1 alpha-2
        
        return {
          formatted_address: result.formatted_address,
          city,
          country
        };
      }
      
      return null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  }
}

// Singleton instance
let geolocationService: GeolocationService | null = null;

/**
 * Get singleton GeolocationService instance
 * 
 * @returns GeolocationService instance
 * 
 * @example
 * import { getGeolocationService } from '@/lib/geolocation/geolocation-service';
 * 
 * const geoService = getGeolocationService();
 * const nearby = await geoService.findNearbyPlaces({
 *   location: { latitude: 40.7484, longitude: -73.9857 },
 *   radius_meters: 5000
 * });
 */
export function getGeolocationService(): GeolocationService {
  if (!geolocationService) {
    geolocationService = new GeolocationService();
  }
  return geolocationService;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles / 0.000621371;
}

/**
 * Convert meters to kilometers
 */
export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

/**
 * Convert kilometers to meters
 */
export function kilometersToMeters(km: number): number {
  return km * 1000;
}

/**
 * Format distance for display
 * 
 * @param meters - Distance in meters
 * @param locale - Display locale (en or uk)
 * @returns Formatted string (e.g., "2.5 km" or "0.8 mi")
 */
export function formatDistance(meters: number, locale: 'en' | 'uk' = 'en'): string {
  if (locale === 'uk') {
    // Ukraine uses metric
    if (meters < 1000) {
      return `${Math.round(meters)} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
  } else {
    // US uses imperial
    const miles = metersToMiles(meters);
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${miles.toFixed(1)} mi`;
  }
}

/**
 * Validate latitude/longitude coordinates
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Calculate radius options for nearby search UI
 */
export const RADIUS_OPTIONS = {
  en: [
    { value: 1609, label: '1 mile' },
    { value: 4828, label: '3 miles' },
    { value: 8047, label: '5 miles' },
    { value: 16093, label: '10 miles' },
    { value: 32187, label: '20 miles' },
  ],
  uk: [
    { value: 1000, label: '1 км' },
    { value: 3000, label: '3 км' },
    { value: 5000, label: '5 км' },
    { value: 10000, label: '10 км' },
    { value: 20000, label: '20 км' },
  ]
};

// ============================================================================
// EXPORTS
// ============================================================================
// Types are exported from @/types/geolocation
