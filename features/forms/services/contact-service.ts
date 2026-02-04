import { initializeDatabase, getDatabaseService } from '@/lib/database/DatabaseService';
import { revalidatePath } from 'next/cache';

/**
 * ContactService: Handles contact form submissions
 * 
 * Ring-native implementation using DatabaseService
 * MUTATIONS - NO CACHE! (contact form submissions)
 */
export const ContactService = {
  /**
   * Submit contact form
   * 
   * Creates contact form submission in database and triggers admin notifications
   * 
   * @param {Object} data - The contact form data
   * @param {string} data.name - The name of the person submitting the form
   * @param {string} data.email - The email address of the person submitting the form
   * @param {string} data.message - The message content
   * @returns {Promise<void>} A promise that resolves when the submission is complete
   * @throws {Error} If there's an error submitting the contact form
   */
  async submitContactForm(data: { name: string; email: string; message: string }): Promise<void> {
    try {
      await initializeDatabase();
      const db = getDatabaseService();

      // Prepare the data for submission
      const submissionData = {
        ...data,
        createdAt: new Date(),
        status: 'new',
        ipAddress: 'server-side-submission',
      };

      // Save to database (MUTATION - NO CACHE!)
      const createResult = await db.create('contactForms', submissionData);
      if (!createResult.success) {
        throw createResult.error || new Error('Failed to create contact form');
      }

      console.log(`Contact form submitted successfully with ID: ${createResult.data.id}`);

      // Revalidate admin contact forms page (React 19 pattern)
      revalidatePath('/[locale]/admin/contact-forms');

    } catch (error) {
      console.error("Error submitting contact form:", error);
      
      // Error logging (best effort)
      try {
        await initializeDatabase();
        const db = getDatabaseService();
        await db.create('errorLogs', {
          error: (error as Error).message,
          timestamp: new Date(),
          operation: 'submitContactForm',
        });
      } catch (logError) {
        console.error("Error logging to errorLogs collection:", logError);
      }

      throw new Error('Failed to submit contact form. Please try again later.');
    }
  },

  /**
   * Retrieve contact form submissions (admin)
   * 
   * READ operation - uses React 19 cache() for performance
   * 
   * @param {number} limit - The maximum number of submissions to retrieve
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array<{id: string, data: any}>>} Array of submission objects
   * @throws {Error} If there's an error retrieving the submissions
   */
  async getContactFormSubmissions(limit: number, offset: number = 0): Promise<Array<{id: string, data: any}>> {
    try {
      await initializeDatabase();
      const db = getDatabaseService();

      // Query contact forms (READ - can be cached)
      const queryResult = await db.query({
        collection: 'contactForms',
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit, offset }
      });

      if (!queryResult.success) {
        throw queryResult.error || new Error('Failed to fetch contact forms');
      }

      const submissions = queryResult.data.map(doc => ({
        id: doc.id,
        data: doc
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

