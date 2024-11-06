# nft-loan-market

nft 买卖与租赁

## 1. 安装与编译

- `yarn install`
- `npx hardhat compile`

## 2. 脚本测试

- `npx hardhat test`

## 3. 部署

### 3.1 localhost 部署

- `npx hardhat node`
- `npx hardhat run ./scripts/deploy.ts --network localhost`

### 3.2 测试网部署

- 先修改.env 文件中 MNEMONIC 的助记词
- `hardhat.config.ts`中添加测试网配置
- network 字段指定为对应网络并部署，如：`npx hardhat run ./scripts/deploy.ts --network fuji`
