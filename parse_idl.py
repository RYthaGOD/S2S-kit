import json

with open('seeker_staking_idl.json', 'r') as f:
    idl = json.load(f)

for ix in idl.get('instructions', []):
    if ix['name'] in ['stake', 'unstake', 'withdraw']:
        print(f"\n--- {ix['name']} ---")
        for acc in ix.get('accounts', []):
            print(f"  {acc['name']}")
