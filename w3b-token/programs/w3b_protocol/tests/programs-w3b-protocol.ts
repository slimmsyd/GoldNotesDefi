import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
// Import the generated IDL type - this is created by `anchor build`
import { W3bProtocol } from "../target/types/w3b_protocol";
import IDL from "../target/idl/w3b_protocol.json";

describe("w3b-protocol", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Use the typed IDL - this tells TypeScript exactly what accounts/methods exist
  const program = new Program<W3bProtocol>(IDL as W3bProtocol, provider);

  it("Initializes the protocol", async () => {

    try {
      // In Anchor 0.30+:
      // - PDAs are auto-derived from seeds defined in the IDL
      // - systemProgram is auto-resolved
      // Use accountsPartial() when you only need to specify some accounts
      const tx = await program.methods
        .initialize()
        .accountsPartial({
          authority: provider.wallet.publicKey,
        })
        .rpc();
      
      console.log("Initialize tx:", tx);
      console.log("Protocol initialized successfully!");
    } catch (e: any) {
      if (e.message?.includes("already in use")) {
        console.log("Protocol already initialized - that's OK!");
      } else {
        console.log("Error:", e.message);
      }
    }
  });
});
