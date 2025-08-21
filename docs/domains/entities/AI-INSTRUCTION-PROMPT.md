# 🏢 Entity Management Domain - AI Instruction Set

> **Professional Organization Management with 26+ Industry Types and Confidential Access**  
> *Complete entity management patterns for Ring Platform's professional networking ecosystem*

---

## 🎯 **Core Entity Functions**

### **Entity Type System (26+ Industries)**

```typescript
// Comprehensive industry classification system
export type EntityType =
  | '3dPrinting'
  | 'aiMachineLearning'
  | 'biotechnology'
  | 'blockchainDevelopment'
  | 'cleanEnergy'
  | 'cloudComputing'
  | 'cncMachining'
  | 'compositeManufacturing'
  | 'cybersecurity'
  | 'droneTechnology'
  | 'electronicManufacturing'
  | 'industrialDesign'
  | 'iotDevelopment'
  | 'laserCutting'
  | 'manufacturing'
  | 'metalFabrication'
  | 'other'
  | 'plasticInjectionMolding'
  | 'precisionEngineering'
  | 'quantumComputing'
  | 'robotics'
  | 'semiconductorProduction'
  | 'smartMaterials'
  | 'softwareDevelopment'
  | 'technologyCenter'
  | 'virtualReality'

// Entity structure with professional networking features
export interface Entity {
  // Core identification
  id: string
  name: string
  type: EntityType
  
  // Content and description
  shortDescription: string
  fullDescription?: string
  logo?: string
  gallery?: { description: string; url: string }[]
  
  // Professional details
  location: string
  foundedYear?: number
  employeeCount?: number
  memberSince?: Timestamp
  
  // Contact information
  contactEmail?: string
  phoneNumber?: string
  website?: string
  socialMedia?: {
    linkedin?: string
    twitter?: string
    facebook?: string
    instagram?: string
  }
  
  // Professional credentials
  certifications?: string[]
  services?: string[]
  industries?: string[]
  partnerships?: string[]
  tags?: string[]
  
  // Access control and visibility
  visibility: 'public' | 'subscriber' | 'member' | 'confidential'
  isConfidential: boolean
  
  // Relationships
  members: string[]         // User IDs of entity members
  opportunities: string[]   // Opportunity IDs posted by entity
  addedBy: string          // User ID who created entity
  
  // Metadata
  dateAdded: Timestamp
  lastUpdated: Timestamp
  
  // Events
  upcomingEvents?: {
    name: string
    description: string
    date: string
  }[]
}
```

### **Entity CRUD Operations**

