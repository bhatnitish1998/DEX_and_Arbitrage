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
    uint public totalFeesA;
    uint public totalFeesB;
    uint public totalSwapVolumeA;
    uint public totalSwapVolumeB;

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
            
            require(tokenB.balanceOf(msg.sender) >= expectedAmountB, "Insufficient B balance to add liquidity");
            amountB = expectedAmountB;


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


    function swapA(uint256 amountAIn) public returns (uint,uint) {

        require(amountAIn <= (tokenA.balanceOf(address(this))/10 ) );
        // subtract the fees
        uint fees = (amountAIn * FEE_NUMERATOR)/ FEE_DENOMINATOR;
        uint amountA = amountAIn - fees;

        uint k = tokenA.balanceOf(address(this)) * tokenB.balanceOf(address(this));
        // ( x + a ) ( y - b ) = k
        //  b = y-k/(x+a)
        uint amountB =  tokenB.balanceOf(address(this)) - (k / ( tokenA.balanceOf(address(this)) + amountA));
        
        // Compute expected
        uint expectedB = (amountA *  tokenB.balanceOf(address(this))) /  tokenA.balanceOf(address(this));
        
        // Do the actual transfer
        tokenA.safeTransferFrom(msg.sender, address(this), amountA);
        tokenB.safeTransfer(msg.sender, amountB);
        
        totalSwapVolumeA += amountAIn;
        totalFeesA += fees;

        return (amountB, expectedB);
    }


    function swapB(uint256 amountBIn) public returns (uint,uint) {

        require(amountBIn <= (tokenB.balanceOf(address(this))/10 ) );
        // subtract the fees
        uint fees = (amountBIn * FEE_NUMERATOR)/ FEE_DENOMINATOR;
        uint amountB = amountBIn - fees;

        uint k = tokenA.balanceOf(address(this)) * tokenB.balanceOf(address(this));
        // ( x + a ) ( y - b ) = k
        //  b = y-k/(x+a)
        uint amountA =  tokenA.balanceOf(address(this)) - (k / ( tokenB.balanceOf(address(this)) + amountB));
        
        // Compute expected
        uint expectedA = (amountB *  tokenA.balanceOf(address(this))) /  tokenB.balanceOf(address(this));
        
        // Do the actual transfer
        tokenB.safeTransferFrom(msg.sender, address(this), amountB);
        tokenA.safeTransfer(msg.sender, amountA);

        totalSwapVolumeB += amountBIn;
        totalFeesB += fees;

        return (amountA,expectedA);
    }

        // Read only functions
    function getReserves() public view returns (uint, uint)
    {
        return (tokenA.balanceOf(address(this)),tokenB.balanceOf(address(this)));
    } 

    function getValueofA() public view returns (uint)
    {
        return ((tokenB.balanceOf(address(this)) * 10 ** 10 )/  tokenA.balanceOf(address(this)));
    }

    function getValueofB() public view returns (uint)
    {
        return ((tokenA.balanceOf(address(this)) * 10 ** 10) /  tokenB.balanceOf(address(this)));
    }
    function getTotalFees() public view returns (uint, uint) {
        return (totalFeesA, totalFeesB);
    }

    function getTotalSwapVolume() public view returns (uint, uint) {
        return (totalSwapVolumeA, totalSwapVolumeB);
    }

    function getLPBalance(address user) public view returns (uint) {
        return LPS[user];
    }

}