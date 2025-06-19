# TODO: Implement All Users Session Tracking# TODO: Implement All Users Session Tracking

## Objective
Implement a unified session tracking system for both guest and authenticated users, allowing for persistent user settings and smooth transition from guest to authenticated status.

## Key Components

### 1. Modified UserSettings Interface
```typescript
export interface UserSettings {
  id: string; // Used as sessionID for all users
  userId?: string; // Optional, links to authenticated users
  language: string;
  notifications: boolean;
  theme: 'light' | 'dark' | 'system';
  notificationPreferences: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}
```

### 2. Updated User Interfaces

```typescript
 export interface GuestUser {export interface GuestUser {
  id: string; // This will be the sessionId
  role: 'guest';
  settings: UserSettings;
  ipAddress?: string;
  browserInfo?: string;
  locale?: string;
  timezone?: string;
  createdAt: Date;
  lastVisit: Date;
}

export interface BaseAuthUser extends Omit<GuestUser, 'role'> {
  role: Exclude<UserRole, 'guest'>;
  authProvider: 'google' | 'apple' | 'metamask' | 'credentials';
  authProviderId: string;
  email: string;
  emailVerified: Date | null;
  name: string | null;
  image?: string | null;
}
```

## Implementation Steps

1. Update User Types:

1. Modify `GuestUser` and `BaseAuthUser` interfaces in `@/features/auth/types.ts`.
2. Ensure all other user types (SubscriberUser, MemberUser, etc.) extend from `BaseAuthUser`.



2. Implement Session Management Functions:

1. Create a new file `@/lib/sessionManagement.ts` with the following functions:
```typescript
import { v4 as uuidv4 } from 'uuid';import { v4 as uuidv4 } from 'uuid';

async function getOrCreateUserSettings(userId?: string): Promise<UserSettings> {
  // Implementation details as discussed earlier
}

async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  // Implementation details as discussed earlier
}

async function linkGuestSettingsToUser(userId: string): Promise<void> {
  // Implementation details as discussed earlier
}

// Database interaction functions (to be implemented based on your database choice)
async function getUserSettingsFromDatabase(id: string): Promise<UserSettings | null> {
  // Implementation depends on the database
}

async function saveUserSettingsToDatabase(settings: UserSettings): Promise<void> {
  // Implementation depends on the database
}
```

3. Integrate Session Management in Authentication Flow:
   1. Update `@/features/auth/adapters/customAdapter.ts` to use the new session management functions.
   2. Modify the `createUser`, `getUser`, and other relevant methods to handle the new UserSettings structure.

4. Update Client-Side Session Handling:
   1. Modify `@/lib/firebaseAuth.ts` to incorporate session ID generation and management for guest users.
   2. Update authentication functions (e.g., `signInWithGoogle`, `signInWithEmail`) to link guest settings to authenticated users.

5. Implement Session Tracking in App Layout:
   1. Update `@/app/layout.tsx` to check for existing session ID on each page load.
   2. If no session ID exists, generate one and create default user settings.

6. Update User Settings Component:
   1. Modify `@/features/auth/components/Settings.tsx` to use the new `updateUserSettings` function.
   2. Ensure it can handle both guest and authenticated user scenarios.

7. Implement Cleanup Strategy:
   1. Create a background job to periodically clean up unused guest settings.
   2. This could be implemented as a serverless function or a cron job, depending on your hosting environment.


## Testing Scenarios

1. Guest User Flow:
   1. Visit the site as a new user.
   2. Verify that a session ID is generated and stored.
   3. Change some settings and verify they persist across page reloads.

2. Guest to Authenticated Transition:
   1. Start as a guest user with some custom settings.
   2. Sign up or log in.
   3. Verify that the settings are transferred to the authenticated user profile.

3. Returning Authenticated User:
   1. Log out and clear local storage.
   2. Log back in.
   3. Verify that the user's settings are retrieved from the database.

4. Multi-Tab Behavior:
   1. Open the site in multiple tabs as a guest user.
   2. Verify that the same session ID is used across all tabs.
   3. Make changes in one tab and verify they reflect in others.

5. Performance Testing:
   1. Simulate high traffic to ensure the session management system scales well.

## Security Considerations

- Ensure that session IDs are securely generated and stored.
- Implement proper access controls to prevent unauthorized access to user settings.
- Be mindful of data privacy regulations (e.g., GDPR) when storing guest user data.

## Future Enhancements

- Implement session expiration for guest users.
- Add more granular control over which settings are shared between guest and authenticated sessions.
- Consider implementing a way for users to manage or delete their guest sessions.

