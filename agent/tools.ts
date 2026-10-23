import { ethers } from 'ethers';

// Smart Contract Details - NEW CONTRACT
const CONTRACT_ADDRESS = "0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8";
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "name", "type": "string" },
      { "internalType": "string", "name": "location", "type": "string" },
      { "internalType": "uint256", "name": "eventDate", "type": "uint256" },
      { "internalType": "uint256", "name": "ticketPrice", "type": "uint256" },
      { "internalType": "uint256", "name": "totalTickets", "type": "uint256" }
    ],
    "name": "createEvent",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "eventId", "type": "uint256" }],
    "name": "buyTicket",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "verifyTicket",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "eventId", "type": "uint256" }],
    "name": "getEventDetails",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "eventId", "type": "uint256" },
        { "internalType": "string", "name": "name", "type": "string" },
        { "internalType": "string", "name": "location", "type": "string" },
        { "internalType": "uint256", "name": "eventDate", "type": "uint256" },
        { "internalType": "address", "name": "organizer", "type": "address" },
        { "internalType": "uint256", "name": "ticketPrice", "type": "uint256" },
        { "internalType": "uint256", "name": "totalTickets", "type": "uint256" },
        { "internalType": "uint256", "name": "ticketsSold", "type": "uint256" },
        { "internalType": "bool", "name": "active", "type": "bool" }
      ], "internalType": "struct ValidusTicket.Event", "name": "", "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "getTicketDetails",
    "outputs": [{
      "components": [
        { "internalType": "uint256", "name": "ticketID", "type": "uint256" },
        { "internalType": "uint256", "name": "eventID", "type": "uint256" },
        { "internalType": "uint256", "name": "faceValue", "type": "uint256" },
        { "internalType": "bool", "name": "forSale", "type": "bool" },
        { "internalType": "uint256", "name": "resalePrice", "type": "uint256" },
        { "internalType": "bool", "name": "redeemed", "type": "bool" }
      ], "internalType": "struct ValidusTicket.Ticket", "name": "", "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "internalType": "uint256", "name": "price", "type": "uint256" }
    ],
    "name": "setResalePrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "redeemTicket",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Sepolia RPC
const PUBLIC_RPC = "https://sepolia-rpc.ethereum.org";

// Initialize contract
const provider = new ethers.JsonRpcProvider(PUBLIC_RPC);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

export const tools = [
  {
    name: "create_event",
    description: "Create a new event (organizer only)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Event name (e.g., 'Coldplay @ Bangalore')",
        },
        location: {
          type: "string",
          description: "Event location",
        },
        eventDate: {
          type: "number",
          description: "Event date as Unix timestamp",
        },
        ticketPrice: {
          type: "number",
          description: "Ticket price in wei",
        },
        totalTickets: {
          type: "number",
          description: "Total tickets available",
        },
      },
      required: ["name", "location", "eventDate", "ticketPrice", "totalTickets"],
    },
  },
  {
    name: "buy_ticket",
    description: "Buy a ticket for an event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "number",
          description: "Event ID to buy ticket for",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "verify_ticket",
    description: "Verify if a ticket is authentic",
    inputSchema: {
      type: "object",
      properties: {
        tokenId: {
          type: "number",
          description: "Ticket token ID",
        },
      },
      required: ["tokenId"],
    },
  },
  {
    name: "get_event_info",
    description: "Get details about an event",
    inputSchema: {
      type: "object",
      properties: {
        eventId: {
          type: "number",
          description: "Event ID",
        },
      },
      required: ["eventId"],
    },
  },
  {
    name: "check_resale_price",
    description: "Check if a resale price is within the 1.5x cap",
    inputSchema: {
      type: "object",
      properties: {
        tokenId: {
          type: "number",
          description: "Ticket token ID",
        },
        proposedPrice: {
          type: "number",
          description: "Proposed resale price in wei",
        },
      },
      required: ["tokenId", "proposedPrice"],
    },
  },
];

export async function processToolCall(toolName: string, toolInput: any) {
  if (toolName === "create_event") {
    return await createEvent(toolInput);
  } else if (toolName === "buy_ticket") {
    return await buyTicket(toolInput.eventId);
  } else if (toolName === "verify_ticket") {
    return await verifyTicket(toolInput.tokenId);
  } else if (toolName === "get_event_info") {
    return await getEventInfo(toolInput.eventId);
  } else if (toolName === "check_resale_price") {
    return await checkResalePrice(toolInput.tokenId, toolInput.proposedPrice);
  }
}

// ============ TOOL IMPLEMENTATIONS ============

async function createEvent(input: any) {
  return {
    verdict: "NOT IMPLEMENTED ❌",
    details: "Event creation requires UI form (organizer dashboard). Contract function exists but needs frontend integration.",
  };
}

async function buyTicket(eventId: number) {
  try {
    const eventDetails = await contract.getEventDetails(eventId);

    if (!eventDetails.active) {
      return {
        verdict: "NOT AVAILABLE ❌",
        details: "Event is not active",
      };
    }

    return {
      verdict: "READY TO BUY ✅",
      details: {
        eventName: eventDetails.name,
        location: eventDetails.location,
        ticketPrice: ethers.formatEther(eventDetails.ticketPrice) + " ETH",
        ticketsRemaining: Number(eventDetails.totalTickets) - Number(eventDetails.ticketsSold),
      },
    };
  } catch (error) {
    return {
      verdict: "NOT FOUND ❓",
      details: `Could not fetch event: ${error}`,
    };
  }
}

async function verifyTicket(tokenId: number) {
  try {
    const isValid = await contract.verifyTicket(tokenId);

    if (!isValid) {
      return {
        verdict: "FAKE ❌",
        details: `Ticket ${tokenId} does not exist on-chain.`,
      };
    }

    const details = await contract.getTicketDetails(tokenId);

    return {
      verdict: "VALID ✅",
      details: {
        ticketID: details.ticketID.toString(),
        eventID: details.eventID.toString(),
        faceValue: ethers.formatEther(details.faceValue) + " ETH",
        redeemed: details.redeemed,
        forSale: details.forSale,
      },
    };
  } catch (error) {
    return {
      verdict: "NOT FOUND ❓",
      details: `Could not verify ticket: ${error}`,
    };
  }
}

async function getEventInfo(eventId: number) {
  try {
    const event = await contract.getEventDetails(eventId);

    return {
      verdict: "FOUND ✅",
      details: {
        name: event.name,
        location: event.location,
        organizer: event.organizer,
        ticketPrice: ethers.formatEther(event.ticketPrice) + " ETH",
        ticketsSold: Number(event.ticketsSold),
        totalTickets: Number(event.totalTickets),
        remaining: Number(event.totalTickets) - Number(event.ticketsSold),
        active: event.active,
      },
    };
  } catch (error) {
    return {
      verdict: "NOT FOUND ❓",
      details: `Event not found: ${error}`,
    };
  }
}

async function checkResalePrice(tokenId: number, proposedPrice: number) {
  try {
    const details = await contract.getTicketDetails(tokenId);
    const faceValue = Number(details.faceValue);
    const maxAllowed = (faceValue * 150) / 100;

    if (proposedPrice > maxAllowed) {
      return {
        verdict: "BLOCKED 🚫",
        details: `Price ${proposedPrice} wei exceeds 1.5x cap of ${maxAllowed} wei. Scalper detected!`,
      };
    }

    return {
      verdict: "ALLOWED ✅",
      details: `Price is within 1.5x cap. Fair resale.`,
    };
  } catch (error) {
    return {
      verdict: "NOT FOUND ❓",
      details: `Could not check price: ${error}`,
    };
  }
}