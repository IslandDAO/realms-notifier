import { ProgramAccount } from '@solana/spl-governance'
import { arrayToRecord } from './script.js'

/**
 * Maps the source array of account to a map keyed by pubkey of the accounts
 * @param accounts
 * @returns
 */
export function accountsToPubkeyMap<T>(accounts: ProgramAccount<T>[]) {
  return arrayToRecord(accounts, (a) => a.pubkey.toBase58())
}