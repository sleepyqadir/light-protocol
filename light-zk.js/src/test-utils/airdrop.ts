import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { token } from "@coral-xyz/anchor/dist/cjs/utils";
import {
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  createAssociatedTokenAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  ADMIN_AUTH_KEYPAIR,
  MINT,
  Provider,
  RELAYER_FEES,
  TestRelayer,
  TOKEN_PUBKEY_SYMBOL,
  User,
  userTokenAccount,
  USER_TOKEN_ACCOUNT,
} from "../index";

export async function airdropShieldedSol({
  provider,
  amount,
  seed,
  recipientPublicKey,
}: {
  provider?: Provider;
  amount: number;
  seed?: string;
  recipientPublicKey?: string;
}) {
  if (!amount) throw new Error("Sol Airdrop amount undefined");
  if (!seed && !recipientPublicKey)
    throw new Error(
      "Sol Airdrop seed and recipientPublicKey undefined define a seed to airdrop shielded sol aes encrypted, define a recipientPublicKey to airdrop shielded sol to the recipient nacl box encrypted",
    );
  const RELAYER = await new TestRelayer(
    ADMIN_AUTH_KEYPAIR.publicKey,
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
    new BN(100000),
  );
  if (!provider) {
    provider = await Provider.init({
      wallet: ADMIN_AUTH_KEYPAIR,
      relayer: RELAYER,
    });
  }
  const userKeypair = Keypair.generate();
  await airdropSol({
    provider: provider.provider!,
    recipientPublicKey: userKeypair.publicKey,
    amount,
  });

  const user: User = await User.init({ provider, seed });
  return await user.shield({
    publicAmountSol: amount,
    token: "SOL",
    recipient: recipientPublicKey,
  });
}

export async function airdropSol({
  provider,
  amount,
  recipientPublicKey,
}: {
  provider: AnchorProvider;
  amount: number;
  recipientPublicKey: PublicKey;
}) {
  await provider.connection.confirmTransaction(
    await provider.connection.requestAirdrop(recipientPublicKey, amount),
    "confirmed",
  );
}

/**
 * airdrops shielded spl tokens from ADMIN_AUTH_KEYPAIR to the user specified by seed if aes encrypted desired, or by recipient pubkey if nacl box encrypted (will be in utxoInbox then)
 * @param param0
 * @returns
 */
export async function airdropShieldedMINTSpl({
  provider,
  amount,
  seed,
  recipientPublicKey,
}: {
  provider?: Provider;
  amount: number;
  seed?: string;
  recipientPublicKey?: string;
}) {
  if (!amount) throw new Error("Sol Airdrop amount undefined");
  if (!seed && !recipientPublicKey)
    throw new Error(
      "Sol Airdrop seed and recipientPublicKey undefined define a seed to airdrop shielded sol aes encrypted, define a recipientPublicKey to airdrop shielded sol to the recipient nacl box encrypted",
    );
  const RELAYER = await new TestRelayer(
    ADMIN_AUTH_KEYPAIR.publicKey,
    Keypair.generate().publicKey,
    Keypair.generate().publicKey,
    new BN(100000),
  );
  if (!provider) {
    provider = await Provider.init({
      wallet: ADMIN_AUTH_KEYPAIR,
      relayer: RELAYER,
    });
  }

  let tokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.provider!.connection,
    ADMIN_AUTH_KEYPAIR,
    MINT,
    ADMIN_AUTH_KEYPAIR.publicKey,
  );
  if (new BN(tokenAccount.amount.toString()).toNumber() < amount) {
    await airdropSplToAssociatedTokenAccount(
      provider.provider!.connection,
      1_000_000_000_000 ? amount : 1_000_000_000_000,
      ADMIN_AUTH_KEYPAIR.publicKey,
    );
  }

  const user: User = await User.init({ provider, seed });
  return await user.shield({
    publicAmountSpl: amount,
    token: TOKEN_PUBKEY_SYMBOL.get(MINT.toBase58())!,
    recipient: recipientPublicKey,
    skipDecimalConversions: true,
  });
}

async function airdropSplToAssociatedTokenAccount(
  connection: Connection,
  amount: number,
  authorityPublicKey: PublicKey,
) {
  let tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    ADMIN_AUTH_KEYPAIR,
    MINT,
    authorityPublicKey,
  );
  await mintTo(
    connection,
    ADMIN_AUTH_KEYPAIR,
    MINT,
    tokenAccount.address,
    authorityPublicKey,
    amount,
    [],
  );
}
