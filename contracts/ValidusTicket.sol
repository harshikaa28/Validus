// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ValidusTicket
 * @dev Production-ready ERC-721 smart contract for the Validus NFT Ticketing Platform.
 *
 * Core Features:
 *  - Enforces ERC-721 standard with enumeration support (ERC721Enumerable).
 *  - Anti-scalping resale price cap: Resale price cannot exceed 1.5x (150%) of face value.
 *  - Organizer royalty: 5% of secondary sales automatically forwarded to event organizer.
 *  - Transfer restriction: Direct transfers can only be executed by the verified ticket owner.
 *  - On-chain authenticity and metadata verification.
 *  - Safe testnet/mainnet compatibility (Sepolia, Base Sepolia, Polygon/Amoy, etc.).
 */
contract ValidusTicket is ERC721Enumerable, Ownable, ReentrancyGuard {

    // =========================================================================
    // Structs & Constants
    // =========================================================================

    struct TicketMetadata {
        string ticketID;         // Off-chain/catalog ticket identifier (e.g., "TKT-001")
        string eventID;          // Identifier of the event (e.g., "Coldplay-BLR-2026")
        string seatNumber;       // Assigned seat/tier (e.g., "VIP-A12", "GA-FLOOR")
        uint256 faceValue;       // Original primary sale price in wei
        address payable organizer; // Event organizer wallet receiving secondary royalties
        bool isForSale;          // True if listed on secondary resale marketplace
        uint256 resalePrice;     // Asking price in wei (capped at 1.5x faceValue)
        bool isValid;            // Ticket validity status (false if invalidated/revoked)
        bool isRedeemed;         // True once ticket is scanned/used at the event venue
    }

    /// @notice Royalty percentage paid to the event organizer on secondary sales (5%)
    uint256 public constant ROYALTY_PERCENT = 5;

    /// @notice Resale price multiplier in basis points (150 = 1.5x or 150%)
    uint256 public constant RESALE_CAP_PERCENT = 150;

    /// @notice Denominator for percentage calculations (100%)
    uint256 public constant PERCENT_DENOMINATOR = 100;

    /// @notice Auto-incrementing counter for unique token IDs
    uint256 private _nextTokenId = 1;

    // =========================================================================
    // State Storage
    // =========================================================================

    /// @dev Mapping from on-chain token ID => TicketMetadata
    mapping(uint256 => TicketMetadata) private _tickets;

    /// @dev Mapping from event ID => custom organizer address
    mapping(string => address payable) public eventOrganizers;

    // =========================================================================
    // Events
    // =========================================================================

    event TicketMinted(
        uint256 indexed tokenId,
        address indexed to,
        string ticketID,
        string eventID,
        string seatNumber,
        uint256 faceValue,
        address organizer
    );

    event TicketResaleListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 maxPriceCap
    );

    event TicketResaleCancelled(
        uint256 indexed tokenId,
        address indexed seller
    );

    event TicketSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 royaltyPaid,
        address organizer
    );

    event TicketRedeemed(
        uint256 indexed tokenId,
        address indexed redeemer,
        string eventID,
        string seatNumber
    );

    event EventOrganizerSet(
        string indexed eventID,
        address indexed organizer
    );

    // =========================================================================
    // Custom Errors
    // =========================================================================

    error TicketDoesNotExist(uint256 tokenId);
    error UnauthorizedSeller(address caller, address actualOwner);
    error OnlyTicketOwnerCanTransfer();
    error PriceExceedsCap(uint256 proposedPrice, uint256 maxAllowedPrice);
    error InvalidPrice();
    error TicketNotForSale(uint256 tokenId);
    error TicketAlreadyRedeemed(uint256 tokenId);
    error TicketNotValid(uint256 tokenId);
    error BuyerCannotBeSeller();
    error InsufficientPayment(uint256 sent, uint256 required);
    error PaymentFailed();
    error ZeroAddressNotAllowed();

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @notice Initializes the Validus NFT Ticketing contract.
     * @param initialOwner Address of the platform administrator and initial contract owner.
     */
    constructor(address initialOwner)
        ERC721("ValidusTicket", "VLDUS")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert ZeroAddressNotAllowed();
    }

    // =========================================================================
    // External & Public Functions
    // =========================================================================

    /**
     * @notice Sets the dedicated organizer address for a specific event.
     * @dev Only the contract owner can assign organizer addresses.
     * @param eventID Identifier of the event.
     * @param organizer Address to receive the 5% royalties for that event.
     */
    function setEventOrganizer(string calldata eventID, address payable organizer) external onlyOwner {
        if (organizer == address(0)) revert ZeroAddressNotAllowed();
        eventOrganizers[eventID] = organizer;
        emit EventOrganizerSet(eventID, organizer);
    }

    /**
     * @notice Mints a new NFT ticket with associated metadata.
     * @dev Restricted to contract owner (platform/issuer).
     * @param to Recipient address who will own the minted ticket.
     * @param ticketID Alphanumeric ticket reference ID (e.g., "TKT-001").
     * @param eventID Event identifier (e.g., "Coldplay-BLR-2026").
     * @param seatNumber Assigned seat or seating zone (e.g., "VIP-A1").
     * @param faceValue Primary ticket price in wei (used to calculate resale cap).
     * @return tokenID Newly generated on-chain token identifier.
     */
    function mintTicket(
        address to,
        string memory ticketID,
        string memory eventID,
        string memory seatNumber,
        uint256 faceValue
    ) external onlyOwner returns (uint256) {
        if (to == address(0)) revert ZeroAddressNotAllowed();
        if (faceValue == 0) revert InvalidPrice();

        uint256 tokenID = _nextTokenId++;

        // Determine organizer: if set for eventID use it, otherwise fallback to contract owner
        address payable organizer = eventOrganizers[eventID];
        if (organizer == address(0)) {
            organizer = payable(owner());
        }

        _tickets[tokenID] = TicketMetadata({
            ticketID: ticketID,
            eventID: eventID,
            seatNumber: seatNumber,
            faceValue: faceValue,
            organizer: organizer,
            isForSale: false,
            resalePrice: 0,
            isValid: true,
            isRedeemed: false
        });

        _safeMint(to, tokenID);

        emit TicketMinted(
            tokenID,
            to,
            ticketID,
            eventID,
            seatNumber,
            faceValue,
            organizer
        );

        return tokenID;
    }

    /**
     * @notice Sets the resale price for a ticket on the secondary market.
     * @dev Enforces the anti-scalping 1.5x price cap. If price is 0, the ticket is delisted.
     * @param tokenID On-chain ID of the ticket.
     * @param price Listing price in wei (must be <= 1.5x face value). Set to 0 to cancel listing.
     */
    function setResalePrice(uint256 tokenID, uint256 price) external {
        _requireTicketExists(tokenID);

        address currentOwner = ownerOf(tokenID);
        if (msg.sender != currentOwner) {
            revert UnauthorizedSeller(msg.sender, currentOwner);
        }

        TicketMetadata storage ticket = _tickets[tokenID];

        if (!ticket.isValid) revert TicketNotValid(tokenID);
        if (ticket.isRedeemed) revert TicketAlreadyRedeemed(tokenID);

        if (price == 0) {
            ticket.isForSale = false;
            ticket.resalePrice = 0;
            emit TicketResaleCancelled(tokenID, msg.sender);
            return;
        }

        // Anti-scalping logic: Price cannot exceed 1.5x face value (faceValue * 150 / 100)
        uint256 maxPriceCap = (ticket.faceValue * RESALE_CAP_PERCENT) / PERCENT_DENOMINATOR;
        if (price > maxPriceCap) {
            revert PriceExceedsCap(price, maxPriceCap);
        }

        ticket.isForSale = true;
        ticket.resalePrice = price;

        emit TicketResaleListed(tokenID, msg.sender, price, maxPriceCap);
    }

    /**
     * @notice Purchases a ticket listed on the secondary market.
     * @dev Enforces the 1.5x price cap, transfers 5% royalty to event organizer,
     *      transfers remaining 95% to the seller, refunds excess payment, and transfers NFT.
     * @param tokenID On-chain ID of the ticket to buy.
     */
    function buyTicket(uint256 tokenID) external payable nonReentrant {
        _requireTicketExists(tokenID);

        TicketMetadata storage ticket = _tickets[tokenID];

        if (!ticket.isForSale) revert TicketNotForSale(tokenID);
        if (!ticket.isValid) revert TicketNotValid(tokenID);
        if (ticket.isRedeemed) revert TicketAlreadyRedeemed(tokenID);

        address seller = ownerOf(tokenID);
        if (msg.sender == seller) revert BuyerCannotBeSeller();

        uint256 price = ticket.resalePrice;
        if (msg.value < price) {
            revert InsufficientPayment(msg.value, price);
        }

        // Re-verify that price complies with 1.5x cap
        uint256 maxPriceCap = (ticket.faceValue * RESALE_CAP_PERCENT) / PERCENT_DENOMINATOR;
        if (price > maxPriceCap) {
            revert PriceExceedsCap(price, maxPriceCap);
        }

        // Calculate 5% royalty for event organizer and 95% proceeds for seller
        uint256 royalty = (price * ROYALTY_PERCENT) / PERCENT_DENOMINATOR;
        uint256 sellerProceeds = price - royalty;

        address payable organizer = ticket.organizer;
        if (organizer == address(0)) {
            organizer = payable(owner());
        }

        // Reset ticket listing state before transfers to guard against state corruption
        ticket.isForSale = false;
        ticket.resalePrice = 0;

        // Transfer 5% royalty to event organizer
        (bool royaltySuccess, ) = organizer.call{value: royalty}("");
        if (!royaltySuccess) revert PaymentFailed();

        // Transfer 95% proceeds to seller
        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert PaymentFailed();

        // Refund any excess payment sent by the buyer
        uint256 excessPayment = msg.value - price;
        if (excessPayment > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excessPayment}("");
            if (!refundSuccess) revert PaymentFailed();
        }

        // Transfer the NFT ticket to the buyer
        _safeTransfer(seller, msg.sender, tokenID);

        emit TicketSold(tokenID, seller, msg.sender, price, royalty, organizer);
    }

    /**
     * @notice Verifies the authenticity and current status of a ticket.
     * @param tokenID On-chain ID of the ticket.
     * @return isValid True if ticket exists and is active/authentic.
     * @return currentOwner Address currently holding the ticket.
     * @return ticketID Alphanumeric ticket identifier.
     * @return eventID Event identifier.
     * @return seatNumber Assigned seat location.
     * @return faceValue Original issue face value in wei.
     * @return isRedeemed True if ticket has already been used at venue entry.
     */
    function verifyTicket(uint256 tokenID)
        external
        view
        returns (
            bool isValid,
            address currentOwner,
            string memory ticketID,
            string memory eventID,
            string memory seatNumber,
            uint256 faceValue,
            bool isRedeemed
        )
    {
        _requireTicketExists(tokenID);

        TicketMetadata memory ticket = _tickets[tokenID];
        return (
            ticket.isValid,
            ownerOf(tokenID),
            ticket.ticketID,
            ticket.eventID,
            ticket.seatNumber,
            ticket.faceValue,
            ticket.isRedeemed
        );
    }

    /**
     * @notice Returns complete metadata and state of a ticket.
     * @param tokenID On-chain ID of the ticket.
     * @return ticketID Alphanumeric ticket catalog reference.
     * @return eventID Event identification code.
     * @return seatNumber Assigned seat number.
     * @return faceValue Primary price in wei.
     * @return currentOwner Address of the token owner.
     * @return organizer Address receiving event royalties.
     * @return isForSale Whether ticket is currently available on secondary market.
     * @return resalePrice Resale asking price in wei.
     * @return isValid Authenticity/validity status.
     * @return isRedeemed Whether ticket has been scanned/redeemed.
     */
    function getTicketDetails(uint256 tokenID)
        external
        view
        returns (
            string memory ticketID,
            string memory eventID,
            string memory seatNumber,
            uint256 faceValue,
            address currentOwner,
            address organizer,
            bool isForSale,
            uint256 resalePrice,
            bool isValid,
            bool isRedeemed
        )
    {
        _requireTicketExists(tokenID);

        TicketMetadata memory ticket = _tickets[tokenID];
        return (
            ticket.ticketID,
            ticket.eventID,
            ticket.seatNumber,
            ticket.faceValue,
            ownerOf(tokenID),
            ticket.organizer,
            ticket.isForSale,
            ticket.resalePrice,
            ticket.isValid,
            ticket.isRedeemed
        );
    }

    /**
     * @notice Scans and redeems a ticket at event entrance.
     * @dev Can be called by ticket owner or the contract owner/event organizer.
     * @param tokenID On-chain ID of the ticket being redeemed.
     */
    function redeemTicket(uint256 tokenID) external {
        _requireTicketExists(tokenID);

        address currentOwner = ownerOf(tokenID);
        TicketMetadata storage ticket = _tickets[tokenID];

        if (msg.sender != currentOwner && msg.sender != owner() && msg.sender != ticket.organizer) {
            revert UnauthorizedSeller(msg.sender, currentOwner);
        }

        if (!ticket.isValid) revert TicketNotValid(tokenID);
        if (ticket.isRedeemed) revert TicketAlreadyRedeemed(tokenID);

        ticket.isRedeemed = true;
        ticket.isForSale = false;
        ticket.resalePrice = 0;

        emit TicketRedeemed(tokenID, msg.sender, ticket.eventID, ticket.seatNumber);
    }

    // =========================================================================
    // Internal Overrides
    // =========================================================================

    /**
     * @dev Overrides ERC721 and ERC721Enumerable update hook.
     *      Enforces requirement: "Only owner can transfer their ticket"
     *      When an external caller invokes transferFrom/safeTransferFrom, `auth` represents
     *      the caller. We ensure `auth == from` so only the ticket owner can initiate transfers.
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // For regular user-to-user transfers (not minting or burning)
        if (from != address(0) && to != address(0) && auth != address(0)) {
            // Direct transfer must be initiated by the owner themselves
            if (auth != from) {
                revert OnlyTicketOwnerCanTransfer();
            }
        }

        // On any transfer, automatically reset active secondary market listing
        if (from != address(0) && to != address(0)) {
            _tickets[tokenId].isForSale = false;
            _tickets[tokenId].resalePrice = 0;
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Required override for balance tracking in ERC721Enumerable.
     */
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    /**
     * @dev Required override for ERC-165 interface detection.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Helper to verify token existence in OpenZeppelin v5.
     */
    function _requireTicketExists(uint256 tokenID) internal view {
        if (_ownerOf(tokenID) == address(0)) {
            revert TicketDoesNotExist(tokenID);
        }
    }
}
