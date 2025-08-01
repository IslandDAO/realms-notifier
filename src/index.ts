// Load environment variables from .env file
import 'dotenv/config'
import { fiveMinutesSeconds, main } from './governance-notifier.js'

// start notifier immediately
main()

setInterval(main, fiveMinutesSeconds * 1000)