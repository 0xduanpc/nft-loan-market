import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 1000,
      },
    },
  },
  solidity: "0.8.4",
};

export default config;
