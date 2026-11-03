import { orderDesktopMenuIds, orderDesktopUtilityIds } from '@/lib/navigation/desktop-menu-order'

const PRIMARY = ['store', 'entities', 'groupBuy'] as const

describe('orderDesktopMenuIds', () => {
  it('keeps the Layer1 utility block ahead of primary nav', () => {
    expect(orderDesktopMenuIds(PRIMARY)).toEqual([
      'profile',
      'wallet',
      'notifications',
      'messages',
      'games',
      'tasks',
      'cart',
      'favorites',
      'store',
      'entities',
      'groupBuy',
    ])
  })

  it('places market rows above wallet and drops games and tasks', () => {
    expect(
      orderDesktopMenuIds(PRIMARY, {
        items: [
          'profile',
          'cart',
          'favorites',
          'store',
          'entities',
          'groupBuy',
          'wallet',
          'notifications',
          'messages',
        ],
        exclude: ['games', 'tasks'],
      }),
    ).toEqual([
      'profile',
      'cart',
      'favorites',
      'store',
      'entities',
      'groupBuy',
      'wallet',
      'notifications',
      'messages',
    ])
  })

  it('appends a primary id that items forgot', () => {
    expect(
      orderDesktopMenuIds(PRIMARY, {
        items: ['cart', 'wallet'],
      }),
    ).toEqual(['cart', 'wallet', 'store', 'entities', 'groupBuy'])
  })

  it('hides excluded utilities when items is omitted', () => {
    expect(orderDesktopUtilityIds({ exclude: ['games', 'tasks'] })).toEqual([
      'profile',
      'wallet',
      'notifications',
      'messages',
      'cart',
      'favorites',
    ])
  })
})
