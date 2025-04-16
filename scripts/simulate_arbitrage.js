const decimals = 1e10;

async function interactWithArbit() {
    try {

        // Initialize addresses
        console.log("Starting Ballot contract interaction...");
        
        const accounts = await web3.eth.getAccounts();

        const token_owner = accounts[0];
        const dex_one_owner = accounts[0];
        const dex_two_owner = accounts[1];
        const lpAccounts = accounts.slice(2, 7);         
        const traderAccounts = accounts.slice(7, 15);

        // Create Tokens and DEX and Arbitrage
        const tokenMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/Token.json'));
        if (!tokenMetadata) throw new Error("Could not find Token.json artifact. Compile the contract first.");
        const TOKEN_ABI = tokenMetadata.abi;
        const TOKEN_BYTECODE = tokenMetadata.data.bytecode.object;
        
    
        const dexMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/DEX.json'));
        if (!dexMetadata) throw new Error("Could not find DEX.json artifact. Compile the contract first.");
        const DEX_ABI = dexMetadata.abi;
        const DEX_BYTECODE = dexMetadata.data.bytecode.object;


        const ArbitMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/Arbitrage.json'));
        if (!ArbitMetadata) throw new Error("Could not find DEX.json artifact. Compile the contract first.");
        const ARBIT_ABI = ArbitMetadata.abi;
        const ARBIT_BYTECODE = ArbitMetadata.data.bytecode.object;

    

        // Deplay Token A
        const Token = new web3.eth.Contract(TOKEN_ABI);
        const tokenA = await Token.deploy({
            data: TOKEN_BYTECODE,
            arguments: ["TokenA", "TKA", 30000 * decimals, token_owner]
        }).send({ from: token_owner,gas: 10000000000000});
        console.log("TokenA deployed at:", tokenA.options.address);
        

        // Deplay Token B
        const tokenB = await Token.deploy({
            data: TOKEN_BYTECODE,
            arguments: ["TokenB", "TKB", 30000 * decimals, token_owner]
        }).send({ from: token_owner,gas: 100000000000});
        console.log("TokenB deployed at:", tokenB.options.address);


        // Distribute tokens to all accounts
        for (let i = 0; i < traderAccounts.length; i++) {
            await tokenA.methods.transfer(traderAccounts[i], 1000 * decimals ).send({ from: token_owner });
            await tokenB.methods.transfer(traderAccounts[i], 1000 * decimals ).send({ from: token_owner });
        }
        console.log("Tokens distributed to traders.");

        for (let i = 0; i < lpAccounts.length; i++) {
            await tokenA.methods.transfer(lpAccounts[i], 3000 * decimals ).send({ from: token_owner });
            await tokenB.methods.transfer(lpAccounts[i], 3000 * decimals ).send({ from: token_owner });
        }
        console.log("Tokens distributed to Liquidity providers.");
        


        // --- Deploy DEX1 ---
        const DEX = new web3.eth.Contract(DEX_ABI);
        const dex1 = await DEX.deploy({
            data: DEX_BYTECODE,
            arguments: [tokenA.options.address, tokenB.options.address,]
        }).send({ from: dex_one_owner, gas: 100000000000});
        console.log("DEX deployed at:", dex1.options.address);


        // --- Deploy DEX2 ---
        const dex2 = await DEX.deploy({
            data: DEX_BYTECODE,
            arguments: [tokenA.options.address, tokenB.options.address,]
        }).send({ from: dex_two_owner, gas: 100000000000});
        console.log("DEX deployed at:", dex2.options.address);

        // 3. Approve the DEX contract for each user.
        const maxApproval = 10000 * decimals;
        for (const user of accounts) {
            await tokenA.methods.approve(dex1.options.address, maxApproval).send({ from: user });
            await tokenB.methods.approve(dex1.options.address, maxApproval).send({ from: user });
            await tokenA.methods.approve(dex2.options.address, maxApproval).send({ from: user });
            await tokenB.methods.approve(dex2.options.address, maxApproval).send({ from: user });
        }




        // --- Deploy Arbitrage ---
        const ARBIT = new web3.eth.Contract(ARBIT_ABI);
        const arbit = await ARBIT.deploy({
            data: ARBIT_BYTECODE,
            arguments: [dex1.options.address, dex2.options.address,]
        }).send({ from: dex_one_owner, gas: 100000000000});
        console.log("ARBIT deployed at:", dex2.options.address);

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // Initial Liquidity
        await dex1.methods.addLiquidity(200 * decimals, 100 * decimals).send({from: lpAccounts[2]});
        await dex2.methods.addLiquidity(300 * decimals, 100 * decimals).send({from: lpAccounts[3]});


        // Parameter
        const thresh = 2 * decimals;  
        const max_trades = 20;        
        
        
        let continueTrading = true;
        let cnt = 0;
        const primary_trader = traderAccounts[0];

        while (continueTrading) {
            cnt++;

            console.log(`\niter: ${cnt}`)
            if (cnt == max_trades)
                break;

            let result, type_of_trade, balanceA, balanceB;
            balanceA = await tokenA.methods.balanceOf(primary_trader).call()
            balanceB = await tokenB.methods.balanceOf(primary_trader).call()

            if(tokenA.methods.balanceOf(primary_trader).call() > tokenB.methods.balanceOf(primary_trader).call())
            {
                result = await arbit.methods.checkOpportunityABA(balanceA, thresh).call({ from: primary_trader });
                type_of_trade = "ABA"
                console.log ("ABA");

            }
            else 
            {
                result = await arbit.methods.checkOpportunityBAB(balanceB, thresh).call({ from: primary_trader });
                type_of_trade = "BAB"
                console.log ("BAB");
                
            }

            let direction = result[0];
            let tradeAmount = result[1];

            if( direction ==0)
                {
                    console.log("Profit is below threshold. Exiting loop.");
                    break;
                }
 
            if (type_of_trade === "ABA") {

                try {
                if(direction == 1){
                // Execute the first swap
                const amounts1 = await dex1.methods.swapA(tradeAmount).call({ from: primary_trader });
                await dex1.methods.swapA(tradeAmount).send({ from: primary_trader });
                
                const amountB = Number(amounts1[0]);
                console.log("Swap on dex1 successful. Received TokenB amount:", amountB);

                // Execute the second swap using the output from the first
                const amounts2 = await dex2.methods.swapB(amountB).call({ from: primary_trader });
                await dex2.methods.swapB(amountB).send({ from: primary_trader});

                const finalAmountA = Number(amounts2[0]);
                console.log(`Final amount A after dex2 swap: ${finalAmountA}`);
                }

                else if(direction == 2)
                {
                    // Execute the first swap
                const amounts1 = await dex2.methods.swapA(tradeAmount).call({ from: primary_trader });
                await dex2.methods.swapA(tradeAmount).send({ from: primary_trader });
                
                const amountB = Number(amounts1[0]);
                console.log("Swap on dex2 successful. Received TokenB amount:", amountB);

                // Execute the second swap using the output from the first
                const amounts2 = await dex1.methods.swapB(amountB).call({ from: primary_trader });
                await dex1.methods.swapB(amountB).send({ from: primary_trader });

                const finalAmountA = Number(amounts2[0]);
                console.log(`Final amount A after dex1 swap: ${finalAmountA}`);
                }


                }
                catch (e) {
                console.error("Swap chain failed:", e.message);
                }              
                
            } else if (type_of_trade === "BAB") {
                try {

                if(direction = 1)
                {
                // Execute the first swap
                const amounts1 = await dex1.methods.swapB(tradeAmount).call({ from: primary_trader });
                await dex1.methods.swapB(tradeAmount).send({ from: primary_trader });
                const amountA = Number(amounts1[0]);
                console.log("Swap on dex1 successful. Received TokenA amount:", amountA);

                // Execute the second swap using the output from the first
                const amounts2 = await dex2.methods.swapA(amountA).call({ from: primary_trader });
                await dex2.methods.swapA(amountA).send({ from: primary_trader });
                const finalAmountB = Number(amounts2[0]);
                console.log(`Final amount B after dex2 swap: ${finalAmountB}`);
                }

                else if(direction = 2)

                {

                    // Execute the first swap
                const amounts1 = await dex2.methods.swapB(tradeAmount).call({ from: primary_trader });
                await dex2.methods.swapB(tradeAmount).send({ from: primary_trader });
                const amountA = Number(amounts1[0]);
                console.log("Swap on dex2 successful. Received TokenA amount:", amountA);

                // Execute the second swap using the output from the first
                const amounts2 = await dex1.methods.swapA(amountA).call({ from: primary_trader });
                dex1.methods.swapA(amountA).send({ from: primary_trader });
                const finalAmountB = Number(amounts2[0]);
                console.log(`Final amount B after dex1 swap: ${finalAmountB}`);

                }

                } catch (e) {
                console.error("Swap chain failed:", e.message);
                }
            }
            
        }


        console.log("finished");

    } 
        catch (error) {
        console.error("Error in interaction:", error);
    }
}

// Run the interaction
interactWithArbit();