/**
 * Make User a Vendor Script
 * 
 * This script:
 * 1. Finds user by email
 * 2. Creates a vendor Entity for them (with storeActivated: true)
 * 3. Updates user role to include 'vendor'
 * 
 * Usage: npm run make-vendor automart@gmail.com "AutoMart Store"
 */

import { initializeDatabase, getDatabaseService } from '../lib/database/DatabaseService'

async function makeUserVendor(email: string, storeName: string) {
  console.log('🔥 Making user a VENDOR...')
  console.log(`Email: ${email}`)
  console.log(`Store Name: ${storeName}`)
  
  try {
    // Initialize database
    await initializeDatabase()
    const db = getDatabaseService()
    
    // 1. Find user by email
    console.log('\n📧 Finding user by email...')
    const usersResult = await db.query({
      collection: 'users',
      filters: [{
        field: 'email',
        operator: '=',
        value: email
      }]
    })
    
    if (!usersResult.success || !usersResult.data) {
      console.error('❌ User not found with email:', email)
      console.log('\n💡 Create user first by logging in once, then run this script')
      process.exit(1)
    }
    
    const usersArray = Array.isArray(usersResult.data) ? usersResult.data : (usersResult.data as any).data || []
    if (usersArray.length === 0) {
      console.error('❌ User not found with email:', email)
      process.exit(1)
    }
    
    const user = usersArray[0]
    console.log('✅ User found:', user.id, user.name || user.email)
    
    // 2. Check if user already has a vendor entity
    console.log('\n🏪 Checking for existing vendor entity...')
    const entitiesResult = await db.query({
      collection: 'entities',
      filters: [{
        field: 'addedBy',
        operator: '=',
        value: user.id
      }, {
        field: 'storeActivated',
        operator: '=',
        value: true
      }]
    })
    
    const entitiesArray = Array.isArray(entitiesResult.data) ? entitiesResult.data : (entitiesResult.data as any)?.data || []
    if (entitiesResult.success && entitiesArray.length > 0) {
      console.log('⚠️  User already has a vendor entity!')
      const existingEntity = entitiesArray[0]
      console.log('Existing store:', existingEntity.name)
      console.log('Store ID:', existingEntity.id)
      console.log('Store Status:', existingEntity.storeStatus)
      return
    }
    
    // 3. Create vendor entity
    console.log('\n🏗️  Creating vendor entity...')
    const entityId = `entity_vendor_${Date.now()}`
    const entity = {
      id: entityId,
      name: storeName,
      description: `${storeName} - Multi-vendor store powered by Ring Platform`,
      addedBy: user.id,
      createdBy: user.id,
      category: 'vendor',
      type: 'vendor-store',
      storeActivated: true,
      storeStatus: 'open',
      vendorTier: 'NEW', // Start as NEW vendor (20% commission)
      vendorRating: 0,
      vendorTotalSales: 0,
      vendorTotalOrders: 0,
      commission: 20, // 20% for NEW vendors
      slug: storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      avatar: '',
      banner: '',
      isPublic: true,
      isVerified: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
    
    const entityResult = await db.create('entities', entity)
    
    if (!entityResult.success) {
      console.error('❌ Failed to create entity:', entityResult.error)
      process.exit(1)
    }
    
    console.log('✅ Vendor entity created!')
    console.log('Entity ID:', entityId)
    console.log('Store Status: open')
    console.log('Vendor Tier: NEW (20% commission)')
    
    // 4. Update user role to include vendor
    console.log('\n👤 Updating user role...')
    const currentRole = user.role || 'user'
    const roles = currentRole.split(',').map((r: string) => r.trim())
    
    if (!roles.includes('vendor')) {
      roles.push('vendor')
    }
    
    const updatedUser = {
      ...user,
      role: roles.join(','),
      lastUpdated: new Date().toISOString()
    }
    
    const updateResult = await db.update('users', user.id, updatedUser)
    
    if (!updateResult.success) {
      console.error('❌ Failed to update user role:', updateResult.error)
      console.log('Entity created but user role not updated')
      process.exit(1)
    }
    
    console.log('✅ User role updated!')
    console.log('New role:', updatedUser.role)
    
    // 5. Summary
    console.log('\n════════════════════════════════════════════════════════════')
    console.log('🏆 VENDOR CREATION COMPLETE! 🏆')
    console.log('════════════════════════════════════════════════════════════')
    console.log('')
    console.log('User:', user.name || user.email)
    console.log('Email:', user.email)
    console.log('Role:', updatedUser.role)
    console.log('')
    console.log('Vendor Store:', storeName)
    console.log('Entity ID:', entityId)
    console.log('Store Status: OPEN')
    console.log('Vendor Tier: NEW (20% commission)')
    console.log('')
    console.log('📍 Vendor Dashboard: /vendor/dashboard')
    console.log('🏪 Store URL: /store/vendor/' + entityId)
    console.log('')
    console.log('Next Steps:')
    console.log('1. Login as', user.email)
    console.log('2. Visit /vendor/dashboard')
    console.log('3. Add products to your store')
    console.log('4. Start selling!')
    console.log('════════════════════════════════════════════════════════════')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Get args from command line
const email = process.argv[2]
const storeName = process.argv[3] || 'My Store'

if (!email) {
  console.log('Usage: npm run make-vendor <email> [storeName]')
  console.log('Example: npm run make-vendor automart@gmail.com "AutoMart Store"')
  process.exit(1)
}

makeUserVendor(email, storeName)

