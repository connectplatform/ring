// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMintableERC20} from "../interfaces/IMintableERC20.sol";

contract MockMintableToken is ERC20, Ownable, IMintableERC20 {
    constructor() ERC20("Mock Ring", "mRING") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
