import {
  createTestAccounts,
  initLookUpTableFromFile,
  setUpMerkleTree,
} from "@lightprotocol/zk.js";
import { getLightProvider, setAnchorProvider } from "../utils/provider";

export const testSetup = async () => {
  const providerAnchor = await setAnchorProvider();
  // TODO: use updated -- buildscript -> add relayer tests
  await createTestAccounts(providerAnchor.connection);

  // await initLookUpTableFromFile(providerAnchor);

  // await setUpMerkleTree(providerAnchor);
};