import "@nomiclabs/hardhat-ethers";

import { ethers } from "hardhat";

describe("Sale Test", () => {
  it("exchange test", async () => {
    const [deployer, seller] = await ethers.getSigners();

    const TestErc20 = await ethers.getContractFactory("TestERC20");
    const testErc20 = await TestErc20.deploy("TestERC20", "TestERC20");
    await testErc20.mint(deployer.address, "5000000000000000000");

    const TestErc721 = await ethers.getContractFactory("TestERC721");
    const testErc721 = await TestErc721.deploy("TestERC721", "TestERC721");
    await testErc721.mint(seller.address, "1");

    const TransferProxy = await ethers.getContractFactory("TransferProxy");
    const transferProxy = await TransferProxy.deploy();
    await testErc721
      .connect(seller)
      .approve(await transferProxy.getAddress(), "1");

    const ERC20TransferProxy = await ethers.getContractFactory(
      "ERC20TransferProxy"
    );
    const erc20TransferProxy = await ERC20TransferProxy.deploy();
    await testErc20.approve(
      await erc20TransferProxy.getAddress(),
      "5000000000000000000"
    );

    const ExchangeStateV1 = await ethers.getContractFactory("ExchangeStateV1");
    const exchangeStateV1 = await ExchangeStateV1.deploy();

    const ExchangeV1 = await ethers.getContractFactory("ExchangeV1");
    const exchangeV1 = await ExchangeV1.deploy(
      await transferProxy.getAddress(),
      await erc20TransferProxy.getAddress(),
      await exchangeStateV1.getAddress(),
      deployer.address,
      deployer.address
    );

    await transferProxy.addOperator(await exchangeV1.getAddress());
    await erc20TransferProxy.addOperator(await exchangeV1.getAddress());
    await exchangeStateV1.addOperator(await exchangeV1.getAddress());

    const order = {
      key: {
        owner: seller.address,
        salt: 12345,
        sellAsset: {
          token: await testErc721.getAddress(),
          tokenId: 1,
          assetType: 3,
        },
        buyAsset: {
          token: await testErc20.getAddress(),
          tokenId: 0,
          assetType: 1,
        },
      },
      selling: 1,
      buying: 2,
      sellerFee: 150,
    };

    const message = {
      owner: seller.address,
      salt: 12345,
      sellToken: await testErc721.getAddress(),
      sellTokenId: 1,
      sellAssetType: 3,
      buyToken: await testErc20.getAddress(),
      buyTokenId: 0,
      buyAssetType: 1,
      selling: 1,
      buying: 2,
      sellerFee: 150,
    };

    const domain = {
      name: "NFT-LOAN-MARKET",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await exchangeV1.getAddress(),
    };

    const types = {
      Order: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
        { name: "sellToken", type: "address" },
        { name: "sellTokenId", type: "uint256" },
        { name: "sellAssetType", type: "uint8" },
        { name: "buyToken", type: "address" },
        { name: "buyTokenId", type: "uint256" },
        { name: "buyAssetType", type: "uint8" },
        { name: "selling", type: "uint256" },
        { name: "buying", type: "uint256" },
        { name: "sellerFee", type: "uint256" },
      ],
    };

    const sig = ethers.Signature.from(
      await seller.signTypedData(domain, types, message)
    );

    const buyerFee = 150;
    const buyerFeeMessage = {
      owner: seller.address,
      salt: 12345,
      sellToken: await testErc721.getAddress(),
      sellTokenId: 1,
      sellAssetType: 3,
      buyToken: await testErc20.getAddress(),
      buyTokenId: 0,
      buyAssetType: 1,
      selling: 1,
      buying: 2,
      sellerFee: 150,
      buyerFee: buyerFee,
    };
    const buyerFeeTypes = {
      BuyerFee: [
        { name: "owner", type: "address" },
        { name: "salt", type: "uint256" },
        { name: "sellToken", type: "address" },
        { name: "sellTokenId", type: "uint256" },
        { name: "sellAssetType", type: "uint8" },
        { name: "buyToken", type: "address" },
        { name: "buyTokenId", type: "uint256" },
        { name: "buyAssetType", type: "uint8" },
        { name: "selling", type: "uint256" },
        { name: "buying", type: "uint256" },
        { name: "sellerFee", type: "uint256" },
        { name: "buyerFee", type: "uint256" },
      ],
    };

    // 项目方签名
    const buyerFeeSig = ethers.Signature.from(
      await deployer.signTypedData(domain, buyerFeeTypes, buyerFeeMessage)
    );

    const amount = 1;
    const buyer = deployer.address;
    await exchangeV1.exchange(order, sig, buyerFee, buyerFeeSig, amount, buyer);
  });

  it("cancel test", async () => {
    const [deployer, seller] = await ethers.getSigners();

    const TestErc20 = await ethers.getContractFactory("TestERC20");
    const testErc20 = await TestErc20.deploy("TestERC20", "TestERC20");
    await testErc20.mint(deployer.address, "5000000000000000000");

    const TestErc721 = await ethers.getContractFactory("TestERC721");
    const testErc721 = await TestErc721.deploy("TestERC721", "TestERC721");
    await testErc721.mint(seller.address, "1");

    const TransferProxy = await ethers.getContractFactory("TransferProxy");
    const transferProxy = await TransferProxy.deploy();
    await testErc721
      .connect(seller)
      .approve(await transferProxy.getAddress(), "1");

    const ERC20TransferProxy = await ethers.getContractFactory(
      "ERC20TransferProxy"
    );
    const erc20TransferProxy = await ERC20TransferProxy.deploy();
    await testErc20.approve(
      await erc20TransferProxy.getAddress(),
      "5000000000000000000"
    );

    const ExchangeStateV1 = await ethers.getContractFactory("ExchangeStateV1");
    const exchangeStateV1 = await ExchangeStateV1.deploy();

    const ExchangeV1 = await ethers.getContractFactory("ExchangeV1");
    const exchangeV1 = await ExchangeV1.deploy(
      await transferProxy.getAddress(),
      await erc20TransferProxy.getAddress(),
      await exchangeStateV1.getAddress(),
      await deployer.address,
      await deployer.address
    );

    await transferProxy.addOperator(await exchangeV1.getAddress());
    await erc20TransferProxy.addOperator(await exchangeV1.getAddress());
    await exchangeStateV1.addOperator(await exchangeV1.getAddress());

    const order_key = {
      owner: seller.address,
      salt: 12345,
      sellAsset: {
        token: await testErc721.getAddress(),
        tokenId: "1",
        assetType: 3,
      },
      buyAsset: {
        token: await testErc20.getAddress(),
        tokenId: "0",
        assetType: 1,
      },
    };
    await exchangeV1.connect(seller).cancel(order_key);
  });
});
