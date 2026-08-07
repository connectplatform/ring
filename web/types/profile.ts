import { AuthUser } from '@/features/auth/types'
import { Session } from 'next-auth'

export interface ProfileFormData {
  name?: string;
  email?: string;
  username?: string;
  bio?: string;
  walletAddress?: string;
  publicProfile?: boolean | string;
  publicProfileSections?: string | string[];
  publicProfileFields?: Record<string, Record<string, boolean>> | string;
  acceptProfileDms?: boolean | string;
  publicProfileNftListings?: boolean | string;
  publicProfileMedia?: Record<string, boolean> | string;
}

export interface ProfileUpdateState {
  success: boolean;
  message: string;
}

export interface ProfileContentProps {
  initialUser: AuthUser | null;
  initialError: string | null;
  params: { id?: string };
  searchParams: { [key: string]: string | string[] | undefined };
  session: Session | null;
  updateProfile: (prevState: ProfileUpdateState, formData: FormData) => Promise<ProfileUpdateState>;
  tunnelReady?: boolean; // PHASE 1: Progressive tunnel loading
}



export interface ProfileWrapperProps {
  initialUser: AuthUser | null;
  initialError: string | null;
  params: { id?: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

