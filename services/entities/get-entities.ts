import { getAdminDb } from '@/lib/firebase-admin.server'
import { Entity } from '@/features/entities/types'
import { UserRole } from '@/features/auth/types'
import { getServerAuthSession } from '@/auth'
import { QuerySnapshot, Query } from 'firebase-admin/firestore'
import { entityConverter } from '@/lib/converters/entity-converter'

/**
 * Fetch a paginated list of entities based on user role.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session information.
 * 2. Accesses Firestore and initializes the entities collection with the entity converter.
 * 3. Builds a query based on the user's role and applies appropriate filters.
 * 4. Implements pagination using the 'limit' and 'startAfter' parameters.
 * 5. Executes the query and processes the results.
 * 6. Maps the document snapshots to Entity objects, including their IDs.
 * 7. Determines the ID of the last visible entity for future pagination.
 * 
 * User steps:
 * 1. User requests a list of entities (e.g., from a client-side component).
 * 2. The function authenticates the user and checks their role.
 * 3. Based on the user's role, the function fetches the appropriate entities.
 * 4. The function returns the entities and pagination information to the user.
 * 
 * @param {number} limit - The maximum number of entities to fetch per page. Defaults to 20.
 * @param {string} [startAfter] - The ID of the last entity from the previous page for pagination. Optional.
 * @returns {Promise<{ entities: Entity[]; lastVisible: string | null }>} A promise that resolves to an object containing the fetched entities and the ID of the last visible entity for pagination.
 * @throws {Error} If the user is not authenticated or if an error occurs during the fetching process.
 */
export async function getEntities(
  limit: number = 20,
  startAfter?: string
): Promise<{ entities: Entity[]; lastVisible: string | null }> {
  try {
    console.log('Services: getEntities - Starting...')

    // Step 1: Authenticate and get user session
    const session = await getServerAuthSession()
    if (!session || !session.user) {
      throw new Error('Unauthorized access')
    }

    const userRole = session.user.role as UserRole

    console.log(`Services: getEntities - User authenticated with role ${userRole}`)

    // Step 2: Access Firestore and initialize collection with converter
    const adminDb = await getAdminDb()
    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter)

    // Step 3: Build the query based on user role and apply filters
    // Use the simplest possible approach to avoid complex composite indexes
    let query: Query<Entity>

    if (userRole === UserRole.ADMIN || userRole === UserRole.CONFIDENTIAL) {
      // Admins and confidential users can see all entities
      // Use simple query without orderBy to avoid index requirements
      query = entitiesCollection.limit(limit)
    } else {
      // For other users, fetch public entities only
      // Use simple equality query without orderBy to avoid index requirements
      query = entitiesCollection
        .where('visibility', '==', 'public')
        .limit(limit)
    }

    // Step 4: Handle pagination using `startAfter`
    if (startAfter) {
      const startAfterDoc = await entitiesCollection.doc(startAfter).get()
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc)
      }
    }

    // Step 5: Execute the query and process results
    const snapshot: QuerySnapshot<Entity> = await query.get()

    // Step 6: Map document snapshots to Entity objects and apply additional filtering if needed
    let entities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }))

    // For non-admin users, we need to filter in memory to include subscriber and role-specific entities
    // This is a trade-off to avoid complex indexes while still providing role-based access
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      // For now, we'll only show public entities to avoid the index issue
      // TODO: Implement a more sophisticated approach for subscriber and role-specific entities
      entities = entities.filter(entity => 
        entity.visibility === 'public' || 
        entity.visibility === 'subscriber' || 
        entity.visibility === userRole
      )
    }

    // Step 7: Get the ID of the last visible document for pagination
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null

    console.log('Services: getEntities - Total entities fetched:', entities.length)

    return { entities, lastVisible }
  } catch (error) {
    console.error('Services: getEntities - Error:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching entities')
  }
}

/**
 * Fetch all confidential entities.
 * 
 * This function performs the following steps:
 * 1. Authenticates the user and retrieves their session information.
 * 2. Validates the user's role and permissions.
 * 3. Accesses Firestore and initializes the entities collection with the entity converter.
 * 4. Builds and executes a query for confidential entities.
 * 5. Maps and returns the resulting confidential entities.
 * 
 * User steps:
 * 1. User requests confidential entities (e.g., from an admin panel).
 * 2. The function authenticates the user and checks if they have the necessary permissions.
 * 3. If authorized, the function fetches all confidential entities.
 * 4. The function returns the confidential entities to the user.
 * 
 * @returns {Promise<Entity[]>} A promise that resolves to an array of confidential Entity objects.
 * @throws {Error} If the user is not authenticated, lacks necessary permissions, or if an error occurs during the fetching process.
 */
export async function getConfidentialEntities(): Promise<Entity[]> {
  try {
    console.log('Services: getConfidentialEntities - Starting...')

    // Step 1: Authenticate and get user session
    const session = await getServerAuthSession()
    if (!session || !session.user) {
      throw new Error('Unauthorized access')
    }

    const userRole = session.user.role as UserRole

    // Step 2: Validate user role and permissions
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
      throw new Error('Access denied. Only ADMIN or CONFIDENTIAL users can fetch confidential entities.')
    }

    console.log(`Services: getConfidentialEntities - User authenticated with role ${userRole}`)

    // Step 3: Access Firestore and initialize collection with converter
    const adminDb = await getAdminDb()
    const entitiesCollection = adminDb.collection('entities').withConverter(entityConverter)

    // Step 4: Build and execute query for confidential entities
    const query = entitiesCollection.where('isConfidential', '==', true)
    const snapshot: QuerySnapshot<Entity> = await query.get()

    // Step 5: Map and return resulting confidential entities
    const confidentialEntities = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }))

    console.log('Services: getConfidentialEntities - Total confidential entities fetched:', confidentialEntities.length)

    return confidentialEntities
  } catch (error) {
    console.error('Services: getConfidentialEntities - Error:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred while fetching confidential entities')
  }
}

