/**
 * Email CRM Module
 * ================
 */

// Contact Service
export { EmailContactService, getEmailContactService, InMemoryContactRepository } from './email-contact-service';
export type { 
  EmailContact, 
  ContactType, 
  SentimentEntry,
  ContactCreateInput,
  ContactUpdateInput,
  ContactSearchParams,
  ContactRepository 
} from './email-contact-service';

// Task Service
export { EmailTaskService, getEmailTaskService, InMemoryTaskRepository } from './task-service';
export type { 
  EmailTask, 
  TaskType, 
  TaskStatus, 
  TaskPriority,
  TaskCreateInput,
  TaskUpdateInput,
  TaskCompleteInput,
  TaskSearchParams,
  TaskAutoCreationRule,
  TaskRepository
} from './task-service';
