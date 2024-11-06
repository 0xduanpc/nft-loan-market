import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";

import { ethers } from "hardhat";

async function deploy_sale() {
  console.log("deploy sale start!");
  const [deployer, beneficiary, signer] = await ethers.getSigners();

  const TransferProxy = await ethers.getContractFactory("TransferProxy");
  const transferProxy = await TransferProxy.deploy();
  console.log("TransferProxy address:", await transferProxy.getAddress());

  const ERC20TransferProxy = await ethers.getContractFactory(
    "ERC20TransferProxy"
  );
  const erc20TransferProxy = await ERC20TransferProxy.deploy();

  const ExchangeStateV1 = await ethers.getContractFactory("ExchangeStateV1");
  const exchangeStateV1 = await ExchangeStateV1.deploy();
  console.log("ExchangeStateV1 address:", await exchangeStateV1.getAddress());

  const ExchangeV1 = await ethers.getContractFactory("ExchangeV1");
  const exchangeV1 = await ExchangeV1.deploy(
    await transferProxy.getAddress(),
    await erc20TransferProxy.getAddress(),
    await exchangeStateV1.getAddress(),
    beneficiary,
    signer
  );
  console.log("ExchangeV1 address:", await exchangeV1.getAddress());

  await transferProxy.addOperator(await exchangeV1.getAddress());
  await erc20TransferProxy.addOperator(await exchangeV1.getAddress());
  await exchangeStateV1.addOperator(await exchangeV1.getAddress());

  console.log("deploy sale finish!");
}

async function deploy_rent() {
  console.log("deploy rent start!");
  const [deployer, beneficiary, signer] = await ethers.getSigners();

  const ERC20TransferProxy = await ethers.getContractFactory(
    "ERC20TransferProxy"
  );
  const erc20TransferProxy = await ERC20TransferProxy.deploy();
  console.log(
    "ERC20TransferProxy address:",
    await erc20TransferProxy.getAddress()
  );

  const RentNFT = await ethers.getContractFactory("RentNFT");
  const rentNFT = await RentNFT.deploy("RentNFT", "RNFT");
  console.log("RentNFT address:", await rentNFT.getAddress());

  const RentV1 = await ethers.getContractFactory("RentV1");
  const rentV1 = await RentV1.deploy(
    await erc20TransferProxy.getAddress(),
    await rentNFT.getAddress(),
    beneficiary.address,
    signer.address
  );
  console.log("RentV1 address:", await rentV1.getAddress());

  await erc20TransferProxy.addOperator(await rentV1.getAddress());
  await rentNFT.setExecutor(await rentV1.getAddress(), true);

  console.log("deploy rent finish!");
}

async function main() {
  await deploy_sale();
  await deploy_rent();
}

main();
