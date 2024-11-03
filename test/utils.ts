// Copyright 2021-2023 nft-market authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { CallOverrides } from '@ethersproject/contracts';
import type { TransactionResponse } from '@ethersproject/providers';

import { getAddress, isAddress } from '@ethersproject/address';
import { BigNumber } from '@ethersproject/bignumber';
import { AddressZero } from '@ethersproject/constants';
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider, JsonRpcSigner } from '@ethersproject/providers';

import { CallError, OutOfGasError, RpcError } from './errors';

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function shortenHash(hash?: string | null, chars = 8): string {
  if (!hash) {
    return '';
  }

  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

export function shortenAddress(address?: string | null, chars = 4): string {
  if (!address) {
    return '';
  }

  const parsed = getAddress(address);

  return `${parsed.slice(0, chars + 2)}...${parsed.slice(-chars)}`;
}

// account is not optional
export function getSigner(library: JsonRpcProvider, account?: string | null): JsonRpcSigner {
  return library.getSigner(account || undefined).connectUnchecked();
}

// account is optional
export function getProviderOrSigner(
  library: JsonRpcProvider,
  account?: string | null
): JsonRpcProvider | JsonRpcSigner {
  return account ? getSigner(library, account) : library;
}

// account is optional
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getContract(
  address: string,
  ABI: any,
  library: JsonRpcProvider,
  account?: string | null
): Contract {
  if (!isAddress(address) || address === AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`);
  }

  return new Contract(address, ABI, getProviderOrSigner(library, account));
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export async function getGasEstimate(
  contract: Contract,
  methodName: string,
  args?: any[],
  overrides?: CallOverrides
): Promise<BigNumber | OutOfGasError | CallError> {
  const gasEstimate = await contract.estimateGas[methodName](...(args ?? []), { ...overrides })
    .then((gasEstimate) => {
      return gasEstimate;
    })
    .catch((gasError) => {
      console.debug('Gas estimate failed, trying eth_call to extract error');

      return contract.callStatic[methodName](...(args ?? []), { ...overrides })
        .then((result) => {
          console.debug('Unexpected successful call after failed estimate gas', gasError, result);

          return new OutOfGasError(methodName);
        })
        .catch((error: any) => {
          console.debug('Call threw error', error);

          return new CallError(
            methodName,
            'Call threw error',
            error?.error?.data?.message || 'Unknown error'
          );
        });
    });

  return gasEstimate;
}

export async function callMethod<T>(
  contract: Contract,
  methodName: string,
  args?: any[],
  overrides?: CallOverrides
): Promise<T> {
  const gasEstimate = await getGasEstimate(contract, methodName, args, overrides);

  if (gasEstimate instanceof Error) {
    throw gasEstimate;
  }

  return contract[methodName](...(args ?? []), {
    ...overrides,
    gasLimit: gasEstimate.mul(12).div(10)
  })
    .then((response: TransactionResponse) => {
      return response;
    })
    .catch((error: any) => {
      // if the user rejected the tx, pass this along
      if (
        [
          -32700, -32600, -32601, -32602, -32603, -32000, -32001, -32002, -32003, -32004, -32005,
          -32006, 4001, 4100, 4200, 4900, 4901
        ].includes(error?.code)
      ) {
        throw new RpcError(error.code);
      } else {
        // otherwise, the error was unexpected and we need to convey that
        console.debug(`${methodName} failed: ${error.message}`, error, methodName, args);
        throw new Error(`${methodName} failed: ${error.message}`);
      }
    });
}

export function randomHex(length: number): string {
  const result: string[] = [];
  const characters = 'ABCDEFabcdef0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
  }

  return '0x' + result.join('');
}