```typescript
// Create entity with role-based validation
export async function createEntity(data: NewEntityData): Promise<Entity> {
  // Step 1: Authentication and authorization
  const session = await auth()
  if (!session?.user) {
    throw new EntityAuthError('User authentication required to create entity')
  }
  
  const userId = session.user.id
  const userRole = session.user.role as UserRole
  
  // Step 2: Role-based permission checking
  if (data.isConfidential) {
    // Only CONFIDENTIAL and ADMIN users can create confidential entities
    const hasConfidentialAccess = userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
    if (!hasConfidentialAccess) {
      throw new EntityPermissionError('Only ADMIN or CONFIDENTIAL users can create confidential entities')
    }
  } else {
    // Regular entities require MEMBER+ role
    const hasEntityAccess = [UserRole.MEMBER, UserRole.ADMIN, UserRole.CONFIDENTIAL].includes(userRole)
    if (!hasEntityAccess) {
      throw new EntityPermissionError('Only ADMIN, MEMBER, or CONFIDENTIAL users can create entities')
    }
  }
  
  // Step 3: Data validation with ES2022 enhancements
  if (!validateEntityData(data)) {
    throw new EntityQueryError('Invalid entity data provided')
  }
  
  // Step 4: Prepare entity document
  const adminDb = await getAdminDb()
  const entityData: Omit<Entity, 'id'> = {
    ...data,
    addedBy: userId,
    members: [userId], // Creator is automatically a member
    opportunities: [],
    dateAdded: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    visibility: data.isConfidential ? 'confidential' : data.visibility || 'public'
  }
  
  // Step 5: Create entity in Firestore with converter
  const entityRef = adminDb.collection('entities').withConverter(entityConverter)
  const docRef = await entityRef.add(entityData)
  
  // Step 6: Update user's created entities list
  await adminDb.collection('users').doc(userId).update({
    createdEntities: admin.firestore.FieldValue.arrayUnion(docRef.id)
  })
  
  // Step 7: Return created entity
  const createdDoc = await docRef.get()
  return { id: createdDoc.id, ...createdDoc.data() }
}

// Get entities with role-based filtering
export async function getEntities(
  limit: number = 20,
  startAfter?: string
): Promise<{ entities: Entity[]; lastVisible: string | null }> {
  // Step 1: Authentication
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new EntityAuthError('Unauthorized access')
  }
  
  const userRole = session.user.role as UserRole
  
  // Step 2: Build role-based query
  const adminDb = await getAdminDb()
  const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter)
  let query: Query<Entity> = entitiesCollection
  
  // Apply role-based filtering
  if (userRole === UserRole.VISITOR) {
    query = query.where('visibility', 'in', ['public'])
  } else if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
    // SUBSCRIBER (and MEMBER) can see public + subscriber + role-specific
    query = query.where('visibility', 'in', ['public', 'subscriber', userRole])
  }
  // ADMIN and CONFIDENTIAL users can see all entities
  
  // Step 3: Apply pagination
  query = query.limit(limit)
  if (startAfter) {
    const startAfterDoc = await entitiesCollection.doc(startAfter).get()
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc)
    }
  }
  
  // Step 4: Execute query
  const snapshot = await query.get()
  const entities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null
  
  return { entities, lastVisible }
}

// Get confidential entities (restricted access)
export async function getConfidentialEntities(
  params: {
    limit: number
    startAfter?: string
    sort: string
    filter?: string
    userId: string
    userRole: UserRole.CONFIDENTIAL | UserRole.ADMIN
  }
): Promise<{
  entities: Entity[]
  lastVisible: string | null
  totalPages: number
  totalEntities: number
}> {
  const { limit, startAfter, sort, filter, userRole } = params
  
  // Step 1: Build confidential entities query
  const adminDb = await getAdminDb()
  const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter)
  let baseQuery = entitiesCollection.where('isConfidential', '==', true)
  
  // Apply additional filters
  if (filter) {
    baseQuery = baseQuery.where('status', '==', filter)
  }
  
  // Apply sorting
  const [sortField, sortDirection] = sort.split(':')
  baseQuery = baseQuery.orderBy(sortField, sortDirection as 'asc' | 'desc')
  
  // Step 2: Get total count for pagination
  const totalSnapshot = await baseQuery.count().get()
  const totalEntities = totalSnapshot.data().count
  const totalPages = Math.ceil(totalEntities / limit)
  
  // Step 3: Execute paginated query
  let query: Query<Entity> = baseQuery.limit(limit)
  if (startAfter) {
    const startAfterDoc = await entitiesCollection.doc(startAfter).get()
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc)
    }
  }
  
  const snapshot = await query.get()
  const entities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null
  
  return { entities, lastVisible, totalPages, totalEntities }
}
```

---

## 🛡️ **Access Control Implementation**

### **Visibility Tier System**

```typescript
// Entity visibility levels
type EntityVisibility = 'public' | 'subscriber' | 'member' | 'confidential'

// Access validation functions
export function canViewEntity(entity: Entity, userRole: UserRole): boolean {
  // Admin can view all entities
  if (userRole === UserRole.ADMIN) return true
  
  // Confidential users can view all entities including confidential
  if (userRole === UserRole.CONFIDENTIAL) return true
  
  // Entity-specific confidential check
  if (entity.isConfidential) {
    return false // Only confidential+ users can view
  }
  
  // Standard visibility checks
  const roleHierarchy = {
    [UserRole.VISITOR]: 0,
    [UserRole.SUBSCRIBER]: 1,
    [UserRole.MEMBER]: 2
  }
  
  const visibilityRequirements = {
    public: 0,
    subscriber: 1,
    member: 2,
    confidential: 3 // Handled above
  }
  
  return roleHierarchy[userRole] >= visibilityRequirements[entity.visibility]
}

export function canEditEntity(entity: Entity, userId: string, userRole: UserRole): boolean {
  // Admin can edit all entities
  if (userRole === UserRole.ADMIN) return true
  
  // Entity creator can edit
  if (entity.addedBy === userId) return true
  
  // Entity members can edit (if they have member+ role)
  if (entity.members.includes(userId) && hasAccess(userRole, UserRole.MEMBER)) {
    return true
  }
  
  return false
}

export function canDeleteEntity(entity: Entity, userId: string, userRole: UserRole): boolean {
  // Admin can delete all entities
  if (userRole === UserRole.ADMIN) return true
  
  // Only entity creator can delete
  return entity.addedBy === userId
}

// Filter entities based on user access
export function filterEntitiesByAccess(entities: Entity[], userRole: UserRole): Entity[] {
  return entities.filter(entity => canViewEntity(entity, userRole))
}
```

