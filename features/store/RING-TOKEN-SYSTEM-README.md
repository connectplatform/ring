# RING Token Membership Payment System

## Overview

The Ring Platform now features a complete RING token-based membership payment system that enables users to pay monthly membership fees using RING tokens. The system includes smart contracts for automated payments, credit balance management, multi-source price oracles, and comprehensive API endpoints.

## Key Features

- ✅ **Smart Contracts**: ERC20 RING token with membership fee deduction capabilities
- ✅ **Automatic Subscriptions**: Monthly payments (1 RING/month) with grace periods
- ✅ **Credit Balance System**: User credit balance with transaction history tracking
- ✅ **Price Oracles**: Multi-source RING/USD conversion (Chainlink, CoinGecko, Binance)
- ✅ **Comprehensive APIs**: Complete REST API for balance, subscription, and payment management
- ✅ **Admin Features**: Batch payment processing, subscription analytics, and user management

## Architecture

### Smart Contracts (Polygon Network)

#### RingToken.sol
- **Type**: ERC20 Upgradeable Token (UUPS Proxy)
- **Supply**: 1 billion RING tokens
- **Membership Fee**: 1 RING per month
- **Features**: Admin controls, emergency pause, treasury management
- **Location**: `ring/contracts/RingToken.sol`

#### Membership.sol
- **Type**: Subscription Management Contract
- **Subscription Period**: 30 days
- **Grace Period**: 7 days after payment due
- **Features**: Automatic renewals, batch processing, failed payment handling
- **Location**: `ring/contracts/Membership.sol`

### Core Services

#### creditBalanceService
- **File**: `ring/services/wallet/credit-balance-service.ts`
- **Purpose**: Manage user credit balances and transaction history
- **Key Methods**:
  - `getUserCreditBalance(userId)` - Get user's current balance
  - `addCredits(userId, request, type, usdRate)` - Add credits (airdrop, top-up, etc.)
  - `spendCredits(userId, request, type, usdRate)` - Spend credits
  - `processMembershipFee(userId, amount, usdRate)` - Process monthly fee
  - `getCreditHistory(userId, request)` - Get transaction history

#### SubscriptionService
- **File**: `ring/services/membership/subscription-service.ts`
- **Purpose**: Manage RING token membership subscriptions
- **Key Methods**:
  - `createSubscription(userId)` - Create new subscription
  - `cancelSubscription(userId)` - Cancel active subscription
  - `renewSubscription(userId)` - Process renewal payment
  - `getSubscriptionStatus(userId)` - Get subscription info
  - `processBatchPayments(batchSize)` - Process due payments

#### PriceOracleService
- **File**: `ring/features/wallet/services/native-token-chainlink-oracle.ts`
- **Purpose**: Multi-source native token/USD price feeds with caching
- **Price Sources**: Chainlink (primary), CoinGecko, CoinMarketCap, Binance
- **Key Methods**:
  - `getNativeTokenUsdPrice()` - Get current price with fallbacks
  - `convertNativeTokenToUsd(amount)` - Convert native token to USD
  - `convertUsdToNativeToken(amount)` - Convert USD to native token

## API Endpoints

### Credit Balance Management
- `GET /api/wallet/credit/balance` - Get user credit balance and subscription status
- `PUT /api/wallet/credit/balance` - Update user credit balance (admin only)
- `GET /api/wallet/credit/history` - Get transaction history with filtering/pagination
- `POST /api/wallet/credit/topup` - Add credits to user balance
- `POST /api/wallet/credit/spend` - Spend credits from user balance

### Pricing & Conversion
- `GET /api/prices/native-token-usd` - Get current native token/USD exchange rate
- `POST /api/prices/native-token-usd` - Refresh price cache (admin only)
- `POST /api/prices/conversion` - Convert between native token and USD amounts
- `GET /api/prices/conversion` - Get conversion rates and supported currencies

### Subscription Management
- `POST /api/membership/subscription/create` - Create native token subscription
- `GET /api/membership/subscription/status` - Get subscription status and info
- `PUT /api/membership/subscription/status` - Update subscription settings
- `POST /api/membership/subscription/cancel` - Cancel active subscription
- `GET /api/membership/subscription/cancel` - Get cancellation preview and options

