export { createNewUserWithEmail } from './create-new-user-with-email';
export { createNewUserWithWallet } from './create-new-user-with-wallet';
export { createUser } from './create-user';
export { deleteUser } from './delete-user';
export { getUserById } from './get-user-by-id';
export { getUserByWalletAddress } from './get-user-by-wallet-address';
export { getUserProfile } from './get-user-profile';
export { getUsersByRole } from './get-users-by-role';
export { getUserSettings } from './get-user-settings';
export { updateProfile } from './update-profile';
export { updateUserRole } from './update-user-role';
export { updateUserSettings } from './update-user-settings';

// Account deletion services
export { 
  requestAccountDeletion,
  cancelAccountDeletion, 
  confirmAccountDeletion,
  getAccountDeletionStatus,
  processExpiredDeletions
} from './account-deletion';
