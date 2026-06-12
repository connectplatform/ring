import { StoreAdapter, StoreProduct, CartItem, CheckoutInfo } from './types'
import { db } from '@/lib/database'
import { logger } from '@/lib/logger'

type ProductRow = Record<string, unknown> & { id: string }

function mapProductRow(row: ProductRow): StoreProduct {
  return {
    id: row.id,
    name: (row.name as string) || '',
    description: (row.description as string) || '',
    price: row.price?.toString() || '0',
    currency: (row.currency as StoreProduct['currency']) || 'USD',
    inStock: ((row.stock as number) || (row.stock_quantity as number) || 0) > 0,
    stock: typeof row.stock === 'number' ? row.stock : parseInt(String(row.stock ?? '0'), 10) || 0,
    category: row.category as string | undefined,
    tags: Array.isArray(row.tags)
      ? row.tags as string[]
      : typeof row.tags === 'string'
        ? (() => { try { return JSON.parse(row.tags) } catch { return [] } })()
        : [],
    images: (row.pictures as string[]) || (row.images as string[]) || [],
    sku: row.sku as string | undefined,
    slug: row.slug as string | undefined,
    longDescription: row.longDescription as string | undefined,
    reorderPoint: row.reorderPoint as number | undefined,
    vendorTier: row.vendorTier as StoreProduct['vendorTier'],
    commissionRate: row.commissionRate as number | undefined,
    approvalStatus: row.approvalStatus as StoreProduct['approvalStatus'],
    approvedBy: row.approvedBy as string | undefined,
    approvedAt: row.approvedAt as string | undefined,
    rejectionReason: row.rejectionReason as string | undefined,
    vendorName: (row.vendorName || row.vendor_name) as string | undefined,
    productListedAt: ['1'],
    productOwner: (row.vendorId || row.vendor_id) as string | undefined,
    ownerEntityId: row.entity_id as string | undefined,
    storeId: '1',
    status: ((row.status as StoreProduct['status'] | undefined) ?? 'active') as StoreProduct['status'],
    variants: row.variants as StoreProduct['variants'],
  }
}

export class PostgreSQLStoreAdapter implements StoreAdapter {
  async getProductById(id: string): Promise<StoreProduct | null> {
    try {
      const result = await db().findDocById<ProductRow>('store_products', id)
      
      if (!result.success) {
        if (result.metadata?.operation === 'initialize') {
          logger.error('PostgreSQLStoreAdapter: Database initialization failed:', { error: result.error })
        }
        return null
      }

      if (!result.data) {
        logger.warn('PostgreSQLStoreAdapter: Product not found:', { id })
        return null
      }

      return mapProductRow(result.data)
    } catch (error: unknown) {
      logger.error('PostgreSQLStoreAdapter: Error fetching product by ID:', {
        id,
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  async createProduct(productData: Partial<StoreProduct> & { vendorId: string }): Promise<StoreProduct> {
    try {
      const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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

      const result = await db().createDoc('store_products', product)

      if (!result.success) {
        logger.error('PostgreSQLStoreAdapter: Failed to create product:', { error: result.error })
        throw new Error('Failed to create product')
      }

      logger.info('PostgreSQLStoreAdapter: Product created successfully', { productId })

      return {
        id: productId,
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        currency: product.currency as StoreProduct['currency'],
        inStock: product.stock > 0,
        category: product.category,
        tags: product.tags,
        productListedAt: ['1'],
        productOwner: product.vendorId,
        ownerEntityId: undefined,
        storeId: '1',
        status: product.status as StoreProduct['status']
      }

    } catch (error) {
      logger.error('PostgreSQLStoreAdapter: Error creating product:', error)
      throw error
    }
  }

  async listProducts(): Promise<StoreProduct[]> {
    try {
      const queryResult = await db().queryDocs<ProductRow>({
        collection: 'store_products',
        filters: [
          { field: 'status', operator: '==', value: 'active' }
        ]
      })

      if (!queryResult.success) {
        logger.error('PostgreSQLStoreAdapter: Failed to query products:', { error: queryResult.error })
        return []
      }

      return queryResult.data.map(mapProductRow)
    } catch (error: unknown) {
      logger.error('PostgreSQLStoreAdapter: Error listing products:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return []
    }
  }

  async checkout(items: CartItem[], info: CheckoutInfo): Promise<{ orderId: string }> {
    try {
      const orderId = this.generateOrderId()

      const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.product.price) * item.quantity)
      }, 0)

      const orderData = {
        id: orderId,
        buyer_id: null,
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

      const createResult = await db().createDoc('store_orders', orderData)
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
