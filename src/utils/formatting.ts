import BN from 'bn.js'
import dayjs from 'dayjs'
import { abbreviateAddress } from './abbreviateAddress.js'
// @ts-ignore
import relativeTime from 'dayjs/plugin/relativeTime.js'

/**
 * @deprecated
 * you shouldn't cast a BN to a number
 * use fmtBnMintDecimals
 */
export const fmtTokenAmount = (c: BN, decimals?: number) =>
  c?.div(new BN(10).pow(new BN(decimals ?? 0))).toNumber() || 0

dayjs.extend(relativeTime)
export const fmtUnixTime = (d: BN | BigNumber | number) =>
  //@ts-ignore
  dayjs(typeof d === 'number' ? d * 1000 : d.toNumber() * 1000).fromNow()

const fmtMsToTime = (milliseconds: number) => {
  let seconds = Math.floor(milliseconds / 1000)
  let minutes = Math.floor(seconds / 60)
  let hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  seconds = seconds % 60
  minutes = minutes % 60

  hours = hours % 24

  return {
    days,
    hours,
    minutes,
    seconds,
  }
}

export const fmtSecsToTime = (secs: number) => {
  return fmtMsToTime(secs * 1000)
}

export const fmtTimeToString = ({
  days,
  hours,
  minutes,
  seconds,
}: {
  days: number
  hours: number
  minutes: number
  seconds: number
}) => {
  const daysStr = days > 0 ? `${days}d : ` : ''
  const hoursStr = hours > 0 ? `${hours}h : ` : ''
  const minutesStr = minutes > 0 ? `${minutes}m` : ''

  return `${daysStr}${hoursStr}${minutesStr}${seconds}s`
}

export { abbreviateAddress }
