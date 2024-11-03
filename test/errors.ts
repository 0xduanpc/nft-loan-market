// Copyright 2021-2023 nft-market authors & contributors
// SPDX-License-Identifier: Apache-2.0

export class ContractError extends Error {
    public methodName: string;
  
    constructor(methodName: string, message: string) {
      super(message);
      this.methodName = methodName;
    }
  }
  
  export class OutOfGasError extends ContractError {
    constructor(methodName: string) {
      super(methodName, 'Unexpected issue with estimating the gas. Please try again.');
    }
  }
  
  export class CallError extends ContractError {
    public reason: string;
  
    constructor(methodName: string, message: string, reason: string) {
      super(methodName, message);
      this.reason = reason;
    }
  }
  
  export class RpcError extends Error {
    public code: number;
  
    constructor(code: number) {
      switch (code) {
        case -32700:
          super('Parse error: Invalid JSON');
  
          break;
        case -32600:
          super('Invalid request: JSON is not a valid request object');
  
          break;
        case -32601:
          super('Method not found: Method does not exist standard');
  
          break;
        case -32602:
          super('Invalid params: Invalid method parameters standard');
  
          break;
        case -32603:
          super('Internal error: Internal JSON-RPC error standard');
  
          break;
        case -32000:
          super('Invalid input: Missing or invalid parameters non-standard');
  
          break;
        case -32001:
          super('Resource not found: Requested resource not found non-standard');
  
          break;
        case -32002:
          super('Resource unavailable: Requested resource not available non-standard');
  
          break;
        case -32003:
          super('Transaction rejected: Transaction creation failed non-standard');
  
          break;
        case -32004:
          super('Method not supported: Method is not implemented non-standard');
  
          break;
        case -32005:
          super('Limit exceeded: Request exceeds defined limit non-standard');
  
          break;
        case -32006:
          super('JSON-RPC version not supported: Version of JSON-RPC protocol is not supported');
  
          break;
        case 4001:
          super('User rejected the request.');
  
          break;
        case 4100:
          super('Requested method and/or account has not been authorized by the user.');
  
          break;
        case 4200:
          super('Provider does not support the requested method.');
  
          break;
        case 4900:
          super('Provider is disconnected from all chains.');
  
          break;
        case 4901:
          super('Provider is not connected to the requested chain.');
  
          break;
        default:
          super(`Unknown error with code ${code}`);
          break;
      }
  
      this.code = code;
    }
  }
  