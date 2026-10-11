/**
 * YOUR AGENT'S TOOLS
 *
 * A tool is just a function the agent is allowed to call.
 * Gemini reads the `description` to decide WHEN to use it,
 * and `parameters` to know WHAT to pass in.
 */

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

// ─── MOCK SELLER LISTINGS (Week 1) ───
// Number of active resale listings each seller has for each event.
const SELLER_LISTINGS: Record<string, Record<string, number>> = {
  "SELL-001": { "Coldplay @Bangalore Oct 15": 6 },
  "SELL-002": { "Coldplay @Bangalore Oct 15": 2 },
  "SELL-003": { "Coldplay @Bangalore Oct 15": 4 },
};

const SCALPER_THRESHOLD = 4;

// ─── MOCK EVENT DATA (Week 1, placeholder values) ───
const EVENTS: Record<string, any> = {
  "Coldplay @Bangalore Oct 15": {
    event: "Coldplay @Bangalore Oct 15",
    date: "2026-10-15",
    venue: "[mock venue]",
    total_tickets: 1000,
    tickets_sold: 940,
  },
};

// Looks up one ticket. Used by verify_ticket and verify_tickets.
function checkTicket(ticket_id: string) {
  const ticket = TICKETS[ticket_id];
  if (!ticket) {
    return {
      valid: false,
      ticket_id,
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
}

export const tools: Tool[] = [
  // ─── 1. Wallet tool: read the agent's own wallet ───
  {
    name: "get_my_wallet",
    description: "Get the agent's own wallet address and its ETH balance on Base Sepolia (testnet).",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const { getWalletAddress, getWalletBalance } = await import("./wallet");
      return {
        address: getWalletAddress(),
        balance: await getWalletBalance(),
        network: "Base Sepolia (testnet)",
      };
    },
  },

  // ─── 2. Validus: verify if a ticket is real ───
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
    run: async ({ ticket_id }) => checkTicket(ticket_id),
  },

  // ─── 3. Validus: verify several tickets at once ───
  {
    name: "verify_tickets",
    description: "Verify several concert/event tickets at once. Use when the user gives more than one ticket ID, or asks to check a list of tickets. Returns a verdict for each ticket.",
    parameters: {
      type: "object",
      properties: {
        ticket_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of ticket IDs to verify, e.g., [\"TKT-001\", \"FAKE-666\"]. Maximum 10.",
        },
      },
      required: ["ticket_ids"],
    },
    run: async ({ ticket_ids }) => {
      const ids: string[] = (ticket_ids ?? []).slice(0, 10);
      const results = ids.map((id) => checkTicket(String(id)));
      return {
        count: results.length,
        valid_count: results.filter((r) => r.valid).length,
        results,
      };
    },
  },

  // ─── 4. Validus: check if a resale listing is overpriced ───
  {
    name: "check_resale_price",
    description: "Check whether a resale ticket listing is overpriced. The maximum allowed resale price is 1.5x the face value. Use when the user asks if a resale price is fair or allowed.",
    parameters: {
      type: "object",
      properties: {
        face_value: { type: "number", description: "Original ticket price in rupees, e.g. 5000" },
        listing_price: { type: "number", description: "Price the seller is asking, in rupees" },
      },
      required: ["face_value", "listing_price"],
    },
    run: async ({ face_value, listing_price }) => {
      const max_cap = face_value * 1.5;
      const allowed = listing_price <= max_cap;
      return {
        allowed,
        face_value,
        listing_price,
        max_allowed_price: max_cap,
        markup_multiple: Number((listing_price / face_value).toFixed(2)),
        message: allowed
          ? "Listing is within the 1.5x resale cap."
          : `BLOCKED: listing is over the 1.5x cap by ₹${listing_price - max_cap}.`,
      };
    },
  },

  // ─── 5. Validus: flag sellers with too many listings for one event (rule S1) ───
  {
    name: "flag_scalper",
    description: "Check whether a seller is a suspected scalper. A seller with 4 or more active resale listings for the same event is flagged. Use when the user asks if a seller is a scalper, or asks about a seller's listings.",
    parameters: {
      type: "object",
      properties: {
        seller_id: { type: "string", description: "The seller ID, e.g., SELL-001" },
        event: { type: "string", description: "The event name, e.g., Coldplay @Bangalore Oct 15" },
      },
      required: ["seller_id", "event"],
    },
    run: async ({ seller_id, event }) => {
      const seller = SELLER_LISTINGS[seller_id];
      if (!seller) {
        return {
          flagged: false,
          seller_id,
          status: "not_found",
          message: "Seller not found in system",
        };
      }
      const listings = seller[event] ?? 0;
      const flagged = listings >= SCALPER_THRESHOLD;
      return {
        flagged,
        seller_id,
        event,
        active_listings: listings,
        threshold: SCALPER_THRESHOLD,
        status: flagged ? "SCALPER_FLAGGED" : "OK",
        message: flagged
          ? `FLAGGED: ${listings} active listings for this event (limit is ${SCALPER_THRESHOLD}).`
          : `OK: ${listings} active listing(s) for this event, under the limit of ${SCALPER_THRESHOLD}.`,
      };
    },
  },

  // ─── 6. Validus: event details and remaining tickets ───
  {
    name: "get_event_info",
    description: "Get details for an event: name, date, venue, and how many tickets remain. Use when the user asks about an event, its date or venue, or how many tickets are left.",
    parameters: {
      type: "object",
      properties: {
        event: { type: "string", description: "The event name, e.g., Coldplay @Bangalore Oct 15" },
      },
      required: ["event"],
    },
    run: async ({ event }) => {
      const info = EVENTS[event];
      if (!info) {
        return { status: "not_found", message: "Event not found in system" };
      }
      return {
        status: "found",
        event: info.event,
        date: info.date,
        venue: info.venue,
        total_tickets: info.total_tickets,
        tickets_sold: info.tickets_sold,
        tickets_remaining: info.total_tickets - info.tickets_sold,
      };
    },
  },
];