// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title RING Token
 * @notice ERC20 token for Ring Platform membership and ecosystem payments
 * @dev Upgradeable ERC20 token with membership subscription functionality
 */
contract RingToken is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    
    /// @notice Treasury wallet that receives membership fees and ecosystem revenue
    address public treasury;
    
    /// @notice Membership contract authorized to deduct subscription fees
    address public membershipContract;
    
    /// @notice Token decimals (18 for precision)
    uint8 private constant DECIMALS = 18;
    
    /// @notice Initial token supply (1 billion RING tokens)
    uint256 private constant INITIAL_SUPPLY = 1_000_000_000 * 10**DECIMALS;
    
    /// @notice Minimum balance required for membership subscription
    uint256 public constant MIN_SUBSCRIPTION_BALANCE = 12 * 10**DECIMALS; // 12 RING (1 year)
    
    /// @notice Monthly membership fee in RING tokens
    uint256 public constant MEMBERSHIP_FEE = 1 * 10**DECIMALS; // 1 RING per month
    
    /// @notice Event emitted when membership contract is updated
    event MembershipContractUpdated(address indexed oldContract, address indexed newContract);
    
    /// @notice Event emitted when treasury address is updated  
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    /// @notice Event emitted when membership fee is deducted
    event MembershipFeeDeducted(address indexed member, uint256 amount, uint256 timestamp);
    
    /// @notice Event emitted when tokens are credited to a user (airdrop, reimbursement)
    event TokensCredited(address indexed recipient, uint256 amount, string reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _treasury Treasury wallet address
     * @param _owner Contract owner address
     */
    function initialize(address _treasury, address _owner) public initializer {
        __ERC20_init("Ring Token", "RING");
        __ERC20Burnable_init();
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();

        require(_treasury != address(0), "Treasury cannot be zero address");
        require(_owner != address(0), "Owner cannot be zero address");
        
        treasury = _treasury;
        _transferOwnership(_owner);
        
        // Mint initial supply to treasury
        _mint(_treasury, INITIAL_SUPPLY);
    }

    /**
     * @notice Set the membership contract address
     * @param _membershipContract New membership contract address
     */
    function setMembershipContract(address _membershipContract) external onlyOwner {
        require(_membershipContract != address(0), "Membership contract cannot be zero address");
        
        address oldContract = membershipContract;
        membershipContract = _membershipContract;
        
        emit MembershipContractUpdated(oldContract, _membershipContract);
    }

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury cannot be zero address");
        
        address oldTreasury = treasury;
        treasury = _treasury;
        
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Deduct membership fee from user account
     * @dev Can only be called by authorized membership contract
     * @param member Member address to deduct from
     * @return success Whether the deduction was successful
     */
    function deductMembershipFee(address member) external returns (bool success) {
        require(msg.sender == membershipContract, "Only membership contract can deduct fees");
        require(balanceOf(member) >= MEMBERSHIP_FEE, "Insufficient balance for membership fee");
        
        _transfer(member, treasury, MEMBERSHIP_FEE);
        
        emit MembershipFeeDeducted(member, MEMBERSHIP_FEE, block.timestamp);
        return true;
    }

    /**
     * @notice Credit tokens to user account (for airdrops, reimbursements, etc.)
     * @dev Can only be called by contract owner
     * @param recipient Address to credit tokens to
     * @param amount Amount of tokens to credit
     * @param reason Reason for crediting tokens
     */
    function creditTokens(address recipient, uint256 amount, string calldata reason) external onlyOwner {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");
        
        _transfer(treasury, recipient, amount);
        
        emit TokensCredited(recipient, amount, reason);
    }

    /**
     * @notice Check if user has sufficient balance for membership subscription
     * @param user User address to check
     * @return hasBalance Whether user has minimum required balance
     */
    function hasSubscriptionBalance(address user) external view returns (bool hasBalance) {
        return balanceOf(user) >= MIN_SUBSCRIPTION_BALANCE;
    }

    /**
     * @notice Get remaining membership months based on current balance
     * @param user User address to check
     * @return months Number of months user can afford
     */
    function getRemainingMembershipMonths(address user) external view returns (uint256 months) {
        uint256 balance = balanceOf(user);
        return balance / MEMBERSHIP_FEE;
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
     * @notice Get token decimals
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Hook called before any token transfer
     * @dev Adds pausable functionality to transfers
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override
    {
        super._beforeTokenTransfer(from, to, amount);
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

    /**
     * @notice Emergency token recovery
     * @dev Allows owner to recover any ERC20 tokens sent to this contract by mistake
     * @param token Token contract address
     * @param amount Amount to recover
     */
    function emergencyTokenRecovery(address token, uint256 amount) external onlyOwner {
        require(token != address(this), "Cannot recover RING tokens");
        IERC20Upgradeable(token).transfer(owner(), amount);
    }
}
