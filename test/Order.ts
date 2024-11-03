// Copyright 2021-2023 nft-market authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Signer } from "@ethersproject/abstract-signer";
import type { SignatureLike } from "@ethersproject/bytes";
import type {
  Asset,
  OrderKey,
  OrderType,
  SequenceOrderType,
  OrderWithBuyerFee,
} from "./types";

import { defaultAbiCoder, ParamType } from "@ethersproject/abi";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { verifyMessage } from "@ethersproject/wallet";

import { randomHex } from "./utils";

export const AssetTypeComponents = [
  {
    name: "token",
    type: "address",
  },
  {
    name: "tokenId",
    type: "uint256",
  },
  {
    name: "assetType",
    type: "uint8",
  },
];

export const OrderKeyComponents = [
  {
    name: "owner",
    type: "address",
  },
  {
    name: "salt",
    type: "uint256",
  },
  {
    components: AssetTypeComponents,
    name: "sellAsset",
    type: "tuple",
  },
  {
    components: AssetTypeComponents,
    name: "buyAsset",
    type: "tuple",
  },
];

export const OrderComponents = [
  {
    name: "key",
    type: "tuple",
    components: OrderKeyComponents,
  },
  {
    name: "selling",
    type: "uint256",
  },
  {
    name: "buying",
    type: "uint256",
  },
  {
    name: "sellerFee",
    type: "uint256",
  },
];

export class Order {
  public key: OrderKey;
  public selling: BigNumber;
  public buying: BigNumber;
  public sellerFee: BigNumber;

  public static parse(_order: SequenceOrderType): Order {
    const owner = _order.key.owner;
    const sellAsset: Asset = {
      token: _order.key.sellAsset.token,
      tokenId: BigNumber.from(_order.key.sellAsset.tokenId),
      assetType: _order.key.sellAsset.assetType,
    };
    const buyAsset: Asset = {
      token: _order.key.buyAsset.token,
      tokenId: BigNumber.from(_order.key.buyAsset.tokenId),
      assetType: _order.key.buyAsset.assetType,
    };
    const selling: BigNumber = BigNumber.from(_order.selling);
    const buying: BigNumber = BigNumber.from(_order.buying);

    return new Order(
      owner,
      sellAsset,
      buyAsset,
      selling,
      buying,
      _order.sellerFee,
      _order.key.salt
    );
  }

  public static verifyOrder(order: Order, signature: SignatureLike): boolean {
    return (
      verifyMessage(order.prepareMessage(), signature).toLowerCase() ===
      order.key.owner.toLowerCase()
    );
  }

  constructor(
    owner: string,
    sellAsset: Asset,
    buyAsset: Asset,
    selling: BigNumberish,
    buying: BigNumberish,
    sellerFee: BigNumberish,
    saltStr?: string
  ) {
    const salt = BigNumber.from(saltStr ?? randomHex(32));
    const key: OrderKey = {
      owner,
      salt,
      sellAsset,
      buyAsset,
    };

    this.key = key;
    this.selling = BigNumber.from(selling);
    this.buying = BigNumber.from(buying);
    this.sellerFee = BigNumber.from(sellerFee);
  }

  public toJson(): OrderType {
    return {
      key: this.key,
      selling: this.selling,
      buying: this.buying,
      sellerFee: this.sellerFee,
    };
  }

  public toJsonWithBuyerFee(buyerFee: BigNumberish): OrderWithBuyerFee {
    return {
      order: this.toJson(),
      buyerFee: buyerFee,
    };
  }

  public sequence(): SequenceOrderType {
    return {
      key: {
        salt: this.key.salt.toString(),
        owner: this.key.owner,
        sellAsset: {
          token: this.key.sellAsset.token,
          tokenId: this.key.sellAsset.tokenId.toString(),
          assetType: this.key.sellAsset.assetType,
        },
        buyAsset: {
          token: this.key.buyAsset.token,
          tokenId: this.key.buyAsset.tokenId.toString(),
          assetType: this.key.buyAsset.assetType,
        },
      },
      selling: this.selling.toString(),
      buying: this.buying.toString(),
      sellerFee: this.sellerFee.toString(),
    };
  }

  public prepareMessage(): Uint8Array {
    const order = this.toJson();

    const orderParam = ParamType.fromObject({
      name: "order",
      type: "tuple",
      components: OrderComponents,
    });

    return arrayify(keccak256(defaultAbiCoder.encode([orderParam], [order])));
  }

  public prepareBuyerFeeMessage(fee: BigNumberish): Uint8Array {
    const order = this.toJson();

    const orderParam = ParamType.fromObject({
      name: "order",
      type: "tuple",
      components: OrderComponents,
    });

    return arrayify(
      keccak256(defaultAbiCoder.encode([orderParam, "uint256"], [order, fee]))
    );
  }

  public async sign(signer: Signer): Promise<string> {
    const message = this.prepareMessage();

    const signature = await signer.signMessage(message);

    return signature;
  }

  public async signBuyerFee(
    signer: Signer,
    fee: BigNumberish
  ): Promise<string> {
    const message = this.prepareBuyerFeeMessage(fee);

    const signature = await signer.signMessage(message);

    return signature;
  }
}
