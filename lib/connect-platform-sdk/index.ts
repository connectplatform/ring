/**
 * Connect Platform TypeScript SDK
 * Modern, type-safe client for Connect Platform v7/v8
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';
import bert from '@/lib/shims/bert-js';

// Protocol Message Types
export enum ConnectMessageType {
  // Authentication
  RequestVerification = 'RequestVerification',
  ConfirmVerification = 'ConfirmVerification',
  SocialAuth = 'SocialAuth',
  User = 'User',
  UpdateUser = 'UpdateUser',
  Logout = 'Logout',
  
  // Contacts & Users
  Contact = 'Contact',
  SyncContacts = 'SyncContacts',
  FindUser = 'FindUser',
  AddContact = 'AddContact',
  BlockContact = 'BlockContact',
  UnBlockContact = 'UnBlockContact',
  
  // Messaging
  Message = 'Message',
  EditMessage = 'EditMessage',
  Delete = 'Delete',
  Retrieve = 'Retrieve',
  ChatUpdates = 'ChatUpdates',
  Typing = 'Typing',
  MarkAsRead = 'MarkAsRead',
  MessageReceived = 'MessageReceived',
  
  // Rooms (Groups)
  Room = 'Room',
  GetCircle = 'GetCircle',
  AddToRoom = 'AddToRoom',
  KickFromRoom = 'KickFromRoom',
  ChangeRoomTopic = 'ChangeRoomTopic',
  
  // Feed Posts (Business Profiles)
  FeedPost = 'FeedPost',
  FeedPostCreate = 'FeedPostCreate',
  FeedPostUpdate = 'FeedPostUpdate',
  Like = 'Like',
  Dislike = 'Dislike',
  
  // Advanced Features
  LiberateSynapse = 'LiberateSynapse',
  SynapseDiscovered = 'SynapseDiscovered',
  BotUpdate = 'BotUpdate',
  WorkflowTransit = 'WorkflowTransit',
  CreateCsr = 'CreateCsr',
  
  // Events
  ChatUpdate = 'ChatUpdate',
  ContactChanged = 'ContactChanged',
  ProfileChanged = 'ProfileChanged',
  UserStatusChanged = 'UserStatusChanged',
  
  // Errors
  ErrorResp = 'ErrorResp'
}

// Core Types
export interface ConnectUser {
  id: string;
  name: string;
  username: string;
  isBot: boolean;
  isVendor: boolean;
  photo?: string;
  thumbnail?: string;
  phone?: string;
  email?: string;
  roles: string[];
  bio?: string;
  data?: string; // JSON encoded additional data
}

export interface ConnectMessage {
  id: string;
  type: 'userMessage' | 'systemNotification';
  kind: 'text' | 'image' | 'video' | 'audio' | 'map' | 'document' | 'sticker' | 'call';
  created: number;
  origin: string;
  recipient: string;
  payload: string;
  media?: MediaEntity[];
  geo?: [number, number];
  isEdited?: boolean;
  reply?: ConnectMessage;
  forward?: ConnectMessage;
}

export interface MediaEntity {
  type: 'image' | 'video' | 'audio' | 'document' | 'text' | 'link';
  caption?: string;
  link: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  name?: string;
  size?: number;
}

export interface FeedPost {
  id: string;
  type: string;
  categories: string[];
  tags: string[];
  title: string;
  descr: string;
  media: MediaEntity[];
  location?: [number, number];
  userId: string;
  created: number;
  vendorId?: string;
  likes: number;
  isLiked: boolean;
}

export interface SynapseStream {
  id: string;
  sender: string;
  feedType: number;
  feedId: string;
  data: ArrayBuffer;
  metadata: string;
}

// SDK Configuration
export interface ConnectSDKConfig {
  httpUrl: string;
  wsUrl: string;
  accessToken?: string;
  version?: string;
  ssl?: boolean;
  debug?: boolean;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

// Event Types
export type ConnectEventMap = {
  connected: () => void;
  disconnected: (reason: string) => void;
  messageReceived: (message: ConnectMessage, feedId: string) => void;
  chatUpdate: (update: any) => void;
  synapseDiscovered: (synapse: SynapseStream) => void;
  error: (error: Error) => void;
  rateLimit: (retryAfter: number) => void;
};

/**
 * Main Connect Platform SDK Class
 */
