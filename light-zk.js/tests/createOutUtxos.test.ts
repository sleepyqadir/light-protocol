import { assert, expect } from "chai";
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
import { BN } from "@coral-xyz/anchor";
// Load chai-as-promised support
chai.use(chaiAsPromised);
let circomlibjs = require("circomlibjs");
import {
  SystemProgram,
  Keypair as SolanaKeypair,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { it } from "mocha";
import { buildPoseidonOpt, buildBabyjub, buildEddsa } from "circomlibjs";
import { Scalar } from "ffjavascript";
import {
  Action,
  TransactionParametersErrorCode,
  createOutUtxos,
  strToArr,
  ADMIN_AUTH_KEYPAIR,
  TOKEN_REGISTRY,
  User,
  Utxo,
  CreateUtxoError,
  CreateUtxoErrorCode,
  Account,
  MINT,
  validateUtxoAmounts,
  Recipient,
  createRecipientUtxos,
  Provider,
} from "../src";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
const numberMaxOutUtxos = 2;

process.env.ANCHOR_PROVIDER_URL = "http://127.0.0.1:8899";
process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";
let seed32 = bs58.encode(new Uint8Array(32).fill(1));

describe("Test createOutUtxos Functional", () => {
  var poseidon, eddsa, babyJub, F, k0: Account, k00: Account, kBurner: Account;
  const userKeypair = ADMIN_AUTH_KEYPAIR;
  const mockPublicKey = SolanaKeypair.generate().publicKey;

  var splAmount,
    solAmount,
    token,
    tokenCtx,
    utxo1,
    relayerFee,
    utxoSol,
    recipientAccount,
    lightProvider: Provider;
  before(async () => {
    lightProvider = await Provider.loadMock();
    poseidon = await circomlibjs.buildPoseidonOpt();
    eddsa = await buildEddsa();
    babyJub = await buildBabyjub();
    F = babyJub.F;
    k0 = new Account({ poseidon, seed: seed32 });
    k00 = new Account({ poseidon, seed: seed32 });
    kBurner = Account.createBurner(poseidon, seed32, new anchor.BN("0"));
    splAmount = new BN(3);
    solAmount = new BN(1e6);
    token = "USDC";
    tokenCtx = TOKEN_REGISTRY.get(token);
    if (!tokenCtx) throw new Error("Token not supported!");
    splAmount = splAmount.mul(new BN(tokenCtx.decimals));
    utxo1 = new Utxo({
      poseidon,
      assets: [SystemProgram.programId, tokenCtx.mint],
      amounts: [new BN(1e8), new BN(5 * tokenCtx.decimals)],
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    utxoSol = new Utxo({
      poseidon,
      assets: [SystemProgram.programId],
      amounts: [new BN(1e6)],
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    relayerFee = new BN(1000);

    let recipientAccountRoot = new Account({
      poseidon,
      seed: bs58.encode(new Uint8Array(32).fill(3)),
    });

    recipientAccount = Account.fromPubkey(
      recipientAccountRoot.getPublicKey(),
      poseidon,
    );
  });

  it("shield sol", async () => {
    let outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(0),
      publicAmountSol: solAmount,
      poseidon,
      changeUtxoAccount: k0,
      action: Action.SHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      solAmount.toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      "0",
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("shield spl", async () => {
    let outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(10),
      publicAmountSol: new BN(0),
      poseidon,
      changeUtxoAccount: k0,
      action: Action.SHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      "0",
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      "10",
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("shield sol with input utxo", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(0),
      publicAmountSol: solAmount,
      poseidon,
      changeUtxoAccount: k0,
      action: Action.SHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].add(solAmount).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("shield sol & spl with input utxo", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(10),
      publicAmountSol: solAmount,
      poseidon,
      changeUtxoAccount: k0,
      action: Action.SHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].add(solAmount).toString(),
      `${outUtxos[0].amounts[0].add(solAmount)} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].add(new BN("10")).toString(),
      `${utxo1.amounts[1].add(new BN("10")).toString()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("shield sol & spl", async () => {
    let outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(10),
      publicAmountSol: solAmount,
      poseidon,
      changeUtxoAccount: k0,
      action: Action.SHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      solAmount.toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      "10",
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield SPL - no relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      publicAmountSol: new BN(0),
      poseidon,
      relayerFee: new BN(0),
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield SPL - with relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      publicAmountSol: new BN(0),
      poseidon,
      relayerFee,
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].sub(relayerFee).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield sol - no relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(0),
      publicAmountSol: solAmount,
      poseidon,
      relayerFee: new BN(0),
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].sub(solAmount).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield sol - with relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(0),
      publicAmountSol: solAmount,
      poseidon,
      relayerFee,
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].sub(relayerFee).sub(solAmount).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield spl & sol - no relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      publicAmountSol: solAmount,
      poseidon,
      relayerFee: new BN(0),
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].sub(solAmount).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].sub(splAmount).toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield spl & sol - with relayer fee", async () => {
    let outUtxos = createOutUtxos({
      inUtxos: [utxo1],
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      publicAmountSol: solAmount,
      poseidon,
      relayerFee,
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].sub(relayerFee).sub(solAmount).toString(),
      `${outUtxos[0].amounts[0]} fee != ${utxo1.amounts[0]}`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].sub(splAmount).toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield in:1SOL + 1SPL should merge 2-1", async () => {
    let outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      inUtxos: [utxo1, utxoSol],
      publicAmountSol: new BN(0),
      poseidon,
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    assert.equal(
      outUtxos[0].amounts[0].toNumber(),
      utxo1.amounts[0].toNumber() + utxoSol.amounts[0].toNumber(),
      `${outUtxos[0].amounts[0]} fee != ${
        utxo1.amounts[0].toNumber() + utxoSol.amounts[0].toNumber()
      }`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount * tokenCtx.decimals
      }`,
    );
  });

  it("unshield in:1SPL + 1SPL should merge 2-1", async () => {
    let outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      inUtxos: [utxo1, utxo1],
      publicAmountSol: new BN(0),
      poseidon,
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    assert.equal(
      outUtxos[0].amounts[0].toString(),
      utxo1.amounts[0].mul(new BN(2)),
      `${outUtxos[0].amounts[0]} fee != ${
        utxo1.amounts[0].toNumber() + utxo1.amounts[0].toNumber()
      }`,
    );
    assert.equal(
      outUtxos[0].amounts[1].toString(),
      utxo1.amounts[1].mul(new BN(2)).sub(splAmount).toString(),
      `${outUtxos[0].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount
      }`,
    );
  });

  it("transfer in:1 SPL ", async () => {
    let recipients = [
      {
        account: recipientAccount,
        mint: utxo1.assets[1],
        solAmount: new BN(0),
        splAmount: new BN(1),
      },
    ];
    let outUtxos = createRecipientUtxos({
      recipients,
      poseidon,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    outUtxos = createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: new BN(0),
      inUtxos: [utxo1],
      outUtxos,
      relayerFee,
      publicAmountSol: new BN(0),
      poseidon,
      changeUtxoAccount: k0,
      action: Action.TRANSFER,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    assert.equal(
      outUtxos[1].amounts[0].toNumber(),
      utxo1.amounts[0].toNumber() -
        relayerFee.toNumber() -
        outUtxos[0].amounts[0].toNumber(),
      `${outUtxos[1].amounts[0]} fee != ${
        utxo1.amounts[0].toNumber() -
        relayerFee.toNumber() -
        outUtxos[0].amounts[0].toNumber()
      }`,
    );

    assert.equal(
      outUtxos[1].amounts[1].toNumber(),
      utxo1.amounts[1].toNumber() - 1,
      `${outUtxos[1].amounts[1].toNumber()}  spl !=  ${
        utxo1.amounts[1].toNumber() - splAmount.toNumber()
      }`,
    );
  });
});

// ... existing imports and code ...

describe("createRecipientUtxos", () => {
  let lightProvider: Provider;
  it("should create output UTXOs for each recipient", async () => {
    lightProvider = await Provider.loadMock();
    const poseidon = await circomlibjs.buildPoseidonOpt();

    const mint = MINT;
    const account1 = new Account({ poseidon, seed: seed32 });
    const account2 = new Account({
      poseidon,
      seed: new Uint8Array(32).fill(4).toString(),
    });

    const recipients: Recipient[] = [
      {
        account: account1,
        solAmount: new BN(5),
        splAmount: new BN(10),
        mint,
      },
      {
        account: account2,
        solAmount: new BN(3),
        splAmount: new BN(7),
        mint,
      },
    ];

    const outputUtxos = createRecipientUtxos({
      recipients,
      poseidon,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    expect(outputUtxos.length).to.equal(recipients.length);
    expect(outputUtxos[0].account).to.equal(account1);
    expect(outputUtxos[0].amounts[0].toString()).to.equal("5");
    expect(outputUtxos[0].amounts[1].toString()).to.equal("10");
    expect(outputUtxos[0].assets[0].equals(SystemProgram.programId)).to.be.true;
    expect(outputUtxos[0].assets[1].equals(mint)).to.be.true;

    expect(outputUtxos[1].account).to.equal(account2);
    expect(outputUtxos[1].amounts[0].toString()).to.equal("3");
    expect(outputUtxos[1].amounts[1].toString()).to.equal("7");
    expect(outputUtxos[1].assets[0].equals(SystemProgram.programId)).to.be.true;
    expect(outputUtxos[1].assets[1].equals(mint)).to.be.true;
  });
});

describe("validateUtxoAmounts", () => {
  let poseidon, assetPubkey, inUtxos, lightProvider: Provider;
  before(async () => {
    lightProvider = await Provider.loadMock();
    poseidon = await circomlibjs.buildPoseidonOpt();
    assetPubkey = new PublicKey(0);
    inUtxos = [
      createUtxo(poseidon, [new BN(5)], [assetPubkey]),
      createUtxo(poseidon, [new BN(3)], [assetPubkey]),
    ];
  });
  // Helper function to create a UTXO with specific amounts and assets
  function createUtxo(poseidon: any, amounts: BN[], assets: PublicKey[]): Utxo {
    return new Utxo({
      poseidon,
      amounts,
      assets,
      blinding: new BN(0),
      account: new Account({ poseidon }),
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
  }

  it("should not throw an error if input UTXOs sum is equal to output UTXOs sum", () => {
    const outUtxos = [createUtxo(poseidon, [new BN(8)], [assetPubkey])];

    expect(() =>
      validateUtxoAmounts({ assetPubkeys: [assetPubkey], inUtxos, outUtxos }),
    ).not.to.throw();
  });

  it("should not throw an error if input UTXOs sum is greater than output UTXOs sum", () => {
    const outUtxos = [createUtxo(poseidon, [new BN(7)], [assetPubkey])];

    expect(() =>
      validateUtxoAmounts({ assetPubkeys: [assetPubkey], inUtxos, outUtxos }),
    ).not.to.throw();
  });

  it("should throw an error if input UTXOs sum is less than output UTXOs sum", () => {
    const outUtxos = [createUtxo(poseidon, [new BN(9)], [assetPubkey])];

    expect(() =>
      validateUtxoAmounts({ assetPubkeys: [assetPubkey], inUtxos, outUtxos }),
    ).to.throw(CreateUtxoError);
  });
});

describe("Test createOutUtxos Errors", () => {
  var poseidon, eddsa, babyJub, F, k0: Account, k00: Account, kBurner: Account;
  const userKeypair = ADMIN_AUTH_KEYPAIR;
  const mockPublicKey = SolanaKeypair.generate().publicKey;

  var splAmount,
    solAmount,
    token,
    tokenCtx,
    utxo1,
    relayerFee,
    utxoSol,
    recipientAccount,
    lightProvider: Provider;
  before(async () => {
    lightProvider = await Provider.loadMock();
    poseidon = await circomlibjs.buildPoseidonOpt();
    eddsa = await buildEddsa();
    babyJub = await buildBabyjub();
    F = babyJub.F;
    k0 = new Account({ poseidon, seed: seed32 });
    k00 = new Account({ poseidon, seed: seed32 });
    kBurner = Account.createBurner(poseidon, seed32, new anchor.BN("0"));
    splAmount = new BN(3);
    solAmount = new BN(1e6);
    token = "USDC";
    tokenCtx = TOKEN_REGISTRY.get(token);
    if (!tokenCtx) throw new Error("Token not supported!");
    splAmount = splAmount.mul(new BN(tokenCtx.decimals));
    utxo1 = new Utxo({
      poseidon,
      assets: [SystemProgram.programId, tokenCtx.mint],
      amounts: [new BN(1e8), new BN(5 * tokenCtx.decimals)],
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    utxoSol = new Utxo({
      poseidon,
      assets: [SystemProgram.programId],
      amounts: [new BN(1e6)],
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
    relayerFee = new BN(1000);

    let recipientAccountRoot = new Account({
      poseidon,
      seed: bs58.encode(new Uint8Array(32).fill(3)),
    });

    recipientAccount = Account.fromPubkey(
      recipientAccountRoot.getPublicKey(),
      poseidon,
    );
    createOutUtxos({
      publicMint: tokenCtx.mint,
      publicAmountSpl: splAmount,
      inUtxos: [utxo1, utxoSol],
      publicAmountSol: new BN(0),
      changeUtxoAccount: k0,
      action: Action.UNSHIELD,
      poseidon,
      numberMaxOutUtxos,
      assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });
  });

  it("NO_POSEIDON_HASHER_PROVIDED", async () => {
    expect(() => {
      // @ts-ignore
      createOutUtxos({
        publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        publicAmountSol: new BN(0),
        // poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: TransactionParametersErrorCode.NO_POSEIDON_HASHER_PROVIDED,
        functionName: "createOutUtxos",
      });
  });

  it("INVALID_NUMER_OF_RECIPIENTS", async () => {
    expect(() => {
      createOutUtxos({
        publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
        outUtxos: [
          new Utxo({
            poseidon,
            assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
            verifierProgramLookupTable:
              lightProvider.lookUpTables.verifierProgramLookupTable,
          }),
          new Utxo({
            poseidon,
            assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
            verifierProgramLookupTable:
              lightProvider.lookUpTables.verifierProgramLookupTable,
          }),
        ],
        numberMaxOutUtxos,
        assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
        verifierProgramLookupTable:
          lightProvider.lookUpTables.verifierProgramLookupTable,
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.INVALID_NUMER_OF_RECIPIENTS,
        functionName: "createOutUtxos",
      });
  });

  it("INVALID_RECIPIENT_MINT", async () => {
    let invalidMint = SolanaKeypair.generate().publicKey;
    expect(() => {
      // @ts-ignore
      createOutUtxos({
        publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
        outUtxos: [
          new Utxo({
            poseidon,
            assets: [SystemProgram.programId, invalidMint],
            amounts: [new BN(0), new BN(1)],
            assetLookupTable: [
              ...lightProvider.lookUpTables.assetLookupTable,
              ...[invalidMint.toBase58()],
            ],
            verifierProgramLookupTable:
              lightProvider.lookUpTables.verifierProgramLookupTable,
          }),
        ],
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.INVALID_RECIPIENT_MINT,
        functionName: "createOutUtxos",
      });
  });

  it("RECIPIENTS_SUM_AMOUNT_MISSMATCH", async () => {
    expect(() => {
      // @ts-ignore
      createOutUtxos({
        publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
        outUtxos: [
          new Utxo({
            poseidon,
            assets: [SystemProgram.programId, utxo1.assets[1]],
            amounts: [new BN(0), new BN(1e12)],
            assetLookupTable: lightProvider.lookUpTables.assetLookupTable,
            verifierProgramLookupTable:
              lightProvider.lookUpTables.verifierProgramLookupTable,
          }),
        ],
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.RECIPIENTS_SUM_AMOUNT_MISSMATCH,
        functionName: "validateUtxoAmounts",
      });
  });

  it("NO_PUBLIC_AMOUNTS_PROVIDED", async () => {
    expect(() => {
      // @ts-ignore
      createOutUtxos({
        publicMint: tokenCtx.mint,
        // publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        // publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.NO_PUBLIC_AMOUNTS_PROVIDED,
        functionName: "createOutUtxos",
      });
  });

  it("NO_PUBLIC_MINT_PROVIDED", async () => {
    expect(() => {
      // @ts-ignore
      createOutUtxos({
        // publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol],
        // publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
        relayerFee: new BN(1),
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.NO_PUBLIC_MINT_PROVIDED,
        functionName: "createOutUtxos",
      });
  });

  // it("SPL_AMOUNT_UNDEFINED",async () => {
  //     expect(()=>{
  //         // @ts-ignore
  //         createOutUtxos({
  //             publicMint: tokenCtx.mint,
  //             publicAmountSpl: splAmount,
  //             inUtxos: [utxo1, utxoSol],
  //             publicAmountSol: new BN(0),
  //             poseidon,
  //             changeUtxoAccount: k0,
  //             action: Action.UNSHIELD,
  //             // @ts-ignore
  //             recipients: [{account: recipientAccount, mint: utxo1.assets[1], solAmount: new BN(0)}],
  //         });
  //     }).to.throw(CreateUtxoError).includes({
  //         code: CreateUtxoErrorCode.SPL_AMOUNT_UNDEFINED,
  //         functionName: "createOutUtxos"
  //     })
  // })

  it("INVALID_OUTPUT_UTXO_LENGTH", async () => {
    let invalidMint = SolanaKeypair.generate().publicKey;

    let utxoSol0 = new Utxo({
      poseidon,
      assets: [SystemProgram.programId, invalidMint],
      amounts: [new BN(1e6), new BN(1e6)],
      assetLookupTable: [
        ...lightProvider.lookUpTables.assetLookupTable,
        ...[invalidMint.toBase58()],
      ],
      verifierProgramLookupTable:
        lightProvider.lookUpTables.verifierProgramLookupTable,
    });

    expect(() => {
      createOutUtxos({
        publicMint: tokenCtx.mint,
        publicAmountSpl: splAmount,
        inUtxos: [utxo1, utxoSol0],
        publicAmountSol: new BN(0),
        poseidon,
        changeUtxoAccount: k0,
        action: Action.UNSHIELD,
        outUtxos: [
          new Utxo({
            poseidon,
            assets: [SystemProgram.programId, utxo1.assets[1]],
            amounts: [new BN(0), new BN(1)],
            assetLookupTable: [
              ...lightProvider.lookUpTables.assetLookupTable,
              ...[invalidMint.toBase58()],
            ],
            verifierProgramLookupTable:
              lightProvider.lookUpTables.verifierProgramLookupTable,
          }),
        ],
        numberMaxOutUtxos,
        assetLookupTable: [
          ...lightProvider.lookUpTables.assetLookupTable,
          ...[invalidMint.toBase58()],
        ],
        verifierProgramLookupTable:
          lightProvider.lookUpTables.verifierProgramLookupTable,
      });
    })
      .to.throw(CreateUtxoError)
      .includes({
        code: CreateUtxoErrorCode.INVALID_OUTPUT_UTXO_LENGTH,
        functionName: "createOutUtxos",
      });
  });
});
