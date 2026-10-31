// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ValidusTicket
 * @dev ERC-721 ticketing contract for the Validus NFT Ticketing Platform.
 */
contract ValidusTicket is ERC721, Ownable, ReentrancyGuard {

    // =========================================================================
    // Structs & Constants
    // =========================================================================

    struct TicketMetadata {
        string ticketID;
        string eventID;
        string seatNumber;
        uint256 faceValue;
        address payable organizer;
        bool isForSale;
        uint256 resalePrice;
        bool isValid;
        bool isRedeemed;
    }

    /// @notice On-chain representation of a ticketed event.
    struct Event {
        uint256 eventId;
        string name;
        string location;
        uint256 eventDate;
        address organizer;
        uint256 ticketPrice;
        uint256 totalTickets;
        uint256 ticketsSold;
        bool active;
    }

    /// @notice Flat struct returned by getTicketDetails().
    struct TicketDetails {
        string ticketID;
        string eventID;
        string seatNumber;
        uint256 faceValue;
        address currentOwner;
        address organizer;
        bool isForSale;
        uint256 resalePrice;
        bool isValid;
        bool isRedeemed;
    }

    uint256 public constant ROYALTY_PERCENT = 5;
    uint256 public constant RESALE_CAP_PERCENT = 150;
    uint256 public constant PERCENT_DENOMINATOR = 100;

    uint256 private _nextTokenId = 1;
    uint256 private _nextEventId = 1;

    // =========================================================================
    // State Storage
    // =========================================================================

    mapping(uint256 => TicketMetadata) private _tickets;
    mapping(uint256 => Event) private _events;
    mapping(string => address payable) public eventOrganizers;
    mapping(uint256 => bool) public eventExists;

    // =========================================================================
    // Events
    // =========================================================================

    event EventCreated(
        uint256 indexed eventId,
        string name,
        string location,
        uint256 eventDate,
        address indexed organizer,
        uint256 ticketPrice,
        uint256 totalTickets
    );

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
    error EventDoesNotExist(uint256 eventId);
    error EventNotActive(uint256 eventId);
    error EventSoldOut(uint256 eventId);

    // =========================================================================
    // Constructor
    // =========================================================================

    constructor(address initialOwner)
        ERC721("ValidusTicket", "VLDUS")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert ZeroAddressNotAllowed();
    }

    // =========================================================================
    // Events (organizer-facing)
    // =========================================================================

    /**
     * @notice Creates a new event on-chain. Owner only.
     */
    function createEvent(
        string memory name,
        string memory location,
        uint256 eventDate,
        uint256 ticketPrice,
        uint256 totalTickets
    ) external onlyOwner returns (uint256) {
        uint256 eventId = _nextEventId++;
        eventExists[eventId] = true;

        _events[eventId] = Event({
            eventId: eventId,
            name: name,
            location: location,
            eventDate: eventDate,
            organizer: msg.sender,
            ticketPrice: ticketPrice,
            totalTickets: totalTickets,
            ticketsSold: 0,
            active: true
        });

        emit EventCreated(eventId, name, location, eventDate, msg.sender, ticketPrice, totalTickets);

        return eventId;
    }

    /**
     * @notice Returns the total number of events created so far.
     */
    function totalEvents() external view returns (uint256) {
        return _nextEventId - 1;
    }

    /**
     * @notice Returns the on-chain details of an event.
     */
    function getEventDetails(uint256 eventId) external view returns (Event memory) {
        require(eventExists[eventId], "ValidusTicket: event does not exist");
        return _events[eventId];
    }

    /**
     * @notice Buys a primary ticket for an event at its face value.
     * @dev msg.value must equal the event's ticketPrice exactly. Payment goes to
     *      the event organizer and a new ticket is minted to the buyer.
     * @param eventId Event ID returned by createEvent().
     * @param ticketID Ticket reference label (e.g., "TKT-001").
     * @param eventTag Event label stored on the ticket (e.g., "Coldplay-BLR-2026").
     * @param seatNumber Seat or zone label (e.g., "GA-FLOOR").
     * @return tokenID Newly minted token ID.
     */
    function buyPrimaryTicket(
        uint256 eventId,
        string memory ticketID,
        string memory eventTag,
        string memory seatNumber
    ) external payable nonReentrant returns (uint256) {
        if (!eventExists[eventId]) revert EventDoesNotExist(eventId);

        Event storage e = _events[eventId];
        if (!e.active) revert EventNotActive(eventId);
        if (e.ticketsSold >= e.totalTickets) revert EventSoldOut(eventId);
        if (msg.value != e.ticketPrice) revert InsufficientPayment(msg.value, e.ticketPrice);

        // Update state before any external call
        e.ticketsSold += 1;

        uint256 tokenID = _nextTokenId++;
        _storeTicket(tokenID, ticketID, eventTag, seatNumber, e.ticketPrice, payable(e.organizer));
        _safeMint(msg.sender, tokenID);

        (bool sent, ) = payable(e.organizer).call{value: msg.value}("");
        if (!sent) revert PaymentFailed();

        emit TicketMinted(tokenID, msg.sender, ticketID, eventTag, seatNumber, e.ticketPrice, e.organizer);
        return tokenID;
    }

    /**
     * @notice Sets the dedicated organizer address for a specific event. Owner only.
     */
    function setEventOrganizer(string calldata eventID, address payable organizer) external onlyOwner {
        if (organizer == address(0)) revert ZeroAddressNotAllowed();
        eventOrganizers[eventID] = organizer;
        emit EventOrganizerSet(eventID, organizer);
    }

    // =========================================================================
    // Tickets
    // =========================================================================

    /**
     * @notice Mints a ticket to an address with metadata. Owner only.
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

        address payable organizer = eventOrganizers[eventID];
        if (organizer == address(0)) {
            organizer = payable(owner());
        }

        _storeTicket(tokenID, ticketID, eventID, seatNumber, faceValue, organizer);
        _safeMint(to, tokenID);

        // Best-effort: if eventID is a numeric on-chain event ID, count the sale
        {
            bool parsed = true;
            uint256 evId = 0;
            bytes memory idBytes = bytes(eventID);
            for (uint256 i = 0; i < idBytes.length; i++) {
                uint8 c = uint8(idBytes[i]);
                if (c < 48 || c > 57) { parsed = false; break; }
                evId = evId * 10 + (c - 48);
            }
            if (parsed && evId > 0 && eventExists[evId]) {
                _events[evId].ticketsSold += 1;
            }
        }

        emit TicketMinted(tokenID, to, ticketID, eventID, seatNumber, faceValue, organizer);

        return tokenID;
    }

    /**
     * @notice Sets the resale price for a ticket. Enforces the 1.5x cap. Price 0 delists.
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

        uint256 maxPriceCap = (ticket.faceValue * RESALE_CAP_PERCENT) / PERCENT_DENOMINATOR;
        if (price > maxPriceCap) {
            revert PriceExceedsCap(price, maxPriceCap);
        }

        ticket.isForSale = true;
        ticket.resalePrice = price;

        emit TicketResaleListed(tokenID, msg.sender, price, maxPriceCap);
    }

    /**
     * @notice Buys a ticket listed on the secondary market.
     * @dev Pays 5% royalty to the organizer, 95% to the seller, refunds excess, transfers the NFT.
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

        uint256 maxPriceCap = (ticket.faceValue * RESALE_CAP_PERCENT) / PERCENT_DENOMINATOR;
        if (price > maxPriceCap) {
            revert PriceExceedsCap(price, maxPriceCap);
        }

        uint256 royalty = (price * ROYALTY_PERCENT) / PERCENT_DENOMINATOR;
        uint256 sellerProceeds = price - royalty;

        address payable organizer = ticket.organizer;
        if (organizer == address(0)) {
            organizer = payable(owner());
        }

        ticket.isForSale = false;
        ticket.resalePrice = 0;

        (bool royaltySuccess, ) = organizer.call{value: royalty}("");
        if (!royaltySuccess) revert PaymentFailed();

        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert PaymentFailed();

        uint256 excessPayment = msg.value - price;
        if (excessPayment > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excessPayment}("");
            if (!refundSuccess) revert PaymentFailed();
        }

        _safeTransfer(seller, msg.sender, tokenID);

        emit TicketSold(tokenID, seller, msg.sender, price, royalty, organizer);
    }

    /**
     * @notice Verifies a ticket's authenticity and current status.
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
     * @notice Returns descriptive metadata of a ticket.
     */
    function getTicketInfo(uint256 tokenID)
        external
        view
        returns (
            string memory ticketID,
            string memory eventID,
            string memory seatNumber,
            uint256 faceValue,
            address currentOwner
        )
    {
        _requireTicketExists(tokenID);

        TicketMetadata storage t = _tickets[tokenID];
        return (t.ticketID, t.eventID, t.seatNumber, t.faceValue, ownerOf(tokenID));
    }

    /**
     * @notice Returns market and validity status of a ticket.
     */
    function getTicketStatus(uint256 tokenID)
        external
        view
        returns (
            address organizer,
            bool isForSale,
            uint256 resalePrice,
            bool isValid,
            bool isRedeemed
        )
    {
        _requireTicketExists(tokenID);

        TicketMetadata storage t = _tickets[tokenID];
        return (t.organizer, t.isForSale, t.resalePrice, t.isValid, t.isRedeemed);
    }

    /**
     * @notice Returns combined ticket metadata and market status in one call.
     */
    function getTicketDetails(uint256 tokenID)
        external
        view
        returns (TicketDetails memory details)
    {
        _requireTicketExists(tokenID);

        TicketMetadata storage t = _tickets[tokenID];
        details.ticketID     = t.ticketID;
        details.eventID      = t.eventID;
        details.seatNumber   = t.seatNumber;
        details.faceValue    = t.faceValue;
        details.currentOwner = ownerOf(tokenID);
        details.organizer    = t.organizer;
        details.isForSale    = t.isForSale;
        details.resalePrice  = t.resalePrice;
        details.isValid      = t.isValid;
        details.isRedeemed   = t.isRedeemed;
    }

    /**
     * @notice Redeems a ticket at venue entry.
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
    // Internal
    // =========================================================================

    function _storeTicket(
        uint256 tokenID,
        string memory ticketID,
        string memory eventID,
        string memory seatNumber,
        uint256 faceValue,
        address payable organizer
    ) internal {
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
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0) && auth != address(0)) {
            if (auth != from) {
                revert OnlyTicketOwnerCanTransfer();
            }
        }

        if (from != address(0) && to != address(0)) {
            _tickets[tokenId].isForSale = false;
            _tickets[tokenId].resalePrice = 0;
        }

        return super._update(to, tokenId, auth);
    }

    function _requireTicketExists(uint256 tokenID) internal view {
        if (_ownerOf(tokenID) == address(0)) {
            revert TicketDoesNotExist(tokenID);
        }
    }
}