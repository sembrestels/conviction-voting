const defaultAlpha = 0.9 // Constant that controls the conviction decay
const defaultBeta = 0.2 // Maximum share of funds a proposal can take
const defaultRho = 0.5 * defaultBeta ** 2 // Tuning param for the threshold function

/**
 * Calculate the amount of conviction at certain time from an initial conviction
 * and the amount of staked tokens following the formula:
 * `y0 * a ^ t + (x * (1 - a ^ t)) / (1 - a)`.
 * @param {number} timePassed Number of blocks since time 0
 * @param {number} initConv Amount of conviction at time 0
 * @param {number} amount Staked tokens at time 0
 * @param {number} alpha Constant that controls the conviction decay
 * @return {number} Amount of conviction at time t
 */
export function getConviction(
  timePassed,
  initConv,
  amount,
  alpha = defaultAlpha
) {
  const t = timePassed
  const y0 = initConv
  const x = amount
  const a = alpha
  const y = y0 * a ** t + (x * (1 - a ** t)) / (1 - a)
  return y
}

/**
 * Get current conviction on a proposal
 * TODO: Current time is mocked to 100. It needs to be obtained from web3.
 * @param {{time: number, tokenStaked: number, totalTokensStaked: number}[]}
 * stakes List of token stakes made on a proposal
 * @param {number} currentTime Current block
 * @param {string} alpha Constant that controls the conviction decay
 * @return {number} Current conviction
 */
export function getCurrentConviction(
  stakes,
  currentTime = 100,
  alpha = defaultAlpha
) {
  // TODO: This is not needed because we can obtain `conviction` from last stake.
  // Change it when conviction not mocked.
  const [conviction] = stakes.reduce(
    ([lastConv, lastTime, oldAmount], stake) => {
      const amount = stake.totalTokensStaked
      const timePassed = stake.time - lastTime
      lastConv = getConviction(timePassed, lastConv, oldAmount, alpha)
      lastTime = stake.time
      return [lastConv, lastTime, amount]
    },
    [0, 0, 0] // Initial conviction, time, and amount to 0
  )
  const { time, totalTokensStaked } = [...stakes].pop()
  // Calculate from last stake to now
  return getConviction(currentTime - time, conviction, totalTokensStaked, alpha)
}

/**
 * Get current conviction of an entity on a proposal
 * @param {{time: number, tokenStaked: number, totalTokensStaked: number}[]}
 * stakes List of token stakes made on a proposal
 * @param {string} entity Entity by which we will filter the stakes
 * @param {number} currentTime Current block
 * @param {string} alpha Constant that controls the conviction decay
 * @return {number} Current conviction
 */
export function getCurrentConvictionByEntity(
  stakes,
  entity,
  currentTime,
  alpha
) {
  return getCurrentConviction(
    stakes
      .filter(({ entity: _entity }) => entity === _entity)
      .map(({ time, tokensStaked }) => ({
        time,
        totalTokensStaked: tokensStaked,
      })),
    currentTime,
    alpha
  )
}

/**
 * Get total conviction amounts from time 0 to time 100 for a certain proposal.
 * TODO: This function only spans from time 0 to 100. It also does not scale, it
 * needs to be refactored.
 * @param {{time: number, tokenStaked: number, totalTokensStaked: number}[]}
 * stakes List of token stakes made on a proposal
 * @param {string} alpha Constant that controls the conviction decay
 * @returns {number[]} Array with conviction amounts from time 0 to 100
 */
export function getConvictionHistory(stakes, alpha = defaultAlpha) {
  let lastConv = 0
  let currentConv = lastConv
  let oldAmount = 0
  const history = []

  let timePassed = 0 // age of current conviction amount, reset every time conviction stake is changed.
  let stakeIndex = 0

  for (let t = 0; t < 100; t++) {
    // get timeline events for this conviction voting
    currentConv = getConviction(timePassed, lastConv, oldAmount, alpha)
    history.push(currentConv)

    // check if user changed her conviction
    if (stakes.length > stakeIndex && stakes[stakeIndex].time <= t) {
      const action = stakes[stakeIndex]
      stakeIndex++
      oldAmount = action.totalTokensStaked
      timePassed = 0
      lastConv = currentConv
    }

    timePassed++
  }
  return history
}

