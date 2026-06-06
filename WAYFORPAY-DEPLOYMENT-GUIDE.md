# 🚀 WayForPay Deployment Guide

## 📋 Pre-Deployment Checklist

### **1. Database Migration**
```bash
# Run payments table migration
psql -U ring_user -d ring_platform -f scripts/create-payments-table.sql

# Or update main schema
psql -U ring_user -d ring_platform -f scripts/postgres-schema.sql
```

### **2. Environment Variables**
Add to `.env.local` (development) or Vercel/K8s secrets (production):

```bash
# WayForPay Credentials (from wayforpay.com/en/account/api)
WAYFORPAY_MERCHANT_ACCOUNT=test_merch_n1  # Production: your_merchant_account
WAYFORPAY_SECRET_KEY=flk3409refn54t54t*FNJRET  # Your actual secret key
WAYFORPAY_DOMAIN=ring-platform.org  # Your registered domain

# Application URL (for webhooks)
NEXTAUTH_URL=https://ring-platform.org  # Must be HTTPS for production
```

### **3. WayForPay Dashboard Configuration**
1. Login to wayforpay.com
2. Go to Settings → API
3. Configure webhook URL: `https://your-domain.com/api/payments/wayforpay/webhook`
4. **CRITICAL**: Must be HTTPS
5. **CRITICAL**: Must be publicly accessible (not localhost)
6. Save and test webhook connectivity

### **4. Test Credentials (Development)**
```bash
WAYFORPAY_MERCHANT_ACCOUNT=test_merch_n1
WAYFORPAY_SECRET_KEY=flk3409refn54t54t*FNJRET
WAYFORPAY_DOMAIN=localhost  # OK for testing
```

**Test Cards**:
- Success: `4111111111111111` (Visa)
- Decline: Check WayForPay docs for specific test scenarios

---

## 🔧 Deployment Steps

### **Development (Local)**
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp env.local.template .env.local
# Edit .env.local with WayForPay test credentials

# 3. Run database migration
psql -U ring_user -d ring_platform -f scripts/create-payments-table.sql

# 4. Start dev server
npm run dev

# 5. Test locally with ngrok (for webhook testing)
ngrok http 3000
# Configure ngrok URL in WayForPay dashboard webhook
```

### **Production (Vercel)**
```bash
# 1. Configure Vercel environment variables
vercel env add WAYFORPAY_MERCHANT_ACCOUNT production
vercel env add WAYFORPAY_SECRET_KEY production
vercel env add WAYFORPAY_DOMAIN production

# 2. Ensure database has payments table
# Run migration on production PostgreSQL

# 3. Deploy
vercel --prod

# 4. Configure webhook in WayForPay dashboard
# URL: https://your-domain.com/api/payments/wayforpay/webhook
```

### **Production (Kubernetes)**
```bash
# 1. Create secret for WayForPay credentials
kubectl create secret generic wayforpay-credentials \
  --from-literal=WAYFORPAY_MERCHANT_ACCOUNT=your_account \
  --from-literal=WAYFORPAY_SECRET_KEY=your_secret \
  --from-literal=WAYFORPAY_DOMAIN=your_domain.com \
  -n ring-platform-org

# 2. Run database migration
kubectl exec -it postgres-0 -n ring-platform-org -- \
  psql -U ring_user -d ring_platform -f /scripts/create-payments-table.sql

# 3. Update deployment to use secret
# Edit k8s/deployment.yaml to reference wayforpay-credentials

# 4. Apply changes
kubectl apply -f k8s/deployment.yaml

# 5. Verify webhook endpoint
curl https://your-domain.com/api/payments/wayforpay/webhook
# Should return: {"status":"ok","service":"wayforpay-webhook"}
```

---

## ✅ Post-Deployment Verification

### **1. Test Payment Flow**
1. Login as SUBSCRIBER
2. Navigate to Profile → Membership
3. Click "Upgrade to MEMBER"
4. Payment modal should show ₴299 UAH
5. Click "Proceed to Card Payment"
6. Should redirect to secure.wayforpay.com
7. Complete test payment
8. Should return to success page
9. Verify role upgraded to MEMBER

### **2. Verify Webhook**
```bash
# Check webhook health
curl https://your-domain.com/api/payments/wayforpay/webhook
# Expected: {"status":"ok","service":"wayforpay-webhook"}

# Check logs for webhook receipt
# Should see: "WayForPay webhook: Received notification"
```

### **3. Database Verification**
```sql
-- Check payments table exists
SELECT * FROM payments LIMIT 1;

-- Check payment records
SELECT "orderId", "userId", "targetRole", amount, status, "createdAt" 
FROM payments 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Verify role upgrade
SELECT id, data->>'email', data->>'role', updated_at 
FROM users 
WHERE data->>'role' = 'MEMBER' 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## 🔍 Monitoring & Logging

### **Critical Logs to Monitor**
```bash
# Payment initiation
grep "WayForPay: Initiating payment request" logs/

# Webhook receipt
grep "WayForPay webhook: Received notification" logs/

# Signature validation
grep "Invalid signature" logs/  # Should be ZERO

# Role upgrades
grep "Role upgrade: User role upgraded successfully" logs/

# Failures
grep "WayForPay.*error\|failed" logs/ -i
```

### **Alerts to Configure**
- Payment success rate < 90%
- Webhook signature validation failures
- Role upgrade failures
- Database connection errors
- WayForPay API timeouts

---

## 🐛 Troubleshooting

### **"Environment variable required" error**
**Fix**: Add missing WAYFORPAY_* variables to .env.local

### **"Invalid signature" in webhook logs**
**Cause**: Wrong WAYFORPAY_SECRET_KEY
**Fix**: Verify secret key matches WayForPay dashboard exactly

### **Webhook not receiving callbacks**
**Cause**: URL not publicly accessible or not HTTPS
**Fix**: 
- Development: Use ngrok for local testing
- Production: Verify HTTPS certificate and DNS

### **Role not upgraded after payment**
**Cause**: Database error or upgrade service failure
**Fix**: Check logs for upgrade-user-role errors

### **Payment modal not showing**
**Cause**: Missing UI component or action import
**Fix**: Verify payment-modal.tsx exists and membership-payment action imported

---

## 📊 Success Metrics

### **Week 1**
- [ ] 10+ test payments processed successfully
- [ ] Zero signature validation failures
- [ ] 100% role upgrade success rate
- [ ] Webhook latency <2 seconds

### **Month 1**
- [ ] 50+ SUBSCRIBER→MEMBER conversions
- [ ] >95% payment success rate
- [ ] >80% payment completion rate
- [ ] <5% support tickets per transaction

### **Quarter 1**
- [ ] ₴15,000+ revenue from membership upgrades
- [ ] 15%+ SUBSCRIBER→MEMBER conversion rate
- [ ] Zero security incidents
- [ ] Zero fraudulent transactions

---

**WayForPay Integration: Ready for Launch** ✅  
**Revenue Engine: Armed and Operational** 💰  
**Security: PCI-DSS Compliant** 🔐

🔥 **DEPLOY AND CONQUER** 🔥

