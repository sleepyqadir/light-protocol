import express from "express";
import { testSetup } from "./setup";
import { port } from "./config";
import { addCorsHeaders } from "./middleware";
import bodyParser from "body-parser";
import {
  indexedTransactions,
  initMerkleTree,
  initLookupTable,
  sendTransaction,
  updateMerkleTree,
} from "./services";
require("dotenv").config();

const app = express();

app.use(addCorsHeaders);
app.use(bodyParser.json());

app.post("/updatemerkletree", updateMerkleTree);

app.get("/merkletree", initMerkleTree);

app.get("/lookuptable", initLookupTable);

app.post("/relayInstruction", sendTransaction);

app.get("/indexedTransactions", indexedTransactions);

app.listen(port, async () => {
  if (process.env.TEST_ENVIROMENT) {
    await testSetup();
  }

  console.log(`Webserver started on port ${port}`);
  console.log("rpc:", process.env.RPC_URL);
});