### **Confidential Entity Management**

```typescript
// Create confidential entity (requires special permissions)
export async function createConfidentialEntity(
  data: Omit<NewEntityData, 'isConfidential'>,
  userId: string
): Promise<Entity> {
  const session = await auth()
  if (!session?.user) {
    throw new EntityAuthError('Authentication required')
  }
  
  const userRole = session.user.role as UserRole
  
  // Validate confidential access
  if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
    throw new EntityPermissionError('Only CONFIDENTIAL or ADMIN users can create confidential entities')
  }
  
  // Create entity with confidential settings
  const confidentialEntityData = {
    ...data,
    isConfidential: true,
    visibility: 'confidential' as const
  }
  
  return createEntity(confidentialEntityData)
}

// Verify confidential entity access in middleware
export function requireConfidentialAccess(req: NextRequest) {
  return auth((request) => {
    const { user } = request.auth
    
    if (!user || !hasConfidentialAccess(user.role as UserRole)) {
      return NextResponse.redirect('/upgrade-access')
    }
    
    return NextResponse.next()
  })(req)
}

function hasConfidentialAccess(userRole: UserRole): boolean {
  return userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN
}
```

---

## 🔄 **Entity Relationships**

### **Entity-User Relationships**

```typescript
// Add user as entity member
export async function addEntityMember(
  entityId: string,
  userId: string,
  requestingUserId: string
): Promise<void> {
  const adminDb = await getAdminDb()
  
  // Get entity and validate permissions
  const entityDoc = await adminDb.collection('entities').doc(entityId).get()
  if (!entityDoc.exists) {
    throw new EntityQueryError('Entity not found')
  }
  
  const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity
  
  // Check if requesting user can manage entity
  const session = await auth()
  const userRole = session?.user?.role as UserRole
  
  if (!canEditEntity(entity, requestingUserId, userRole)) {
    throw new EntityPermissionError('Insufficient permissions to manage entity members')
  }
  
  // Add member to entity
  await entityDoc.ref.update({
    members: admin.firestore.FieldValue.arrayUnion(userId),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  })
  
  // Update user's entity memberships
  await adminDb.collection('users').doc(userId).update({
    entityMemberships: admin.firestore.FieldValue.arrayUnion(entityId)
  })
}

// Remove entity member
export async function removeEntityMember(
  entityId: string,
  userId: string,
  requestingUserId: string
): Promise<void> {
  const adminDb = await getAdminDb()
  
  // Validate permissions (same as addEntityMember)
  const entityDoc = await adminDb.collection('entities').doc(entityId).get()
  const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity
  
  const session = await auth()
  const userRole = session?.user?.role as UserRole
  
  if (!canEditEntity(entity, requestingUserId, userRole)) {
    throw new EntityPermissionError('Insufficient permissions to manage entity members')
  }
  
  // Remove member from entity
  await entityDoc.ref.update({
    members: admin.firestore.FieldValue.arrayRemove(userId),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  })
  
  // Update user's entity memberships
  await adminDb.collection('users').doc(userId).update({
    entityMemberships: admin.firestore.FieldValue.arrayRemove(entityId)
  })
}

// Get user's entity memberships
export async function getUserEntityMemberships(userId: string): Promise<Entity[]> {
  const adminDb = await getAdminDb()
  
  // Query entities where user is a member
  const snapshot = await adminDb
    .collection('entities')
    .withConverter(entityConverter)
    .where('members', 'array-contains', userId)
    .get()
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

### **Entity-Opportunity Relationships**

```typescript
// Link opportunity to entity
export async function linkOpportunityToEntity(
  entityId: string,
  opportunityId: string,
  userId: string
): Promise<void> {
  const adminDb = await getAdminDb()
  
  // Validate entity exists and user has permissions
  const entityDoc = await adminDb.collection('entities').doc(entityId).get()
  if (!entityDoc.exists) {
    throw new EntityQueryError('Entity not found')
  }
  
  const entity = { id: entityDoc.id, ...entityDoc.data() } as Entity
  const session = await auth()
  const userRole = session?.user?.role as UserRole
  
  if (!canEditEntity(entity, userId, userRole)) {
    throw new EntityPermissionError('Insufficient permissions to manage entity opportunities')
  }
  
  // Add opportunity to entity
  await entityDoc.ref.update({
    opportunities: admin.firestore.FieldValue.arrayUnion(opportunityId),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  })
  
  // Update opportunity with entity reference
  await adminDb.collection('opportunities').doc(opportunityId).update({
    entityId: entityId,
    entityName: entity.name
  })
}