### Payment Processing
- `POST /api/membership/payment/token` - Process native token payment for membership
- `GET /api/membership/payment/token` - Get payment options and pricing

## Data Models

### User Profile Extension
```typescript
interface UserCreditBalance {
  amount: string;                              // native token tokens as string for precision
  main_currency_equivalent: string;                      // USD equivalent
  last_updated: number;                        // Timestamp
  subscription_active: boolean;                // Has active subscription
  subscription_contract_address?: string;      // Smart contract address
  subscription_next_payment?: number;          // Next payment timestamp
}
```

### Credit Transaction
```typescript
interface CreditTransaction {
  id: string;                                  // Unique transaction ID
  user_id: string;                            // User ID
  type: CreditTransactionType;                // Transaction type
  amount: string;                             // Amount (negative for debits)
  main_currency_rate: string;                           // USD exchange rate at time
  main_currency_equivalent: string;                     // USD equivalent amount
  balance_after: string;                      // Balance after transaction
  timestamp: number;                          // Transaction timestamp
  description: string;                        // Human-readable description
  tx_hash?: string;                           // Blockchain transaction hash
  order_id?: string;                          // Associated order ID
  reference_id?: string;                      // External reference
  metadata?: Record<string, any>;             // Additional data
}
```

### Subscription Status
```typescript
interface SubscriptionStatus {
  user_id: string;                            // User ID
  status: 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';
  start_time?: number;                        // Subscription start timestamp
  next_payment_due?: number;                  // Next payment due timestamp
  failed_attempts: number;                    // Failed payment attempts
  auto_renew: boolean;                        // Auto-renewal enabled
  total_paid: string;                         // Total native token paid
  payments_count: number;                     // Number of payments made
}
```

## Transaction Types

- `payment` - Direct payment/purchase with native token tokens
- `airdrop` - Free tokens given to user
- `reimbursement` - Refund or compensation
- `purchase` - Store purchase using credits
- `membership_fee` - Monthly membership fee deduction
- `top_up` - User-initiated balance top-up
- `bonus` - Loyalty/referral bonuses
- `penalty` - Administrative deductions

## Deployment

### Smart Contract Deployment

#### Testnet (Polygon Mumbai)
```bash
cd ring/contracts
npm install
npm run deploy:testnet
```

#### Mainnet (Polygon)
```bash
cd ring/contracts
npm run deploy:mainnet
```

### Environment Variables
```env
# Smart Contract Addresses (set after deployment)
RING_TOKEN_CONTRACT_ADDRESS=0x...
RING_MEMBERSHIP_CONTRACT_ADDRESS=0x...
RING_TREASURY_WALLET_ADDRESS=0x...

# Price Oracle Configuration
CHAINLINK_RING_USD_FEED=0x...           # Optional Chainlink feed
COINMARKETCAP_API_KEY=your_api_key      # Optional CoinMarketCap API key

# Blockchain Configuration
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/your-api-key
MUMBAI_RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/your-api-key
DEPLOYMENT_PRIVATE_KEY=0x...            # Deployment wallet private key
POLYGONSCAN_API_KEY=your_api_key        # For contract verification
```

## Usage Examples

### Server-Side Service Usage

```typescript
import { creditBalanceService } from '@/services/wallet/credit-balance-service';
import { subscriptionService } from '@/services/membership/subscription-service';
import { nativeTokenChainlinkOracleService } from '@/features/wallet/services/native-token-chainlink-oracle';

// Check user credit balance
const balance = await creditBalanceService.getUserCreditBalance(userId);

// Create subscription
const subscription = await subscriptionService.createSubscription(userId);

// Get current RING price
const priceData = await nativeTokenChainlinkOracleService.getNativeTokenUsdPrice();
```

### API Usage Examples

```typescript
// Get credit balance
const balanceResponse = await fetch('/api/wallet/credit/balance');
const balance = await balanceResponse.json();

// Create subscription
const subscriptionResponse = await fetch('/api/membership/subscription/create', {
  method: 'POST',
  body: JSON.stringify({ auto_renew: true })
});

// Convert native token to USD
const conversionResponse = await fetch('/api/prices/conversion', {
  method: 'POST',
  body: JSON.stringify({
    amount: '10.5',
    from: '{native_token}',
    to: 'USD'
  })
});
```

