// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMintableERC20} from "./interfaces/IMintableERC20.sol";

/// @title ReferralRewards
/// @notice Gasless referral reward distribution — operator mints or transfers project tokens to referrers.
contract ReferralRewards is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum RewardMode {
        MINT,
        TRANSFER
    }

    error ReferralRewards__ZeroAddress();
    error ReferralRewards__ZeroAmount();
    error ReferralRewards__AlreadyPaid(bytes32 orderRef);

    event ReferralPaid(
        address indexed refWallet,
        uint256 amount,
        bytes32 indexed orderRef
    );
    event RewardTokenUpdated(address indexed token);
    event RewardModeUpdated(RewardMode mode);

    IERC20 public rewardToken;
    RewardMode public rewardMode;
    mapping(bytes32 => bool) public paidOrders;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address operator,
        address token,
        RewardMode mode
    ) external initializer {
        if (admin == address(0) || operator == address(0) || token == address(0)) {
            revert ReferralRewards__ZeroAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);

        rewardToken = IERC20(token);
        rewardMode = mode;
    }

    function payReferral(
        address refWallet,
        uint256 amount,
        bytes32 orderRef
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (refWallet == address(0)) revert ReferralRewards__ZeroAddress();
        if (amount == 0) revert ReferralRewards__ZeroAmount();
        if (paidOrders[orderRef]) revert ReferralRewards__AlreadyPaid(orderRef);

        paidOrders[orderRef] = true;

        if (rewardMode == RewardMode.MINT) {
            IMintableERC20(address(rewardToken)).mint(refWallet, amount);
        } else {
            rewardToken.safeTransfer(refWallet, amount);
        }

        emit ReferralPaid(refWallet, amount, orderRef);
    }

    function setRewardToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ReferralRewards__ZeroAddress();
        rewardToken = IERC20(token);
        emit RewardTokenUpdated(token);
    }

    function setRewardMode(RewardMode mode) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardMode = mode;
        emit RewardModeUpdated(mode);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    uint256[47] private __gap;
}
