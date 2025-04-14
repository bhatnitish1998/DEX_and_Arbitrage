// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LPToken.sol";
import "./Token.sol";

contract DEX {

    // Tokens
    LPToken public lpToken;
    IERC20 public tokenA;
    IERC20 public tokenB;

    // Reserves A & B
    uint public reserveA;
    uint public reserveB;

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

        if (reserveA == 0 && reserveB == 0) {
            // Set the reserves with the initial values.
            reserveA = amountA;
            reserveB = amountB ;

            // Set the total LP supply and assign the initial share.
            totalLPTokens = amountA ;
            LPS[msg.sender] = amountA;

            // Add the liquidity provider to the list.
            lpList.push(msg.sender);

        } else {
            // For subsequent liquidity providers we maintain the same ratio as the current reserve.

            // Calculate the expected amountB based on the amountA provided.
            uint expectedAmountB = (amountA * reserveB) / reserveA;
            require(
                amountB == expectedAmountB,
                "Liquidity must be provided in the correct ratio"
            );

            // LPTOKEN calculation

            
            // Update the reserves with the new liquidity.
            reserveA += amountA;
            reserveB += amountB;
            
            // Increase the total LP token supply.
            totalLPTokens += amountA;
            
            // If the provider is new, add them to the LP list.
            if (LPS[msg.sender] == 0) {
                lpList.push(msg.sender);
            }
            
            // Update the LP share for this provider.
            LPS[msg.sender] += amountA;
        }
    }


    function distributeFees() internal {
        require(totalLPTokens > 0, "No LP tokens exist");
        // Ensure at least one fee pool has fees.
        require(totalFeesA > 0 || totalFeesB > 0, "No fees to distribute");
        
        // Capture current total fees from both tokens.
        uint feeBalanceA = totalFeesA;
        uint feeBalanceB = totalFeesB;
        
        // Reset fee accumulators.
        totalFeesA = 0;
        totalFeesB = 0;
        
        // Loop through each LP provider and transfer their proportional share.
        for (uint i = 0; i < lpList.length; i++) {
            address lp = lpList[i];
            // Calculate LP provider's share for both tokens.
            uint shareA = (LPS[lp] * feeBalanceA) / totalLPTokens;
            uint shareB = (LPS[lp] * feeBalanceB) / totalLPTokens;
            
            if (shareA > 0) {
                require(tokenA.transfer(lp, shareA), "Token A fee transfer failed");
            }
            if (shareB > 0) {
                require(tokenB.transfer(lp, shareB), "Token B fee transfer failed");
            }
        }
    }


    function removeLiquidity(uint256 lpAmount) public {
    
        // give fees to all users
        distributeFees();

        // Ensure the caller has enough LP tokens to remove liquidity.
        require(LPS[msg.sender] >= lpAmount, "Not enough LP tokens");

        // Calculate the proportional amounts of Token A and Token B to withdraw.
        // We multiply first then divide to avoid precision issues.
        uint amountA = (lpAmount * reserveA) / totalLPTokens;
        uint amountB = (lpAmount * reserveB) / totalLPTokens;

        // Update the LP provider's balance and the total LP supply.
        LPS[msg.sender] -= lpAmount;
        totalLPTokens -= lpAmount;

        // Update the liquidity pool's reserves.
        reserveA -= amountA;
        reserveB -= amountB;

        // Burn the LP tokens from the provider.
        lpToken.burn(msg.sender, lpAmount);

        // Transfer Token A and Token B from the DEX to the liquidity provider.
        require(tokenA.transfer(msg.sender, amountA), "Token A transfer failed");
        require(tokenB.transfer(msg.sender, amountB), "Token B transfer failed");

        // If the liquidity removal empties the pool, reset the pool state.
        if (totalLPTokens == 0) {
            reserveA = 0;
            reserveB = 0;
        }
    }


}