// Get entity's opportunities
export async function getEntityOpportunities(
  entityId: string,
  userRole: UserRole
): Promise<Opportunity[]> {
  const adminDb = await getAdminDb()
  
  // Get opportunities linked to entity
  let query = adminDb
    .collection('opportunities')
    .withConverter(opportunityConverter)
    .where('entityId', '==', entityId)
  
  // Apply role-based filtering
  if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
    query = query.where('accessTier', 'in', ['public', 'subscriber', userRole])
  }
  
  const snapshot = await query.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

---

## 📝 **Entity Validation and Utilities**

### **Data Validation**

```typescript
// Comprehensive entity data validation
export function validateEntityData(data: Partial<Entity>): boolean {
  // Required fields validation
  const requiredFields = ['name', 'type', 'shortDescription', 'location']
  for (const field of requiredFields) {
    if (!data[field as keyof Entity]) {
      console.error(`Missing required field: ${field}`)
      return false
    }
  }
  
  // Type validation
  if (data.type && !isValidEntityType(data.type)) {
    console.error(`Invalid entity type: ${data.type}`)
    return false
  }
  
  // Email validation
  if (data.contactEmail && !isValidEmail(data.contactEmail)) {
    console.error(`Invalid email: ${data.contactEmail}`)
    return false
  }
  
  // URL validation
  if (data.website && !isValidUrl(data.website)) {
    console.error(`Invalid website URL: ${data.website}`)
    return false
  }
  
  // Social media URL validation
  if (data.socialMedia) {
    for (const [platform, url] of Object.entries(data.socialMedia)) {
      if (url && !isValidUrl(url)) {
        console.error(`Invalid ${platform} URL: ${url}`)
        return false
      }
    }
  }
  
  return true
}

function isValidEntityType(type: string): type is EntityType {
  const validTypes: EntityType[] = [
    '3dPrinting', 'aiMachineLearning', 'biotechnology', 'blockchainDevelopment',
    'cleanEnergy', 'cloudComputing', 'cncMachining', 'compositeManufacturing',
    'cybersecurity', 'droneTechnology', 'electronicManufacturing', 'industrialDesign',
    'iotDevelopment', 'laserCutting', 'manufacturing', 'metalFabrication', 'other',
    'plasticInjectionMolding', 'precisionEngineering', 'quantumComputing', 'robotics',
    'semiconductorProduction', 'smartMaterials', 'softwareDevelopment', 'technologyCenter',
    'virtualReality'
  ]
  
  return validTypes.includes(type as EntityType)
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// Entity search and filtering utilities
export function searchEntities(
  entities: Entity[],
  searchTerm: string,
  filters: {
    type?: EntityType
    location?: string
    industry?: string
    confidentialOnly?: boolean
  } = {}
): Entity[] {
  let filtered = entities
  
  // Text search
  if (searchTerm) {
    const term = searchTerm.toLowerCase()
    filtered = filtered.filter(entity =>
      entity.name.toLowerCase().includes(term) ||
      entity.shortDescription.toLowerCase().includes(term) ||
      entity.fullDescription?.toLowerCase().includes(term) ||
      entity.tags?.some(tag => tag.toLowerCase().includes(term))
    )
  }
  
  // Type filter
  if (filters.type) {
    filtered = filtered.filter(entity => entity.type === filters.type)
  }
  
  // Location filter
  if (filters.location) {
    filtered = filtered.filter(entity =>
      entity.location.toLowerCase().includes(filters.location!.toLowerCase())
    )
  }
  
  // Industry filter
  if (filters.industry) {
    filtered = filtered.filter(entity =>
      entity.industries?.includes(filters.industry!)
    )
  }
  
  // Confidential filter
  if (filters.confidentialOnly) {
    filtered = filtered.filter(entity => entity.isConfidential)
  }
  
  return filtered
}
```

