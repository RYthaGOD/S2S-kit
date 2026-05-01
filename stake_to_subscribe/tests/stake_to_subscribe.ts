import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakeToSubscribe } from "../target/types/stake_to_subscribe";

describe("stake_to_subscribe", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.stakeToSubscribe as Program<StakeToSubscribe>;

  it("Is initialized!", async () => {
    // Initializing protocol (stub for now)
    console.log("Protocol initialized");
  });
});
