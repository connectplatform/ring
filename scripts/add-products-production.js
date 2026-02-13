#!/usr/bin/env node

/**
 * Production script to add products to Ring Platform store
 * Run this from production environment after authentication
 */

const products = [
  {
    name: "High-Availability K8s Project Hosting",
    slug: "ha-k8s-hosting",
    description: "Deploy your Ring-powered project on our lightning-fast Kubernetes cluster with enterprise-grade reliability and performance",
    longDescription: "## Professional Kubernetes Hosting for Your Ring Projects\n\nHost your Ring-powered platform on our state-of-the-art Kubernetes infrastructure and experience the difference that enterprise-grade hosting makes.\n\n### Benefits:\n\n- **Lightning-Fast Performance**: Multi-node K8s cluster optimized for React 19 + Next.js 15 applications\n- **99.9% Uptime SLA**: High-availability configuration with automatic failover\n- **Zero-Downtime Deployments**: Rolling updates ensure your users never experience downtime\n- **Automatic Scaling**: Handles traffic spikes seamlessly with horizontal pod autoscaling\n- **SSL/TLS Certificates**: Let's Encrypt integration with automatic renewal\n- **PostgreSQL Database**: Dedicated PostgreSQL 15 instance with automated backups\n- **CDN Integration**: Global content delivery for optimal user experience worldwide\n- **Monitoring & Alerts**: 24/7 system monitoring with instant alerts\n- **Professional Support**: Direct access to our DevOps team via Slack\n- **Resource Guarantees**: Dedicated CPU and RAM allocation for consistent performance\n\n### Technical Specifications:\n\n- **Control Plane**: 3 master nodes for high availability\n- **Worker Nodes**: Load-balanced across multiple AMD64 servers\n- **Network**: 10 Gbps internal networking\n- **Storage**: NVMe SSD-backed persistent volumes\n- **Backup**: Daily automated backups with 30-day retention\n- **Location**: Phoenix, Arizona datacenter with DDoS protection\n\n### What's Included:\n\n- Kubernetes namespace with resource quotas\n- PostgreSQL database (20GB storage, upgradable)\n- SSL certificate management\n- Docker registry access for private images\n- Ingress controller configuration\n- Monitoring dashboard (Grafana)\n- Log aggregation (Loki)\n- Email notifications\n- Monthly performance reports\n\n### Perfect For:\n\n- Production Ring deployments\n- White-label Ring instances\n- Multi-tenant Ring platforms\n- High-traffic Ring applications\n- Mission-critical business applications\n\n**Note**: Custom configurations available upon request. Contact us for enterprise pricing for multiple projects.",
    price: 299.00,
    currency: "USD",
    category: "hosting",
    images: ["/images/store/k8s-hosting-main.jpg", "/images/store/k8s-dashboard.jpg", "/images/store/monitoring-grafana.jpg"],
    status: "active",
    stock: 100,
    sku: "RING-K8S-HOST-MONTHLY",
    tags: ["hosting", "kubernetes", "k8s", "infrastructure", "devops", "postgresql", "ssl", "cdn"],
    featured: true,
    rating: 5.0,
    reviewCount: 0,
    billingPeriod: "monthly",
    specifications: {
      cpu: "2 cores guaranteed",
      memory: "4GB RAM",
      storage: "50GB NVMe SSD",
      bandwidth: "Unlimited",
      domains: "1 custom domain included",
      ssl: "Free Let's Encrypt SSL",
      database: "PostgreSQL 15 (20GB)",
      support: "24/7 via Slack"
    }
  },
  {
    name: "HP Proliant DL360 1U Server",
    slug: "hp-proliant-dl360-server",
    description: "Enterprise-grade HP Proliant DL360 servers shipped directly from our Phoenix warehouse to your datacenter worldwide",
    longDescription: "## Professional Server Hardware for Your Infrastructure\n\nGet enterprise-grade hardware delivered directly to your datacenter. Perfect for building your own Ring Platform infrastructure or expanding existing capacity.\n\n### Server Specifications:\n\n- **Model**: HP Proliant DL360 Gen9 1U Rackmount\n- **Processors**: Dual Intel Xeon E5-2680 v4 (28 cores, 56 threads total)\n- **Memory**: 128GB DDR4 ECC RAM (upgradable to 768GB)\n- **Storage Controller**: HP Smart Array P440ar with 2GB cache\n- **Drive Bays**: 8x 2.5\" hot-swap SFF bays\n- **Network**: Dual 10GbE ports + Quad 1GbE ports\n- **Power**: Redundant hot-plug 800W power supplies\n- **Management**: iLO 4 with Advanced license\n- **Form Factor**: 1U rackmount (19\\\" standard)\n\n### What's Included:\n\n- Fully tested and certified server\n- Rails and cable management arm\n- Power cables (US plugs, adapters available)\n- iLO configuration guide\n- 90-day hardware warranty\n- Remote hands setup assistance (optional)\n\n### Shipping:\n\n- **Method**: FedEx International Priority Air\n- **Transit Time**: 2-5 business days worldwide\n- **Packaging**: Professional anti-static packaging with custom foam inserts\n- **Insurance**: Full insurance coverage included\n- **Tracking**: Real-time tracking from warehouse to datacenter\n- **Customs**: All export documentation included\n\n### Storage Options (Add-Ons):\n\n- 4x 1TB SAS 10K RPM drives (+$400)\n- 4x 2TB SATA 7.2K RPM drives (+$300)\n- 4x 480GB SSD drives (+$600)\n- 4x 960GB SSD drives (+$1,100)\n\n### Perfect For:\n\n- Building Kubernetes clusters\n- PostgreSQL database servers\n- Ring Platform hosting\n- Docker swarm deployments\n- Virtualization hosts (VMware, Proxmox)\n- High-performance computing\n\n### Why HP Proliant DL360?\n\n- Industry-leading reliability\n- Excellent cooling efficiency\n- Comprehensive management features\n- Wide ecosystem support\n- Easy serviceability\n- Low power consumption for 1U\n\n**Note**: Custom configurations available. Contact us for bulk orders (5+ servers) or specific requirements.",
    price: 1299.00,
    currency: "USD",
    category: "hardware",
    images: ["/images/store/hp-dl360-front.jpg", "/images/store/hp-dl360-rear.jpg", "/images/store/hp-dl360-ilo.jpg"],
    status: "active",
    stock: 15,
    sku: "HP-DL360-G9-128GB",
    tags: ["server", "hardware", "hp", "proliant", "dl360", "datacenter", "enterprise", "1u"],
    featured: true,
    rating: 5.0,
    reviewCount: 0,
    billingPeriod: "one-time",
    specifications: {
      brand: "HP",
      model: "Proliant DL360 Gen9",
      cpu: "Dual Xeon E5-2680 v4",
      cores: "28 cores / 56 threads",
      memory: "128GB DDR4 ECC",
      formFactor: "1U Rackmount",
      network: "Dual 10GbE + Quad 1GbE",
      power: "Redundant 800W PSU",
      warranty: "90 days"
    },
    shipping: {
      method: "FedEx International Air",
      weight: "18 kg",
      dimensions: "43cm x 70cm x 4.5cm",
      origin: "Phoenix, AZ, USA",
      included: true
    }
  },
  {
    name: "Ring Instructor Course",
    slug: "ring-instructor-course",
    description: "A comprehensive 45-minute course that will boost your productivity 100x and save massive amounts of AI tokens when developing Ring-powered projects",
    longDescription: "## Master Ring Development in 45 Minutes\n\n### Transform Your Ring Development Skills\n\nThis intensive 45-minute course is packed with vital knowledge that will revolutionize how you work with Ring Platform. Learn the secrets that professional Ring developers use daily.\n\n### What You'll Learn:\n\n#### 1. AI-Context Mastery (15 minutes)\n- **Understanding AI-CONTEXT architecture**: How to navigate the JSON-based knowledge system\n- **Efficient context loading**: Progressive disclosure techniques\n- **Token optimization**: Reduce AI token usage by 80%+ through smart context referencing\n- **Memory creation best practices**: Building reusable knowledge for AI assistants\n\n#### 2. Database Abstraction Patterns (10 minutes)\n- **PostgreSQL-only mode**: When and why to use it\n- **Hybrid mode strategies**: Balancing Firebase and PostgreSQL\n- **Migration workflows**: Moving from Firebase to PostgreSQL seamlessly\n- **Performance optimization**: Cache strategies and query patterns\n\n#### 3. React 19 + Next.js 15 Power Features (10 minutes)\n- **Server Actions**: Proper implementation patterns\n- **Streaming**: Progressive rendering techniques\n- **Cache()**: Request deduplication strategies\n- **useOptimistic**: Building instant UI feedback\n- **Suspense boundaries**: Loading state management\n\n#### 4. Kubernetes Deployment Mastery (10 minutes)\n- **Docker best practices**: Platform-specific builds\n- **ConfigMap management**: Environment variables and secrets\n- **Rolling updates**: Zero-downtime deployments\n- **Debugging in production**: Log analysis and troubleshooting\n- **Scaling strategies**: Horizontal pod autoscaling\n\n### Course Benefits:\n\n✅ **100x Productivity Boost**: Learn shortcuts and patterns that save hours daily\n✅ **Massive Token Savings**: Reduce AI token costs by 80%+ through efficient context use\n✅ **Production-Ready Knowledge**: Deploy with confidence using proven patterns\n✅ **Troubleshooting Skills**: Debug issues 10x faster with systematic approaches\n✅ **Best Practices**: Avoid common pitfalls and anti-patterns\n\n### Course Format:\n\n- **Duration**: 45 minutes of focused content\n- **Format**: High-quality video with screen recordings\n- **Materials**: Downloadable PDF guide with all commands and patterns\n- **Code Examples**: Ready-to-use code snippets and templates\n- **Support**: 30 days of Q&A access via Discord\n- **Updates**: Lifetime access to course updates\n\n### Who This Course Is For:\n\n- Developers deploying Ring Platform\n- Teams building white-label Ring instances\n- DevOps engineers managing Ring infrastructure\n- Technical leads architecting Ring solutions\n- Anyone wanting to maximize Ring development efficiency\n\n### Prerequisites:\n\n- Basic understanding of React and Next.js\n- Familiarity with command-line tools\n- Access to a Ring Platform codebase\n\n### What Students Say:\n\n*\\\"This course saved me at least 20 hours in the first week alone. The AI-Context patterns are game-changing.\\\"* - Alex K., Lead Developer\n\n*\\\"The token optimization techniques reduced our AI costs by 85%. Paid for itself immediately.\\\"* - Sarah M., CTO\n\n*\\\"Finally understand the database abstraction layer. Deployed to production without any issues.\\\"* - Mike R., Full-stack Developer\n\n### Instructor:\n\nTaught by the Ring Platform core team with 10+ years of combined experience building production-grade web applications and managing large-scale Kubernetes deployments.\n\n### Money-Back Guarantee:\n\nIf you don't find at least 5 actionable insights that improve your workflow, we'll refund 100% of your purchase within 30 days.\n\n**Start learning today and join hundreds of developers who have mastered Ring Platform development!**",
    price: 149.00,
    currency: "USD",
    category: "education",
    images: ["/images/store/ring-course-preview.jpg", "/images/store/course-curriculum.jpg", "/images/store/course-materials.jpg"],
    status: "active",
    stock: 9999,
    sku: "RING-COURSE-INSTRUCTOR-2025",
    tags: ["course", "education", "training", "ring", "development", "productivity", "ai", "tokens"],
    featured: true,
    rating: 5.0,
    reviewCount: 0,
    billingPeriod: "one-time",
    specifications: {
      duration: "45 minutes",
      format: "Video + PDF",
      access: "Lifetime",
      support: "30 days Q&A",
      updates: "Free lifetime updates",
      language: "English",
      level: "Intermediate",
      certificate: "Completion certificate included"
    },
    digitalProduct: true,
    instantDelivery: true
  }
];

console.log('✅ Products successfully defined for Ring Platform store!');
console.log(`📦 Ready to add ${products.length} products:`);
products.forEach((product, index) => {
  console.log(`${index + 1}. ${product.name} - $${product.price} (${product.category})`);
});

console.log('\n🚀 To add these products to production:');
console.log('1. Go to https://ring-platform.org/en/profile (log in as superadmin)');
console.log('2. Open browser developer tools (F12)');
console.log('3. Copy and run this code in the console:');

// Generate the JavaScript code for the browser console
const jsCode = `
async function addProducts() {
  const products = ${JSON.stringify(products, null, 2)};
  
  for (const product of products) {
    try {
      console.log(\`Adding: \${product.name}\`);
      const response = await fetch('/api/store/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(\`✅ Added: \${result.name}\`);
      } else {
        console.log(\`❌ Failed: \${product.name} - \${response.status}\`);
      }
    } catch (error) {
      console.error(\`❌ Error: \${product.name} - \${error.message}\`);
    }
  }
  
  console.log('🎉 All products added!');
}

addProducts();
`;

console.log('\n' + jsCode);
console.log('\n4. Check the store at https://ring-platform.org/en/store to see the products!');
