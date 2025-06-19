import { getAdminDb, getAdminRtdbRef, setAdminRtdbData, setAdminRtdbOnDisconnect, getAdminRtdbServerTimestamp } from '@/lib/firebase-admin.server';
import { Entity } from '@/features/entities/types';
import { auth } from '@/auth';
import { UserRole } from '@/features/auth/types';

export async function createEntity(data: Omit<Entity, 'id' | 'onlineStatus' | 'lastOnline'>): Promise<Entity> {
  console.log('Services: createEntity - Starting creation of new entity...');

  try {
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized access');
    }

    const { id: userId, role: userRole } = session.user;

    console.log(`Services: createEntity - User authenticated with ID ${userId} and role ${userRole}`);

    if (data.isConfidential) {
      if (userRole !== UserRole.CONFIDENTIAL && userRole !== UserRole.ADMIN) {
        throw new Error('Only ADMIN or CONFIDENTIAL users can create confidential entities.');
      }
    } else {
      if (userRole !== UserRole.MEMBER && userRole !== UserRole.ADMIN && userRole !== UserRole.CONFIDENTIAL) {
        throw new Error('Only ADMIN, MEMBER, or CONFIDENTIAL users can create entities with presence.');
      }
    }

    const adminDb = await getAdminDb();
    const entitiesCollection = adminDb.collection('entities');

    const initialData = {
      ...data,
      addedBy: userId,
      onlineStatus: false,
      lastOnline: null,
    };

    const docRef = await entitiesCollection.add(initialData);
    const entityId = docRef.id;

    console.log('Services: createEntity - Entity created successfully with ID:', entityId);

    if (userRole === UserRole.MEMBER || userRole === UserRole.CONFIDENTIAL || userRole === UserRole.ADMIN) {
      await setupPresenceDetection(entityId, entitiesCollection);
    } else {
      console.log(`Services: createEntity - Presence detection not enabled as user role is ${userRole}.`);
    }

    const docSnap = await docRef.get();
    const entityData = docSnap.data() as Omit<Entity, 'id'>;

    // Construct the final Entity object, explicitly including the id
    const createdEntity: Entity = {
      id: entityId,
      ...entityData,
    };

    return createdEntity;

  } catch (error) {
    console.error('Services: createEntity - Error creating entity:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred while creating entity');
  }
}

async function setupPresenceDetection(entityId: string, entitiesCollection: FirebaseFirestore.CollectionReference): Promise<void> {
  console.log('Services: createEntity - Enabling presence detection for eligible user roles.');

  const onlineRef = getAdminRtdbRef(`entities/${entityId}/online`);
  const lastOnlineRef = getAdminRtdbRef(`entities/${entityId}/lastOnline`);
  const connectedRef = getAdminRtdbRef('.info/connected');

  connectedRef.on('value', (snapshot) => {
    if (snapshot.val() === true) {
      console.log('Services: Realtime presence - Connected to Firebase Realtime Database.');

      setAdminRtdbData(`entities/${entityId}/online`, true);

      const onDisconnect = setAdminRtdbOnDisconnect(`entities/${entityId}/online`);
      onDisconnect.set(false);

      const lastOnlineDisconnect = setAdminRtdbOnDisconnect(`entities/${entityId}/lastOnline`);
      lastOnlineDisconnect.set(getAdminRtdbServerTimestamp());

      entitiesCollection.doc(entityId).update({
        onlineStatus: true,
      }).then(() => {
        console.log('Services: Firestore - Entity updated to online.');
      });
    } else {
      console.log('Services: Realtime presence - Not connected.');
    }
  });
}

