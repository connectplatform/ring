import { db } from '@/lib/database';
import { revalidatePath } from 'next/cache';

/**
 * ContactService: Handles contact form submissions
 *
 * Ring-native implementation using DatabaseService
 * MUTATIONS - NO CACHE! (contact form submissions)
 */
export const ContactService = {
  async submitContactForm(data: { name: string; email: string; message: string }): Promise<void> {
    try {
      const submissionData = {
        ...data,
        createdAt: new Date(),
        status: 'new',
        ipAddress: 'server-side-submission',
      };

      const createResult = await db().createDoc('contactForms', submissionData);
      if (!createResult.success) {
        throw createResult.error || new Error('Failed to create contact form');
      }

      console.log(`Contact form submitted successfully with ID: ${createResult.data?.id}`);

      revalidatePath('/[locale]/admin/contact-forms');

    } catch (error) {
      console.error("Error submitting contact form:", error);

      try {
        await db().createDoc('errorLogs', {
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

  async getContactFormSubmissions(limit: number, offset: number = 0): Promise<Array<{id: string, data: any}>> {
    try {
      const queryResult = await db().queryDocs<Record<string, unknown>>({
        collection: 'contactForms',
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        pagination: { limit, offset }
      });

      if (!queryResult.success || !queryResult.data) {
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
