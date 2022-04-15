## ERC-20 MaxToken

ERC20 contract with additional functions setMinterRole, mint, burn, burnFrom

#### 1) Hardhat tasks:
|Command|Description|
|---------------------------------|-------------------------------------------------|
| -  token-allowance       | Get token allowance to spend from owner |
| -  token-approve         | Allow spender to transfer amount of tokens from owner |
| -  token-balanceof       | Get token balance for user |
| -  token-burn            | Burn some of your tokens |
| -  token-burn-from       | Trusted burning of allowed amount of tokens |
| -  token-deploy          | Deploy new Maxtoken contract. |
| -  token-mint            | Mint token to some address |
| -  token-set-minter-role | Enable or disable minting role for user (owner only) |
| -  token-transfer        | Transfer token |
| -  token-transfer-from   | Trusted transfer of allowed amount of tokens |

Add "--help" to these commands to see explanations.

Users addresses can also be indexes of accounts from PRIVATE_KEYS_LIST (0,1,2..) (or from hardhat test accounts list), for example:
```
> npx hardhat token-balanceof --who 1 --network localhost
```

You should attach contract's address in order to use tasks:
```
> npx hardhat attach-contract --address <CONTRACT_ADDRESS>
```

#### 2) Deploy script to rinkeby network 

- Windows:

Addresses can also be indexes of accounts from PRIVATE_KEYS_LIST as well

"--signer" is optional, default is 0
```
> $env:HARDHAT_NETWORK='rinkeby'
> npx ts-node scripts/deploy.ts --supply 1000000 --name MaxToken --symbol MAXT --decimals 3 [--signer 0]
```
- Linux: 
```
>  HARDHAT_NETWORK=rinkeby npx ts-node scripts/deploy.ts --supply 1000000 --name MaxToken --symbol MAXT --decimals 3 [--signer 0]
```

#### 3) Tests (solidity-coverage 100%)
#### 4) Etherscan verification
```
> npx hardhat verify --network rinkeby 0x051e8B3d9C9440215Ba2D096e683562758adE247 1000000 MaxToken MAXT 3
```
https://rinkeby.etherscan.io/address/0x051e8B3d9C9440215Ba2D096e683562758adE247#code
#### 5) .env settings:
```
PROJECT_URL="https://rinkeby.infura.io/v3/<project id here>"
PRIVATE_KEYS_LIST=["<pk0>","<pk1>","<pk2>",...]
ETHERSCAN_API_KEY=<api-key>
```