---

## 🎨 **React Components Integration**

### **Entity Management Hooks**

```typescript
// Custom hooks for entity management
export function useEntities(params: {
  limit?: number
  filter?: EntityType
  confidentialOnly?: boolean
} = {}) {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastVisible, setLastVisible] = useState<string | null>(null)
  
  const { user, isAuthenticated } = useAuth()
  
  const fetchEntities = useCallback(async (startAfter?: string) => {
    if (!isAuthenticated) return
    
    try {
      setLoading(true)
      const response = await fetch('/api/entities?' + new URLSearchParams({
        limit: String(params.limit || 20),
        ...(startAfter && { startAfter }),
        ...(params.filter && { type: params.filter }),
        ...(params.confidentialOnly && { confidential: 'true' })
      }))
      
      if (!response.ok) {
        throw new Error('Failed to fetch entities')
      }
      
      const data = await response.json()
      
      if (startAfter) {
        setEntities(prev => [...prev, ...data.entities])
      } else {
        setEntities(data.entities)
      }
      
      setLastVisible(data.lastVisible)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, params.limit, params.filter, params.confidentialOnly])
  
  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])
  
  const loadMore = () => {
    if (lastVisible) {
      fetchEntities(lastVisible)
    }
  }
  
  const refresh = () => {
    fetchEntities()
  }
  
  return {
    entities,
    loading,
    error,
    hasMore: !!lastVisible,
    loadMore,
    refresh
  }
}

// Entity creation hook with React 19 optimistic updates
export function useCreateEntity() {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const createEntity = async (data: Omit<Entity, 'id' | 'dateAdded' | 'lastUpdated'>) => {
    setIsCreating(true)
    setError(null)
    
    try {
      const response = await fetch('/api/entities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create entity')
      }
      
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setIsCreating(false)
    }
  }
  
  return { createEntity, isCreating, error }
}
```

### **Entity Display Components**

```typescript
// Entity card component with access control
interface EntityCardProps {
  entity: Entity
  showConfidentialBadge?: boolean
  onEdit?: (entity: Entity) => void
  onDelete?: (entity: Entity) => void
}

export function EntityCard({ entity, showConfidentialBadge, onEdit, onDelete }: EntityCardProps) {
  const { user } = useAuth()
  const canEdit = user ? canEditEntity(entity, user.id, user.role) : false
  const canDelete = user ? canDeleteEntity(entity, user.id, user.role) : false
  
  return (
    <Card className="entity-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          {entity.logo && (
            <img src={entity.logo} alt={entity.name} className="w-12 h-12 rounded" />
          )}
          <div>
            <CardTitle className="flex items-center gap-2">
              {entity.name}
              {entity.isConfidential && showConfidentialBadge && (
                <Badge variant="secondary" className="text-xs">
                  Confidential
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{entity.type}</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {entity.shortDescription}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline">{entity.location}</Badge>
          {entity.foundedYear && (
            <Badge variant="outline">Founded {entity.foundedYear}</Badge>
          )}
          {entity.employeeCount && (
            <Badge variant="outline">{entity.employeeCount} employees</Badge>
          )}
        </div>
        
        {entity.tags && entity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {entity.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/entities/${entity.id}`}>View Details</Link>
            </Button>
            
            {canEdit && onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(entity)}>
                Edit
              </Button>
            )}
          </div>
          
          {canDelete && onDelete && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => onDelete(entity)}
            >
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Entity list with infinite scroll
export function EntityList({ filter, confidentialOnly }: {
  filter?: EntityType
  confidentialOnly?: boolean
}) {
  const { entities, loading, error, hasMore, loadMore } = useEntities({
    filter,
    confidentialOnly
  })
  
  if (loading && entities.length === 0) {
    return <div className="text-center py-8">Loading entities...</div>
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map(entity => (
          <EntityCard
            key={entity.id}
            entity={entity}
            showConfidentialBadge={confidentialOnly}
          />
        ))}
      </div>
      
      {hasMore && (
        <div className="text-center py-4">
          <Button onClick={loadMore} disabled={loading}>
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
      
      {entities.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          No entities found
        </div>
      )}
    </div>
  )
}
```

---

## 📊 **Performance Patterns**

### **Firestore Optimization**

```typescript
// Efficient entity queries with indexing
export const ENTITY_INDEXES = [
  // Compound indexes for common queries
  { collection: 'entities', fields: ['visibility', 'type', 'dateAdded'] },
  { collection: 'entities', fields: ['isConfidential', 'type', 'lastUpdated'] },
  { collection: 'entities', fields: ['addedBy', 'dateAdded'] },
  { collection: 'entities', fields: ['members', 'lastUpdated'] },
  
  // Single field indexes
  { collection: 'entities', fields: ['type'] },
  { collection: 'entities', fields: ['location'] },
  { collection: 'entities', fields: ['industries'] },
  { collection: 'entities', fields: ['tags'] }
]

