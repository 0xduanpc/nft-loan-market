// Copyright 2021-2023 nft-market authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { BigNumberish } from "@ethersproject/bignumber";

export enum AssetType {
  ETH = 0,
  ERC20 = 1,
  ERC1155 = 2,
  ERC721 = 3,
}

export type Asset = {
  token: string;
  tokenId: BigNumberish;
  assetType: AssetType;
};

export type OrderKey = {
  owner: string;
  salt: BigNumberish;
  sellAsset: Asset;
  buyAsset: Asset;
};

export interface OrderType {
  key: OrderKey;
  selling: BigNumberish;
  buying: BigNumberish;
  sellerFee: BigNumberish;
}

export interface OrderWithBuyerFee {
  order: OrderType;
  buyerFee: BigNumberish;
}

export interface SequenceOrderType {
  key: {
    salt: string;
    owner: string;
    sellAsset: {
      token: string;
      tokenId: string;
      assetType: AssetType;
    };
    buyAsset: {
      token: string;
      tokenId: string;
      assetType: AssetType;
    };
  };
  selling: string;
  buying: string;
  sellerFee: BigNumberish;
}
