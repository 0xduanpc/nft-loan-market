import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";

import { ethers } from "hardhat";

describe("Rent Test", () => {
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function getBlockTime() {
    const block = await ethers.provider.getBlock("latest");
    if (!block) {
      throw new Error("Failed to get the latest block");
    }
    return block.timestamp;
  }

  async function displayBalance() {
    console.log("rentV1 ETH balance:");
    console.log(
      (await ethers.provider.getBalance(await rentV1.getAddress())) / bigNum
    );
    console.log("rentV1 USDC balance:");
    console.log(
      (await testErc20.balanceOf(await rentV1.getAddress())) / bigNum
    );
    console.log("----------");
    console.log("deployer ETH balance:");
    console.log(
      (await ethers.provider.getBalance(await deployer.getAddress())) / bigNum
    );
    console.log("deployer USDC balance:");
    console.log(
      (await testErc20.balanceOf(await deployer.getAddress())) / bigNum
    );
    console.log("----------");
    console.log("signer1 ETH balance:");
    console.log(
      (await ethers.provider.getBalance(await signer1.getAddress())) / bigNum
    );
    console.log("signer1 USDC balance:");
    console.log(
      (await testErc20.balanceOf(await signer1.getAddress())) / bigNum
    );
    console.log("----------");
    console.log("signer2 ETH balance:");
    console.log(
      (await ethers.provider.getBalance(await signer2.getAddress())) / bigNum
    );
    console.log("signer2 USDC balance:");
    console.log(
      (await testErc20.balanceOf(await signer2.getAddress())) / bigNum
    );
    console.log("#########################");
  }

  let deployer: any;
  let signer1: any;
  let signer2: any;
  let TestErc20;
  let testErc20: any;
  let TestErc721;
  let testErc721: any;
  let ERC20TransferProxy;
  let erc20TransferProxy: any;
  let RentNFT;
  let rentNFT: any;
  let RentState;
  let rentState: any;
  let RentV1;
  let rentV1: any;
  let domain: any;
  let types_order: any;
  let types_fee: any;
  let bigNum = 100000000000000n;

  beforeEach(async () => {
    [deployer, signer1, signer2] = await ethers.getSigners();

    TestErc20 = await ethers.getContractFactory("TestERC20");
    testErc20 = await TestErc20.deploy("TestERC20", "TestERC20");
    await testErc20.mint(signer1.address, "5000000000000000000");
    await testErc20.mint(signer2.address, "5000000000000000000");

    TestErc721 = await ethers.getContractFactory("TestERC721");
    testErc721 = await TestErc721.deploy("TestERC721", "TestERC721");
    await testErc721.mint(signer1.address, 1);
    await testErc721.mint(signer2.address, 2);

    ERC20TransferProxy = await ethers.getContractFactory("ERC20TransferProxy");
    erc20TransferProxy = await ERC20TransferProxy.deploy();

    RentNFT = await ethers.getContractFactory("RentNFT");
    rentNFT = await RentNFT.deploy("RentNFT", "RNFT");

    RentState = await ethers.getContractFactory("RentStateV1");
    rentState = await RentState.deploy();

    await testErc20
      .connect(signer1)
      .approve(await erc20TransferProxy.getAddress(), "5000000000000000000");
    await testErc20
      .connect(signer2)
      .approve(await erc20TransferProxy.getAddress(), "5000000000000000000");

    RentV1 = await ethers.getContractFactory("RentV1");
    rentV1 = await RentV1.deploy(
      await erc20TransferProxy.getAddress(),
      await rentNFT.getAddress(),
      await rentState.getAddress(),
      deployer.address,
      deployer.address
    );

    await erc20TransferProxy.addOperator(await rentV1.getAddress());
    await rentNFT.setExecutor(await rentV1.getAddress(), true);
    await rentState.addOperator(await rentV1.getAddress());

    domain = {
      name: "NFT-MARKET",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await rentV1.getAddress(),
    };

    types_order = {
      Order: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
        { name: "nft", type: "address" },
        { name: "nftId", type: "uint256" },
        { name: "token", type: "address" },
        { name: "tokenAmount", type: "uint256" },
        { name: "tokenType", type: "uint8" },
        { name: "orderType", type: "uint8" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
      ],
    };
    types_fee = {
      Fee: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
        { name: "nft", type: "address" },
        { name: "nftId", type: "uint256" },
        { name: "token", type: "address" },
        { name: "tokenAmount", type: "uint256" },
        { name: "tokenType", type: "uint8" },
        { name: "orderType", type: "uint8" },
        { name: "startTime", type: "uint256" },
        { name: "endTime", type: "uint256" },
        { name: "rentInFee", type: "uint256" },
        { name: "rentOutFee", type: "uint256" },
      ],
    };
  });

  it("rent in with erc20", async () => {
    const blockTime = await getBlockTime();
    const startTime = blockTime + 5;
    const endTime = blockTime + 10;
    const rentInFee = 100;
    const rentOutFee = 150;
    const order = {
      owner: await signer1.getAddress(),
      salt: 12345,
      nft: await testErc721.getAddress(),
      nftId: 2,
      token: await testErc20.getAddress(),
      tokenAmount: "3000000000000000000",
      tokenType: 1,
      orderType: 0,
      startTime: startTime,
      endTime: endTime,
    };
    const fee = {
      ...order,
      rentInFee: rentInFee,
      rentOutFee: rentOutFee,
    };
    const order_sig = ethers.Signature.from(
      await signer1.signTypedData(domain, types_order, order)
    );
    const fee_sig = ethers.Signature.from(
      await deployer.signTypedData(domain, types_fee, fee)
    );

    await rentV1
      .connect(signer2)
      .rent(order, order_sig, rentInFee, rentOutFee, fee_sig);

    await displayBalance();

    await sleep(7000);
    await rentV1
      .connect(signer2)
      .claim(await testErc721.getAddress(), 2, startTime, endTime);
    await displayBalance();

    await sleep(7000);
    await rentV1
      .connect(signer2)
      .claim(await testErc721.getAddress(), 2, startTime, endTime);
    await displayBalance();
  });

  it("rent out with eth", async () => {
    const blockTime = await getBlockTime();
    const startTime = blockTime + 5;
    const endTime = blockTime + 10;
    const rentInFee = 100;
    const rentOutFee = 150;
    const order = {
      owner: await signer1.getAddress(),
      salt: 12345,
      nft: await testErc721.getAddress(),
      nftId: 1,
      token: "0x0000000000000000000000000000000000000000",
      tokenAmount: ethers.parseEther("1000"),
      tokenType: 0,
      orderType: 1,
      startTime: startTime,
      endTime: endTime,
    };
    const fee = {
      ...order,
      rentInFee: rentInFee,
      rentOutFee: rentOutFee,
    };
    const order_sig = ethers.Signature.from(
      await signer1.signTypedData(domain, types_order, order)
    );
    const fee_sig = ethers.Signature.from(
      await deployer.signTypedData(domain, types_fee, fee)
    );
    await rentV1
      .connect(signer2)
      .rent(order, order_sig, rentInFee, rentOutFee, fee_sig, {
        value: ethers.parseEther((1000 * (1 + rentInFee / 10000)).toString()),
      });

    await displayBalance();

    await sleep(7000);
    await rentV1
      .connect(signer1)
      .claim(await testErc721.getAddress(), 1, startTime, endTime);
    await displayBalance();

    await sleep(7000);
    await rentV1
      .connect(signer1)
      .claim(await testErc721.getAddress(), 1, startTime, endTime);
    await displayBalance();
  });

  it("double rent test", async () => {
    const blockTime = await getBlockTime();
    const startTime = blockTime + 5;
    const endTime = blockTime + 10;
    const rentInFee = 100;
    const rentOutFee = 150;
    const order = {
      owner: await signer1.getAddress(),
      salt: 12345,
      nft: await testErc721.getAddress(),
      nftId: 2,
      token: await testErc20.getAddress(),
      tokenAmount: "3000000000000000000",
      tokenType: 1,
      orderType: 0,
      startTime: startTime,
      endTime: endTime,
    };
    const fee = {
      ...order,
      rentInFee: rentInFee,
      rentOutFee: rentOutFee,
    };
    const order_sig = ethers.Signature.from(
      await signer1.signTypedData(domain, types_order, order)
    );
    const fee_sig = ethers.Signature.from(
      await deployer.signTypedData(domain, types_fee, fee)
    );
    await rentV1
      .connect(signer2)
      .rent(order, order_sig, rentInFee, rentOutFee, fee_sig);

    const order2 = {
      owner: await signer1.getAddress(),
      salt: 12345,
      nft: await testErc721.getAddress(),
      nftId: 2,
      token: await testErc20.getAddress(),
      tokenAmount: "3000000000000000000",
      tokenType: 1,
      orderType: 0,
      startTime: startTime + 1,
      endTime: endTime + 1,
    };
    const fee2 = {
      ...order2,
      rentInFee: rentInFee,
      rentOutFee: rentOutFee,
    };
    const order_sig2 = ethers.Signature.from(
      await signer1.signTypedData(domain, types_order, order2)
    );
    const fee_sig2 = ethers.Signature.from(
      await deployer.signTypedData(domain, types_fee, fee2)
    );
    let e: any;
    try {
      await rentV1
        .connect(signer2)
        .rent(order2, order_sig2, rentInFee, rentOutFee, fee_sig2);
    } catch (_e) {
      e = _e;
    }
    expect(e.message.includes("nft is already rented")).to.equal(true);
  });

  it("cancel test", async () => {
    const blockTime = await getBlockTime();
    const startTime = blockTime + 5;
    const endTime = blockTime + 10;
    const order = {
      owner: await signer1.getAddress(),
      salt: 12345,
      nft: await testErc721.getAddress(),
      nftId: 2,
      token: await testErc20.getAddress(),
      tokenAmount: "3000000000000000000",
      tokenType: 1,
      orderType: 0,
      startTime: startTime,
      endTime: endTime,
    };

    await rentV1.connect(signer1).cancel(order);
  });
});
