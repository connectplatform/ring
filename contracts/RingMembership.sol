// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./RingToken.sol";

/**
 * @title Ring Membership Subscription Contract
 * @notice Manages automatic monthly membership payments using RING tokens
 * @dev Handles subscription creation, payment processing, and status management
 */
contract RingMembership is Initializable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    
    /// @notice RING token contract
    RingToken public ringToken;
    
    /// @notice Subscription duration in seconds (30 days)
    uint256 public constant SUBSCRIPTION_PERIOD = 30 days;
    
    /// @notice Grace period before membership expires (7 days)
    uint256 public constant GRACE_PERIOD = 7 days;
    
    /// @notice Maximum number of failed payment attempts before cancellation
    uint256 public constant MAX_FAILED_ATTEMPTS = 3;
    
    /// @notice Subscription status enum
    enum SubscriptionStatus {
        INACTIVE,    // No subscription
        ACTIVE,      // Active subscription with auto-renewal
        EXPIRED,     // Subscription expired due to insufficient funds
        CANCELLED,   // Manually cancelled by user
        SUSPENDED    // Suspended by admin
    }
    
    /// @notice Subscription data structure
    struct Subscription {
        SubscriptionStatus status;
        uint256 startTime;
        uint256 nextPaymentDue;
        uint256 failedAttempts;
        bool autoRenew;
        uint256 totalPaid;
        uint256 paymentsCount;
    }
    
    /// @notice User subscriptions mapping
    mapping(address => Subscription) public subscriptions;
    
    /// @notice Array of active subscribers for batch processing
    address[] public activeSubscribers;
    mapping(address => uint256) public subscriberIndex;
    
    /// @notice Total active subscriptions count
    uint256 public totalActiveSubscriptions;
    
    /// @notice Total revenue collected
    uint256 public totalRevenue;
    
    /// @notice Event emitted when user creates subscription
    event SubscriptionCreated(address indexed user, uint256 timestamp);
    
    /// @notice Event emitted when subscription payment is processed
    event SubscriptionPaymentProcessed(address indexed user, uint256 amount, uint256 nextDue);
    
    /// @notice Event emitted when subscription payment fails
    event SubscriptionPaymentFailed(address indexed user, uint256 failedAttempts, string reason);
    
    /// @notice Event emitted when subscription is cancelled
    event SubscriptionCancelled(address indexed user, uint256 timestamp, string reason);
    
    /// @notice Event emitted when subscription expires
    event SubscriptionExpired(address indexed user, uint256 timestamp);
    
    /// @notice Event emitted when subscription is manually renewed
    event SubscriptionRenewed(address indexed user, uint256 amount, uint256 nextDue);
    
    /// @notice Event emitted during batch payment processing
    event BatchPaymentProcessed(uint256 processed, uint256 successful, uint256 failed);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _ringToken RING token contract address
     * @param _owner Contract owner address
     */
    function initialize(address _ringToken, address _owner) public initializer {
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(_ringToken != address(0), "RING token cannot be zero address");
        require(_owner != address(0), "Owner cannot be zero address");
        
        ringToken = RingToken(_ringToken);
        _transferOwnership(_owner);
    }

    /**
     * @notice Create a new subscription
     * @dev User must have sufficient RING balance and approve this contract
     */
    function createSubscription() external whenNotPaused nonReentrant {
        require(subscriptions[msg.sender].status == SubscriptionStatus.INACTIVE, "Subscription already exists");
        require(ringToken.balanceOf(msg.sender) >= ringToken.MEMBERSHIP_FEE(), "Insufficient RING balance");
        
        // Process initial payment
        bool success = ringToken.deductMembershipFee(msg.sender);
        require(success, "Initial payment failed");
        
        // Create subscription
        subscriptions[msg.sender] = Subscription({
            status: SubscriptionStatus.ACTIVE,
            startTime: block.timestamp,
            nextPaymentDue: block.timestamp + SUBSCRIPTION_PERIOD,
            failedAttempts: 0,
            autoRenew: true,
            totalPaid: ringToken.MEMBERSHIP_FEE(),
            paymentsCount: 1
        });
        
        // Add to active subscribers array
        subscriberIndex[msg.sender] = activeSubscribers.length;
        activeSubscribers.push(msg.sender);
        totalActiveSubscriptions++;
        totalRevenue += ringToken.MEMBERSHIP_FEE();
        
        emit SubscriptionCreated(msg.sender, block.timestamp);
        emit SubscriptionPaymentProcessed(msg.sender, ringToken.MEMBERSHIP_FEE(), subscriptions[msg.sender].nextPaymentDue);
    }

    /**
     * @notice Cancel user's subscription
     */
    function cancelSubscription() external {
        require(subscriptions[msg.sender].status == SubscriptionStatus.ACTIVE, "No active subscription");
        
        _cancelSubscription(msg.sender, "User cancelled");
    }

    /**
     * @notice Manually renew subscription (pay now)
     */
    function renewSubscription() external whenNotPaused nonReentrant {
        Subscription storage sub = subscriptions[msg.sender];
        require(sub.status == SubscriptionStatus.ACTIVE || sub.status == SubscriptionStatus.EXPIRED, "Invalid subscription status");
        require(ringToken.balanceOf(msg.sender) >= ringToken.MEMBERSHIP_FEE(), "Insufficient RING balance");
        
        // Process payment
        bool success = ringToken.deductMembershipFee(msg.sender);
        require(success, "Payment failed");
        
        // Update subscription
        sub.status = SubscriptionStatus.ACTIVE;
        sub.nextPaymentDue = block.timestamp + SUBSCRIPTION_PERIOD;
        sub.failedAttempts = 0;
        sub.totalPaid += ringToken.MEMBERSHIP_FEE();
        sub.paymentsCount++;
        
        // If was expired, add back to active list
        if (sub.status != SubscriptionStatus.ACTIVE) {
            subscriberIndex[msg.sender] = activeSubscribers.length;
            activeSubscribers.push(msg.sender);
            totalActiveSubscriptions++;
        }
        
        totalRevenue += ringToken.MEMBERSHIP_FEE();
        
        emit SubscriptionRenewed(msg.sender, ringToken.MEMBERSHIP_FEE(), sub.nextPaymentDue);
    }

    /**
     * @notice Process subscription payments for due subscribers
     * @param batchSize Maximum number of subscriptions to process
     */
    function processBatchPayments(uint256 batchSize) external onlyOwner {
        require(batchSize > 0, "Batch size must be greater than zero");
        
        uint256 processed = 0;
        uint256 successful = 0;
        uint256 failed = 0;
        uint256 currentIndex = 0;
        
        while (processed < batchSize && currentIndex < activeSubscribers.length) {
            address subscriber = activeSubscribers[currentIndex];
            
            if (_isPaymentDue(subscriber)) {
                if (_processSubscriptionPayment(subscriber)) {
                    successful++;
                } else {
                    failed++;
                }
                processed++;
            }
            
            currentIndex++;
        }
        
        emit BatchPaymentProcessed(processed, successful, failed);
    }

    /**
     * @notice Get subscription information for a user
     * @param user User address
     * @return subscription Subscription data
     */
    function getSubscription(address user) external view returns (Subscription memory subscription) {
        return subscriptions[user];
    }

    /**
     * @notice Check if user has active membership
     * @param user User address
     * @return isActive Whether user has active membership
     */
    function hasActiveMembership(address user) external view returns (bool isActive) {
        Subscription memory sub = subscriptions[user];
        if (sub.status != SubscriptionStatus.ACTIVE) {
            return false;
        }
        
        // Check if in grace period
        if (block.timestamp <= sub.nextPaymentDue + GRACE_PERIOD) {
            return true;
        }
        
        return false;
    }

    /**
     * @notice Get users with due payments
     * @param maxResults Maximum number of results to return
     * @return dueUsers Array of user addresses with due payments
     */
    function getDuePayments(uint256 maxResults) external view returns (address[] memory dueUsers) {
        uint256 count = 0;
        address[] memory tempArray = new address[](maxResults);
        
        for (uint256 i = 0; i < activeSubscribers.length && count < maxResults; i++) {
            address subscriber = activeSubscribers[i];
            if (_isPaymentDue(subscriber)) {
                tempArray[count] = subscriber;
                count++;
            }
        }
        
        // Create properly sized array
        dueUsers = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            dueUsers[i] = tempArray[i];
        }
    }

    /**
     * @notice Admin function to suspend a subscription
     * @param user User address to suspend
     */
    function suspendSubscription(address user) external onlyOwner {
        require(subscriptions[user].status == SubscriptionStatus.ACTIVE, "No active subscription");
        subscriptions[user].status = SubscriptionStatus.SUSPENDED;
        _removeFromActiveList(user);
        emit SubscriptionCancelled(user, block.timestamp, "Admin suspended");
    }

    /**
     * @notice Admin function to reactivate a suspended subscription
     * @param user User address to reactivate
     */
    function reactivateSubscription(address user) external onlyOwner {
        require(subscriptions[user].status == SubscriptionStatus.SUSPENDED, "Subscription not suspended");
        subscriptions[user].status = SubscriptionStatus.ACTIVE;
        subscriptions[user].nextPaymentDue = block.timestamp + SUBSCRIPTION_PERIOD;
        
        subscriberIndex[user] = activeSubscribers.length;
        activeSubscribers.push(user);
        totalActiveSubscriptions++;
        
        emit SubscriptionCreated(user, block.timestamp);
    }

    /**
     * @notice Pause contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Internal function to check if payment is due
     */
    function _isPaymentDue(address user) internal view returns (bool) {
        Subscription memory sub = subscriptions[user];
        return sub.status == SubscriptionStatus.ACTIVE && 
               block.timestamp >= sub.nextPaymentDue;
    }

    /**
     * @dev Internal function to process subscription payment
     */
    function _processSubscriptionPayment(address user) internal returns (bool success) {
        Subscription storage sub = subscriptions[user];
        
        // Check if user has sufficient balance
        if (ringToken.balanceOf(user) < ringToken.MEMBERSHIP_FEE()) {
            sub.failedAttempts++;
            
            if (sub.failedAttempts >= MAX_FAILED_ATTEMPTS) {
                _expireSubscription(user, "Too many failed attempts");
            } else {
                emit SubscriptionPaymentFailed(user, sub.failedAttempts, "Insufficient balance");
            }
            return false;
        }
        
        // Attempt payment
        try ringToken.deductMembershipFee(user) returns (bool paymentSuccess) {
            if (paymentSuccess) {
                sub.nextPaymentDue = block.timestamp + SUBSCRIPTION_PERIOD;
                sub.failedAttempts = 0;
                sub.totalPaid += ringToken.MEMBERSHIP_FEE();
                sub.paymentsCount++;
                totalRevenue += ringToken.MEMBERSHIP_FEE();
                
                emit SubscriptionPaymentProcessed(user, ringToken.MEMBERSHIP_FEE(), sub.nextPaymentDue);
                return true;
            } else {
                sub.failedAttempts++;
                emit SubscriptionPaymentFailed(user, sub.failedAttempts, "Payment failed");
                return false;
            }
        } catch {
            sub.failedAttempts++;
            emit SubscriptionPaymentFailed(user, sub.failedAttempts, "Payment exception");
            return false;
        }
    }

    /**
     * @dev Internal function to cancel subscription
     */
    function _cancelSubscription(address user, string memory reason) internal {
        subscriptions[user].status = SubscriptionStatus.CANCELLED;
        _removeFromActiveList(user);
        emit SubscriptionCancelled(user, block.timestamp, reason);
    }

    /**
     * @dev Internal function to expire subscription
     */
    function _expireSubscription(address user, string memory reason) internal {
        subscriptions[user].status = SubscriptionStatus.EXPIRED;
        _removeFromActiveList(user);
        emit SubscriptionExpired(user, block.timestamp);
        emit SubscriptionCancelled(user, block.timestamp, reason);
    }

    /**
     * @dev Internal function to remove user from active subscribers list
     */
    function _removeFromActiveList(address user) internal {
        uint256 index = subscriberIndex[user];
        uint256 lastIndex = activeSubscribers.length - 1;
        
        if (index != lastIndex) {
            address lastSubscriber = activeSubscribers[lastIndex];
            activeSubscribers[index] = lastSubscriber;
            subscriberIndex[lastSubscriber] = index;
        }
        
        activeSubscribers.pop();
        delete subscriberIndex[user];
        totalActiveSubscriptions--;
    }

    /**
     * @notice Authorize contract upgrade
     * @dev Only owner can upgrade the contract
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        onlyOwner
        override
    {}
}
