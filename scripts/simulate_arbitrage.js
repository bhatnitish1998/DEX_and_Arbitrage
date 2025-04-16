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

        await dex1.methods.addLiquidity(200 * decimals, 100 * decimals).send({from: lpAccounts[2]});
        await dex2.methods.addLiquidity(300 * decimals, 100 * decimals).send({from: lpAccounts[3]});


        value = await arbit.methods.checkOpportunityBAB(100*decimals,4*decimals).call({from: traderAccounts[0]});
        console.log(value[0],value[1]/decimals);


        // 1. Fix threshold
        // 2. Do the actual swap based on direction
        // 3. Put it in the loop to do trades until profit < threshold 

        console.log("finished");

    } 
        catch (error) {
        console.error("Error in interaction:", error);
    }
}

// Run the interaction
interactWithArbit();