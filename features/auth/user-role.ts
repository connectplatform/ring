/**
 * UserRole enum - MINIMAL EDGE-COMPATIBLE VERSION
 * 
 * This file contains ONLY the UserRole enum for edge runtime usage (middleware).
 * 
 * WHY THIS EXISTS:
 * - Middleware bundle was 4MB because it imported features/auth/types.ts (15KB, 567 lines)
 * - Middleware only needs UserRole enum (14 lines)
 * - Edge runtime bundles EVERYTHING imported, even if unused
 * 
 * USAGE:
 * - Middleware: import { UserRole } from '@/features/auth/user-role' 
 * - App code: import { UserRole, AuthUser, etc } from '@/features/auth/types'
 * 
 * Per Next.js 15 Specialist + TypeScript Performance Optimizer guidance:
 * - Extract minimal types for edge runtime
 * - Keep full types for server/client bundles
 * - Optimize bundle size through strategic imports
 */

export enum UserRole {
  VISITOR = 'visitor',
  SUBSCRIBER = 'subscriber',
  MEMBER = 'member',
  CONFIDENTIAL = 'confidential',
  ADMIN = 'admin',
  SUPERADMIN = 'superadmin'
}

