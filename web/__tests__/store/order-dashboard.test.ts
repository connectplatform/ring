import { readBuyerShipment, readOpportunityOffer, readPromotionConditions } from '@/features/store/lib/order-dashboard'

describe('readBuyerShipment', () => {
  it('reads the first warehouse waybill', () => {
    expect(
      readBuyerShipment({
        shipments: {
          wh1: { number: '20400000000001', status: 'In the city' },
        },
      }),
    ).toEqual({ number: '20400000000001', status: 'In the city' })
  })

  it('reads a legacy single shipment', () => {
    expect(readBuyerShipment({ shipment: { number: '59000000000011', status: 'Received' } })).toEqual({
      number: '59000000000011',
      status: 'Received',
    })
  })
})

describe('readPromotionConditions', () => {
  it('reads vendor promotion conditions from an opportunity', () => {
    expect(
      readPromotionConditions({
        vendor: { promotion: { conditions: 'Free delivery from 800 UAH' } },
      }),
    ).toBe('Free delivery from 800 UAH')
  })

  it('joins condition objects', () => {
    expect(
      readOpportunityOffer({
        id: 'op1',
        title: 'Spring honey',
        type: 'vendor_listing',
        vendor: { promotion: { conditions: { min: '2 jars', window: 'this week' } } },
      }),
    ).toEqual({
      id: 'op1',
      title: 'Spring honey',
      type: 'vendor_listing',
      conditions: '2 jars · this week',
    })
  })
})
