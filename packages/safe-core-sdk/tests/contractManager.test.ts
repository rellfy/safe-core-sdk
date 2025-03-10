import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { deployments, waffle } from 'hardhat'
import Safe, { ContractNetworksConfig } from '../src'
import { ZERO_ADDRESS } from '../src/utils/constants'
import { getContractNetworks } from './utils/setupContractNetworks'
import {
  getFactory,
  getMultiSend,
  getMultiSendCallOnly,
  getSafeSingleton,
  getSafeWithOwners
} from './utils/setupContracts'
import { getEthAdapter } from './utils/setupEthAdapter'
import { getAccounts } from './utils/setupTestNetwork'

chai.use(chaiAsPromised)

describe('Safe contracts manager', () => {
  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture()
    const accounts = await getAccounts()
    const chainId: number = (await waffle.provider.getNetwork()).chainId
    const contractNetworks = await getContractNetworks(chainId)
    return {
      safe: await getSafeWithOwners([accounts[0].address]),
      accounts,
      contractNetworks,
      chainId
    }
  })

  describe('create', async () => {
    it('should fail if the current network is not a default network and no contractNetworks is provided', async () => {
      const { safe, accounts } = await setupTests()
      const [account1] = accounts
      const ethAdapter = await getEthAdapter(account1.signer)
      await chai
        .expect(
          Safe.create({
            ethAdapter,
            safeAddress: safe.address
          })
        )
        .to.be.rejectedWith(
          process.env.ETH_LIB === 'web3'
            ? 'You must provide the json interface of the contract when instantiating a contract object'
            : 'Invalid MultiSend contract address'
        )
    })

    it('should fail if SafeProxy contract is not deployed on the current network', async () => {
      const { accounts, contractNetworks } = await setupTests()
      const [account1] = accounts
      const ethAdapter = await getEthAdapter(account1.signer)
      await chai
        .expect(
          Safe.create({
            ethAdapter,
            safeAddress: ZERO_ADDRESS,
            contractNetworks
          })
        )
        .to.be.rejectedWith('SafeProxy contract is not deployed on the current network')
    })

    it('should fail if MultiSend contract is specified in contractNetworks but not deployed', async () => {
      const { safe, accounts, chainId } = await setupTests()
      const customContractNetworks: ContractNetworksConfig = {
        [chainId]: {
          multiSendAddress: ZERO_ADDRESS,
          multiSendAbi: (await getMultiSend()).abi,
          multiSendCallOnlyAddress: ZERO_ADDRESS,
          multiSendCallOnlyAbi: (await getMultiSendCallOnly()).abi,
          safeMasterCopyAddress: ZERO_ADDRESS,
          safeMasterCopyAbi: (await getSafeSingleton()).abi,
          safeProxyFactoryAddress: ZERO_ADDRESS,
          safeProxyFactoryAbi: (await getFactory()).abi
        }
      }
      const [account1] = accounts
      const ethAdapter = await getEthAdapter(account1.signer)
      await chai
        .expect(
          Safe.create({
            ethAdapter,
            safeAddress: safe.address,
            contractNetworks: customContractNetworks
          })
        )
        .to.be.rejectedWith('MultiSend contract is not deployed on the current network')
    })

    it('should set the MultiSend contract available on the current network', async () => {
      const { safe, accounts, chainId, contractNetworks } = await setupTests()
      const [account1] = accounts
      const ethAdapter = await getEthAdapter(account1.signer)
      const safeSdk = await Safe.create({
        ethAdapter,
        safeAddress: safe.address,
        contractNetworks
      })
      chai
        .expect(safeSdk.getMultiSendAddress())
        .to.be.eq(contractNetworks[chainId].multiSendAddress)
    })
  })
})
