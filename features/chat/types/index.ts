// /features/chat/types/index.ts
import { Timestamp } from 'firebase/firestore';

export interface chat {
  id: string;
  participants: string[];
  opportunityId: string;
  messages: {
    id: string;
    senderId: string;
    content: string;
    timestamp: Timestamp;
  }[];
}