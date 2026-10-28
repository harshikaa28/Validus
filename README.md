# Validus

Validus is a Web3 ticketing platform designed to stop fake tickets, reduce scalping, and give buyers and organizers more trust in live events. It combines an AI-powered verification assistant with on-chain ticketing logic to help users validate ticket authenticity, enforce resale caps, and manage ticket inventory securely.

Built with Next.js, Google Gemini, and Solidity, Validus brings together conversational AI and blockchain-based ticket trust for a modern event experience.

## Why Validus

Ticket fraud and resale abuse are common in the live events market. Buyers often struggle to tell whether a ticket is real, and organizers lose control when tickets are resold at inflated prices. Validus solves this by:

- Verifying ticket authenticity in natural language
- Detecting suspicious resale behavior and anti-scalping violations
- Enforcing resale price limits to reduce exploitation
- Giving organizers a cleaner way to manage event listings and sales
- Supporting wallet-connected ticket purchasing through a blockchain-ready flow

## Key Features

- AI ticket verification assistant for buyer queries
- Ticket authenticity checks against known valid IDs
- Secondary market price-cap enforcement
- Anti-scalping detection logic for repeat listings
- Buyer dashboard to inspect event and ticket data
- Organizer dashboard for creating and tracking events
- Sepolia-based smart contract integration for on-chain ticketing
- MetaMask wallet connectivity for Web3 interactions

## How It Works

Validus combines three layers:

1. Frontend experience in Next.js
   - Buyer UI
   - Organizer UI
   - Wallet-driven actions

2. AI agent layer with Gemini
   - Parses customer prompts in plain English
   - Calls the right verification tool
   - Returns a clear verdict and actionable recommendation

3. Contract layer on Ethereum-compatible networks
   - Event creation
   - Ticket minting and ownership tracking
   - Secondary sale controls
   - Royalty and resale guardrails

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Google GenAI / Gemini
- Hardhat
- Solidity 0.8.x
- OpenZeppelin ERC-721 contracts
- Ethers.js + viem
- MetaMask / Sepolia wallet support

## Repository Structure

```text
validus-week1/
├── agent/
│   ├── agent.ts
│   ├── tools.ts
│   └── wallet.ts
├── app/
│   ├── api/
│   ├── buyer/
│   ├── organizer/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── BuyerDashboard.tsx
│   ├── EventOrganizerDashboard.tsx
│   └── ui/
├── contracts/
│   └── ValidusTicket.sol
├── lib/
│   ├── sepolia.ts
│   └── utils.ts
├── public/
├── scripts/
├── .env.example
├── AGENTS.md
├── LICENSE
├── README.md
├── components.json
├── hardhat.config.js
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── ...
```

## Smart Contract Overview

The contract in `contracts/ValidusTicket.sol` implements an ERC-721 ticketing system with extra controls:

- Event creation with organizer metadata
- NFT-based ticket minting
- Resale restrictions
- Price caps based on face value
- Secondary sale royalty distribution
- Ticket validity and redemption tracking

This gives Validus a reliable, auditable foundation for ticket ownership and resale logic.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Google AI Studio API key for Gemini
- MetaMask or another Web3 wallet for blockchain interactions
- A Sepolia wallet with test ETH for contract interaction

### Installation

```bash
git clone https://github.com/harshikaa28/Validus.git
cd Validus
npm install
```

### Environment Setup

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Then update `.env` with your values:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-flash-latest
WALLET_PRIVATE_KEY=
```

> Leave `WALLET_PRIVATE_KEY` empty unless you intentionally want to use a known test wallet. If blank, the app can create a wallet from the UI for demo use.

### Run the App

```bash
npm run dev
```

Then open:

- http://localhost:3000
- http://localhost:3000/buyer
- http://localhost:3000/organizer

## Usage Examples

Try prompts such as:

- "Verify ticket TKT-001"
- "Is this resale price fair?"
- "Is FAKE-666 a valid ticket?"
- "Check if this seller is violating the resale cap"
- "How many tickets are left for this event?"

The AI agent interprets the request and decides which tool or on-chain check is needed.

## Development Notes

### Run contract compile checks

```bash
npx hardhat compile
```

### Build the app

```bash
npm run build
```

### Start production server

```bash
npm run start
```

## Security Notes

- Never commit your `.env` file or wallet secrets.
- Use a test wallet only for local or demo work.
- Keep private keys offline whenever possible.
- Only use Sepolia test ETH for testing, never real funds.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Project Status

Validus is an evolving proof-of-concept and demo application for safer ticketing in the Web3 era. It demonstrates how agentic AI and smart contracts can work together to improve trust, transparency, and fraud detection in live event ticketing.

## Built For

- Event organizers
- Ticket marketplaces
- Buyers who need confidence in ticket legitimacy
- Developer experimentation around AI + blockchain + trust systems
