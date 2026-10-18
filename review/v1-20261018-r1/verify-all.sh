#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p verification
node --version > verification/environment.txt
python3 --version >> verification/environment.txt
node --test army-v10-implementation/test/campaign.test.js > verification/campaign.txt 2>&1
node army-v10-implementation/test/verify-seeds.js > verification/seeds.txt 2>&1
node --test army-v10-implementation/spear-skills/test.cjs > verification/spear.txt 2>&1
node --test army-v10-implementation/spear-skills/receipt-amplification.test.cjs > verification/receipt-amplification.txt 2>&1
node army-v10-validation/build-compatibility/receipt-bug.cjs > verification/known-bug-reproduced.json 2>&1
node army-v10-validation/build-compatibility/inheritance.cjs > verification/inheritance.txt 2>&1
node army-v10-validation/build-compatibility/compatibility.cjs > verification/compatibility.txt 2>&1
node army-v10-validation/build-compatibility/rerun-existing.cjs > verification/existing.txt 2>&1
node army-v10-validation/routes-condition/validate.mjs > verification/routes-condition.txt 2>&1
(cd army-v10-validation/growth-economy && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_model.py) > verification/growth-tests.txt 2>&1
PYTHONDONTWRITEBYTECODE=1 python3 army-v10-validation/growth-economy/model.py > verification/growth-model.txt 2>&1
(cd army-v10-planning/legion-relic-budget && PYTHONDONTWRITEBYTECODE=1 python3 -m unittest -v test_model.py) > verification/relic-budget.txt 2>&1
printf '%s\n' 'PASS: commands completed; known receipt defect reproduced, not fixed. Not a 1.0 campaign balance certification.' > verification/STATUS.txt
