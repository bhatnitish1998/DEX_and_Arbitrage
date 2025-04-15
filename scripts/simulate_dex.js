const decimals = 1e10;

// Generate a random integer between min and max 
function generateN(min, max) {
  const N = Math.floor(Math.random() * (max - min + 1)) + min;
  return N;
}

// Transaction types
const TxType = {
  DEPOSIT: 0,
  WITHDRAW: 1,
  SWAP: 2
};

// Example usage:
const N = generateN(50, 100);
console.log("Random  N:", N);


async function interactWithDEX() {
    try {

        // Initialize addresses
        console.log("Starting Ballot contract interaction...");
        
        const accounts = await web3.eth.getAccounts();

        const token_owner = accounts[0];
        const dex_one_owner = accounts[0];
        const dex_two_owner = accounts[1];
        const lpAccounts = accounts.slice(2, 7);         
        const traderAccounts = accounts.slice(7, 15);

        // Create Tokens and DEX
        const tokenMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/Token.json'));
        if (!tokenMetadata) throw new Error("Could not find Token.json artifact. Compile the contract first.");
        const TOKEN_ABI = tokenMetadata.abi;
        const TOKEN_BYTECODE = tokenMetadata.data.bytecode.object;
        
    
        const dexMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/DEX.json'));
        if (!dexMetadata) throw new Error("Could not find DEX.json artifact. Compile the contract first.");
        const DEX_ABI = dexMetadata.abi;
        const DEX_BYTECODE = dexMetadata.data.bytecode.object;
    

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
        


        // --- Deploy DEX ---
        const DEX = new web3.eth.Contract(DEX_ABI);
        const dex1 = await DEX.deploy({
            data: DEX_BYTECODE,
            arguments: [tokenA.options.address, tokenB.options.address,]
        }).send({ from: dex_one_owner, gas: 100000000000});
        console.log("DEX deployed at:", dex1.options.address);

        // 3. Approve the DEX contract for each user.
        const maxApproval = 10000 * decimals;
        for (const user of accounts) {
            await tokenA.methods.approve(dex1.options.address, maxApproval).send({ from: user });
            await tokenB.methods.approve(dex1.options.address, maxApproval).send({ from: user });
        }
        

        
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////
        
        // make 1st intital transaction to set Ratio
        try {
            await dex1.methods.addLiquidity(100 * decimals, 200 * decimals).send({ from: dex_one_owner });
            console.log("First Transaction Deposit successful.");
        } catch (e) {
            console.error("Deposit failed:", e.message);
        }

        // setup csv logging
        const csvRows = [];
        const header = [
            "Step",
            "TxnType",
            "User",
            "TVL",
            "ReserveA",
            "ReserveB",
            "ReserveRatio",
            "SpotPriceAinB",
            "SpotPriceBinA",
            "SwapVolA",
            "SwapVolB",
            "TotalFeeA",
            "TotalFeeB",
            "LPBalances",  // will be a semicolon-delimited list in same order as lpAccounts
            "Slippage"     // only applicable for swap txns, else empty
        ].join(",");
        csvRows.push(header);

        // RUn N Random Transsactions
        for (let i = 0; i < 20; i++) {
            console.log(`\n--- Transaction ${i + 1} ---`);
            let metric = {};
            metric.slippage = 0;

            // Randomly choose a transaction type
            // 0 = deposit liquidity, 1 = withdraw liquidity, 2 = swap
            // const txType = Math.floor(Math.random() * 3);
            const txType = Math.floor(Math.random() * 3);
            metric.txn = txType;
            

            // must be done by only LPACcounts
            if (txType === TxType.DEPOSIT) {
                console.log("Performing LP Deposit");

                // Pick a random LP account
                const lpIndex = Math.floor(Math.random() * lpAccounts.length);
                const account = lpAccounts[lpIndex];
                metric.user = lpIndex;

                // Query current pool reserves
                let reserves = await dex1.methods.getReserves().call();

                // Get LP account token balances for depositing
                const balanceA = Number(await tokenA.methods.balanceOf(account).call());
                const balanceB = Number(await tokenB.methods.balanceOf(account).call());

                console.log(account)
                console.log(balanceA /decimals)
                console.log(balanceB /decimals)
                console.log(reserves[0])
                console.log(reserves[1])

                // transaction must be in ratio (reserveA/reserveB)
                const ratio = Number(reserves[1]) / Number(reserves[0]);

                const maxDeposit = Math.min(balanceA, balanceB );

                if (maxDeposit <= 0) {
                        console.log("LP account has insufficient tokens for deposit. Skipping deposit.");
                        continue; 
                }

                // Choose a random deposit amount: at least 10% up to 10% of maximum depositable amount.
                const rawFraction = 0.1 + (Math.random() * 0.29);
                const fraction = parseFloat(rawFraction.toFixed(1));

                console.log("fraction",fraction, "\tratio: ", ratio)

                const depositA = Math.floor(maxDeposit * fraction);
                const depositB = depositA * ratio;


                console.log(`LP ${account} depositing: TokenA ${depositA }, TokenB ${1}`);
                try {
                    await dex1.methods.addLiquidity(depositA, 1).send({ from: account });
                    console.log("Deposit successful.");
                } catch (e) {
                    console.error("Deposit failed:", e.message);
                }


            // must be done my only LPACcounts
            } else if (txType === TxType.WITHDRAW) {
                console.log("Performing LP Withdrawal");

                // Pick a random LP account
                const lpIndex = Math.floor(Math.random() * lpAccounts.length);
                const account = lpAccounts[lpIndex];
                metric.user = lpIndex;
                
                // Total LPShares
                let totalLPTokens = Number(await dex1.methods.totalLPTokens().call());

                // get users  LP Share
                const lpBalance = Number(await dex1.methods.getLPBalance(account).call());
                console.log("LP Tokens held by user:", lpBalance ,totalLPTokens);

                if (lpBalance === 0) {
                    console.log("No LP tokens. Skipping withdrawal.");
                    continue;
                }
                
                // Choosing a random withdrawal by taking random lpShare between 10 and 40 %
                const rawFraction = 0.1 + (Math.random() * 0.29);
                const fraction = parseFloat(rawFraction.toFixed(1));
                const withdrawAmount = Math.floor(lpBalance * fraction);

                console.log(`LP ${account} withdrawAmount: ${withdrawAmount} fraction ${fraction}`);

                try {
                    await dex1.methods.removeLiquidity(withdrawAmount).send({ from: account });
                    console.log("Withdrawal successful.");
                } catch (e) {
                    console.error("Withdrawal failed:", e.message);
                }

            // must be done my only Traders
            } else if (txType === TxType.SWAP) {
                
                console.log("Performing Swap");
                // Get a random trader account
                const traderIndex = Math.floor(Math.random() * traderAccounts.length);
                const account = traderAccounts[traderIndex];
                metric.user = traderIndex;

                // Get Trader account token balances for swapping
                const balanceA = Number(await tokenA.methods.balanceOf(account).call());
                const balanceB = Number(await tokenB.methods.balanceOf(account).call());
                
                // Query current pool reserves
                let reserves = await dex1.methods.getReserves().call();

                // Randomly decide the direction: 0 => swap tokenA for tokenB, 1 => swap tokenB for tokenA
                const swapDir = Math.floor(Math.random() * 2);

                if (swapDir === 0) {

                    const reserveA = reserves[0];

                    if (balanceA <= 0 ) {
                        console.log("Insufficient tokenA balance . Skipping swap.");
                        continue;
                    }


                    if ( reserveA <= 0 ) {
                        console.log("Insufficient pool reserve A. Skipping swap.");
                        continue;
                    }



                    // Maximum swap amount is the minimum of the user’s tokenA balance and 10% of reserveA.
                    const maxSwap = Math.min(balanceA, reserveA * 0.1);

                    if (maxSwap <= 0) {
                        console.log("Max swap amount is 0. Skipping swap.");
                        continue;
                    }

                    // get Random swap amount between 10 to 40 percent of maxSwap
                    const rawFraction = 0.1 + (Math.random() * 0.29);
                    const fraction = parseFloat(rawFraction.toFixed(1));
                    const swapAmount = Math.floor(maxSwap * fraction);


                    // Calling swapA first to get expected return of B and actual B info
                    let result = await dex1.methods.swapA(swapAmount).call({ from: account });
                    const actualOut = Number(result[0]);
                    const expectedOut = Number(result[1]);

                    // calculate slippage
                    const slippage = ((expectedOut - actualOut) / expectedOut) * 100;
                    metric.slippage = slippage;
                
                    console.log(`Trader ${account} swapping ${swapAmount } TokenA for TokenB ,fraction ${fraction} 0f maxSwamamount ${maxSwap}`);
                    console.log(`Expected TokenB: ${expectedOut }, Actual TokenB: ${actualOut }, Slippage: ${slippage.toFixed(2)}%`);

                    try {
                        await dex1.methods.swapA(swapAmount).send({ from: account });
                        console.log("Swap successful.");
                    } catch (e) {
                        console.error("Swap failed:", e.message);
                    }
                }
                else {
                    // swap B for A
                    const reserveB = reserves[1];

                    if (balanceB <= 0 ) {
                        console.log("Insufficient tokenB balance . Skipping swap.");
                        continue;
                    }


                    if ( reserveB <= 0 ) {
                        console.log("Insufficient pool reserve B. Skipping swap.");
                        continue;
                    }



                    // Maximum swap amount is the minimum of the user’s tokenA balance and 10% of reserveA.
                    const maxSwap = Math.min(balanceA, reserveB * 0.1);

                    if (maxSwap <= 0) {
                        console.log("Max swap amount is 0. Skipping swap.");
                        continue;
                    }

                    // get Random swap amount between 10 to 40 percent of maxSwap
                    const rawFraction = 0.1 + (Math.random() * 0.29);
                    const fraction = parseFloat(rawFraction.toFixed(1));
                    const swapAmount = Math.floor(maxSwap * fraction);


                    // Calling swapA first to get expected return of B and actual B info
                    let result = await dex1.methods.swapB(swapAmount).call({ from: account });
                    const actualOut = Number(result[0]);
                    const expectedOut = Number(result[1]);

                    // calculate slippage
                    const slippage = ((expectedOut - actualOut) / expectedOut) * 100;
                    metric.slippage = slippage;
                
                    console.log(`Trader ${account} swapping ${swapAmount } TokenB for TokenA,fraction ${fraction} 0f maxSwamamount ${maxSwap}`);
                    console.log(`Expected TokenA: ${expectedOut }, Actual TokenA: ${actualOut }, Slippage: ${slippage.toFixed(2)}%`);

                    try {
                        await dex1.methods.swapB(swapAmount).send({ from: account });
                        console.log("Swap successful.");
                    } catch (e) {
                        console.error("Swap failed:", e.message);
                    }
                }

            }

            const reserves = await dex1.methods.getReserves().call();
            let spotAinB = 0, spotBinA = 0;
            try {
            spotAinB = await dex1.methods.getValueofA().call();
            spotBinA = await dex1.methods.getValueofB().call();
            } catch (err) { /* no liquidity yet */ }
            const fees = await dex1.methods.getTotalFees().call();
            const volumes = await dex1.methods.getTotalSwapVolume().call();
            
            const reserveA =  Number(reserves[0]);
            const reserveB =  Number(reserves[1]);
            
            const tvl = reserveA + reserveB;

            const reserveRatio = reserveB > 0 ? (reserveA / reserveB).toFixed(4) : "N/A";
            
            let lpBalances = [];
            for (let i = 0; i < lpAccounts.length; i++) {
                const bal = Number(await dex1.methods.getLPBalance(lpAccounts[i]).call()) / decimals;
                lpBalances.push(bal);
            }
            lpBalances = (lpBalances).join(";")
            const csvRow = [
                i,
                metric.txn,
                metric.user,
                tvl / decimals,
                reserveA / decimals,
                reserveB / decimals,
                reserveRatio,
                spotAinB / decimals,
                spotBinA / decimals,
                volumes[0],
                volumes[1],
                fees[0],
                fees[1],
                `"${lpBalances}"`,
                metric.slippage
            ].join(",");
            csvRows.push(csvRow);

        } // end for loop over random txns

        const csvContent = csvRows.join("\n");
        console.log("CSV Output:\n" + csvContent);


        /////////////////////////////////
        ////////////////////////////////////////////////////////////////////////////

        // await dex1.methods.addLiquidity(2000 * decimals, 1000 * decimals).send({from: lpAccounts[2]});

        // value = await dex1.methods.totalLPTokens().call()
        // console.log("value",value)


        // await dex1.methods.removeLiquidity(500 * decimals).send({from: lpAccounts[2]});

        // value = await dex1.methods.totalLPTokens().call()
        // console.log("value",value)

        // value = await dex1.methods.getValueofA().call()
        // console.log(value/decimals);
        // value = await dex1.methods.getValueofB().call()
        // console.log(value/decimals);


        // value = await dex1.methods.swapB(10 * decimals).call({from: traderAccounts[0]});
        // await dex1.methods.swapB(10 * decimals).send({from: traderAccounts[0]});
        // actual = value[0]/decimals;
        // expected = value[1]/decimals;
        // slippage = ((expected-actual)/expected)*100;

        // console.log("Amount B", actual);
        // console.log("Slippage", slippage);

        // console.log("finished");

    } catch (error) {
        console.error("Error in interaction:", error);
    }
}

// Run the interaction
interactWithDEX();