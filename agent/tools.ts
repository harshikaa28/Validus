/**
 * YOUR AGENT'S TOOLS
 *
 * A tool is just a function the agent is allowed to call.
 * Gemini reads the `description` to decide WHEN to use it,
 * and `parameters` to know WHAT to pass in.
 *
 * Add your own tool: copy one of the objects below, change it,
 * and save. It shows up in the "Tools" list on the page.
 */
import { getWalletAddress, getWalletBalance, payAndFetch } from "./wallet";

export type Tool = {
  name: string;
  description: string;
  /** JSON Schema describing the inputs. */
  parameters: object;
  /** The code that runs when the agent calls this tool. */
  run: (args: any, ctx: { baseUrl: string }) => Promise<unknown>;
};

// ─── MOCK TICKET DATABASE (Week 1) ───
const TICKETS: Record<string, any> = {
  "TKT-001": {
    id: "TKT-001",
    owner: "Priya",
    event: "Coldplay @Bangalore Oct 15",
    purchased_date: "2026-10-06",
    price: 5000,
    status: "active",
    transferred: false,
  },
  "TKT-002": {
    id: "TKT-002",
    owner: "Raj",
    event: "Coldplay @Bangalore Oct 15",
    purchased_date: "2026-10-05",
    price: 5000,
    status: "active",
    transferred: false,
  },
  "FAKE-666": {
    id: "FAKE-666",
    owner: null,
    event: "Coldplay @Bangalore Oct 15",
    purchased_date: null,
    price: null,
    status: "invalid",
    transferred: null,
  },
};

export const tools: Tool[] = [
  // ─── 1. A paid API: the agent's wallet signs a payment to unlock it ───
  {
    name: "get_weather",
    description: "Get the current weather for a city. Costs 0.01 USDC, paid automatically from the agent's wallet.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Mumbai" },
      },
      required: ["city"],
    },
    run: async ({ city }, { baseUrl }) => {
      return payAndFetch(`${baseUrl}/api/weather?city=${encodeURIComponent(city)}`);
    },
  },

  // ─── 2. Wallet tool: read the agent's own wallet ───
  {
    name: "get_my_wallet",
    description: "Get the agent's own wallet address and its ETH balance on Base Sepolia (testnet).",
    parameters: { type: "object", properties: {} },
    run: async () => ({
      address: getWalletAddress(),
      balance: await getWalletBalance(),
      network: "Base Sepolia (testnet)",
    }),
  },

  // ─── 3. A plain tool: no wallet, no API. Try changing this one first! ───
  {
    name: "roll_dice",
    description: "Roll a dice with the given number of sides.",
    parameters: {
      type: "object",
      properties: {
        sides: { type: "number", description: "How many sides the dice has. Default 6." },
      },
    },
    run: async ({ sides = 6 }) => ({ rolled: Math.floor(Math.random() * sides) + 1, sides }),
  },

  // ─── 4. Validus: verify if a ticket is real ───
  {
    name: "verify_ticket",
    description: "Verify if a concert/event ticket is real or fake. Returns ticket details and authenticity status.",
    parameters: {
      type: "object",
      properties: {
        ticket_id: { type: "string", description: "The ticket ID to verify, e.g., TKT-001" },
      },
      required: ["ticket_id"],
    },
    run: async ({ ticket_id }) => {
      const ticket = TICKETS[ticket_id];
      if (!ticket) {
        return {
          valid: false,
          ticket_id: ticket_id,
          status: "not_found",
          message: "Ticket not found in system",
        };
      }
      return {
        valid: ticket.status === "active",
        ticket_id: ticket.id,
        owner: ticket.owner,
        event: ticket.event,
        purchased_date: ticket.purchased_date,
        price: ticket.price,
        transferred: ticket.transferred,
        status: ticket.status,
      };
    },
  },
];