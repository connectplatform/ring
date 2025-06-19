// import { useState, useEffect } from 'react';
// import FirebaseService from '@/lib/firebase-service';
// import { Entity } from '@/features/entities/types';
// import { UserRole } from '@/features/auth/types';

// export function useentities(userRole: UserRole) {
//   const [entities, setentities] = useState<Entity[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<Error | null>(null);

//   useEffect(() => {
//     async function fetchEntities() {
//       try {
//         const data = await FirebaseService.getEntities(userRole);
//         setentities(data);
//       } catch (err) {
//         setError(err instanceof Error ? err : new Error('An unknown error occurred'));
//       } finally {
//         setLoading(false);
//       }
//     }

//     fetchEntities();
//   }, [userRole]);

//   return { entities, loading, error };
// }