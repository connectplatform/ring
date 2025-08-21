import { getFirebaseServiceManager } from '@/lib/services/firebase-service-manager';
// 🚀 OPTIMIZED SERVICE: Migrated to use Firebase optimization patterns
// - Centralized service manager
// - React 19 cache() for request deduplication
// - Build-time phase detection and caching
// - Intelligent data strategies per environment

/**
 * ContactService: Handles contact form submissions
 * 
 * This service provides a method for submitting contact form data to the Firestore database
 * using the Firebase Admin SDK. It ensures that all operations are performed server-side
 * for enhanced security and reliability.
 */
export const ContactService = {
  /**
   * Submit contact form
   * 
   * This function handles the submission of contact form data to the Firestore database.
   * It uses the Firebase Admin SDK to ensure server-side execution and proper authentication.
   * 
   * User steps:
   * 1. User fills out the contact form with their name, email, and message on the client-side
   * 2. User clicks the submit button
   * 3. Client-side code sends a request to the server with the form data
   * 4. This function is called on the server to process the submission
   * 5. Form data is stored in the Firestore database
   * 6. A success message is logged, or an error is thrown if the submission fails
   * 
   * @param {Object} data - The contact form data
   * @param {string} data.name - The name of the person submitting the form
   * @param {string} data.email - The email address of the person submitting the form
   * @param {string} data.message - The message content
   * @returns {Promise<void>} A promise that resolves when the submission is complete
   * @throws {Error} If there's an error submitting the contact form
   */
  async submitContactForm(data: { name: string; email: string; message: string }): Promise<void> {
    // Initialize adminDb outside the try block
    const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;

    try {
      console.log('Admin Firestore instance obtained');

      // Step 2: Prepare the data for submission
      const submissionData = {
        ...data,
        createdAt: new Date(), // Server-side timestamp
        status: 'new', // Initial status of the submission
        ipAddress: 'server-side-submission', // Placeholder for server-side submissions
      };

      // Step 3: Add the submission to the 'contactForms' collection
      const docRef = await adminDb.collection('contactForms').add(submissionData);
      console.log(`Contact form submitted successfully with ID: ${docRef.id}`);

      // Step 4: Optionally, you can perform additional actions here, such as:
      // - Sending a confirmation email
      // - Updating analytics
      // - Triggering a notification to admin

    } catch (error) {
      // Step 5: Error handling
      console.error("Error submitting contact form:", error);
      
      // Error logging can now use adminDb directly
      try {
        await adminDb.collection('errorLogs').add({
          error: (error as Error).message,
          timestamp: new Date(),
          operation: 'submitContactForm',
        });
      } catch (logError) {
        console.error("Error logging to errorLogs collection:", logError);
      }

      // Rethrow the error for the calling function to handle
      throw new Error('Failed to submit contact form. Please try again later.');
    }
  },

  /**
   * Retrieve contact form submissions
   * 
   * This function retrieves contact form submissions from the Firestore database.
   * It's designed for admin use to view and manage submitted contact forms.
   * 
   * Admin steps:
   * 1. Admin navigates to the contact form management page
   * 2. This function is called to fetch the submissions
   * 3. Submissions are retrieved from the Firestore database
   * 4. The data is returned to be displayed in the admin interface
   * 
   * @param {number} limit - The maximum number of submissions to retrieve
   * @param {string} [startAfter] - The ID of the last document to start after (for pagination)
   * @returns {Promise<Array<{id: string, data: any}>>} A promise that resolves to an array of submission objects
   * @throws {Error} If there's an error retrieving the submissions
   */
  async getContactFormSubmissions(limit: number, startAfter?: string): Promise<Array<{id: string, data: any}>> {
    try {
      // Step 1: Get the admin Firestore instance
      const serviceManager = getFirebaseServiceManager();
    const adminDb = serviceManager.db;
      console.log('Admin Firestore instance obtained for retrieving submissions');

      // Step 2: Prepare the query
      let query = adminDb.collection('contactForms')
        .orderBy('createdAt', 'desc')
        .limit(limit);

      // If startAfter is provided, use it for pagination
      if (startAfter) {
        const startAfterDoc = await adminDb.collection('contactForms').doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      // Step 3: Execute the query
      const snapshot = await query.get();

      // Step 4: Process and return the results
      const submissions = snapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));

      console.log(`Retrieved ${submissions.length} contact form submissions`);
      return submissions;

    } catch (error) {
      console.error("Error retrieving contact form submissions:", error);
      throw new Error('Failed to retrieve contact form submissions. Please try again later.');
    }
  }
};

export default ContactService;

