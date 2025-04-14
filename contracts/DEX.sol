// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./LPToken.sol";
import "./Token.sol";

contract DEX {

    using SafeERC20 for IERC20;

    // Tokens
    LPToken public lpToken;
    IERC20 public tokenA;
    IERC20 public tokenB;


    // Mapping of LP provider addresses to their LP token share
    mapping(address => uint) private LPS;

    // Total minted LP tokens
    uint public totalLPTokens;

    // store fees to later distribute to LP
    uint private totalFeesA;
    uint private totalFeesB;

    uint private constant FEE_NUMERATOR = 3;
    uint private constant FEE_DENOMINATOR = 1000;

    // List of LP providers
    address[] private lpList;

    constructor(address _tokenA, address _tokenB) {
    require(_tokenA != _tokenB, "Tokens must be different");
    tokenA = IERC20(_tokenA);
    tokenB = IERC20(_tokenB);
    lpToken = new LPToken("Liquidity Provider Token", "LPT", address(this));
    }


    // LIQUIDITY FUNCTIONS

    function addLiquidity(uint amountA, uint amountB) public {

        if (tokenA.balanceOf(address(this)) == 0 && tokenB.balanceOf(address(this)) == 0) {
            // Set the reserves with the initial values.

            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);

            // mint new LP tokens
            lpToken.mint(msg.sender, amountA);

            // Update variables
            totalLPTokens = amountA;
            LPS[msg.sender] = amountA;
            lpList.push(msg.sender);
            


        } else {
            // For subsequent liquidity providers we maintain the same ratio as the current reserve.

            // Calculate the expected amountB based on the amountA provided.
            uint expectedAmountB = (amountA * tokenB.balanceOf(address(this))) / tokenA.balanceOf(address(this));
            require(
                amountB == expectedAmountB,
                "Liquidity must be provided in the correct ratio"
            );

            // LPTOKEN calculation


            // Update the reserves with the new liquidity.
            tokenA.safeTransferFrom(msg.sender, address(this), amountA);
            tokenB.safeTransferFrom(msg.sender, address(this), amountB);
            
            // Mint LP tokens
            lpToken.mint(msg.sender, amountA);

            // Update variables
            totalLPTokens += amountA;
            
            if (LPS[msg.sender] == 0) {
                lpList.push(msg.sender);
            }
            LPS[msg.sender] += amountA;
        }
    }


    function removeLiquidity(uint256 lpAmount) public {

        // Ensure the caller has enough LP tokens to remove liquidity.
        require(LPS[msg.sender] >= lpAmount, "Not enough LP tokens");

        // Calculate the proportional amounts of Token A and Token B to withdraw.
        // We multiply first then divide to avoid precision issues.
        uint amountA = (lpAmount * tokenA.balanceOf(address(this))) / totalLPTokens;
        uint amountB = (lpAmount * tokenB.balanceOf(address(this))) / totalLPTokens;

        // Update variables and burn token
        LPS[msg.sender] -= lpAmount;
        totalLPTokens -= lpAmount;
        lpToken.burn(msg.sender, lpAmount);


        // Transfer Token A and Token B from the DEX to the liquidity provider.
            tokenA.safeTransfer(msg.sender, amountA);
            tokenB.safeTransfer(msg.sender, amountB);

    }


}