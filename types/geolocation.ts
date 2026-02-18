/**
 * Ring Platform - Geolocation Types
 * 
 * TypeScript interfaces for PostGIS-powered geolocation features
 * Reverse propagated from: ring-pet-friendly (2026-02-17)
 * 
 * @description
 * Generic geolocation types supporting ANY location-based Ring Platform feature:
 * - Store delivery radius validation
 * - Entity office/branch locations
 * - Event venue discovery
 * - Real estate listings
 * - Restaurant finders
 * - Service provider search
 * 
 * @requires
 * - PostgreSQL 15+ with PostGIS extension
 * - GEOGRAPHY columns in tables (CREATE EXTENSION postgis)
 * - GIST spatial indexes for <100ms query performance
 * 
 * @see lib/geolocation/geolocation-service.ts for service implementation
 * @see data/schema.sql for PostGIS extension setup
 * 
 * @example Basic Usage
 * ```typescript
 * import { GeolocationPoint, NearbySearchParams } from '@/types/geolocation';
 * import { GeolocationService } from '@/lib/geolocation/geolocation-service';
 * 
 * const service = new GeolocationService();
 * const userLocation: GeolocationPoint = { latitude: 50.4501, longitude: 30.5234 };
 * 
 * // Find nearby entities within 5km radius
 * const nearbyEntities = await service.findNearbyPlaces({
 *   location: userLocation,
 *   radius_meters: 5000,
 *   filters: {
 *     entity_type: 'restaurant',
 *     is_verified: true,
 *     rating_min: 4.0
 *   },
 *   limit: 50
 * });
 * ```
 */

// ============================================================================
// CORE GEOLOCATION TYPES
// ============================================================================

/**
 * Geographic point coordinates (WGS 84 / EPSG:4326)
 * 
 * @description
 * Standard latitude/longitude coordinates used globally.
 * Compatible with Google Maps, OpenStreetMap, and all major mapping services.
 * 
 * @property latitude - Decimal degrees, range: -90 to +90 (North/South)
 * @property longitude - Decimal degrees, range: -180 to +180 (East/West)
 * 
 * @example
 * const kyivCenter: GeolocationPoint = {
 *   latitude: 50.4501,
 *   longitude: 30.5234
 * };
 */
export interface GeolocationPoint {
  latitude: number;
  longitude: number;
}

// ============================================================================
// NEARBY SEARCH TYPES
// ============================================================================

/**
 * Parameters for nearby location search with PostGIS spatial queries
 * 
 * @description
 * Generic search parameters supporting ANY location-based feature in Ring Platform.
 * The `filters` object is intentionally flexible to accommodate different use cases.
 * 
 * @property location - Center point for radius search (user's current location)
 * @property radius_meters - Search radius in meters (e.g., 5000 = 5km)
 * @property filters - FLEXIBLE filters based on your table's JSONB data structure
 * @property limit - Maximum results to return (default: 50, max: 500)
 * 
 * @example Store Delivery Radius Search
 * ```typescript
 * const params: NearbySearchParams = {
 *   location: { latitude: 50.4501, longitude: 30.5234 },
 *   radius_meters: 10000, // 10km
 *   filters: {
 *     store_type: 'grocery',
 *     accepts_delivery: true,
 *     min_order_uah: 200
 *   },
 *   limit: 20
 * };
 * ```
 * 
 * @example Entity Office Locations
 * ```typescript
 * const params: NearbySearchParams = {
 *   location: userLocation,
 *   radius_meters: 50000, // 50km
 *   filters: {
 *     entity_type: 'coworking_space',
 *     has_parking: true,
 *     capacity_min: 10
 *   }
 * };
 * ```
 * 
 * @example Event Venues
 * ```typescript
 * const params: NearbySearchParams = {
 *   location: userLocation,
 *   radius_meters: 25000, // 25km
 *   filters: {
 *     venue_type: 'conference_hall',
 *     capacity_min: 100,
 *     has_projector: true,
 *     available_date: '2026-03-15'
 *   }
 * };
 * ```
 * 
 * @example Real Estate Listings
 * ```typescript
 * const params: NearbySearchParams = {
 *   location: { latitude: 50.4501, longitude: 30.5234 },
 *   radius_meters: 15000, // 15km
 *   filters: {
 *     property_type: 'apartment',
 *     bedrooms_min: 2,
 *     price_max_usd: 150000,
 *     has_parking: true
 *   }
 * };
 * ```
 * 
 * @filter_patterns
 * Common filter patterns across Ring Platform use cases:
 * 
 * Boolean filters:
 *   - is_verified, is_active, is_public, is_featured
 *   - has_parking, has_wifi, accepts_delivery
 * 
 * Enum/Category filters:
 *   - entity_type, place_type, venue_type, property_type
 *   - status: 'active' | 'inactive' | 'pending'
 * 
 * Numeric range filters:
 *   - price_min, price_max, rating_min, capacity_min
 *   - bedrooms_min, bathrooms_min, area_sqm_min
 * 
 * Date filters:
 *   - available_from, available_until, created_after
 * 
 * Array membership filters:
 *   - amenities: ['wifi', 'parking', 'ac']
 *   - tags: ['eco-friendly', 'pet-friendly']
 */
