import * as anchor from "@coral-xyz/anchor";
import {
  SystemProgram,
  Keypair as SolanaKeypair,
  PublicKey,
} from "@solana/web3.js";
const solana = require("@solana/web3.js");
import _ from "lodash";
import { assert } from "chai";
const token = require("@solana/spl-token");
let circomlibjs = require("circomlibjs");

import {
  Transaction,
  Account,
  Utxo,
  createMintWrapper,
  setUpMerkleTree,
  initLookUpTableFromFile,
  MerkleTreeProgram,
  merkleTreeProgramId,
  IDL_MERKLE_TREE_PROGRAM,
  TRANSACTION_MERKLE_TREE_KEY,
  ADMIN_AUTH_KEYPAIR,
  MINT,
  KEYPAIR_PRIVKEY,
  REGISTERED_VERIFIER_PDA,
  REGISTERED_VERIFIER_ONE_PDA,
  USER_TOKEN_ACCOUNT,
  createTestAccounts,
  userTokenAccount,
  recipientTokenAccount,
  FEE_ASSET,
  confirmConfig,
  TransactionParameters,
  Provider as LightProvider,
  newAccountWithTokens,
  Action,
  useWallet,
  TestRelayer,
  IDL_VERIFIER_PROGRAM_TWO,
  LOOK_UP_TABLE
} from "@lightprotocol/zk.js";

import { IDL } from "../target/types/mock_verifier";
import { BN } from "@coral-xyz/anchor";

var LOOK_UP_TABLE, POSEIDON, KEYPAIR, RELAYER, deposit_utxo1;