// Entity converter for type safety and performance
export const entityConverter = {
  toFirestore(entity: Entity): admin.firestore.DocumentData {
    // Remove client-side only fields
    const { id, ...data } = entity
    return data
  },
  
  fromFirestore(
    snapshot: admin.firestore.QueryDocumentSnapshot,
    options: admin.firestore.SnapshotOptions
  ): Entity {
    const data = snapshot.data(options)
    return {
      id: snapshot.id,
      ...data,
      // Ensure proper type conversion
      dateAdded: data.dateAdded?.toDate() || new Date(),
      lastUpdated: data.lastUpdated?.toDate() || new Date(),
      memberSince: data.memberSince?.toDate(),
    } as Entity
  }
}

// Cached queries for frequently accessed data
export const getCachedEntitiesByType = cache(async (entityType: EntityType) => {
  const adminDb = await getAdminDb()
  const snapshot = await adminDb
    .collection('entities')
    .withConverter(entityConverter)
    .where('type', '==', entityType)
    .where('visibility', '==', 'public')
    .limit(50)
    .get()
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
})
```

---

## 🎯 **Key Implementation Notes**

1. **Always validate user permissions** before entity operations
2. **Use role hierarchy** - higher roles inherit lower role permissions  
3. **Implement confidential access carefully** - only CONFIDENTIAL+ users can access
4. **Use Firebase converters** for type safety and performance
5. **Apply proper indexing** for efficient queries
6. **Handle member relationships** - users can be members of multiple entities
7. **Link opportunities to entities** for professional networking
8. **Validate industry types** - only allow predefined EntityType values
9. **Use pagination** for large entity lists
10. **Implement search functionality** across multiple entity fields
11. **Use unified status pages** for entity lifecycle management
12. **Implement dynamic [action]/[status] routing** for entity workflows

## 🔄 **Unified Status Page Integration**

### **Entity Status Pages**

```typescript
// Dynamic status page routing
// app/(public)/[locale]/entities/status/[action]/[status]/page.tsx

// Supported actions: create, verify, approve, publish
// Supported statuses: draft, pending_review, published, failed, rejected, etc.

// Status page component with i18n support
<EntityStatusPage 
  action="create" 
  status="published" 
  locale="en"
  entityId="ent-12345"
  entityName="Tech Innovation Corp"
/>
```

### **Entity Workflow Statuses**

- **Create**: draft → pending_review → published/failed/rejected
- **Verify**: pending → under_review → verified/rejected/expired
- **Approve**: pending → approved/rejected/needs_revision
- **Publish**: scheduled → published/failed/unpublished/archived

### **Status Page Benefits**

- **Consistent UX** across all entity workflows
- **Centralized i18n** for status messages
- **SEO-friendly** with dynamic metadata
- **Workflow tracking** with contextual guidance
- **Error handling** with actionable next steps

This entity management system provides comprehensive professional organization management with sophisticated access control and unified status page patterns, perfect for Ring Platform's business networking requirements.