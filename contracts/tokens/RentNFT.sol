// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract RentNFT is Initializable, Ownable, ERC721Enumerable {
    using SafeMath for uint256;

    //Executor
    mapping(address => bool) public executor;

    uint256 public tokenIdIndex;

    string private baseURI;

    struct NftInfo {
        address nft;
        uint nftId;
        uint startTime;
        uint endTime;
    }
    mapping(uint256 => NftInfo) internal _nftInfo;
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

    function _setNftInfo(
        uint256 i,
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) internal {
        _nftInfo[i] = NftInfo({
            nft: nft,
            nftId: nftId,
            startTime: startTime,
            endTime: endTime
        });
    }

    function mint(
        address to,
        address nft,
        uint nftId,
        uint startTime,
        uint endTime
    ) external onlyExecutor {
        _setNftInfo(tokenIdIndex, nft, nftId, startTime, endTime);
        super._mint(to, tokenIdIndex);
        tokenIdIndex = tokenIdIndex.add(1);
    }

    function nftInfo(uint256 _id) external view returns (NftInfo memory) {
        return _nftInfo[_id];
    }
}
