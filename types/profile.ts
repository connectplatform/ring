import { AuthUser } from '@/features/auth/types'
import { Session } from 'next-auth'

export interface ProfileFormData {
  name?: string;
  email?: string;
  bio?: string;
  walletAddress?: string;
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
}



export interface ProfileWrapperProps {
  initialUser: AuthUser | null;
  initialError: string | null;
  params: { id?: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

