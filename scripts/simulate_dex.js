const decimals = 1e10;

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

        // Deploy contracts
        const tokenMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/Token.json'));
        if (!tokenMetadata) throw new Error("Could not find Token.json artifact. Compile the contract first.");
        const TOKEN_ABI = tokenMetadata.abi;
        const TOKEN_BYTECODE = tokenMetadata.data.bytecode.object;
        
    
        const dexMetadata = JSON.parse(await remix.call('fileManager', 'getFile', './contracts/artifacts/DEX.json'));
        if (!dexMetadata) throw new Error("Could not find DEX.json artifact. Compile the contract first.");
        const DEX_ABI = dexMetadata.abi;
        const DEX_BYTECODE = dexMetadata.data.bytecode.object;
    


        const Token = new web3.eth.Contract(TOKEN_ABI);
        const tokenA = await Token.deploy({
            data: TOKEN_BYTECODE,
            arguments: ["TokenA", "TKA", 10000 * decimals, token_owner]
        }).send({ from: token_owner});
        console.log("TokenA deployed at:", tokenA.options.address);
        

        // --- Deploy TokenB ---
        const tokenB = await Token.deploy({
            data: TOKEN_BYTECODE,
            arguments: ["TokenB", "TKB", 10000 * decimals, token_owner]
        }).send({ from: token_owner});
        console.log("TokenB deployed at:", tokenB.options.address);


        // --- Deploy DEX ---
        const DEX = new web3.eth.Contract(DEX_ABI);
        const dex1 = await DEX.deploy({
            data: DEX_BYTECODE,
            arguments: [tokenA.options.address, tokenB.options.address,]
        }).send({ from: dex_one_owner});
        console.log("DEX deployed at:", dex1.options.address);



        await dex1.methods.addLiquidity(100 * decimals, 200 * decimals).send({from: dex_one_owner});
        await dex1.methods.addLiquidity(50 * decimals, 100 * decimals).send({from: dex_one_owner});
        await dex1.methods.addLiquidity(1000 * decimals, 2000 * decimals).send({from: dex_one_owner});

        
      

        console.log("finished")

    } 
        catch (error) {
        console.error("Error in interaction:", error);
    }
}

// Run the interaction
interactWithDEX();