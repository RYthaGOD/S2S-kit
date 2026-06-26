// Generates an Anchor-compatible IDL for the stake_to_subscribe program with
// correct sha256 discriminators, and writes it to the SDK and CLI.
//   node scripts/gen-idl.mjs
//
// NOTE: `anchor build` produces the canonical IDL once the Solana toolchain is
// installed. This generator keeps the bundled clients in sync in the meantime.
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ADDRESS = "StKToSuBSCriBe11111111111111111111111111111";

const disc = (prefix, name) =>
  Array.from(createHash("sha256").update(`${prefix}:${name}`).digest().subarray(0, 8));

// shorthand account spec: "name" | "name!" (writable) | "name!s" (writable+signer) | "name?s" (signer)
const acc = (spec) => {
  const writable = spec.includes("!");
  const signer = spec.includes("s");
  const name = spec.replace(/[!?s]/g, "");
  return { name, ...(writable ? { writable: true } : {}), ...(signer ? { signer: true } : {}) };
};
const ix = (name, accounts, args = []) => ({
  name,
  discriminator: disc("global", name),
  accounts: accounts.map(acc),
  args,
});
const arg = (name, type) => ({ name, type });
const bytes32 = { array: ["u8", 32] };

const instructions = [
  ix("initialize_protocol", ["config!", "pass_mint!", "authority!s", "token_program", "system_program"],
    [arg("protocol_fee_bps", "u16"), arg("treasury", "pubkey"), arg("cooldown_seconds", "u64")]),
  ix("add_lst", ["authority!s", "config!", "lst_mint", "lst_config!", "system_program"],
    [arg("rate_kind", "u8"), arg("initial_rate", "u128"), arg("rate_source", "pubkey")]),
  ix("update_lst_rate", ["authority?s", "config", "lst_config!"],
    [arg("new_rate", "u128")]),
  ix("refresh_lst_rate", ["lst_config!", "stake_pool"], []),
  ix("initialize_dapp", ["authority!s", "config!", "dapp!", "system_program"],
    [arg("dapp_id", bytes32), arg("treasury", "pubkey"), arg("min_stake_value", "u64"),
     arg("price_per_period", "u64"), arg("period_seconds", "i64"), arg("trial_seconds", "i64")]),
  ix("deposit_and_subscribe",
    ["user!s", "config", "dapp", "lst_config", "user_vault!", "lst_mint", "user_lst_account!",
     "vault_lst_account!", "pass_mint!", "user_pass_account!", "token_program", "pass_token_program",
     "associated_token_program", "system_program"],
    [arg("amount", "u64"), arg("dapp_id", bytes32)]),
  ix("harvest_yield",
    ["cranker!s", "config", "dapp", "lst_config", "user_vault!", "lst_mint", "vault_lst_account!",
     "protocol_treasury_account!", "dapp_treasury_account!", "token_program"], []),
  ix("verify_access", ["user_vault", "dapp"], []),
  ix("set_authority", ["authority?s", "config!"], [arg("new_authority", "pubkey")]),
  ix("set_protocol_fee", ["authority?s", "config!"], [arg("new_fee_bps", "u16")]),
  ix("set_lst_enabled", ["authority?s", "config", "lst_config!"], [arg("enabled", "bool")]),
  ix("update_dapp", ["authority?s", "dapp!"],
    [arg("treasury", "pubkey"), arg("min_stake_value", "u64"), arg("price_per_period", "u64"),
     arg("period_seconds", "i64"), arg("trial_seconds", "i64")]),
  ix("initiate_unsubscribe", ["user?s", "user_vault!"], []),
  ix("withdraw",
    ["user!s", "config", "user_vault!", "lst_mint", "vault_lst_account!", "user_lst_account!",
     "pass_mint!", "user_pass_account!", "token_program", "pass_token_program", "system_program"], []),
];

const account = (name) => ({ name, discriminator: disc("account", name) });
const accounts = ["GlobalConfig", "LstConfig", "DappRegistry", "UserVault"].map(account);

const field = (name, type) => ({ name, type });
const types = [
  { name: "GlobalConfig", type: { kind: "struct", fields: [
    field("authority", "pubkey"), field("protocol_fee_bps", "u16"), field("treasury", "pubkey"),
    field("pass_mint", "pubkey"), field("cooldown_seconds", "u64"), field("total_dapps", "u64"),
    field("total_lsts", "u16"), field("bump", "u8") ] } },
  { name: "LstConfig", type: { kind: "struct", fields: [
    field("mint", "pubkey"), field("rate", "u128"), field("rate_kind", "u8"),
    field("rate_source", "pubkey"), field("last_rate_update", "i64"),
    field("enabled", "bool"), field("bump", "u8") ] } },
  { name: "DappRegistry", type: { kind: "struct", fields: [
    field("dapp_id", bytes32), field("authority", "pubkey"), field("treasury", "pubkey"),
    field("min_stake_value", "u64"), field("price_per_period", "u64"),
    field("period_seconds", "i64"), field("trial_seconds", "i64"), field("bump", "u8") ] } },
  { name: "UserVault", type: { kind: "struct", fields: [
    field("user", "pubkey"), field("lst_mint", "pubkey"), field("dapp", "pubkey"),
    field("deposited_lst", "u64"), field("principal_value", "u64"),
    field("cumulative_yield_skimmed", "u64"), field("protocol_fees_contributed", "u64"),
    field("active_pass_mint", "pubkey"), field("deposited_at", "i64"), field("paid_through", "i64"),
    field("is_cooling_down", "bool"), field("cooldown_start_time", "i64"),
    field("last_harvest_at", "i64"), field("bump", "u8") ] } },
];

const idl = {
  address: ADDRESS,
  metadata: { name: "stake_to_subscribe", version: "0.2.0", spec: "0.1.0",
    description: "S2S-Kit — LST subscription vault" },
  instructions,
  accounts,
  types,
};

const json = JSON.stringify(idl, null, 2) + "\n";
for (const out of ["sdk/s2s-react/src/idl.json", "packages/cli/src/idl.json"]) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log("wrote", out);
}
