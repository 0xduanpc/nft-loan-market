// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TestERC721 is Initializable, Ownable, ERC721Enumerable {
    using SafeMath for uint256;

    //Executor
    mapping(address => bool) public executor;

    string private baseURI;

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {
        executor[msg.sender] = true;
    }

    function setExecutor(
        address _address,
        bool _type
    ) external onlyOwner returns (bool) {
        executor[_address] = _type;
        return true;
    }

    modifier onlyExecutor() {
        require(executor[msg.sender], "executor: caller is not the executor");
        _;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setBaseURI(string memory value) external {
        baseURI = value;
    }

    function mint(address to, uint256 tokenId) external onlyExecutor {
        super._mint(to, tokenId);
    }
}