export class ConnectPlatformSDK extends EventEmitter {
  private config: ConnectSDKConfig;
  private http: AxiosInstance;
  private ws?: WebSocket;
  private isConnected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private messageQueue: Array<{ message: any; callback?: (response: any) => void }> = [];
  private pendingRequests = new Map<number, (response: any) => void>();
  private currentUser?: ConnectUser;

  constructor(config: ConnectSDKConfig) {
    super();
    this.config = {
      version: 'v7',
      ssl: true,
      debug: false,
      autoReconnect: true,
      reconnectInterval: 5000,
      ...config
    };

    // Initialize HTTP client
    this.http = axios.create({
      baseURL: this.config.httpUrl,
      headers: {
        'Content-Type': 'application/x-bert',
        'X-API-Version': this.config.version,
        ...(this.config.accessToken && {
          'Authorization': `Bearer ${this.config.accessToken}`
        })
      }
    });

    // Add response interceptor for rate limiting
    this.http.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          this.emit('rateLimit', retryAfter);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authentication Methods
   */
  async requestVerification(phone: string, deviceType: 'mobile' | 'desktop' = 'mobile'): Promise<void> {
    const message = {
      phone,
      deviceType: deviceType === 'mobile' ? 1 : 2
    };
    
    await this.call(ConnectMessageType.RequestVerification, message);
  }

  async confirmVerification(phone: string, smsCode: string, deviceInfo?: {
    os?: 'ios' | 'android' | 'desktop' | 'web';
    deviceId?: string;
    deviceName?: string;
  }): Promise<{ token: string; user: ConnectUser }> {
    const message = {
      phone,
      smsCode,
      os: this.mapPlatform(deviceInfo?.os || 'web'),
      deviceId: deviceInfo?.deviceId || this.generateDeviceId(),
      deviceName: deviceInfo?.deviceName || 'Ring Platform Web'
    };
    
    const response = await this.call(ConnectMessageType.ConfirmVerification, message);
    
    // Store token
    this.config.accessToken = response.token;
    this.http.defaults.headers['Authorization'] = `Bearer ${response.token}`;
    
    // Get user profile
    const userResponse = await this.call(ConnectMessageType.User, {});
    this.currentUser = userResponse.user;
    
    return { token: response.token, user: userResponse.user };
  }

  async socialAuth(network: 'facebook' | 'google', accessToken: string): Promise<{ token: string; user: ConnectUser }> {
    const message = {
      network: network === 'facebook' ? 1 : 2,
      accessToken,
      os: this.mapPlatform('web'),
      deviceId: this.generateDeviceId(),
      deviceName: 'Ring Platform Web'
    };
    
    const response = await this.call(ConnectMessageType.SocialAuth, message);
    
    // Store token
    this.config.accessToken = response.token;
    this.http.defaults.headers['Authorization'] = `Bearer ${response.token}`;
    
    // Get user profile
    const userResponse = await this.call(ConnectMessageType.User, {});
    this.currentUser = userResponse.user;
    
    return { token: response.token, user: userResponse.user };
  }

  /**
   * User Management
   */
  async getCurrentUser(): Promise<ConnectUser> {
    const response = await this.call(ConnectMessageType.User, {});
    this.currentUser = response.user;
    return response.user;
  }

  async updateUser(updates: Partial<ConnectUser>): Promise<ConnectUser> {
    const response = await this.call(ConnectMessageType.UpdateUser, {
      user: updates
    });
    this.currentUser = response.user;
    return response.user;
  }

  /**
   * Contact Management
   */
  async findUsers(query: { name?: string; userIds?: string[]; isVendor?: boolean }): Promise<ConnectUser[]> {
    const response = await this.call(ConnectMessageType.FindUser, query);
    return response.contacts;
  }

  async addContact(userId: string, name?: string): Promise<any> {
    const response = await this.call(ConnectMessageType.AddContact, {
      contact: { userId, name }
    });
    return response.contact;
  }

  /**
   * Messaging
   */
  async sendMessage(feedId: string, content: string, options?: {
    feedType?: 'chat' | 'room';
    media?: MediaEntity[];
    replyTo?: string;
    location?: [number, number];
  }): Promise<ConnectMessage> {
    const message = {
      feedType: options?.feedType === 'room' ? 2 : 1,
      feedId,
      message: {
        id: this.generateMessageId(),
        type: 1, // userMessage
        kind: 1, // text
        created: Math.floor(Date.now() / 1000),
        origin: this.currentUser?.id,
        recipient: feedId,
        payload: content,
        media: options?.media || [],
        geo: options?.location,
        reply: options?.replyTo ? { id: options.replyTo } : undefined
      }
    };
    
    const response = await this.call(ConnectMessageType.Message, message);
    return response.message;
  }

  async getMessages(feedId: string, options?: {
    feedType?: 'chat' | 'room';
    limit?: number;
    before?: string;
    after?: string;
  }): Promise<ConnectMessage[]> {
    const message = {
      feedType: options?.feedType === 'room' ? 2 : 1,
      feedId,
      top: options?.before || '',
      stop: options?.after || '',
      direction: options?.before ? 1 : 2, // up or down
      count: options?.limit || 50
    };
    
    const response = await this.call(ConnectMessageType.Retrieve, message);
    return response.messages;
  }

  async markAsRead(feedId: string, feedType?: 'chat' | 'room'): Promise<void> {
    await this.call(ConnectMessageType.MarkAsRead, {
      feedType: feedType === 'room' ? 2 : 1,
      feedId
    });
  }

  async sendTyping(feedId: string, feedType?: 'chat' | 'room'): Promise<void> {
    await this.call(ConnectMessageType.Typing, {
      feedType: feedType === 'room' ? 2 : 1,
      feedId,
      userId: ''
    });
  }

  /**
   * Feed Posts (Business Profiles)
   */
  async createFeedPost(post: Partial<FeedPost>): Promise<FeedPost> {
    const response = await this.call(ConnectMessageType.FeedPostCreate, {
      post: {
        type: post.type || 'general',
        categories: post.categories || [],
        tags: post.tags || [],
        title: post.title || '',
        descr: post.descr || '',
        media: post.media || [],
        location: post.location,
        userId: this.currentUser?.id
      }
    });
    return response.post;
  }

  async getFeedPosts(filters?: {
    type?: string;
    categories?: string[];
    tags?: string[];
    location?: [number, number];
    distance?: number;
    skip?: number;
    limit?: number;
  }): Promise<{ posts: FeedPost[]; total: number }> {
    const response = await this.call(ConnectMessageType.FeedPost, filters || {});
    return { posts: response.posts, total: response.total };
  }

  async likeFeedPost(postId: string): Promise<void> {
    await this.call(ConnectMessageType.Like, {
      recordType: 'feed_post',
      recordId: postId
    });
  }

  /**
   * Advanced Features - LiberateSynapse
   */
  async createSynapseStream(config: {
    type: 'sensor' | 'video' | 'audio' | 'presentation' | 'mixed';
    targetId: string;
    streams?: Array<{ type: string; id: string; label?: string }>;
    includeOwnStream?: boolean;
  }): Promise<string> {
    const synapseData = {
      synapse: {
        id: this.generateSynapseId(),
        sender: this.currentUser?.id,
        feedType: 1, // Based on type
        feedId: config.targetId,
        data: new ArrayBuffer(0),
        metadata: JSON.stringify({
          type: config.type,
          streams: config.streams || []
        })
      },
      sendToMe: config.includeOwnStream || false
    };
    
    const response = await this.call(ConnectMessageType.LiberateSynapse, synapseData);
    return synapseData.synapse.id;
  }

  /**
   * WebSocket Connection
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.wsUrl}?token=${this.config.accessToken}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'X-API-Version': this.config.version || 'v7'
        }
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        this.emit('connected');
        this.processMessageQueue();
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleWebSocketMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.emit('disconnected', reason.toString());
        
        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  disconnect(): void {
    this.config.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Core API Call Method
   */
  private async call(messageType: ConnectMessageType, data: any): Promise<any> {
    const ref = this.generateRef();
    const message = {
      ref,
      ...data
    };

    // Encode to BERT
    const encoded = bert.encode(message);

    try {
      const response = await this.http.post(`/api/${this.config.version}`, encoded, {
        headers: {
          'Content-Type': 'application/x-bert'
        },
        responseType: 'arraybuffer'
      });

      // Decode BERT response
      const decoded = bert.decode(new Uint8Array(response.data));
      
      // Check for errors
      if (decoded.code && decoded.message) {
        throw new Error(`${decoded.messageType}: ${decoded.message}`);
      }

      return decoded;
    } catch (error: any) {
      if (error.response?.data) {
        try {
          const errorData = bert.decode(new Uint8Array(error.response.data));
          throw new Error(`${errorData.messageType || 'Error'}: ${errorData.message || 'Unknown error'}`);
        } catch {
          // Fall through to default error
        }
      }
      throw error;
    }
  }

  /**
   * WebSocket Message Handling
   */
  private handleWebSocketMessage(data: Buffer): void {
    try {
      const decoded = bert.decode(new Uint8Array(data));
      const messageType = this.getMessageType(decoded);

      if (this.config.debug) {
        console.log('WebSocket message:', messageType, decoded);
      }

      switch (messageType) {
        case ConnectMessageType.MessageReceived:
          this.emit('messageReceived', decoded.message, decoded.feedId);
          break;
          
        case ConnectMessageType.ChatUpdate:
          this.emit('chatUpdate', decoded.update);
          break;
          
        case ConnectMessageType.SynapseDiscovered:
          this.emit('synapseDiscovered', decoded.synapse);
          break;
          
        case ConnectMessageType.ContactChanged:
          this.emit('contactChanged', decoded.contact);
          break;
          
        case ConnectMessageType.UserStatusChanged:
          this.emit('userStatusChanged', decoded.status);
          break;
          
        default:
          if (decoded.ref && this.pendingRequests.has(decoded.ref)) {
            const callback = this.pendingRequests.get(decoded.ref);
            this.pendingRequests.delete(decoded.ref);
            callback?.(decoded);
          }
      }
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Utility Methods
   */
  private generateRef(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSynapseId(): string {
    return `syn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeviceId(): string {
    return `device_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapPlatform(platform: string): number {
    const platformMap: Record<string, number> = {
      'ios': 1,
      'android': 2,
      'desktop': 3,
      'web': 4
    };
    return platformMap[platform] || 4;
  }

  private getMessageType(message: any): string {
    // Connect Platform uses the first field as message type
    const keys = Object.keys(message);
    return keys.find(key => key !== 'ref') || 'Unknown';
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.emit('error', error);
        this.scheduleReconnect();
      });
    }, this.config.reconnectInterval);
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const { message, callback } = this.messageQueue.shift()!;
      this.sendWebSocketMessage(message, callback);
    }
  }

  private sendWebSocketMessage(message: any, callback?: (response: any) => void): void {
    if (!this.isConnected || !this.ws) {
      this.messageQueue.push({ message, callback });
      return;
    }

    if (callback && message.ref) {
      this.pendingRequests.set(message.ref, callback);
    }

    const encoded = bert.encode(message);
    this.ws.send(encoded);
  }
}

/**
 * Helper function to create SDK instance
 */
export function createConnectSDK(config: ConnectSDKConfig): ConnectPlatformSDK {
  return new ConnectPlatformSDK(config);
}

// Types are already exported above