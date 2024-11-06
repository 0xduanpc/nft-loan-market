import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const accounts = {
  mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
  count: 200
};

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 1000,
      },
    },
    fuji:{
      url: "https://api.avax-test.network/ext/C/rpc",
      accounts,
      chainId: 43113,
      gas: 5000000,
      timeout: 10000000
    }
  },
  solidity: "0.8.4",
};

export default config;
