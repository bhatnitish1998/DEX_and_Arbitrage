// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// A simple ERC20 token used to create TokenA and TokenB.
contract Token is ERC20 {
    //  Deploys a new ERC20 token with name,symbol  and intial supply.
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    )
        ERC20(name, symbol)
    {
        _mint(msg.sender, initialSupply);
    }
}