/**
 * Get total conviction amounts from time 0 to time 100 for a certain proposal
 * TODO: It probably needs to be refactored, as #getConvictionHistory.
 * @param {{time: number, tokenStaked: number, totalTokensStaked: number}[]}
 * stakes List of token stakes made on a proposal
 * @param {string} entity Entity by which we will filter the stakes
 * @param {string} alpha Constant that controls the conviction decay
 * @returns {number[]} Array with conviction amounts from time 0 to 100
 */
export function getConvictionHistoryByEntity(stakes, entity, alpha) {
  return getConvictionHistory(
    stakes
      .filter(({ entity: _entity }) => entity === _entity)
      .map(({ time, tokensStaked }) => ({
        time,
        totalTokensStaked: tokensStaked,
      })),
    alpha
  )
}

/**
 * Get number of blocks needed in order for a proposal to pass.
 * @param {number} threshold Amount of conviction needed for a proposal to pass
 * @param {number} conviction Current amount of conviction
 * @param {number} amount Current amount of staked tokens
 * @param {number} alpha Constant that controls the conviction decay
 * @returns {number|NaN} Number of blocks needed. It is negative if `conviction
 * > threshold` and `NaN` if conviction will not pass the threshold with the
 * current amount of staked tokens
 */
export function getRemainingTimeToPass(
  threshold,
  conviction,
  amount,
  alpha = defaultAlpha
) {
  const a = alpha
  const y = threshold
  const y0 = conviction
  const x = amount
  return Math.log(((a - 1) * y + x) / ((a - 1) * y0 + x)) / Math.log(a)
}

/**
 * Gets conviction trend in percentage since last `timeSpan` amount of blocks.
 * @param {{time: number, tokenStaked: number, totalTokensStaked: number}[]}
 * stakes List of token stakes made on a proposal
 * @param {number} maxConviction Max conviction possible with current token supply
 * @param {number} timeSpan Number of blocks we want to cover
 * @param {number} alpha Constant that controls the conviction decay
 * @returns {number} Number from -1 to 1 that represents the increment or
 * decrement of conviction
 */
export function getConvictionTrend(
  stakes,
  maxConviction,
  timeSpan = 20,
  alpha
) {
  const history = getConvictionHistory(stakes, alpha)
  const pastConviction = history[history.length - timeSpan]
  const currentConviction = getCurrentConviction(stakes, history.length, alpha)
  return (currentConviction - pastConviction) / maxConviction
}

/**
 * Get amount of conviction needed for a proposal to pass. It uses the formula:
 * `threshold = (rho * supply) / (beta - (requeted / funds)) ** 2`.
 * @param {number} requested Amount of requested funds
 * @param {number} funds Total amount of funds
 * @param {number} supply Supply of the token being staked
 * @param {number} beta Maximum share of funds a proposal can take
 * @param {number} rho Tuning param to set up the threshold (linearly)
 * @returns {number} Threshold
 */
export function getThreshold(
  requested,
  funds,
  supply,
  beta = defaultBeta,
  rho = defaultRho
) {
  const share = requested / funds
  if (share < beta) {
    return (rho * supply) / (beta - share) ** 2
  } else {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * Get the needed stake in order for conviction to arrive a certain threshold
 * at some point in time. We obtain this function isolating `x` from the max
 * conviction formula `y = x / (1 - a), so we know how much tokens are needed
 * to be staked (`x`) in order for conviction to arribe a certain threshold `y`.
 * @param {number} threshold Amount of conviction needed for a proposal to pass
 * @param {number} alpha Constant that controls the decay
 * @returns {number} Minimum amount of needed staked tokens for a proposal to
 * pass
 */
export function getMinNeededStake(threshold, alpha = defaultAlpha) {
  const y = threshold
  const a = alpha
  return -a * y + y
}

/**
 * Get max conviction possible with current token supply. It is used to state
 * the 100% of conviction in visuals. We obtain this function from the
 * conviction formula, by calculating the limit when time `t` is infinite.
 * @param {number} supply Stake token supply
 * @param {number} alpha Constant that controls the decay
 * @returns {number} Max amount of conviction possible
 */
export function getMaxConviction(supply, alpha = defaultAlpha) {
  const x = supply
  const a = alpha
  return x / (1 - a)
}