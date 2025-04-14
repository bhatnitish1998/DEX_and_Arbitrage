// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// A simple ERC20 token used to create TokenA and TokenB.
contract Token is ERC20 {
    // Deploys a new ERC20 token with name, symbol, initial supply, and recipient address.
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address recipient
    )
        ERC20(name, symbol)
    {
        _mint(recipient, initialSupply * 10 ** decimals());
    }
}
