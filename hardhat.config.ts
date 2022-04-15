import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { parseEther, formatEther, parseUnits, formatUnits } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from 'fs';
import { constants, Contract } from "ethers";
import { JsonRpcSigner } from "@ethersproject/providers";
import { boolean } from "hardhat/internal/core/params/argumentTypes";

dotenv.config();

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address + " - " + formatEther(await account.getBalance()) + " ETH");
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const account = ethers.utils.getAddress(taskArgs.account);
    const balance = await ethers.provider.getBalance(account);

    console.log(formatEther(balance), "ETH");
  });

/////////////////////////////////////////////////////////////////////////////////////

function parseAddressOrIndex(hre : HardhatRuntimeEnvironment, input : string) {
  if (hre.ethers.utils.isAddress(input)) {
    return input;
  } else {
    return Number(input);
  }
}

const localConfigName = '.env-local';

function getLocalConfig() {
  return dotenv.parse(fs.readFileSync(localConfigName));
}

function getSigner(hre: HardhatRuntimeEnvironment, owner: any) {
  return hre.ethers.provider.getSigner(parseAddressOrIndex(hre, owner));
}

async function getAllowance(maxToken : Contract, ownerSigner : JsonRpcSigner, spenderSigner : JsonRpcSigner) {
  return await maxToken.allowance(await ownerSigner.getAddress(), await spenderSigner.getAddress());
}

async function getBalance(maxToken: Contract, signer: JsonRpcSigner) {
  return await maxToken.balanceOf(await signer.getAddress());
}

async function logUnits(text: string, allowance: any, maxToken: Contract) {
  console.log(text, formatUnits(allowance, await maxToken.decimals()), await maxToken.symbol());
}

function delay(n : number){
  return new Promise(function(resolve){
      setTimeout(resolve,n*1000);
  });
}

function getGasCost(txRes: any) {
  return txRes.gasUsed.mul(txRes.effectiveGasPrice);
}

task("token-deploy", "Deploy new Maxtoken contract.")
  .addOptionalParam("signer", "Signer's address (will be owner). Default is first. All user addresses are addressOrIndex type", "0")
  .addParam("supply", "Token initial supply")
  .addParam("name", "Token name")
  .addParam("symbol", "Token short symbol")
  .addParam("decimals", "Token decimals")
  .setAction(async ({ signer, supply, name, symbol, decimals }, hre) => {
    const ownerSigner = getSigner(hre, signer);
    const MaxToken = await hre.ethers.getContractFactory("MaxToken", ownerSigner);
    const maxToken = await MaxToken.deploy(supply, name, symbol, decimals);
    const txRes = await ((await maxToken.deployed()).deployTransaction).wait();

    console.log("Owner: ", await ownerSigner.getAddress());
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");
    console.log("MaxToken deployed to: ", maxToken.address);
    console.log("Note: you should attach address by \"npx hardhat attach-contract --address <contract>\"");
  });

task("attach-contract", "Set contract address for tasks")
  .addParam("address", "Contract's address")
  .setAction(async ({address}, hre) => {
    if (hre.ethers.utils.isAddress(address) == false) {
      console.log("Address not valid");
      return;
    }

    fs.writeFileSync(localConfigName, 'TOKEN_CONTRACT='+address, 'utf8');
    console.log("Success.");
  });

task("token-balanceof", "Get token balance for user")
  .addParam("who", "Token's holder address")
  .setAction(async ({who}, hre) => {
    const localConfig = getLocalConfig();

    const contract = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);
    const maxToken = contract;

    const signer = getSigner(hre, who);
    const balance = await getBalance(maxToken, signer);
    await logUnits("Token balance: ", balance, maxToken);
  });

task("token-allowance", "Get token allowance to spend from owner")
  .addParam("owner", "Token's owner address")
  .addParam("spender", "Token's spender address")
  .setAction(async ({owner, spender}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const ownerSigner = getSigner(hre, owner);
    const spenderSigner = getSigner(hre, spender);
    const allowance = await getAllowance(maxToken, ownerSigner, spenderSigner);
    await logUnits("Allowance: ", allowance, maxToken);
  });

