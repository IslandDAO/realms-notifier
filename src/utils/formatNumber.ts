import BigNumber from "bignumber.js"

/**
 * Get the user's locale using values on the browser. If unsuccessful, default
 * to `'en-US'`.
 */
export function getUserLocale() {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
    return 'en-US'
  }

  if (window.navigator.languages?.length) {
    return window.navigator.languages[0]
  }

  return window.navigator.language || 'en-US'
}

const getFormatter = (() => {
  const formatters = new Map<string, (number: number) => string>()

  return (locale: string, options?: Intl.NumberFormatOptions) => {
    // if we pass in options, don't use a cached formatter
    if (options) {
      if (typeof Intl !== 'undefined') {
        const newFormatter = new Intl.NumberFormat(locale, options)
        return (number: number) => newFormatter.format(number)
      }
    } else if (!formatters.has(locale)) {
      if (typeof Intl !== 'undefined') {
        const newFormatter = new Intl.NumberFormat(locale, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })
        formatters.set(locale, (number) => newFormatter.format(number))
      } else {
        formatters.set(locale, (number) => number.toString())
      }
    }

    return formatters.get(locale) as (number: number) => string
  }
})()

/**
 * Convert a number into a easier to read comma separated string representation
 * of the number. The number can be a primitive `number` or `bigint` type, or
 * it can be a `BigNumber` from `bignumber.js`. If you know the user locale,
 * you can pass that in, otherwise it will try to use the locale from the
 * browser, then default to `'en-US'`.
 */
export function formatNumber(number: BigNumber | number | bigint, locale?: string, options?: Intl.NumberFormatOptions) {
  const format = getFormatter(locale || getUserLocale(), options)

  if (typeof number === 'bigint') {
    return format(Number(number))
  }

  if (typeof number === 'number') {
    return format(number)
  }

  // BigNumber comes with a formatter, so we'll use that unless we have the
  // Intl package available.
  if (typeof Intl !== 'undefined') {
    return format(number.toNumber())
  }

  return number.toFormat(options?.maximumSignificantDigits || 2)
}
