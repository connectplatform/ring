// import { 
//   getAuth, 
//   signInWithPopup, 
//   Googleauth-provider, 
//   signInWithEmailAndPassword, 
//   createUserWithEmailAndPassword, 
//   sendPasswordResetEmail, 
//   updateProfile, 
//   sendEmailVerification,
//   User
// } from 'firebase/auth';
// import { AuthUser, UserRole } from '@/features/auth/types';
// import { createOrUpdateUserProfile } from '../users/userProfileService';

// /**
//  * AuthService: Handles all authentication-related operations
//  * 
//  * This service provides methods for user authentication, registration,
//  * and related operations using Firebase Authentication.
//  */
// export const AuthService = {
//   /**
//    * Sign in with Google
//    * 
//    * User steps:
//    * 1. User clicks on "Sign in with Google" button
//    * 2. Google sign-in popup appears
//    * 3. User selects their Google account
//    * 4. User is signed in and returned to the application
//    * 
//    * @returns {Promise<User>} A promise that resolves to the signed-in user
//    * @throws {Error} If there's an error during the sign-in process
//    */
//   async signInWithGoogle(): Promise<User> {
//     const firebaseAuth = getAuth();
//     const provider = new Googleauth-provider();
//     provider.addScope('https://www.googleapis.com/auth/contacts.readonly');
//     try {
//       const result = await signInWithPopup(firebaseAuth, provider);
//       return result.user;
//     } catch (error) {
//       console.error('Error signing in with Google:', error);
//       throw error;
//     }
//   },

//   /**
//    * Sign in with email and password
//    * 
//    * User steps:
//    * 1. User enters their email and password
//    * 2. User clicks on "Sign in" button
//    * 3. User is authenticated and signed in
//    * 
//    * @param {string} email - The user's email address
//    * @param {string} password - The user's password
//    * @returns {Promise<User>} A promise that resolves to the signed-in user
//    * @throws {Error} If there's an error during the sign-in process
//    */
//   async signInWithEmail(email: string, password: string): Promise<User> {
//     const firebaseAuth = getAuth();
//     try {
//       const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
//       return userCredential.user;
//     } catch (error) {
//       console.error("Error signing in with email and password:", error);
//       throw error;
//     }
//   },

//   /**
//    * Sign up with email, password, and name
//    * 
//    * User steps:
//    * 1. User enters their email, password, and name
//    * 2. User clicks on "Sign up" button
//    * 3. New account is created and user is signed in
//    * 4. User profile is created/updated in the database
//    * 
//    * @param {string} email - The user's email address
//    * @param {string} password - The user's chosen password
//    * @param {string} name - The user's name
//    * @returns {Promise<User>} A promise that resolves to the newly created user
//    * @throws {Error} If there's an error during the sign-up process
//    */
//   async signUpWithEmail(email: string, password: string, name: string): Promise<User> {
//     const firebaseAuth = getAuth();
//     try {
//       const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
//       await updateProfile(userCredential.user, { displayName: name });
//       await createOrUpdateUserProfile({
//         id: userCredential.user.uid,
//         email: userCredential.user.email || '',
//         name: userCredential.user.displayName || '',
//         role: UserRole.SUBSCRIBER,
//         isVerified: false,
//         createdAt: new Date(),
//         lastLogin: new Date(),
//         // ... other default user properties
//       });
//       return userCredential.user;
//     } catch (error) {
//       console.error("Error signing up with email and password:", error);
//       throw error;
//     }
//   },

//   /**
//    * Send password reset email
//    * 
//    * User steps:
//    * 1. User clicks on "Forgot password" link
//    * 2. User enters their email address
//    * 3. User clicks on "Reset password" button
//    * 4. Password reset email is sent to the user
//    * 
//    * @param {string} email - The email address to send the password reset link to
//    * @returns {Promise<void>}
//    * @throws {Error} If there's an error sending the password reset email
//    */
//   async sendPasswordReset(email: string): Promise<void> {
//     const firebaseAuth = getAuth();
//     try {
//       await sendPasswordResetEmail(firebaseAuth, email);
//     } catch (error) {
//       console.error("Error sending password reset email:", error);
//       throw error;
//     }
//   },

//   /**
//    * Send email verification
//    * 
//    * User steps:
//    * 1. User signs up or requests email verification
//    * 2. Verification email is sent to the user's email address
//    * 
//    * @param {User} user - The user object for which to send the verification email
//    * @returns {Promise<void>}
//    * @throws {Error} If there's an error sending the verification email
//    */
//   async sendVerificationEmail(user: User): Promise<void> {
//     try {
//       await sendEmailVerification(user);
//       console.log("Verification email sent successfully");
//     } catch (error) {
//       console.error("Error sending verification email:", error);
//       throw error;
//     }
//   },
// };

// export default AuthService;
