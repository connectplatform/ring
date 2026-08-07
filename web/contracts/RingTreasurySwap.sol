// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RingTreasurySwap
 * @notice Off-ramp allowlist for Wagmi sign-in wallet → treasury deposits.
 * @dev Deploy-time / owner-managed ERC-20 allowlist. Does NOT mint RING;
 *      RING settlement to custodial wallets is off-chain (ops / Solana treasury).
 *      Smart-contract security audit required before mainnet deploy (workspace rule).
 *
 * Minimal Ownable/Pausable (no OZ path coupling — RingToken uses upgradeable OZ).
 */
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract RingTreasurySwap {
    address public owner;
    address public treasury;
    bool public paused;
    mapping(address => bool) public allowlisted;
    address[] private _allowlist;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryUpdated(address indexed previous, address indexed current);
    event TokenAllowlisted(address indexed token, bool allowed);
    event DepositPulled(address indexed token, address indexed from, uint256 amount);
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(address treasury_) {
        require(treasury_ != address(0), "treasury=0");
        owner = msg.sender;
        treasury = treasury_;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setTreasury(address treasury_) external onlyOwner {
        require(treasury_ != address(0), "treasury=0");
        emit TreasuryUpdated(treasury, treasury_);
        treasury = treasury_;
    }

    function setTokenAllowlisted(address token, bool allowed) external onlyOwner {
        require(token != address(0), "token=0");
        if (allowed && !allowlisted[token]) {
            allowlisted[token] = true;
            _allowlist.push(token);
            emit TokenAllowlisted(token, true);
            return;
        }
        if (!allowed && allowlisted[token]) {
            allowlisted[token] = false;
            emit TokenAllowlisted(token, false);
        }
    }

    function allowlistLength() external view returns (uint256) {
        return _allowlist.length;
    }

    function allowlistAt(uint256 index) external view returns (address) {
        return _allowlist[index];
    }

    /**
     * @notice Pull allowlisted ERC-20 from `from` into treasury (requires prior approve).
     */
    function pullDeposit(address token, address from, uint256 amount) external whenNotPaused {
        require(allowlisted[token], "not allowlisted");
        require(amount > 0, "amount=0");
        require(IERC20Minimal(token).transferFrom(from, treasury, amount), "transferFrom failed");
        emit DepositPulled(token, from, amount);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Recover mistaken ERC-20 sent to this contract (not the treasury wallet).
     */
    function emergencyTokenRecovery(address token, uint256 amount) external onlyOwner {
        require(IERC20Minimal(token).transfer(owner, amount), "transfer failed");
    }
}