task("token-transfer", "Transfer token")
  .addParam("sender", "Tokens sender address")
  .addParam("to", "Tokens receiver address")
  .addParam("value", "Tokens amount (in token units)")
  .setAction(async ({sender, to, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const senderSigner = getSigner(hre, sender);
    const toSigner = getSigner(hre, to);

    const senderBefore = await getBalance(maxToken, senderSigner);
    const toBefore = await getBalance(maxToken, toSigner);
    await logUnits("Sender balance before:", senderBefore, maxToken);
    await logUnits("Receiver balance before:", toBefore, maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Transfer(await senderSigner.getAddress(), await toSigner.getAddress());
    maxToken.once(filter, (from, to, value, event) => {
      console.log("Transfer happened: ", "\nFrom: ", from, "\nTo: ", to, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(senderSigner)
          .transfer(await toSigner.getAddress(), parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const senderAfter = await getBalance(maxToken, senderSigner);
    const toAfter = await getBalance(maxToken, toSigner);
    await logUnits("Sender balance after:", senderAfter, maxToken);
    await logUnits("Receiver balance after:", toAfter, maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });


task("token-transfer-from", "Trusted transfer of alowed amount of tokens")
  .addParam("spender", "Token spender address")
  .addParam("from", "Tokens owner address")
  .addParam("to", "Tokens receiver address")
  .addParam("value", "Tokens amount (in token units)")
  .setAction(async ({spender, from, to, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const spenderSigner = getSigner(hre, spender);
    const fromSigner = getSigner(hre, from);
    const toSigner = getSigner(hre, to);

    const fromBefore = await getBalance(maxToken, fromSigner);
    const toBefore = await getBalance(maxToken, toSigner);
    const allowanceBefore = await getAllowance(maxToken, fromSigner, spenderSigner);
    await logUnits("Spender balance before:", fromBefore, maxToken);
    await logUnits("Receiver balance before:", toBefore, maxToken);
    await logUnits("Allowance before:", allowanceBefore, maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Transfer(await fromSigner.getAddress(), await toSigner.getAddress());
    maxToken.once(filter, (from, to, value, event) => {
      console.log("Transfer happened: ", "\nFrom: ", from, "\nTo: ", to, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(spenderSigner)
          .transferFrom(await fromSigner.getAddress(), await toSigner.getAddress(), parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const fromAfter = await getBalance(maxToken, fromSigner);
    const toAfter = await getBalance(maxToken, toSigner);
    const allowanceAfter = await getAllowance(maxToken, fromSigner, spenderSigner);
    await logUnits("Spender balance after:", fromAfter, maxToken);
    await logUnits("Receiver balance after:", toAfter, maxToken);
    await logUnits("Allowance after:", allowanceAfter, maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });

task("token-approve", "Allow spender to transfer amount of tokens from owner")
  .addParam("owner", "Tokens owner address")
  .addParam("spender", "Tokens spender address")
  .addParam("value", "Allowed tokens amount (in token units)")
  .setAction(async ({owner, spender, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const ownerSigner = getSigner(hre, owner);
    const spenderSigner = getSigner(hre, spender);

    const ownerBalance = await getBalance(maxToken, ownerSigner);
    const allowanceBefore = await getAllowance(maxToken, ownerSigner, spenderSigner);
    await logUnits("Owner balance:", ownerBalance, maxToken);
    await logUnits("Allowance before:", allowanceBefore, maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Approval(await ownerSigner.getAddress(), await spenderSigner.getAddress());
    maxToken.once(filter, (owner, spender, value, event) => {
      console.log("Approval happened: ", "\nOwner: ", owner, "\nSpender: ", spender, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(ownerSigner)
          .approve(await spenderSigner.getAddress(), parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const allowanceAfter = await getAllowance(maxToken, ownerSigner, spenderSigner);
    await logUnits("Allowance after:", allowanceAfter, maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });

task("token-set-minter-role", "Enable or disable minting role for user")
  .addParam("user", "User's address")
  .addParam("isminter", "New role for user")
  .setAction(async ({user, isminter}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const userSigner = getSigner(hre, user);
    const tx = await maxToken.setMinterRole(await userSigner.getAddress(), isminter === "true");
    const txRes = await tx.wait();

    const gasCost = getGasCost(txRes);
    console.log("Role set: ", await maxToken.minters(await userSigner.getAddress()), "for", await userSigner.getAddress());
    console.log("Gas cost: ", formatEther(gasCost), "ETH");
  });

task("token-mint", "Mint token to some address")
  .addParam("minter", "Tokens minter address")
  .addParam("to", "Tokens receiver address")
  .addParam("value", "Tokens amount (in token units)")
  .setAction(async ({minter, to, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const minterSigner = getSigner(hre, minter);
    const toSigner = getSigner(hre, to);

    const toBefore = await getBalance(maxToken, toSigner);
    await logUnits("Receiver balance before:", toBefore, maxToken);
    await logUnits("Total supply before:", await maxToken.totalSupply(), maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Transfer(constants.AddressZero, await toSigner.getAddress());
    maxToken.once(filter, (from, to, value, event) => {
      console.log("Transfer happened: ", "\nFrom: ", from, "\nTo: ", to, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(minterSigner)
          .mint(await toSigner.getAddress(), parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const toAfter = await getBalance(maxToken, toSigner);
    await logUnits("Receiver balance after:", toAfter, maxToken);
    await logUnits("Total supply after:", await maxToken.totalSupply(), maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });

task("token-burn", "Burn some of your tokens")
  .addParam("owner", "Tokens owner address")
  .addParam("value", "Tokens amount (in token units)")
  .setAction(async ({owner, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const ownerSigner = getSigner(hre, owner);

    const before = await getBalance(maxToken, ownerSigner);
    await logUnits("Owner balance before:", before, maxToken);
    await logUnits("Total supply before:", await maxToken.totalSupply(), maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Transfer(await ownerSigner.getAddress(), constants.AddressZero);
    maxToken.once(filter, (from, to, value, event) => {
      console.log("Transfer happened: ", "\nFrom: ", from, "\nTo: ", to, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(ownerSigner)
          .burn(parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const after = await getBalance(maxToken, ownerSigner);
    await logUnits("Owner balance after:", after, maxToken);
    await logUnits("Total supply after:", await maxToken.totalSupply(), maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });

task("token-burn-from", "Trusted burning of allowed amount of tokens")
  .addParam("spender", "Token spender address")
  .addParam("from", "Tokens owner address")
  .addParam("value", "Tokens amount (in token units)")
  .setAction(async ({spender, from, value}, hre) => {
    const localConfig = getLocalConfig();

    const maxToken = await hre.ethers.getContractAt("MaxToken", localConfig.TOKEN_CONTRACT);

    const spenderSigner = getSigner(hre, spender);
    const fromSigner = getSigner(hre, from);

    const fromBefore = await getBalance(maxToken, fromSigner);
    const allowanceBefore = await getAllowance(maxToken, fromSigner, spenderSigner);
    await logUnits("Burning balance before:", fromBefore, maxToken);
    await logUnits("Allowance before:", allowanceBefore, maxToken);
    await logUnits("Total supply before:", await maxToken.totalSupply(), maxToken);
    console.log();

    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const filter = maxToken.filters.Transfer(await fromSigner.getAddress(), constants.AddressZero);
    maxToken.once(filter, (from, to, value, event) => {
      console.log("Transfer happened: ", "\nFrom: ", from, "\nTo: ", to, "\nValue: ", formatUnits(value, decimals), symbol);
    });

    const tx = await maxToken
          .connect(spenderSigner)
          .burnFrom(await fromSigner.getAddress(), parseUnits(value, await maxToken.decimals()));
    const txRes = await tx.wait();

    const fromAfter = await getBalance(maxToken, fromSigner);
    const allowanceAfter = await getAllowance(maxToken, fromSigner, spenderSigner);
    await logUnits("Burning balance after:", fromAfter, maxToken);
    await logUnits("Allowance after:", allowanceAfter, maxToken);
    await logUnits("Total supply after:", await maxToken.totalSupply(), maxToken);
    console.log();
    
    const gasCost = getGasCost(txRes);
    console.log("Gas cost: ", formatEther(gasCost), "ETH");

    await delay(4);
  });

/////////////////////////////////////////////////////////////////////////////////////

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    localhost: {
      url: 'http://localhost:8545',
      //gasPrice: 125000000000, // you can adjust gasPrice locally to see how much it will cost on production
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    rinkeby: {
      url: process.env.PROJECT_URL,
      accounts: JSON.parse(process.env.PRIVATE_KEYS_LIST !== undefined ? process.env.PRIVATE_KEYS_LIST : ""),
      gas: 2100000,
      gasPrice: 8000000000
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;




