import { Args, Command, Flags } from "@oclif/core";
import {
  MERKLE_TREE_AUTHORITY_PDA,
  TRANSACTION_MERKLE_TREE_KEY,
} from "light-sdk";
import { getLightProvider, getPayer, getWalletConfig } from "../../utils";

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

class AuthorityCommand extends Command {
  static description = "Initialize, set, or get the Merkle Tree Authority";

  static examples = [
    "light authority init",
    "light authority set -p <publicKey>",
    "light authority get",
  ];

  static flags = {
    publicKey: Flags.string({
      char: "p",
      description: "Public key of the authority",
    }),
  };

  static args = {
    method: Args.string({
      name: "method",
      description: "Method to perform: init, set, or get",
      required: true,
    }),
  };

  async run() {
    const { args, flags } = await this.parse(AuthorityCommand);
    const { method } = args;
    const { publicKey } = flags;

    try {
      const provider = await getLightProvider(getPayer());

      let merkleTreeConfig = await getWalletConfig(provider.provider!);

      if (method === "init") {
        this.log("Initializing Merkle Tree Authority");
        try {
          const ix = await merkleTreeConfig.initMerkleTreeAuthority();
          this.log("Merkle Tree Authority initialized successfully", {
            success: true,
          });
          this.log(
            `Merkle Tree Authority PubKey: ${MERKLE_TREE_AUTHORITY_PDA}`
          );
        } catch (error) {
          this.error(`${error}`);
        }
      } else if (method === "set") {
        this.log("Updating Authority Account", { info: true });
        if (!publicKey) {
          this.error(
            "Please provide the public key of the new authority account"
          );
          return;
        }
        try {
          await merkleTreeConfig.updateMerkleTreeAuthority(
            new PublicKey(publicKey),
            true
          );
          this.log(`Updated authority: ${new PublicKey(publicKey)}`, {
            success: true,
          });
          this.log("Merkle Tree Authority updated successfully", {
            success: true,
          });
        } catch (error) {
          this.error(`${error}`);
        }
      } else if (method === "get") {
        this.log("Getting Merkle Tree Authority");
        try {
          const authority =
            await merkleTreeConfig.merkleTreeProgram.account.merkleTreeAuthority.fetch(
              MERKLE_TREE_AUTHORITY_PDA
            );
          this.log("Authority Account:", authority);
          this.log("Merkle Tree Authority retrieved successfully", {
            success: true,
          });
        } catch (error) {
          this.error(`${error}`);
        }
      } else {
        this.error("Invalid command. Please use 'init', 'set', or 'get'");
      }
    } catch (error) {
      this.error(`${error}`);
    }
  }
}

AuthorityCommand.strict = false;

export default AuthorityCommand;