## Workflows

### Membership Upgrade Flow
1. User has SUBSCRIBER role
2. Check native token balance >= 1 token
3. Process initial payment via creditBalanceService
4. Create subscription via subscriptionService
5. Update user role to MEMBER
6. Set next payment due date (30 days from now)

### Monthly Renewal Process
1. Cron job finds subscriptions due for payment
2. Check user native token balance for each subscription
3. Process payment via creditBalanceService
4. Update subscription next payment date
5. Handle failed payments with 7-day grace period
6. Mark subscription as expired if grace period exceeded

### Subscription Cancellation
1. User requests cancellation
2. Choose immediate or end-of-period cancellation
3. Update subscription status to CANCELLED
4. Stop automatic renewals
5. Optionally downgrade user role
6. Send confirmation notification

## Security Features

### Smart Contract Security
- UUPS upgradeable proxy pattern for future updates
- Multi-signature treasury wallet requirement
- Emergency pause functionality for critical issues
- Rate limiting on subscription creation
- Slippage protection on price conversions

### Platform Security
- Server-side balance validation before all transactions
- Transaction idempotency keys to prevent double-spending
- Rate limiting on payment endpoints (configurable per user)
- Comprehensive audit trails for all credit transactions
- Role-based access control for admin functions

## Testing

### Smart Contract Tests
```bash
cd ring/contracts
npm test                    # Run all tests
npm run coverage           # Generate coverage report
npm run gas-report         # Generate gas usage report
```

### Platform Tests
- API endpoint testing with comprehensive error scenarios
- Integration tests for end-to-end membership flows
- Load testing for batch payment processing
- Security testing for rate limiting and validation

## Monitoring & Analytics

### Key Metrics
- Total active subscriptions
- Monthly recurring revenue in native token tokens
- Failed payment rates and reasons
- Price oracle accuracy and response times
- User credit balance distribution
- Subscription churn rates

### Alerts & Monitoring
- Price oracle failures or high latency
- Elevated failed payment rates
- Smart contract errors or exceptions
- Low treasury balance warnings
- Unusual subscription patterns

## Troubleshooting

### Common Issues

#### "Insufficient native token balance" Error
- **Cause**: User doesn't have enough native token tokens for payment
- **Solution**: Direct user to top-up balance or purchase native token tokens

#### Price Oracle Failures
- **Cause**: External API failures or network issues
- **Solution**: System automatically falls back to alternative price sources

#### Smart Contract Errors
- **Cause**: Network congestion or contract issues
- **Solution**: Retry mechanism with exponential backoff

#### Failed Subscription Renewals
- **Cause**: Insufficient balance or temporary failures
- **Solution**: Grace period allows 7 days for user to resolve issues

### Debugging Tools
- Comprehensive logging with structured context
- Transaction trace IDs for end-to-end tracking
- Admin dashboard for subscription and payment monitoring
- Smart contract event monitoring and alerting

## Future Enhancements

- **RING Staking Rewards**: Reward long-term subscribers with staking yields
- **Bulk Payments**: Organization-level bulk membership management
- **Cross-Chain Support**: Expand native token to other blockchains
- **DeFi Integration**: Yield farming and liquidity provision options
- **NFT Benefits**: Special NFTs for long-term subscribers
- **Mobile Wallet**: Dedicated mobile app for native token token management
- **Fiat On-Ramp**: Direct native token token purchases with credit cards

## Support & Resources

- **Documentation**: This README and inline code documentation
- **API Reference**: OpenAPI spec available at `/api/docs` (when implemented)
- **Smart Contract Code**: Fully documented Solidity contracts with NatSpec
- **Test Examples**: Comprehensive test suites for all components
- **Community**: GitHub discussions and issue tracking

## Contributing

When contributing to the native token token system:

1. Follow existing code patterns and naming conventions
2. Add comprehensive tests for new features
3. Update documentation and API specs
4. Consider security implications of all changes
5. Test against both testnet and local development environments

For questions or support, please refer to the AI-CONTEXT documentation or create an issue in the project repository.
