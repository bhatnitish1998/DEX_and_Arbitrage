      const accounts = await web3.eth.getAccounts();
      console.log("Accounts detected:", accounts);

      const token_owner = accounts[0];
      const dex_one_owner = accounts[0];
      const dex_two_owner = accounts[1];
      const lpAccounts = accounts.slice(2, 7);         
      const traderAccounts = accounts.slice(7, 15);      


