#!/usr/bin/env node

/**
 * Firebase News Feature Setup Script
 * 
 * This script sets up the Firebase Firestore collection and indexes for the News feature.
 * It creates sample news articles and sets up proper indexes for efficient querying.
 */

import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const serviceAccount = JSON.parse(
  await readFile(new URL('./svc.json', import.meta.url))
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Sample news articles
const sampleNews = [
  {
    id: 'news-1',
    title: 'Ring Platform Launches v0.5 with Enhanced Features',
    slug: 'ring-platform-v05-launch',
    content: `
      <p>We're excited to announce the launch of Ring Platform v0.5, featuring significant improvements and new capabilities.</p>
      
      <h3>Key Features:</h3>
      <ul>
        <li>Enhanced user authentication with crypto wallet support</li>
        <li>Improved entity management system</li>
        <li>Advanced opportunity matching algorithms</li>
        <li>Real-time notification system</li>
        <li>Comprehensive analytics dashboard</li>
      </ul>
      
      <p>This release represents months of development and community feedback integration.</p>
    `,
    excerpt: 'Ring Platform v0.5 brings enhanced features including crypto wallet support, improved entity management, and advanced opportunity matching.',
    authorId: 'admin',
    authorName: 'Ring Team',
    category: 'platform-updates',
    tags: ['platform', 'update', 'features', 'v0.5'],
    featuredImage: '/images/news/ring-v05-launch.jpg',
    status: 'published',
    visibility: 'public',
    featured: true,
    views: 0,
    likes: 0,
    comments: 0,
    publishedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    seo: {
      metaTitle: 'Ring Platform v0.5 Launch - Enhanced Features and Capabilities',
      metaDescription: 'Discover the new features in Ring Platform v0.5 including crypto wallet support, improved entity management, and advanced opportunity matching.',
      keywords: ['ring platform', 'update', 'features', 'crypto wallet', 'entity management']
    }
  },
  {
    id: 'news-2',
    title: 'New Partnership Opportunities Available',
    slug: 'new-partnership-opportunities',
    content: `
      <p>Ring Platform is expanding its network with exciting new partnership opportunities across multiple industries.</p>
      
      <h3>Available Partnerships:</h3>
      <ul>
        <li>Technology integration partnerships</li>
        <li>Strategic business alliances</li>
        <li>Research and development collaborations</li>
        <li>Industry-specific partnerships</li>
      </ul>
      
      <p>These partnerships will help members access new markets and technologies.</p>
    `,
    excerpt: 'Explore exciting new partnership opportunities across technology, business, and research sectors on Ring Platform.',
    authorId: 'admin',
    authorName: 'Partnership Team',
    category: 'partnerships',
    tags: ['partnerships', 'business', 'opportunities', 'collaboration'],
    featuredImage: '/images/news/partnership-opportunities.jpg',
    status: 'published',
    visibility: 'public',
    featured: false,
    views: 0,
    likes: 0,
    comments: 0,
    publishedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    seo: {
      metaTitle: 'New Partnership Opportunities - Ring Platform',
      metaDescription: 'Discover new partnership opportunities across technology, business, and research sectors on Ring Platform.',
      keywords: ['partnerships', 'business opportunities', 'collaboration', 'technology']
    }
  },
  {
    id: 'news-3',
    title: 'Community Spotlight: Success Stories',
    slug: 'community-spotlight-success-stories',
    content: `
      <p>This month, we're highlighting amazing success stories from our Ring Platform community.</p>
      
      <h3>Featured Success Stories:</h3>
      <ul>
        <li>TechCorp's successful funding round</li>
        <li>InnovateLab's breakthrough research</li>
        <li>StartupX's market expansion</li>
        <li>DevTeam's product launch</li>
      </ul>
      
      <p>These stories demonstrate the power of collaboration and innovation within our community.</p>
    `,
    excerpt: 'Celebrating success stories from the Ring Platform community, showcasing the power of collaboration and innovation.',
    authorId: 'admin',
    authorName: 'Community Team',
    category: 'community',
    tags: ['community', 'success stories', 'collaboration', 'innovation'],
    featuredImage: '/images/news/community-spotlight.jpg',
    status: 'published',
    visibility: 'member',
    featured: true,
    views: 0,
    likes: 0,
    comments: 0,
    publishedAt: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
    seo: {
      metaTitle: 'Community Spotlight: Success Stories - Ring Platform',
      metaDescription: 'Celebrating success stories from the Ring Platform community, showcasing collaboration and innovation.',
      keywords: ['community', 'success stories', 'collaboration', 'innovation', 'ring platform']
    }
  }
];

async function setupNewsCollection() {
  console.log('🔧 Setting up News collection...');
  
  try {
    // Create news collection and add sample data
    const newsCollection = db.collection('news');
    
    for (const article of sampleNews) {
      await newsCollection.doc(article.id).set(article);
      console.log(`✅ Created news article: ${article.title}`);
    }
    
    console.log('✅ News collection setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up news collection:', error);
    throw error;
  }
}

async function setupNewsIndexes() {
  console.log('📊 Setting up Firestore indexes...');
  
  // Note: Indexes are typically created automatically when queries are made
  // Or they can be defined in firestore.indexes.json
  
  console.log('ℹ️  Indexes will be created automatically when queries are executed.');
  console.log('ℹ️  Add custom indexes to firestore.indexes.json if needed.');
}

async function setupNewsCategories() {
  console.log('🏷️  Setting up news categories...');
  
  const categories = [
    {
      id: 'platform-updates',
      name: 'Platform Updates',
      description: 'Latest updates and new features on Ring Platform',
      color: '#4F46E5',
      icon: '🚀'
    },
    {
      id: 'partnerships',
      name: 'Partnerships',
      description: 'Partnership opportunities and business collaborations',
      color: '#059669',
      icon: '🤝'
    },
    {
      id: 'community',
      name: 'Community',
      description: 'Community news, events, and success stories',
      color: '#DC2626',
      icon: '👥'
    },
    {
      id: 'industry-news',
      name: 'Industry News',
      description: 'Latest news and trends in the industry',
      color: '#7C2D12',
      icon: '📰'
    },
    {
      id: 'events',
      name: 'Events',
      description: 'Upcoming events, webinars, and conferences',
      color: '#9333EA',
      icon: '📅'
    }
  ];
  
  try {
    const categoriesCollection = db.collection('newsCategories');
    
    for (const category of categories) {
      await categoriesCollection.doc(category.id).set({
        ...category,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      });
      console.log(`✅ Created news category: ${category.name}`);
    }
    
    console.log('✅ News categories setup completed!');
    
  } catch (error) {
    console.error('❌ Error setting up news categories:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting Firebase News Feature Setup...');
    console.log('='.repeat(50));
    
    await setupNewsCollection();
    await setupNewsCategories();
    await setupNewsIndexes();
    
    console.log('='.repeat(50));
    console.log('✅ Firebase News Feature Setup completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Update firestore.rules to include news security rules');
    console.log('2. Add news API routes to your application');
    console.log('3. Create React components for news display');
    console.log('4. Test the news functionality');
    console.log('');
    console.log('🔍 Sample data created:');
    console.log(`- ${sampleNews.length} news articles`);
    console.log(`- 5 news categories`);
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
main();