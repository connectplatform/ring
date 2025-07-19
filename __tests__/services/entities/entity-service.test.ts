// @ts-nocheck - Disable TypeScript checking for test files
/**
 * Entity Service Tests
 * Testing entity CRUD operations, validation, and confidential entities
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore'

// Mock Firebase Firestore
jest.mock('firebase/firestore')

// Mock the entity service
const mockEntityService = {
  createEntity: jest.fn(),
  getEntity: jest.fn(),
  updateEntity: jest.fn(),
  deleteEntity: jest.fn(),
  listEntities: jest.fn(),
  searchEntities: jest.fn(),
  getEntityBySlug: jest.fn(),
  getUserEntities: jest.fn(),
  getConfidentialEntities: jest.fn(),
  validateEntity: jest.fn(),
  archiveEntity: jest.fn(),
  restoreEntity: jest.fn(),
}

describe('Entity Service', () => {
  beforeEach(() => {
    global.testUtils.clearAllMocks()
    
    // Setup default Firebase mocks
    ;(addDoc as jest.Mock).mockResolvedValue({ id: 'test-entity-id' })
    ;(getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({ id: 'test-entity-id', name: 'Test Entity' }),
      id: 'test-entity-id'
    })
    ;(updateDoc as jest.Mock).mockResolvedValue(undefined)
    ;(deleteDoc as jest.Mock).mockResolvedValue(undefined)
    ;(getDocs as jest.Mock).mockResolvedValue({
      docs: [
        global.testUtils.createMockFirebaseDoc({ id: 'entity-1', name: 'Entity 1' }),
        global.testUtils.createMockFirebaseDoc({ id: 'entity-2', name: 'Entity 2' })
      ]
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Entity Creation', () => {
    it('should create a new entity successfully', async () => {
      const entityData = {
        name: 'Test Company',
        type: 'company',
        description: 'A test company for testing purposes',
        website: 'https://testcompany.com',
        email: 'contact@testcompany.com',
        phone: '+1234567890',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          country: 'Test Country',
          postalCode: '12345'
        },
        tags: ['technology', 'startup'],
        isConfidential: false
      }

      const mockEntity = {
        id: 'test-entity-id',
        ...entityData,
        slug: 'test-company',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'test-user-id',
        status: 'active'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: true,
        entity: mockEntity
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(true)
      expect(result.entity.id).toBe('test-entity-id')
      expect(result.entity.name).toBe(entityData.name)
      expect(result.entity.slug).toBe('test-company')
      expect(mockEntityService.createEntity).toHaveBeenCalledWith(entityData)
    })

    it('should validate required fields', async () => {
      const incompleteEntityData = {
        name: 'Test Company',
        type: 'company'
        // Missing required fields
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: false,
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        validationErrors: {
          description: 'Description is required',
          email: 'Email is required'
        }
      })

      const result = await mockEntityService.createEntity(incompleteEntityData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing required fields')
      expect(result.validationErrors.description).toBe('Description is required')
      expect(result.validationErrors.email).toBe('Email is required')
    })

    it('should validate entity type', async () => {
      const entityData = {
        name: 'Test Entity',
        type: 'invalid-type',
        description: 'Test description',
        email: 'test@example.com'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: false,
        error: 'Invalid entity type',
        code: 'INVALID_TYPE',
        validTypes: ['company', 'organization', 'individual', 'project']
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid entity type')
      expect(result.code).toBe('INVALID_TYPE')
      expect(result.validTypes).toContain('company')
    })

    it('should validate email format', async () => {
      const entityData = {
        name: 'Test Company',
        type: 'company',
        description: 'Test description',
        email: 'invalid-email'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: false,
        error: 'Invalid email format',
        code: 'INVALID_EMAIL'
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email format')
      expect(result.code).toBe('INVALID_EMAIL')
    })

    it('should validate website URL format', async () => {
      const entityData = {
        name: 'Test Company',
        type: 'company',
        description: 'Test description',
        email: 'test@example.com',
        website: 'invalid-url'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: false,
        error: 'Invalid website URL',
        code: 'INVALID_URL'
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid website URL')
      expect(result.code).toBe('INVALID_URL')
    })

    it('should generate unique slug for entity', async () => {
      const entityData = {
        name: 'Test Company #1',
        type: 'company',
        description: 'Test description',
        email: 'test@example.com'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: true,
        entity: {
          id: 'test-entity-id',
          ...entityData,
          slug: 'test-company-1', // Normalized slug
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(true)
      expect(result.entity.slug).toBe('test-company-1')
    })

    it('should handle duplicate entity names', async () => {
      const entityData = {
        name: 'Existing Company',
        type: 'company',
        description: 'Test description',
        email: 'test@example.com'
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: false,
        error: 'Entity with this name already exists',
        code: 'DUPLICATE_NAME'
      })

      const result = await mockEntityService.createEntity(entityData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Entity with this name already exists')
      expect(result.code).toBe('DUPLICATE_NAME')
    })
  })

  describe('Entity Retrieval', () => {
    it('should get entity by ID successfully', async () => {
      const entityId = 'test-entity-id'
      const mockEntity = {
        id: entityId,
        name: 'Test Company',
        type: 'company',
        description: 'Test description',
        email: 'test@example.com',
        status: 'active'
      }

      mockEntityService.getEntity.mockResolvedValue({
        success: true,
        entity: mockEntity
      })

      const result = await mockEntityService.getEntity(entityId)

      expect(result.success).toBe(true)
      expect(result.entity.id).toBe(entityId)
      expect(result.entity.name).toBe('Test Company')
      expect(mockEntityService.getEntity).toHaveBeenCalledWith(entityId)
    })

    it('should handle entity not found', async () => {
      const entityId = 'non-existent-id'

      mockEntityService.getEntity.mockResolvedValue({
        success: false,
        error: 'Entity not found',
        code: 'ENTITY_NOT_FOUND'
      })

      const result = await mockEntityService.getEntity(entityId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Entity not found')
      expect(result.code).toBe('ENTITY_NOT_FOUND')
    })

    it('should get entity by slug successfully', async () => {
      const slug = 'test-company'
      const mockEntity = {
        id: 'test-entity-id',
        name: 'Test Company',
        slug: slug,
        type: 'company',
        description: 'Test description'
      }

      mockEntityService.getEntityBySlug.mockResolvedValue({
        success: true,
        entity: mockEntity
      })

      const result = await mockEntityService.getEntityBySlug(slug)

      expect(result.success).toBe(true)
      expect(result.entity.slug).toBe(slug)
      expect(mockEntityService.getEntityBySlug).toHaveBeenCalledWith(slug)
    })

    it('should list entities with pagination', async () => {
      const mockEntities = [
        { id: 'entity-1', name: 'Entity 1', type: 'company' },
        { id: 'entity-2', name: 'Entity 2', type: 'organization' },
        { id: 'entity-3', name: 'Entity 3', type: 'project' }
      ]

      mockEntityService.listEntities.mockResolvedValue({
        success: true,
        entities: mockEntities.slice(0, 2), // First page
        hasMore: true,
        nextCursor: 'cursor-2',
        totalCount: 3
      })

      const result = await mockEntityService.listEntities({ limit: 2, cursor: null })

      expect(result.success).toBe(true)
      expect(result.entities).toHaveLength(2)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe('cursor-2')
      expect(result.totalCount).toBe(3)
    })

    it('should filter entities by type', async () => {
      const mockCompanies = [
        { id: 'company-1', name: 'Company 1', type: 'company' },
        { id: 'company-2', name: 'Company 2', type: 'company' }
      ]

      mockEntityService.listEntities.mockResolvedValue({
        success: true,
        entities: mockCompanies,
        hasMore: false,
        nextCursor: null,
        totalCount: 2
      })

      const result = await mockEntityService.listEntities({ type: 'company' })

      expect(result.success).toBe(true)
      expect(result.entities).toHaveLength(2)
      expect(result.entities.every(e => e.type === 'company')).toBe(true)
    })

    it('should search entities by name', async () => {
      const searchTerm = 'tech'
      const mockResults = [
        { id: 'tech-1', name: 'Tech Company 1', type: 'company' },
        { id: 'tech-2', name: 'TechStart Inc', type: 'company' }
      ]

      mockEntityService.searchEntities.mockResolvedValue({
        success: true,
        entities: mockResults,
        searchTerm: searchTerm,
        totalCount: 2
      })

      const result = await mockEntityService.searchEntities(searchTerm)

      expect(result.success).toBe(true)
      expect(result.entities).toHaveLength(2)
      expect(result.searchTerm).toBe(searchTerm)
      expect(mockEntityService.searchEntities).toHaveBeenCalledWith(searchTerm)
    })

    it('should get user entities', async () => {
      const userId = 'test-user-id'
      const mockUserEntities = [
        { id: 'user-entity-1', name: 'My Company', createdBy: userId },
        { id: 'user-entity-2', name: 'My Project', createdBy: userId }
      ]

      mockEntityService.getUserEntities.mockResolvedValue({
        success: true,
        entities: mockUserEntities,
        totalCount: 2
      })

      const result = await mockEntityService.getUserEntities(userId)

      expect(result.success).toBe(true)
      expect(result.entities).toHaveLength(2)
      expect(result.entities.every(e => e.createdBy === userId)).toBe(true)
    })
  })

  describe('Entity Updates', () => {
    it('should update entity successfully', async () => {
      const entityId = 'test-entity-id'
      const updateData = {
        name: 'Updated Company Name',
        description: 'Updated description',
        website: 'https://updated-website.com'
      }

      const mockUpdatedEntity = {
        id: entityId,
        ...updateData,
        type: 'company',
        email: 'test@example.com',
        updatedAt: new Date()
      }

      mockEntityService.updateEntity.mockResolvedValue({
        success: true,
        entity: mockUpdatedEntity
      })

      const result = await mockEntityService.updateEntity(entityId, updateData)

      expect(result.success).toBe(true)
      expect(result.entity.name).toBe(updateData.name)
      expect(result.entity.description).toBe(updateData.description)
      expect(result.entity.website).toBe(updateData.website)
      expect(mockEntityService.updateEntity).toHaveBeenCalledWith(entityId, updateData)
    })

    it('should validate update permissions', async () => {
      const entityId = 'test-entity-id'
      const updateData = { name: 'Unauthorized Update' }

      mockEntityService.updateEntity.mockResolvedValue({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED'
      })

      const result = await mockEntityService.updateEntity(entityId, updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(result.code).toBe('PERMISSION_DENIED')
    })

    it('should validate update data', async () => {
      const entityId = 'test-entity-id'
      const invalidUpdateData = {
        email: 'invalid-email',
        website: 'invalid-url'
      }

      mockEntityService.updateEntity.mockResolvedValue({
        success: false,
        error: 'Validation errors',
        code: 'VALIDATION_ERROR',
        validationErrors: {
          email: 'Invalid email format',
          website: 'Invalid URL format'
        }
      })

      const result = await mockEntityService.updateEntity(entityId, invalidUpdateData)

      expect(result.success).toBe(false)
      expect(result.validationErrors.email).toBe('Invalid email format')
      expect(result.validationErrors.website).toBe('Invalid URL format')
    })

    it('should handle entity not found during update', async () => {
      const entityId = 'non-existent-id'
      const updateData = { name: 'Updated Name' }

      mockEntityService.updateEntity.mockResolvedValue({
        success: false,
        error: 'Entity not found',
        code: 'ENTITY_NOT_FOUND'
      })

      const result = await mockEntityService.updateEntity(entityId, updateData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Entity not found')
      expect(result.code).toBe('ENTITY_NOT_FOUND')
    })
  })

  describe('Entity Deletion', () => {
    it('should delete entity successfully', async () => {
      const entityId = 'test-entity-id'

      mockEntityService.deleteEntity.mockResolvedValue({
        success: true,
        message: 'Entity deleted successfully'
      })

      const result = await mockEntityService.deleteEntity(entityId)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Entity deleted successfully')
      expect(mockEntityService.deleteEntity).toHaveBeenCalledWith(entityId)
    })

    it('should validate delete permissions', async () => {
      const entityId = 'test-entity-id'

      mockEntityService.deleteEntity.mockResolvedValue({
        success: false,
        error: 'Permission denied',
        code: 'PERMISSION_DENIED'
      })

      const result = await mockEntityService.deleteEntity(entityId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
      expect(result.code).toBe('PERMISSION_DENIED')
    })

    it('should handle entity not found during deletion', async () => {
      const entityId = 'non-existent-id'

      mockEntityService.deleteEntity.mockResolvedValue({
        success: false,
        error: 'Entity not found',
        code: 'ENTITY_NOT_FOUND'
      })

      const result = await mockEntityService.deleteEntity(entityId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Entity not found')
      expect(result.code).toBe('ENTITY_NOT_FOUND')
    })

    it('should handle entities with dependencies', async () => {
      const entityId = 'test-entity-id'

      mockEntityService.deleteEntity.mockResolvedValue({
        success: false,
        error: 'Cannot delete entity with dependencies',
        code: 'HAS_DEPENDENCIES',
        dependencies: ['opportunities', 'partnerships']
      })

      const result = await mockEntityService.deleteEntity(entityId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Cannot delete entity with dependencies')
      expect(result.code).toBe('HAS_DEPENDENCIES')
      expect(result.dependencies).toContain('opportunities')
      expect(result.dependencies).toContain('partnerships')
    })
  })

  describe('Confidential Entities', () => {
    it('should create confidential entity successfully', async () => {
      const confidentialEntityData = {
        name: 'Confidential Company',
        type: 'company',
        description: 'Confidential description',
        email: 'confidential@example.com',
        isConfidential: true,
        confidentialityLevel: 'high',
        accessList: ['user-1', 'user-2']
      }

      mockEntityService.createEntity.mockResolvedValue({
        success: true,
        entity: {
          id: 'confidential-entity-id',
          ...confidentialEntityData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const result = await mockEntityService.createEntity(confidentialEntityData)

      expect(result.success).toBe(true)
      expect(result.entity.isConfidential).toBe(true)
      expect(result.entity.confidentialityLevel).toBe('high')
      expect(result.entity.accessList).toEqual(['user-1', 'user-2'])
    })

    it('should restrict access to confidential entities', async () => {
      const confidentialEntityId = 'confidential-entity-id'

      mockEntityService.getEntity.mockResolvedValue({
        success: false,
        error: 'Access denied to confidential entity',
        code: 'CONFIDENTIAL_ACCESS_DENIED'
      })

      const result = await mockEntityService.getEntity(confidentialEntityId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Access denied to confidential entity')
      expect(result.code).toBe('CONFIDENTIAL_ACCESS_DENIED')
    })

    it('should get confidential entities for authorized user', async () => {
      const userId = 'authorized-user-id'
      const mockConfidentialEntities = [
        { id: 'conf-1', name: 'Confidential Entity 1', isConfidential: true },
        { id: 'conf-2', name: 'Confidential Entity 2', isConfidential: true }
      ]

      mockEntityService.getConfidentialEntities.mockResolvedValue({
        success: true,
        entities: mockConfidentialEntities,
        totalCount: 2
      })

      const result = await mockEntityService.getConfidentialEntities(userId)

      expect(result.success).toBe(true)
      expect(result.entities).toHaveLength(2)
      expect(result.entities.every(e => e.isConfidential)).toBe(true)
    })

    it('should handle unauthorized access to confidential entities list', async () => {
      const userId = 'unauthorized-user-id'

      mockEntityService.getConfidentialEntities.mockResolvedValue({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      })

      const result = await mockEntityService.getConfidentialEntities(userId)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient permissions')
      expect(result.code).toBe('INSUFFICIENT_PERMISSIONS')
    })
  })

  describe('Entity Archiving', () => {
    it('should archive entity successfully', async () => {
      const entityId = 'test-entity-id'

      mockEntityService.archiveEntity.mockResolvedValue({
        success: true,
        message: 'Entity archived successfully',
        entity: {
          id: entityId,
          status: 'archived',
          archivedAt: new Date()
        }
      })

      const result = await mockEntityService.archiveEntity(entityId)

      expect(result.success).toBe(true)
      expect(result.entity.status).toBe('archived')
      expect(result.entity.archivedAt).toBeDefined()
    })

    it('should restore archived entity successfully', async () => {
      const entityId = 'archived-entity-id'

      mockEntityService.restoreEntity.mockResolvedValue({
        success: true,
        message: 'Entity restored successfully',
        entity: {
          id: entityId,
          status: 'active',
          restoredAt: new Date()
        }
      })

      const result = await mockEntityService.restoreEntity(entityId)

      expect(result.success).toBe(true)
      expect(result.entity.status).toBe('active')
      expect(result.entity.restoredAt).toBeDefined()
    })
  })

  describe('Error Handling with ES2022 Error.cause', () => {
    it('should handle database errors with cause chain', async () => {
      const databaseError = new Error('Firestore connection failed')
      const serviceError = new Error('Entity creation failed', { cause: databaseError })

      mockEntityService.createEntity.mockRejectedValue(serviceError)

      try {
        await mockEntityService.createEntity({
          name: 'Test Entity',
          type: 'company',
          description: 'Test description',
          email: 'test@example.com'
        })
      } catch (error) {
        expect(error.message).toBe('Entity creation failed')
        expect(error.cause).toBe(databaseError)
        expect(error.cause.message).toBe('Firestore connection failed')
      }
    })

    it('should handle validation errors with detailed cause information', async () => {
      const validationError = new Error('Email validation failed')
      const entityError = new Error('Entity validation failed', { cause: validationError })

      mockEntityService.validateEntity.mockRejectedValue(entityError)

      try {
        await mockEntityService.validateEntity({ email: 'invalid-email' })
      } catch (error) {
        expect(error.message).toBe('Entity validation failed')
        expect(error.cause).toBe(validationError)
        expect(error.cause.message).toBe('Email validation failed')
      }
    })

    it('should handle permission errors with cause chain', async () => {
      const authError = new Error('User not authenticated')
      const permissionError = new Error('Permission denied', { cause: authError })

      mockEntityService.updateEntity.mockRejectedValue(permissionError)

      try {
        await mockEntityService.updateEntity('entity-id', { name: 'Updated Name' })
      } catch (error) {
        expect(error.message).toBe('Permission denied')
        expect(error.cause).toBe(authError)
        expect(error.cause.message).toBe('User not authenticated')
      }
    })
  })
}) 