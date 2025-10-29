import { ProgramAccount, Proposal } from "@solana/spl-governance"

// utils/voteType.ts
export const COMMUNITY_TOKEN_MINT = 'Ds52CDgqdWbTWsua1hgT3AuSSy4FNx2Ezge1br3jQ14a'

export function getVoteLabel(proposal: ProgramAccount<Proposal>): string {
  return proposal.account.governingTokenMint.toBase58() === COMMUNITY_TOKEN_MINT
    ? '(Community Vote)'
    : '(Council Vote)'
}