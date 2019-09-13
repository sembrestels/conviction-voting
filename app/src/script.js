import 'core-js/stable'
import 'regenerator-runtime/runtime'
import { of } from 'rxjs'
import AragonApi from '@aragon/api'

const INITIALIZATION_TRIGGER = Symbol('INITIALIZATION_TRIGGER')

const api = new AragonApi()

const mockState = {
  proposals: [
    {
      id: 1,
      name: 'Aragon Sidechain',
      description: 'Lorem ipsum...',
      requestedToken: 'DAI', // token address?
      requestedAmount: 1500,
      stakedConviction: 0.57,
      neededConviction: 0.72,
      creator: '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7',
      beneficiary: '0xD41b2558691d4A39447b735C23E6c98dF6cF4409',
    },
    {
      id: 2,
      name: 'Conviction Voting',
      description: 'Lorem ipsum...',
      requestedToken: 'DAI', // token address?
      requestedAmount: 500,
      stakedConviction: 0.57,
      neededConviction: 0.72,
      creator: '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7',
      beneficiary: '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7',
    },
  ],
  myStake: {
    proposal: 2,
    stakedTokens: 33,
    stakedConviction: 0.25,
  },
}

api.store(
  async (state, { event, returnValues, address }) => {
    let newState

    switch (event) {
      case INITIALIZATION_TRIGGER:
        newState = mockState
        break
      case 'ProposalAdded': {
        const { entity, id, title, amount, beneficiary } = returnValues
        const newProposal = {
          id,
          name: title,
          description: 'Lorem ipsum...',
          requestedToken: 'DAI', // token address?
          requestedAmount: parseInt(amount),
          stakedConviction: 0.57,
          neededConviction: 0.72,
          creator: entity,
          beneficiary: beneficiary,
        }
        newState = { ...state, proposals: [...state.proposals, newProposal] }
        break
      }
      case 'Staked': {
        const { id } = returnValues
        newState = {
          ...state,
          myStake: { ...state.myStake, proposal: parseInt(id) },
        }
        console.log(newState)
        break
      }
      case 'Withdrawn': {
        newState = { ...state, myStake: null }
        break
      }
      default:
        newState = state
    }

    return newState
  },
  [
    // Always initialize the store with our own home-made event
    of({ event: INITIALIZATION_TRIGGER }),
  ]
)
