import { Connection, PublicKey } from '@solana/web3.js'
import {
  getGovernanceAccounts,
  Governance,
  ProgramAccount,
  Proposal,
  ProposalState,
  pubkeyFilter,
} from '@solana/spl-governance'
import { getCertifiedRealmInfo } from './utils/api.js'
import { fmtTokenAmount } from './utils/formatting.js'
import { formatNumber } from './utils/formatNumber.js'
import { accountsToPubkeyMap } from './utils/accounts.js'
import { EmbedBuilder, WebhookClient } from 'discord.js'

export const fiveMinutesSeconds = 5 * 60
const toleranceSeconds = 30

const webhookClient = new WebhookClient({
  url: process.env.WEBHOOK_URL!,
})

if (!process.env.CLUSTER_URL) {
  console.error('Please set CLUSTER_URL to a rpc node of choice!')
  process.exit(1)
}

export function main() {
  runNotifier().catch((error) => {
    console.error('[Notifier Error]', error)
  })
}

// run every 5 mins, checks if a governance proposal just opened in the last 5 mins
// and notifies on WEBHOOK_URL
async function runNotifier() {
  const REALM = process.env.REALM
  if (!REALM) {
    console.error('Please set REALM to the realm you want to monitor!')
    process.exit(1)
  }
  const realmInfo = await getCertifiedRealmInfo(REALM)
  const realmUrl = `https://v2.realms.today/dao/${escape(REALM)}`
  const connection = new Connection(process.env.CLUSTER_URL!)
  console.log(`- getting all governance accounts for ${REALM}`)
  const governances = await getGovernanceAccounts(connection, realmInfo!.programId, Governance, [
    pubkeyFilter(1, realmInfo!.realmId)!,
  ])

  const governancesMap = accountsToPubkeyMap(governances)

  console.log(`- getting all proposals for all governances`)
  const proposalsByGovernance = await Promise.all(
    Object.keys(governancesMap).map((governancePk) => {
      return getGovernanceAccounts(connection, realmInfo!.programId, Proposal, [
        pubkeyFilter(1, new PublicKey(governancePk))!,
      ])
    }),
  )

  console.log(`- scanning all '${REALM}' proposals`)
  let countJustOpenedForVoting = 0
  let countOpenForVotingSinceSomeTime = 0
  let countVotingNotStartedYet = 0
  let countClosed = 0
  let countCancelled = 0
  const nowInSeconds = new Date().getTime() / 1000
  for (const proposals_ of proposalsByGovernance) {
    for (const proposal of proposals_) {
      const proposalUrl = `${realmUrl}/proposal/${proposal.pubkey.toBase58()}`
      //   // debugging
      //   console.log(
      //     `-- proposal ${proposal.account.governance.toBase58()} - ${
      //       proposal.account.name
      //     } - ${proposal.account.state} - votingAt: ${proposal.account.votingAt?.toString()} - votingCompletedAt: ${proposal.account.votingCompletedAt?.toString()}`
      //   )

      if (
        // proposal is cancelled
        proposal.account.state === ProposalState.Cancelled
      ) {
        countCancelled++
        continue
      }

      if (
        // voting is closed
        proposal.account.votingCompletedAt
      ) {
        if (nowInSeconds - proposal.account.votingCompletedAt.toNumber() <= fiveMinutesSeconds + toleranceSeconds) {
          await postProposalEnded({
            proposalUrl,
            proposal,
          })
        }
        countClosed++
        continue
      }

      if (
        // voting has not started yet
        !proposal.account.votingAt
      ) {
        countVotingNotStartedYet++
        continue
      }

      if (
        // proposal opened in last 5 mins
        nowInSeconds - proposal.account.votingAt.toNumber() <=
        fiveMinutesSeconds + toleranceSeconds
        // proposal opened in last 24 hrs - useful to notify when bot recently stopped working
        // and missed the 5 min window
        // (nowInSeconds - proposal.info.votingAt.toNumber())/(60 * 60) <=
        // 24
      ) {
        countJustOpenedForVoting++

        await postProposalCreated({
          proposalUrl,
          proposal,
        })
      }
      // note that these could also include those in finalizing state, but this is just for logging
      else if (proposal.account.state === ProposalState.Voting) {
        countOpenForVotingSinceSomeTime++

        //// in case bot has an issue, uncomment, and run from local with webhook url set as env var
        // const msg = `“${
        //     proposal.account.name
        // }” proposal just opened for voting 🗳 https://realms.today/dao/${escape(
        //     REALM
        // )}/proposal/${proposal.pubkey.toBase58()}`
        //
        // console.log(msg)
        // if (process.env.WEBHOOK_URL) {
        //   axios.post(process.env.WEBHOOK_URL, { content: msg })
        // }
      }

      const remainingInSeconds =
        governancesMap[proposal.account.governance.toBase58()].account.config.baseVotingTime +
        proposal.account.votingAt.toNumber() -
        nowInSeconds
      if (remainingInSeconds > 86400 && remainingInSeconds < 86400 + fiveMinutesSeconds + toleranceSeconds) {
        await postProposalEnding({ proposalUrl, proposal })
      }
    }
  }
  console.log(
    `-- countOpenForVotingSinceSomeTime: ${countOpenForVotingSinceSomeTime}, countJustOpenedForVoting: ${countJustOpenedForVoting}, countVotingNotStartedYet: ${countVotingNotStartedYet}, countClosed: ${countClosed}, countCancelled: ${countCancelled}`,
  )
}

