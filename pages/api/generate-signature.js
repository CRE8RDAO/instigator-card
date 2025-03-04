import { unstable_getServerSession } from 'next-auth/next'
import { ThirdwebSDK } from '@thirdweb-dev/sdk'
import { authOptions } from './auth/[...nextauth]'

export default async function generateNftSignature (req, res) {
  // Get the Next Auth session so we can use the accessToken as part of the discord API request
  const session = await unstable_getServerSession(req, res, authOptions)

  // Put Your Discord Server ID here
  const discordServerId = '1012065955309957222'

  // Grab the claimer address (currently connected address) out of the request body
  const { claimerAddress } = JSON.parse(req.body)

  // Read the access token from the session so we can use it in the below API request
  const accessToken = session?.accessToken

  // Make a request to the Discord API to get the servers this user is a part of
  const response = await fetch(`https://discordapp.com/api/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  // Parse the response as JSON
  const data = await response.json()

  // You may get rate limited here and receive an error.

  // Filter all the servers to find the one we want
  // Returns undefined if the user is not a member of the server
  // Returns the server object if the user is a member
  const discordMembership = data?.find(server => server.id === discordServerId)

  // Return an error response if the user is not a member of the server
  // This prevents the signature from being generated if they are not a member
  if (!discordMembership) {
    res.status(403).send('User is not a member of the discord server.')
    return
  }

  // NOTE: Using environment variables to store your private key is unsafe and not best practice.
  // Learn how to store your private key securely here: https://portal.thirdweb.com/sdk/set-up-the-sdk/securing-your-private-key
  // This allows us (the contract owner) to control the generation of the mint signatures
  if (!process.env.PRIVATE_KEY) {
    throw new Error("You're missing PRIVATE_KEY in your .env.local file.")
  }

  // Initialize the Thirdweb SDK on the serverside using the private key on the mumbai network
  const sdk = ThirdwebSDK.fromPrivateKey(process.env.PRIVATE_KEY, 'goerli')

  // Load the NFT Collection via it's contract address using the SDK
  const nftCollection = await sdk.getNFTCollection(
    '0x8Daa86c6b0740A08d3bE40D08c5C0D7677a08532'
  )

  // Generate the signature for the NFT mint transaction
  const signedPayload = await nftCollection.erc721.signature.generate({
    to: claimerAddress,
    metadata: {
      name: `AmpliFi Instigators Card`,
      image: `${session.user.image}`,
      description: `Instigators are the first to join the AmpliFi community. They are the first to receive the NFTs and the first to receive the rewards.`
    }
  })

  // Return back the signedPayload (mint signature) to the client.
  res.status(200).json({
    signedPayload: JSON.parse(JSON.stringify(signedPayload))
  })
}
