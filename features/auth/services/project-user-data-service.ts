// ============================================================================
// PROJECT-SPECIFIC USER DATA SERVICE
// Handles isolated user behavior tracking per project
// ============================================================================

import { cache } from 'react';
import {
  ProjectUserDataService as IProjectUserDataService,
  UserProjectSession,
  UserProductInteraction,
  UserFavorite,
  UserCartHistory,
  UserSearchHistory,
  UserContentEngagement,
  UserProjectNotification,
  UserProjectAchievement,
  UserProjectFeedback
} from '@/features/auth/types';
import { getDatabaseService, initializeDatabase } from '@/lib/database';

/**
 * Project-specific user data service implementation
 * Manages isolated user behavior data per project while maintaining global user identity
 */
class ProjectUserDataServiceImpl implements IProjectUserDataService {
  private projectSlug: string;

  constructor(projectSlug: string) {
    this.projectSlug = projectSlug;
  }

  // ============================================================================
  // SESSION TRACKING
  // ============================================================================

  async trackSession(sessionData: Omit<UserProjectSession, 'id' | 'createdAt'>): Promise<UserProjectSession> {
    console.log(`📊 ProjectUserDataService - Tracking session for user ${sessionData.globalUserId} in project ${this.projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const session: UserProjectSession = {
        id: crypto.randomUUID(),
        ...sessionData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_project_sessions', session);
      if (!result.success) {
        throw new Error(`Failed to create session: ${result.error}`);
      }

      return session;
    } catch (error) {
      console.error('ProjectUserDataService - Error tracking session:', error);
      throw error;
    }
  }

  async getUserSessions(globalUserId: string, projectSlug: string, limit: number = 10): Promise<UserProjectSession[]> {
    console.log(`📊 ProjectUserDataService - Getting sessions for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      // Query with filter for user and project
      const dbQuery = {
        collection: 'user_project_sessions',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug }
        ],
        orderBy: [{ field: 'session_start', direction: 'desc' as const }],
        pagination: { limit }
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query sessions: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting sessions:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRODUCT INTERACTIONS
  // ============================================================================

  async recordInteraction(interactionData: Omit<UserProductInteraction, 'id' | 'createdAt'>): Promise<UserProductInteraction> {
    console.log(`📊 ProjectUserDataService - Recording interaction for user ${interactionData.globalUserId} on product ${interactionData.productId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const interaction: UserProductInteraction = {
        id: crypto.randomUUID(),
        ...interactionData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_product_interactions', interaction);
      if (!result.success) {
        throw new Error(`Failed to record interaction: ${result.error}`);
      }

      return interaction;
    } catch (error) {
      console.error('ProjectUserDataService - Error recording interaction:', error);
      throw error;
    }
  }

  async getUserInteractions(globalUserId: string, projectSlug: string, type?: string): Promise<UserProductInteraction[]> {
    console.log(`📊 ProjectUserDataService - Getting interactions for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const filters: any[] = [
        { field: 'global_user_id', operator: '==', value: globalUserId },
        { field: 'project_slug', operator: '==', value: projectSlug }
      ];

      if (type) {
        filters.push({ field: 'interaction_type', operator: '==', value: type });
      }

      const dbQuery = {
        collection: 'user_product_interactions',
        filters,
        orderBy: [{ field: 'created_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query interactions: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting interactions:', error);
      throw error;
    }
  }

  // ============================================================================
  // FAVORITES MANAGEMENT
  // ============================================================================

  async addFavorite(favoriteData: Omit<UserFavorite, 'id' | 'createdAt'>): Promise<UserFavorite> {
    console.log(`📊 ProjectUserDataService - Adding favorite for user ${favoriteData.globalUserId}: ${favoriteData.favoriteType} ${favoriteData.favoriteId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const favorite: UserFavorite = {
        id: crypto.randomUUID(),
        ...favoriteData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_favorites', favorite);
      if (!result.success) {
        throw new Error(`Failed to add favorite: ${result.error}`);
      }

      return favorite;
    } catch (error) {
      console.error('ProjectUserDataService - Error adding favorite:', error);
      throw error;
    }
  }

  async removeFavorite(globalUserId: string, projectSlug: string, favoriteType: string, favoriteId: string): Promise<void> {
    console.log(`📊 ProjectUserDataService - Removing favorite for user ${globalUserId}: ${favoriteType} ${favoriteId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const dbQuery = {
        collection: 'user_favorites',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug },
          { field: 'favorite_type', operator: '==', value: favoriteType },
          { field: 'favorite_id', operator: '==', value: favoriteId }
        ]
      };

      // Find the document first
      const findResult = await dbService.query(dbQuery);
      if (!findResult.success || !findResult.data || findResult.data.length === 0) {
        throw new Error(`Favorite not found: ${favoriteType} ${favoriteId}`);
      }

      // Delete by ID
      const result = await dbService.delete('user_favorites', findResult.data[0].id);
      if (!result.success) {
        throw new Error(`Failed to remove favorite: ${result.error}`);
      }
    } catch (error) {
      console.error('ProjectUserDataService - Error removing favorite:', error);
      throw error;
    }
  }

  async getUserFavorites(globalUserId: string, projectSlug: string, type?: string): Promise<UserFavorite[]> {
    console.log(`📊 ProjectUserDataService - Getting favorites for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const filters: any[] = [
        { field: 'global_user_id', operator: '==', value: globalUserId },
        { field: 'project_slug', operator: '==', value: projectSlug }
      ];

      if (type) {
        filters.push({ field: 'favorite_type', operator: '==', value: type });
      }

      const dbQuery = {
        collection: 'user_favorites',
        filters,
        orderBy: [{ field: 'created_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query favorites: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting favorites:', error);
      throw error;
    }
  }

  // ============================================================================
  // CART ANALYTICS
  // ============================================================================

  async trackCartAction(cartData: Omit<UserCartHistory, 'id' | 'addedAt'>): Promise<UserCartHistory> {
    console.log(`📊 ProjectUserDataService - Tracking cart action for user ${cartData.globalUserId} on product ${cartData.productId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const cartAction: UserCartHistory = {
        id: crypto.randomUUID(),
        ...cartData,
        projectSlug: this.projectSlug,
        addedAt: new Date()
      };

      const result = await dbService.create('user_cart_history', cartAction);
      if (!result.success) {
        throw new Error(`Failed to track cart action: ${result.error}`);
      }

      return cartAction;
    } catch (error) {
      console.error('ProjectUserDataService - Error tracking cart action:', error);
      throw error;
    }
  }

  async getCartHistory(globalUserId: string, projectSlug: string, status?: string): Promise<UserCartHistory[]> {
    console.log(`📊 ProjectUserDataService - Getting cart history for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const filters: any[] = [
        { field: 'global_user_id', operator: '==', value: globalUserId },
        { field: 'project_slug', operator: '==', value: projectSlug }
      ];

      if (status) {
        filters.push({ field: 'cart_status', operator: '==', value: status });
      }

      const dbQuery = {
        collection: 'user_cart_history',
        filters,
        orderBy: [{ field: 'added_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query cart history: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting cart history:', error);
      throw error;
    }
  }

  // ============================================================================
  // SEARCH ANALYTICS
  // ============================================================================

  async recordSearch(searchData: Omit<UserSearchHistory, 'id' | 'createdAt'>): Promise<UserSearchHistory> {
    console.log(`📊 ProjectUserDataService - Recording search for user ${searchData.globalUserId}: "${searchData.searchQuery}"`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const search: UserSearchHistory = {
        id: crypto.randomUUID(),
        ...searchData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_search_history', search);
      if (!result.success) {
        throw new Error(`Failed to record search: ${result.error}`);
      }

      return search;
    } catch (error) {
      console.error('ProjectUserDataService - Error recording search:', error);
      throw error;
    }
  }

  async getSearchHistory(globalUserId: string, projectSlug: string): Promise<UserSearchHistory[]> {
    console.log(`📊 ProjectUserDataService - Getting search history for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const dbQuery = {
        collection: 'user_search_history',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug }
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' as const }],
        pagination: { limit: 100 }
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query search history: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting search history:', error);
      throw error;
    }
  }

  // ============================================================================
  // CONTENT ENGAGEMENT
  // ============================================================================

  async recordEngagement(engagementData: Omit<UserContentEngagement, 'id' | 'createdAt'>): Promise<UserContentEngagement> {
    console.log(`📊 ProjectUserDataService - Recording engagement for user ${engagementData.globalUserId} on ${engagementData.contentType} ${engagementData.contentId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const engagement: UserContentEngagement = {
        id: crypto.randomUUID(),
        ...engagementData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_content_engagement', engagement);
      if (!result.success) {
        throw new Error(`Failed to record engagement: ${result.error}`);
      }

      return engagement;
    } catch (error) {
      console.error('ProjectUserDataService - Error recording engagement:', error);
      throw error;
    }
  }

  async getEngagementHistory(globalUserId: string, projectSlug: string, contentType?: string): Promise<UserContentEngagement[]> {
    console.log(`📊 ProjectUserDataService - Getting engagement history for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const filters: any[] = [
        { field: 'global_user_id', operator: '==', value: globalUserId },
        { field: 'project_slug', operator: '==', value: projectSlug }
      ];

      if (contentType) {
        filters.push({ field: 'content_type', operator: '==', value: contentType });
      }

      const dbQuery = {
        collection: 'user_content_engagement',
        filters,
        orderBy: [{ field: 'created_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query engagement history: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting engagement history:', error);
      throw error;
    }
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  async updateNotificationSettings(settingsData: Omit<UserProjectNotification, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProjectNotification> {
    console.log(`📊 ProjectUserDataService - Updating notification settings for user ${settingsData.globalUserId} on ${settingsData.notificationType}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const settings: UserProjectNotification = {
        id: crypto.randomUUID(),
        ...settingsData,
        projectSlug: this.projectSlug,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Check if settings already exist
      const findQuery = {
        collection: 'user_project_notifications',
        filters: [
          { field: 'global_user_id', operator: '==', value: settingsData.globalUserId },
          { field: 'project_slug', operator: '==', value: this.projectSlug },
          { field: 'notification_type', operator: '==', value: settingsData.notificationType }
        ]
      };

      const findResult = await dbService.query(findQuery);

      if (findResult.success && findResult.data && findResult.data.length > 0) {
        // Update existing settings
        const updateResult = await dbService.update('user_project_notifications', findResult.data[0].id, {
          ...settings,
          updated_at: new Date().toISOString()
        });

        if (updateResult.success && updateResult.data) {
          return {
            ...updateResult.data.data,
            id: updateResult.data.id
          };
        }
      }

      // If no existing record, create new one
      const createResult = await dbService.create('user_project_notifications', settings);
      if (!createResult.success) {
        throw new Error(`Failed to update notification settings: ${createResult.error}`);
      }

      return settings;
    } catch (error) {
      console.error('ProjectUserDataService - Error updating notification settings:', error);
      throw error;
    }
  }

  async getNotificationSettings(globalUserId: string, projectSlug: string): Promise<UserProjectNotification[]> {
    console.log(`📊 ProjectUserDataService - Getting notification settings for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const dbQuery = {
        collection: 'user_project_notifications',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug }
        ]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query notification settings: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting notification settings:', error);
      throw error;
    }
  }

  // ============================================================================
  // ACHIEVEMENTS
  // ============================================================================

  async unlockAchievement(achievementData: Omit<UserProjectAchievement, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserProjectAchievement> {
    console.log(`📊 ProjectUserDataService - Unlocking achievement for user ${achievementData.globalUserId}: ${achievementData.achievementId}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const achievement: UserProjectAchievement = {
        id: crypto.randomUUID(),
        ...achievementData,
        projectSlug: this.projectSlug,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await dbService.create('user_project_achievements', achievement);
      if (!result.success) {
        throw new Error(`Failed to unlock achievement: ${result.error}`);
      }

      return achievement;
    } catch (error) {
      console.error('ProjectUserDataService - Error unlocking achievement:', error);
      throw error;
    }
  }

  async getUserAchievements(globalUserId: string, projectSlug: string): Promise<UserProjectAchievement[]> {
    console.log(`📊 ProjectUserDataService - Getting achievements for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const dbQuery = {
        collection: 'user_project_achievements',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug }
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query achievements: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting achievements:', error);
      throw error;
    }
  }

  // ============================================================================
  // FEEDBACK
  // ============================================================================

  async submitFeedback(feedbackData: Omit<UserProjectFeedback, 'id' | 'createdAt'>): Promise<UserProjectFeedback> {
    console.log(`📊 ProjectUserDataService - Submitting feedback for user ${feedbackData.globalUserId}: ${feedbackData.feedbackType}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const feedback: UserProjectFeedback = {
        id: crypto.randomUUID(),
        ...feedbackData,
        projectSlug: this.projectSlug,
        createdAt: new Date()
      };

      const result = await dbService.create('user_project_feedback', feedback);
      if (!result.success) {
        throw new Error(`Failed to submit feedback: ${result.error}`);
      }

      return feedback;
    } catch (error) {
      console.error('ProjectUserDataService - Error submitting feedback:', error);
      throw error;
    }
  }

  async getUserFeedback(globalUserId: string, projectSlug: string): Promise<UserProjectFeedback[]> {
    console.log(`📊 ProjectUserDataService - Getting feedback for user ${globalUserId} in project ${projectSlug}`);

    try {
      const initResult = await initializeDatabase();
      if (!initResult.success) {
        throw new Error(`Database initialization failed: ${initResult.error}`);
      }

      const dbService = getDatabaseService();

      const dbQuery = {
        collection: 'user_project_feedback',
        filters: [
          { field: 'global_user_id', operator: '==', value: globalUserId },
          { field: 'project_slug', operator: '==', value: projectSlug }
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' as const }]
      };

      const result = await dbService.query(dbQuery);

      if (!result.success) {
        throw new Error(`Failed to query feedback: ${result.error}`);
      }

      return (result.data || []).map(doc => ({
        ...doc.data,
        id: doc.id
      }));
    } catch (error) {
      console.error('ProjectUserDataService - Error getting feedback:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create project-specific user data service
 * @param projectSlug The project identifier (e.g., 'ring_platform', 'enterprise_client')
 * @returns ProjectUserDataService instance
 */
export const createProjectUserDataService = cache((projectSlug: string): IProjectUserDataService => {
  return new ProjectUserDataServiceImpl(projectSlug);
});

/**
 * Get the current project's user data service
 * @returns ProjectUserDataService for the current project context
 */
export const getCurrentProjectUserDataService = cache((): IProjectUserDataService => {
  // In a real implementation, this would get the project slug from context/environment
  // For now, defaulting to 'ring_platform'
  const projectSlug = process.env.NEXT_PUBLIC_PROJECT_SLUG || 'ring_platform';
  return createProjectUserDataService(projectSlug);
});