export async function postToDiscord(contentOrEmbed: string | { embeds: any[] }) {
  if (typeof contentOrEmbed === 'string') {
    return webhookClient.send({ content: contentOrEmbed })
  } else {
    return webhookClient.send(contentOrEmbed)
  }
}

export async function postProposalCreated({
  proposalUrl,
  proposal,
}: {
  proposalUrl: string
  proposal: ProgramAccount<Proposal>
}) {
  const embed = new EmbedBuilder()
    .setTitle('🗳  Proposal Created')
    .setDescription(
      `**${proposal.account.name}** proposal just opened for voting.
        
        Go vote: ${proposalUrl}`,
    )
    .setURL(proposalUrl)
    .setThumbnail('https://raw.githubusercontent.com/solana-labs/governance-ui/main/public/img/logo-realms.png')
    .setColor(0x0099ff)
    .setTimestamp()

  return postToDiscord({ embeds: [embed] })
}

export async function postProposalEnding({
  proposalUrl,
  proposal,
}: {
  proposalUrl: string
  proposal: ProgramAccount<Proposal>
}) {
  const embed = new EmbedBuilder()
    .setTitle('⏰  24 Hours Left')
    .setDescription(
      `**${proposal.account.name}** proposal will close for voting in 24 hours.
        
        Go vote if you haven't already: ${proposalUrl}`,
    )
    .setURL(proposalUrl)
    .setThumbnail('https://raw.githubusercontent.com/solana-labs/governance-ui/main/public/img/logo-realms.png')
    .setColor(0xf8d91c)
    .setTimestamp()

  return postToDiscord({ embeds: [embed] })
}

export async function postProposalEnded({
  proposalUrl,
  proposal,
}: {
  proposalUrl: string
  proposal: ProgramAccount<Proposal>
}) {
  const votingTokenDecimals = 6
  const yesVotes = fmtTokenAmount(proposal.account.getYesVoteCount(), votingTokenDecimals)
  const noVotes = fmtTokenAmount(proposal.account.getNoVoteCount(), votingTokenDecimals)

  const minVotesNeeded =
    proposal.account.governingTokenMint.toBase58() === 'Ds52CDgqdWbTWsua1hgT3AuSSy4FNx2Ezge1br3jQ14a' ? 35000000 : 3

  const quorumReached = yesVotes >= minVotesNeeded
  const isSuccess = yesVotes > noVotes && quorumReached
  const status = isSuccess ? '✅ Success' : !quorumReached ? '❌ Defeated - Quorum Not Reached' : '❌ Defeated'

  const embed = new EmbedBuilder()
    .setTitle('⚖️  Proposal Ended')
    .setDescription(`**${proposal.account.name}**\n\nStatus: **${status}**`)
    .addFields(
      { name: '\u200B', value: '\u200B' },
      { name: '✅ Yes Votes', value: formatNumber(yesVotes, undefined, { minimumFractionDigits: 0 }), inline: true },
      { name: '❌ No Votes', value: formatNumber(noVotes, undefined, { minimumFractionDigits: 0 }), inline: true },
    )
    .setURL(proposalUrl)
    .setThumbnail('https://raw.githubusercontent.com/solana-labs/governance-ui/main/public/img/logo-realms.png')
    .setColor(isSuccess ? 0x00cc66 : 0xcc3300)
    .setTimestamp()

  return postToDiscord({ embeds: [embed] })
}
