import { Metadata } from 'next';

/**
 * Standard page props interface for Next.js 15 pages
 * Contains the async params and searchParams properties
 */
export interface PageProps<P = { [key: string]: string }> {
  params: Promise<P>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Type for resolved page params after awaiting the promise
 */
export type ResolvedParams<P = { [key: string]: string }> = P;

/**
 * Type for resolved search params after awaiting the promise
 */
export type ResolvedSearchParams = { [key: string]: string | string[] | undefined };

/**
 * Props for route handlers with dynamic parameters
 */
export interface RouteHandlerProps<P = { [key: string]: string }> {
    params: Promise<P>;
  }
  
/**
 * Props for metadata generation functions
 */
export interface MetadataProps<P = { [key: string]: string }> {
  params: Promise<P>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Type for the generateMetadata function
 */
export type GenerateMetadataFn<P = { [key: string]: string }> = (props: MetadataProps<P>) => Promise<Metadata>;