var transactions: Transaction[] = [];
/*
describe("Verifier Two test", () => {
  // Configure the client to use the local cluster.
  process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";
  const path = require("path");
  const circuitPath = path.resolve(__dirname, "../sdk/build-circuit/");

  const provider = anchor.AnchorProvider.local(
    "http://127.0.0.1:8899",
    confirmConfig,
  );
  anchor.setProvider(provider);
  process.env.ANCHOR_PROVIDER_URL = "http://127.0.0.1:8899";
  console.log = () => {};
  const merkleTreeProgram: anchor.Program<MerkleTreeProgram> =
    new anchor.Program(IDL_MERKLE_TREE_PROGRAM, merkleTreeProgramId);

  var depositSplAmount, depositSolAmount;
  const VERIFIER_IDLS = [IDL_VERIFIER_PROGRAM_TWO];

  before(async () => {
    await createTestAccounts(provider.connection, userTokenAccount);

    POSEIDON = await circomlibjs.buildPoseidonOpt();

    KEYPAIR = new Account({
      poseidon: POSEIDON,
      seed: KEYPAIR_PRIVKEY.toString(),
    });

    depositSplAmount =
      10_000 + (Math.floor(Math.random() * 1_000_000_000) % 1_100_000_000);
    depositSolAmount =
      10_000 + (Math.floor(Math.random() * 1_000_000_000) % 1_100_000_000);

    for (var verifier in VERIFIER_IDLS) {

      await token.approve(
        provider.connection,
        ADMIN_AUTH_KEYPAIR,
        userTokenAccount,
        Transaction.getSignerAuthorityPda(
          merkleTreeProgramId,
          new PublicKey(
            VERIFIER_IDLS[verifier].constants[0].value.slice(1, -1),
          ),
        ), //delegate
        USER_TOKEN_ACCOUNT, // owner
        depositSplAmount * 10,
        [USER_TOKEN_ACCOUNT],
      );

      const relayerRecipientSol = SolanaKeypair.generate().publicKey;

      await provider.connection.requestAirdrop(
        relayerRecipientSol,
        2_000_000_000,
      );

      RELAYER = await new TestRelayer(
        ADMIN_AUTH_KEYPAIR.publicKey,
        LOOK_UP_TABLE,
        relayerRecipientSol,
        new BN(100000),
      );

      let lightProvider = await LightProvider.init({
        wallet: ADMIN_AUTH_KEYPAIR,
        relayer: RELAYER,
      }); // userKeypair

      deposit_utxo1 = new Utxo({
        poseidon: POSEIDON,
        assets: [FEE_ASSET, MINT],
        amounts: [
          new anchor.BN(depositSolAmount),
          new anchor.BN(depositSplAmount),
        ],
        account: KEYPAIR,
      });

      let txParams = new TransactionParameters({
        outputUtxos: [deposit_utxo1],
        transactionMerkleTreePubkey: TRANSACTION_MERKLE_TREE_KEY,
        senderSpl: userTokenAccount,
        senderSol: ADMIN_AUTH_KEYPAIR.publicKey,
        poseidon: POSEIDON,
        action: Action.SHIELD,
        lookUpTable: LOOK_UP_TABLE,
        transactionNonce: 0,
        verifierIdl: VERIFIER_IDLS[verifier],
      });

      const appParams0 = {
        inputs: { releaseSlot: new BN(1), currentSlot: new BN(1) },
        path: circuitPath,
        verifierIdl: IDL,
      };
      var transaction = new Transaction({
        provider: lightProvider,
        params: txParams,
      });

      await transaction.compileAndProve();
      await transaction.provider.provider.connection.confirmTransaction(
        await transaction.provider.provider.connection.requestAirdrop(
          transaction.params.accounts.authority,
          1_000_000_000,
        ),
      );
      // does one successful transaction
      await transaction.sendAndConfirmTransaction();
      await lightProvider.relayer.updateMerkleTree(lightProvider);

      // // Deposit
      var deposit_utxo2 = new Utxo({
        poseidon: POSEIDON,
        assets: [FEE_ASSET, MINT],
        amounts: [
          new anchor.BN(depositSolAmount),
          new anchor.BN(depositSplAmount),
        ],
        account: KEYPAIR,
      });

      let txParams1 = new TransactionParameters({
        outputUtxos: [deposit_utxo2],
        transactionMerkleTreePubkey: TRANSACTION_MERKLE_TREE_KEY,
        senderSpl: userTokenAccount,
        senderSol: ADMIN_AUTH_KEYPAIR.publicKey,
        poseidon: POSEIDON,
        action: Action.SHIELD,
        lookUpTable: LOOK_UP_TABLE,
        transactionNonce: 1,
        verifierIdl: VERIFIER_IDLS[verifier],
      });
      const appParams = {
        inputs: { releaseSlot: new BN(1), currentSlot: new BN(1) },
        path: circuitPath,
        verifierIdl: IDL,
      };
      var transaction1 = new Transaction({
        provider: lightProvider,
        params: txParams1,
        appParams,
      });
      await transaction1.compileAndProve();
      transactions.push(transaction1);

      // Withdrawal
      var tokenRecipient = recipientTokenAccount;

      let lightProviderWithdrawal = await LightProvider.init({
        wallet: ADMIN_AUTH_KEYPAIR,
        relayer: RELAYER,
      });

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(relayerRecipientSol, 10000000),
      );

      let txParams2 = new TransactionParameters({
        inputUtxos: [deposit_utxo1],
        transactionMerkleTreePubkey: TRANSACTION_MERKLE_TREE_KEY,
        recipientSpl: tokenRecipient,
        recipientSol: ADMIN_AUTH_KEYPAIR.publicKey,
        relayer: lightProviderWithdrawal.relayer,
        poseidon: POSEIDON,
        action: Action.UNSHIELD,
        transactionNonce: 2,
        verifierIdl: VERIFIER_IDLS[verifier],
      });
      var tx = new Transaction({
        provider: lightProviderWithdrawal,
        params: txParams2,
        appParams,
      });

      await tx.compileAndProve();
      transactions.push(tx);
      console.log(transactions[0].remainingAccounts);
    }
  });

  const sendTestTx = async (
    tx: Transaction,
    type: string,
    account?: string,
  ) => {
    var instructions = await tx.getInstructions(tx.appParams);
    console.log("aftere instructions");
    const provider = anchor.AnchorProvider.local(
      "http://127.0.0.1:8899",
      confirmConfig,
    );
    tx.provider.provider = provider;
    var e;

    for (var ix = 0; ix < instructions.length; ix++) {
      console.log("ix ", ix);
      if (ix != instructions.length - 1) {
        e = await tx.sendTransaction(instructions[ix]);

        // // confirm throws socket hangup error thus waiting a second instead
        await new Promise((resolve) => setTimeout(resolve, 700));
      } else {
        e = await tx.sendTransaction(instructions[ix]);
      }
    }

    if (type === "ProofVerificationFails") {
      assert.isTrue(
        e.logs.includes("Program log: error ProofVerificationFailed"),
      );
    } else if (type === "Account") {
      assert.isTrue(
        e.logs.includes(
          `Program log: AnchorError caused by account: ${account}. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated.`,
        ),
      );
    } else if (type === "preInsertedLeavesIndex") {
      assert.isTrue(
        e.logs.includes(
          "Program log: AnchorError caused by account: pre_inserted_leaves_index. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.",
        ),
      );
    } else if (type === "Includes") {
      console.log("trying includes: ", account);

      assert.isTrue(e.logs.includes(account));
    }
    if (instructions.length > 1) {
      await tx.closeVerifierState();
    }
  };

  it("Wrong amount", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      let wrongAmount = new anchor.BN("123213").toArray();
      tmp_tx.transactionInputs.publicInputs.publicAmountSpl = Array.from([
        ...new Array(29).fill(0),
        ...wrongAmount,
      ]);
      console.log("before sendTestTxs");

      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong publicAmountSol", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      let wrongFeeAmount = new anchor.BN("123213").toArray();
      tmp_tx.transactionInputs.publicInputs.publicAmountSol = Array.from([
        ...new Array(29).fill(0),
        ...wrongFeeAmount,
      ]);
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong Mint", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      let relayer = SolanaKeypair.generate();
      const newMintKeypair = SolanaKeypair.generate();
      await createMintWrapper({
        authorityKeypair: ADMIN_AUTH_KEYPAIR,
        mintKeypair: newMintKeypair,
        connection: provider.connection,
      });
      tmp_tx.params.accounts.senderSpl = await newAccountWithTokens({
        connection: provider.connection,
        MINT: newMintKeypair.publicKey,
        ADMIN_AUTH_KEYPAIR,
        userAccount: relayer,
        amount: new BN(0),
      });
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong encryptedUtxos", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      tmp_tx.params.encryptedUtxos = new Uint8Array(174).fill(2);
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong relayerFee", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      tmp_tx.params.relayer.relayerFee = new anchor.BN("9000");
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong nullifier", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      for (var i in tmp_tx.transactionInputs.publicInputs.inputNullifier) {
        tmp_tx.transactionInputs.publicInputs.inputNullifier[i] = new Array(
          32,
        ).fill(2);
        await sendTestTx(tmp_tx, "ProofVerificationFails");
      }
    }
  });

  it("Wrong leaves", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      for (var i in tmp_tx.transactionInputs.publicInputs.outputCommitment) {
        tmp_tx.transactionInputs.publicInputs.outputCommitment[i] = new Array(
          32,
        ).fill(2);
        await sendTestTx(tmp_tx, "ProofVerificationFails");
      }
    }
  });

  // doesn't work sig verify error
  it.skip("Wrong signer", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      const wrongSinger = SolanaKeypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          wrongSinger.publicKey,
          1_000_000_000,
        ),
        "confirmed",
      );
      tmp_tx.provider.wallet = useWallet(wrongSinger);
      tmp_tx.params.relayer.accounts.relayerPubkey = wrongSinger.publicKey;
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong recipientFee", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      tmp_tx.params.accounts.recipientSol = SolanaKeypair.generate().publicKey;
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong recipient", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      tmp_tx.params.accounts.recipientSpl = SolanaKeypair.generate().publicKey;
      await sendTestTx(tmp_tx, "ProofVerificationFails");
    }
  });

  it("Wrong registeredVerifierPda", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      if (
        tmp_tx.params.accounts.registeredVerifierPda.toBase58() ==
        REGISTERED_VERIFIER_ONE_PDA.toBase58()
      ) {
        tmp_tx.params.accounts.registeredVerifierPda = REGISTERED_VERIFIER_PDA;
      } else {
        tmp_tx.params.accounts.registeredVerifierPda =
          REGISTERED_VERIFIER_ONE_PDA;
      }
      await sendTestTx(tmp_tx, "Account", "registered_verifier_pda");
    }
  });

  it("Wrong authority", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      tmp_tx.params.accounts.authority = Transaction.getSignerAuthorityPda(
        merkleTreeProgramId,
        SolanaKeypair.generate().publicKey,
      );
      await sendTestTx(tmp_tx, "Account", "authority");
    }
  });

  it("Wrong nullifier accounts", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      // await tmp_tx.getPdaAddresses();
      for (
        var i = 0;
        i < tmp_tx.remainingAccounts.nullifierPdaPubkeys.length;
        i++
      ) {
        tmp_tx.remainingAccounts.nullifierPdaPubkeys[i] =
          tmp_tx.remainingAccounts.nullifierPdaPubkeys[
            (i + 1) % tmp_tx.remainingAccounts.nullifierPdaPubkeys.length
          ];
        await sendTestTx(
          tmp_tx,
          "Includes",
          "Program log: Passed-in pda pubkey != on-chain derived pda pubkey.",
        );
      }
    }
  });

  it("Wrong leavesPdaPubkeys accounts", async () => {
    for (var tx in transactions) {
      var tmp_tx: Transaction = _.cloneDeep(transactions[tx]);
      await tmp_tx.getPdaAddresses();
      if (tmp_tx.remainingAccounts.leavesPdaPubkeys.length > 1) {
        for (
          var i = 0;
          i < tmp_tx.remainingAccounts.leavesPdaPubkeys.length;
          i++
        ) {
          tmp_tx.remainingAccounts.leavesPdaPubkeys[i] =
            tmp_tx.remainingAccounts.leavesPdaPubkeys[
              (i + 1) % tmp_tx.remainingAccounts.leavesPdaPubkeys.length
            ];
          await sendTestTx(
            tmp_tx,
            "Includes",
            "Program log: Instruction: InsertTwoLeaves",
          );
        }
      } else {
        tmp_tx.remainingAccounts.leavesPdaPubkeys[0] = {
          isSigner: false,
          isWritable: true,
          pubkey: SolanaKeypair.generate().publicKey,
        };
        await sendTestTx(
          tmp_tx,
          "Includes",
          "Program log: AnchorError caused by account: two_leaves_pda. Error Code: ConstraintSeeds. Error Number: 2006. Error Message: A seeds constraint was violated.",
        );
      }
    }
  });
});
*/