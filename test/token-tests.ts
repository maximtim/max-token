import * as hre from "hardhat";
import { expect } from "chai";
import { BigNumber, constants, Contract, utils } from "ethers";
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { JsonRpcSigner } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { formatUnits, parseUnits } from "ethers/lib/utils";


async function getAllowance(maxToken : Contract, ownerSigner : SignerWithAddress, spenderSigner : SignerWithAddress) {
  return await maxToken.allowance(await ownerSigner.getAddress(), await spenderSigner.getAddress());
}

async function getBalance(maxToken: Contract, signer: SignerWithAddress) {
  return await maxToken.balanceOf(await signer.getAddress());
}

function getGasCost(txRes: any) {
  return txRes.gasUsed.mul(txRes.effectiveGasPrice);
}

function delay(n : number){
  return new Promise(function(resolve){
      setTimeout(resolve,n*1000);
  });
}

///////////////////////////////////////////////////////////////////////////////

describe("MaxToken", function () {
  let owner : SignerWithAddress,
     first: SignerWithAddress, 
     second: SignerWithAddress, 
     third : SignerWithAddress;
  let maxToken : Contract;
  const supply = 1000_000;
  const name = "MaxToken";
  const symbol = "MAXT";
  const decimals = 3;

  beforeEach(async () => {
    [ owner, first, second, third ] = await ethers.getSigners();
    const MaxToken = await hre.ethers.getContractFactory("MaxToken");
    maxToken = await MaxToken.deploy(supply, name, symbol, decimals);
    await maxToken.deployed();
  })

  it("should deploy successfully", async function () {
    expect(maxToken.address).to.be.properAddress;
    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.minters(await owner.getAddress())).to.be.true;
  });

  it("Should transfer successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const transferValue = parseUnits("10", await maxToken.decimals());

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, first)).to.equal(0);

    await expect(maxToken.connect(owner).transfer(await first.getAddress(), transferValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(await owner.getAddress(), await first.getAddress(), transferValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply - transferValue.toNumber());
    expect(await getBalance(maxToken, first)).to.equal(transferValue);
  });

  it("Should fail transfer when insufficient funds", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const transferValue = parseUnits("10000", await maxToken.decimals());

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, first)).to.equal(0);

    await expect(maxToken.connect(owner).transfer(await first.getAddress(), transferValue))
        .to.be.revertedWith('Not enough tokens on balance');

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, first)).to.equal(0);
  });

  it("Should approve successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const approveValue = parseUnits("10", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);
  });

  it("Should transferFrom successfully if allowed before", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const approveValue = parseUnits("100", await maxToken.decimals());
    const transferValue = parseUnits("10", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, second)).to.equal(0);

    await expect(maxToken.connect(first).transferFrom(await owner.getAddress(), await second.getAddress(), transferValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(await owner.getAddress(), await second.getAddress(), transferValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply - transferValue.toNumber());
    expect(await getBalance(maxToken, second)).to.equal(transferValue);
    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue.sub(transferValue));
  });

  it("Should fail transferFrom if not enough allowed to spend", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const approveValue = parseUnits("5", await maxToken.decimals());
    const transferValue = parseUnits("10", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, second)).to.equal(0);

    await expect(maxToken.connect(first).transferFrom(await owner.getAddress(), await second.getAddress(), transferValue))
        .to.be.revertedWith('Not enough allowance to spend');

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, second)).to.equal(0);
    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);
  });

  it("Should fail transferFrom if insufficient funds", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const approveValue = parseUnits("100000", await maxToken.decimals());
    const transferValue = parseUnits("10000", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, second)).to.equal(0);

    await expect(maxToken.connect(first).transferFrom(await owner.getAddress(), await second.getAddress(), transferValue))
        .to.be.revertedWith('Not enough tokens on spender balance');

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, second)).to.equal(0);
    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);
  });

  it("Should add and remove minter successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    expect(await maxToken.minters(await first.getAddress())).to.be.false;
    await expect(maxToken.connect(owner).setMinterRole(await first.getAddress(), true)).to.not.be.reverted;
    expect(await maxToken.minters(await first.getAddress())).to.be.true;
    await expect(maxToken.connect(owner).setMinterRole(await first.getAddress(), false)).to.not.be.reverted;
    expect(await maxToken.minters(await first.getAddress())).to.be.false;
  });

  it("Should fail to set minter if caller is not owner", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    expect(await maxToken.minters(await first.getAddress())).to.be.false;
    await expect(maxToken.connect(first).setMinterRole(await first.getAddress(), true)).to.be.revertedWith('Only owner can set minter role');
  });

  it("Should mint successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const mintValue = parseUnits("100", await maxToken.decimals());

    expect(await maxToken.minters(await first.getAddress())).to.be.false;
    await expect(maxToken.connect(owner).setMinterRole(await first.getAddress(), true)).to.not.be.reverted;
    expect(await maxToken.minters(await first.getAddress())).to.be.true;

    expect(await getBalance(maxToken, second)).to.equal(0);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(first).mint(await second.getAddress(), mintValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(constants.AddressZero, await second.getAddress(), mintValue);

    expect(await getBalance(maxToken, second)).to.equal(mintValue);
    expect(await maxToken.totalSupply()).to.equal(supply + mintValue.toNumber());
  });

  it("Should fail minting if sender is not minter", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const mintValue = parseUnits("100", await maxToken.decimals());

    expect(await maxToken.minters(await first.getAddress())).to.be.false;

    expect(await getBalance(maxToken, second)).to.equal(0);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(first).mint(await second.getAddress(), mintValue))
        .to.be.revertedWith('Only minter can mint tokens');

    expect(await getBalance(maxToken, second)).to.equal(0);
    expect(await maxToken.totalSupply()).to.equal(supply);
  });

  it("Should burn successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const burnValue = parseUnits("10", await maxToken.decimals());

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(owner).burn(burnValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(await owner.getAddress(), constants.AddressZero, burnValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply - burnValue.toNumber());
    expect(await maxToken.totalSupply()).to.equal(supply - burnValue.toNumber());
  });

  it("Should fail burn if insufficient funds", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const burnValue = parseUnits("10000", await maxToken.decimals());

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(owner).burn(burnValue))
        .to.be.revertedWith('Not enough tokens on balance to burn');

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);
  });

  it("Should transfer successfully", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();
    const transferValue = parseUnits("10", await maxToken.decimals());

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await getBalance(maxToken, first)).to.equal(0);

    await expect(maxToken.connect(owner).transfer(await first.getAddress(), transferValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(await owner.getAddress(), await first.getAddress(), transferValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply - transferValue.toNumber());
    expect(await getBalance(maxToken, first)).to.equal(transferValue);
  });

  it("Should burnFrom successfully if allowed before", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const approveValue = parseUnits("100", await maxToken.decimals());
    const burnValue = parseUnits("10", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(first).burnFrom(await owner.getAddress(), burnValue))
      .to.emit(maxToken, "Transfer")
      .withArgs(await owner.getAddress(), constants.AddressZero, burnValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply - burnValue.toNumber());
    expect(await maxToken.totalSupply()).to.equal(supply - burnValue.toNumber());
  });

  it("Should fail burnFrom if not enough allowance", async function () {
    const decimals = await maxToken.decimals();
    const symbol = await maxToken.symbol();

    const approveValue = parseUnits("10", await maxToken.decimals());
    const burnValue = parseUnits("100", await maxToken.decimals());

    expect(await getAllowance(maxToken, owner, first)).to.equal(0);

    await expect(maxToken.connect(owner).approve(await first.getAddress(), approveValue))
      .to.emit(maxToken, "Approval")
      .withArgs(await owner.getAddress(), await first.getAddress(), approveValue);

    expect(await getAllowance(maxToken, owner, first)).to.equal(approveValue);

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);

    await expect(maxToken.connect(first).burnFrom(await owner.getAddress(), burnValue))
        .to.be.revertedWith('Not enough allowance to burn');

    expect(await getBalance(maxToken, owner)).to.equal(supply);
    expect(await maxToken.totalSupply()).to.equal(supply);
  });
});
