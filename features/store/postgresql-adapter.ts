import { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'
import { getDatabaseService, initializeDatabase } from '@/lib/database'
import { logger } from '@/lib/logger'

export class PostgreSQLStoreAdapter implements StoreAdapter {
  async createProduct(productData: Partial<StoreProduct> & { vendorId: string }): Promise<StoreProduct> {
    try {
      // Initialize database service
      const initResult = await initializeDatabase()
      if (!initResult.success) {
        logger.error('PostgreSQLStoreAdapter: Database initialization failed:', { error: initResult.error })
        throw new Error('Database initialization failed')
      }

      const dbService = getDatabaseService()

      // Generate product ID
      const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Prepare product data for database
      const product = {
        id: productId,
        name: productData.name || '',
        slug: productData.slug || productData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '',
        description: productData.description || '',
        longDescription: productData.longDescription || '',
        price: parseFloat(productData.price || '0'),
        currency: productData.currency || 'USD',
        category: productData.category || 'general',
        images: productData.images || [],
        status: productData.status || 'active',
        vendorId: productData.vendorId,
        vendorName: productData.vendorName || 'Ring Portal Store',
        stock: productData.stock || 9999,
        sku: productData.sku || productId,
        tags: productData.tags || [],
        featured: productData.featured || false,
        rating: productData.rating || 5.0,
        reviewCount: productData.reviewCount || 0,
        billingPeriod: productData.billingPeriod || 'one-time',
        specifications: productData.specifications || {},
        digitalProduct: productData.digitalProduct || false,
        instantDelivery: productData.instantDelivery || false,
        shipping: productData.shipping || null
      }

      // Save to database
      const result = await dbService.create('store_products', product)

      if (!result.success) {
        logger.error('PostgreSQLStoreAdapter: Failed to create product:', { error: result.error })
        throw new Error('Failed to create product')
      }

      logger.info('PostgreSQLStoreAdapter: Product created successfully', { productId })

      // Return the created product in StoreProduct format
      return {
        id: productId,
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        currency: product.currency as any,
        inStock: product.stock > 0,
        category: product.category,
        tags: product.tags,
        productListedAt: ['1'], // Default store
        productOwner: product.vendorId,
        ownerEntityId: undefined,
        storeId: '1', // Default store
        status: product.status as any
      }

    } catch (error) {
      logger.error('PostgreSQLStoreAdapter: Error creating product:', error)
      throw error
    }
  }

  async listProducts(): Promise<StoreProduct[]> {
    try {
      // Initialize database service
      const initResult = await initializeDatabase()
      if (!initResult.success) {
        logger.error('PostgreSQLStoreAdapter: Database initialization failed:', { error: initResult.error })
        return []
      }

      const dbService = getDatabaseService()

      // Query store_products table
      const queryResult = await dbService.query({
        collection: 'store_products',
        filters: [
          { field: 'status', operator: '==', value: 'active' }
        ],
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      })

      if (!queryResult.success) {
        logger.error('PostgreSQLStoreAdapter: Failed to query products:', { error: queryResult.error })
        return []
      }

      // Convert database documents to StoreProduct format
      const products: StoreProduct[] = queryResult.data.map(doc => {
        const data = doc.data
        return {
          id: doc.id,
          name: data?.name || '',
          description: data?.description || '',
          price: data?.price?.toString() || '0',
          currency: (data?.currency as any) || 'USD',
          inStock: (data?.stock || data?.stock_quantity || 0) > 0,
          category: data?.category,
          tags: data?.tags || [],
          vendorName: data?.vendorName || data?.vendor_name,
          productListedAt: ['1'], // Default store
          productOwner: data?.vendorId || data?.vendor_id,
          ownerEntityId: data?.entity_id,
          storeId: '1', // Default store
          status: (data?.status as any) || 'active'
        }
      })

      return products
    } catch (error) {
      logger.error('PostgreSQLStoreAdapter: Error listing products:', error)
      return []
    }
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    try {
      // Initialize database service
      const initResult = await initializeDatabase()
      if (!initResult.success) {
        logger.error('PostgreSQLStoreAdapter: Database initialization failed:', { error: initResult.error })
        throw new Error('Database initialization failed')
      }

      const dbService = getDatabaseService()

      // Generate order ID
      const orderId = this.generateOrderId()

      // Calculate totals
      const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.product.price) * item.quantity)
      }, 0)

      // Create order data for store_orders table
      const orderData = {
        id: orderId,
        buyer_id: null, // Will be set by the calling service
        items: items.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          currency: item.product.currency,
          quantity: item.quantity
        })),
        subtotal: subtotal,
        tax: 0,
        shipping: 0,
        total: subtotal,
        currency: 'USD',
        status: 'pending',
        shipping_address: {
          firstName: info.firstName,
          lastName: info.lastName,
          address: info.address,
          city: info.city,
          postalCode: info.postalCode,
          country: info.country,
          phone: info.phone,
          email: info.email
        },
        billing_address: {
          firstName: info.firstName,
          lastName: info.lastName,
          address: info.address,
          city: info.city,
          postalCode: info.postalCode,
          country: info.country,
          phone: info.phone,
          email: info.email
        },
        notes: info.notes
      }

      // Create the order in database
      const createResult = await dbService.create('store_orders', orderData)
      if (!createResult.success) {
        logger.error('PostgreSQLStoreAdapter: Failed to create order:', { error: createResult.error })
        throw new Error('Failed to create order')
      }

      logger.info('PostgreSQLStoreAdapter: Order created successfully:', { orderId })
      return { orderId }
    } catch (error) {
      logger.error('PostgreSQLStoreAdapter: Error during checkout:', error)
      throw error
    }
  }

  private generateOrderId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `ORD-${timestamp}-${random}`.toUpperCase()
  }
}
