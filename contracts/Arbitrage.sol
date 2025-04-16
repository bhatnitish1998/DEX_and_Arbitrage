// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./DEX.sol";

contract Arbitrage{

    DEX public dex1;
    DEX public dex2;
    uint threshold = 2 * 10**10;

    constructor(address _dex1, address _dex2) {
    dex1 = DEX(_dex1);
    dex2 = DEX(_dex2);
    }


    // returns (True, amountA) if trade possible
    // returns (false, 0) if trade not possible
    function ABA_helper (uint amountA, DEX dex_one, DEX dex_two) internal view returns (bool, uint)
    {
        (uint RA1, uint RB1) = dex_one.getReserves();
        (uint RA2, uint RB2) = dex_two.getReserves();
        
        uint max_possible = ((RA2 * RB1) - (RA1 * RB2))/(RB1 + RB2);
        uint max_can_trade = amountA < max_possible ? amountA : max_possible;
        max_can_trade = max_can_trade < (RA1 / 10 ) ? max_can_trade : (RA1/10); 

        uint cnt = 0;
        for(uint i = 1 * 10**10 ; i <= 100 * 10**10 ; i = i + 10**10)
        {
            cnt++;
            if (cnt == 100){
                break;
            }

            uint fees = (i * 3)/1000;
            uint actual_i = i - fees;
            uint k = RA1 * RB1;
            uint amountB =  RB1 - (k / (( RA1) + actual_i));

            if(amountB >= RB2/10){
                return(false,0);
            }

            fees = (amountB * 3)/ 1000;
            uint actual_B = amountB - fees;
            k = RA2 * RB2;
            uint received_A =  RA2 - (k / ( RB2 + actual_B));
        
            if((received_A - i) < threshold){
                continue;
            }

            return (true,i);
        }
        return(false,0);
    }



    // returns (True, amountA) if trade possible
    // returns (false, 0) if trade not possible
    function BAB_helper (uint amountB, DEX dex_one, DEX dex_two) internal view returns (bool, uint)
    {
        (uint RA1, uint RB1) = dex_one.getReserves();
        (uint RA2, uint RB2) = dex_two.getReserves();
        
        // uint max_possible = ((RA2 * RB1) - (RA1 * RB2))/(RA1 + RA2);
        uint max_possible = ((RA1 * RB2)-(RA2 * RB1))/(RA1 + RA2);
        uint max_can_trade = 100 * 10**10; // amountB < max_possible ? amountB : max_possible;
        max_can_trade = max_can_trade < (RB1 / 10 ) ? max_can_trade : (RB1/10);

        uint cnt = 0; 

        for(uint i = 1* 10**10 ; i <= max_can_trade ; i = i + 10**10)
        {
            cnt++;
            if (cnt == 100){
                break;
            }
            uint fees = (i * 3)/1000;
            uint actual_i = i - fees;
            uint k = RA1 * RB1;
            uint amountA =  RA1 - (k / (( RB1) + actual_i));

            if(amountA >= RA2/10){
                continue;
            }

            fees = (amountA * 3)/ 1000;
            uint actual_A = amountA - fees;
            k = RA2 * RB2;
            uint received_B =  RB2 - (k / ( RA2 + actual_A));
        
            if((received_B - i) < threshold){
                continue;
            }

            return (true,i);
        }

            return(false,0);
    }


    // amountA trader has, threshold = Number of A tokens he needs as profit
    // returns profit
    function checkOpportunityABA(uint amountA, uint _threshold) public  returns (uint,uint)
    {
        uint direction = 0;
        threshold = _threshold;
        // ABA = Buy B from cheaper and sell it to costlier
         uint BforA1 = dex1.getValueofA();
         uint BforA2 = dex2.getValueofA();
        

         if(BforA1 > BforA2)
         {
            // Buy from 1 and Sell to 2

            (bool flag, uint amount) = ABA_helper(amountA, dex1, dex2);
            if(flag)
            {
                direction = 1;
                return (direction,amount);
            }

         }

         else if (BforA2 > BforA1)
         {
            // Buy from 2 and sell to 1
            (bool flag, uint amount) = ABA_helper(amountA, dex2, dex1);
            if(flag)
            {
                direction = 2;
                return (direction,amount);
            }
         }

         return (direction, 0);
    }




    // amountB trader has, threshold = Number of B tokens he needs as profit
    // returns profit
    function checkOpportunityBAB(uint amountB, uint _threshold) public  returns (uint,uint)
    {
        threshold = _threshold;
        uint direction = 0;
        // ABA = Buy B from cheaper and sell it to costlier
         uint AforB1 = dex1.getValueofB();
         uint AforB2 = dex2.getValueofB();
        

         if(AforB1 > AforB2)
         {
            // Buy from 1 and Sell to 2

            (bool flag, uint amount) = BAB_helper(amountB, dex1, dex2);
            if(flag)
            {
                direction = 1;
                return (direction,amount);
            }

         }

         else if (AforB2 > AforB1)
         {
            // Buy from 2 and sell to 1
            (bool flag, uint amount) = BAB_helper(amountB, dex2, dex1);
            if(flag)
            {
                direction = 2;
                return (direction,amount);
            }
         }

         return (direction, 0);
    }

}