export interface NearbySearchParams {
  location: GeolocationPoint;
  radius_meters: number;
  filters?: Record<string, any>; // Flexible filters for any Ring Platform use case
  limit?: number;
}

/**
 * Base interface for nearby search results
 * 
 * @description
 * Extend your entity interface with this to add calculated distance field.
 * Distance is calculated on-demand during PostGIS query execution.
 * 
 * @property distance_meters - Calculated earth-surface distance from search center
 * 
 * @example
 * ```typescript
 * interface NearbyStore extends Store {
 *   distance_meters: number; // PostGIS ST_Distance result
 * }
 * 
 * const nearbyStores: NearbyStore[] = await service.findNearbyPlaces(...);
 * 
 * nearbyStores.forEach(store => {
 *   console.log(`${store.name} - ${(store.distance_meters / 1000).toFixed(1)}km away`);
 * });
 * ```
 */
export interface NearbyResult {
  distance_meters: number;
}

// ============================================================================
// GEOCODING TYPES (Google Maps API)
// ============================================================================

/**
 * Google Maps Geocoding API response structure
 * 
 * @description
 * Result from geocoding (address → coordinates) or reverse geocoding (coordinates → address).
 * Used for address validation, autocomplete, and location picker UIs.
 * 
 * @see https://developers.google.com/maps/documentation/geocoding/overview
 * 
 * @example Geocode Address
 * ```typescript
 * const result = await service.geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');
 * if (result) {
 *   const { latitude, longitude } = result.location;
 *   console.log(`Coordinates: ${latitude}, ${longitude}`);
 *   console.log(`Formatted: ${result.formatted_address}`);
 * }
 * ```
 */
export interface GeocodeResult {
  location: GeolocationPoint;
  formatted_address: string;
  place_id?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

// ============================================================================
// DELIVERY VALIDATION TYPES
// ============================================================================

/**
 * Result of delivery radius validation check
 * 
 * @description
 * Used by Store module to validate if delivery address is within vendor's service area.
 * Leverages PostGIS for accurate earth-surface distance calculation.
 * 
 * @property within_radius - Whether delivery location is within vendor's radius
 * @property distance_meters - Actual distance from vendor to delivery address
 * @property vendor_radius_meters - Vendor's configured delivery radius
 * 
 * @example
 * ```typescript
 * const validation = await service.isWithinDeliveryRadius('vendor_123', deliveryLocation);
 * 
 * if (!validation.within_radius) {
 *   const overage_km = (validation.distance_meters - validation.vendor_radius_meters) / 1000;
 *   throw new Error(`Delivery address is ${overage_km.toFixed(1)}km outside service area`);
 * }
 * ```
 */
export interface DeliveryRadiusCheck {
  within_radius: boolean;
  distance_meters: number;
  vendor_radius_meters: number;
}

// ============================================================================
// DISTANCE CALCULATION TYPES
// ============================================================================

/**
 * Options for distance calculation methods
 * 
 * @property method - Calculation method: 'haversine' (default) or 'postgis'
 * @property unit - Output unit: 'meters' (default), 'kilometers', 'miles'
 * 
 * @example
 * ```typescript
 * const distance = await service.calculateDistance(
 *   { latitude: 50.4501, longitude: 30.5234 }, // Kyiv
 *   { latitude: 49.8397, longitude: 24.0297 }, // Lviv
 *   { unit: 'kilometers' }
 * );
 * console.log(`Distance: ${distance.toFixed(1)}km`); // ~469km
 * ```
 */
export interface DistanceCalculationOptions {
  method?: 'haversine' | 'postgis';
  unit?: 'meters' | 'kilometers' | 'miles';
}

// ============================================================================
// EXPORTS
// ============================================================================
// All interfaces are already exported above with 'export interface' syntax
