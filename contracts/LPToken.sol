// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract LPToken is ERC20 {
    address public owner;

    constructor(string memory name, string memory symbol, address _owner) ERC20(name, symbol) {
        owner = _owner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount );
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount );
    }
}