# Validus AI Agent

> Smart ticket verification and anti-scalping engine — built for the Agentmaxxing Hackathon (Oct 2026)

Validus is an AI agent that protects fans from fake tickets and predatory scalpers. You chat with it in plain English, it calls the right tool, and it gives you a clear verdict: VALID ✅, FAKE ❌, ALLOWED ✅, or BLOCKED 🚫.

Built on the Agentmaxxing starter kit using Google Gemini and Next.js.

---

## What Validus Does

- **Verifies tickets** — checks if a ticket ID is real or fake against a registry
- **Bulk verification** — paste several ticket IDs and get a verdict for each
- **Resale price cap** — blocks listings that exceed 1.5x the face value
- **Scalper detection** — flags sellers with 4 or more active listings for the same event (Rule S1)
- **Event info** — returns event name, date, venue, and remaining tickets

---

## Week 1 (Current State)

This is the Week 1 submission for the Agentmaxxing Hackathon. The agent is fully working with all five tools above, but uses a **mock database** instead of real blockchain data. This was intentional: the goal for Week 1 was to ship a working AI agent with tool use, not to build full blockchain infrastructure.

**What is mock:**
- Ticket data (hardcoded in `agent/tools.ts`)
- Seller listings and event info

**What is real:**
- AI agent loop (Gemini + tool calling)
- All five tools with correct logic
- Agent wallet on Base Sepolia (testnet)
- Anti-scalping rules (1.5x cap, 4+ listings flag)

---

## Roadmap

| Week | Dates | Plan |
|------|-------|------|
| Week 1 | Oct 8–9 | ✅ Working AI agent with mock data, tool use, anti-scalping logic |
| Week 2 | Oct 12–16 | Replace mock data with real blockchain queries (Base Sepolia, thirdweb) |
| Week 3 | Oct 19–23 | NFT ticket minting, dynamic QR codes, wallet-based transfers |
| Week 4 | Oct 24–25 | Full demo, organiser dashboard, final polish |

---

## Try It

Once the app is running, test these prompts in the chat:

| Prompt | What happens |
|--------|-------------|
| `Is TKT-001 real?` | Agent verifies the ticket → VALID ✅ |
| `Is FAKE-666 real?` | Agent verifies the ticket → FAKE ❌ |
| `Check these tickets: TKT-001, TKT-002, FAKE-666` | Agent bulk verifies all three |
| `Is a resale ticket with face value 5000 and listing price 8000 allowed?` | Agent checks resale cap → BLOCKED 🚫 |
| `Is seller SELL-001 a scalper for Coldplay @Bangalore Oct 15?` | Agent flags the seller → FLAGGED |
| `How many tickets are left for Coldplay @Bangalore Oct 15?` | Agent returns event info |

---

## Setup

### Prerequisites
- Node.js 20 or newer (`node -v` to check)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Run locally

```bash
git clone https://github.com/harshikaa28/Validus.git
cd Validus
npm i
```

Add your Gemini API key to `.env`:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.8-flash
```

Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Create Wallet**, and start chatting.

---

## Project Structure

| Path | Description |
|------|-------------|
| `agent/tools.ts` | All five Validus tools — edit this to add or change tools |
| `agent/agent.ts` | Agent loop and system prompt |
| `agent/wallet.ts` | Wallet creation and payment signing |
| `app/page.tsx` | Frontend UI |
| `app/api/agent/route.ts` | Server endpoint that runs the agent |
| `.env` | Your API key and model config (never commit this) |
| `.agent-wallet.json` | Agent wallet (never commit this) |

---

## Tech Stack

- [Next.js](https://nextjs.org) — app and API routes
- [Google Gemini](https://aistudio.google.com) — AI agent with tool calling
- [viem](https://viem.sh) — wallet creation and Base Sepolia
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) — UI

---

## What I Learned (Week 1)

- How AI agents differ from chatbots: agents decide which tool to call based on the user's message
- How tool calling works: the agent loop sends tools to Gemini, Gemini picks one, the `run` function executes, and the result goes back to Gemini
- How to write tool descriptions that help the model pick the right one
- How a crypto wallet works at a basic level (key generation, Base Sepolia testnet)
- How to build a Next.js app with API routes from a starter template

---

## Security

- Never commit `.env` or `.agent-wallet.json` — both are in `.gitignore`
- This wallet is for testing only — never send real funds to it
- Seed phrases and private keys stay offline

---

## Built by

Harshika — B.Tech CS (AI), Year 3
Agentmaxxing Hackathon, October 2026
