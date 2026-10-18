#!/usr/bin/env python3
"""Budget arithmetic only: not a game sampler, persistence layer or combat model."""
import json
import re
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XP = (3, 1, 1, 1, 1, 2, 1) * 5
GROWTH_RESERVED = (2, 5, 8)
KEY_RESERVED = 21
PROFILES = {
    'mixed_baseline': (),
    'relic_three_trial': (9, 23, 39),
    'relic_four_comparison': (9, 23, 29, 39),
}

def ledger():
    total = 0
    rows = []
    for battle, gain in enumerate(XP, 1):
        total += gain
        rows.append({'battle': battle, 'chapter': (battle-1)//7+1, 'xp': total,
                     'cap': 6 + sum(total >= t for t in (4, 9, 13))})
    return rows

def first25():
    rows = re.findall(r'^\| (\d+) `([^`]+)`', (ROOT/'relic-catalog.md').read_text(), re.M)
    selected = [(int(n), ident) for n, ident in rows if 1 <= int(n) <= 21 or 26 <= int(n) <= 29]
    assert len(selected) == 25 and len({ident for _, ident in selected}) == 25
    return dict(selected)

def compare(thresholds):
    rows = ledger()
    selected = [next(row for row in rows if row['xp'] >= xp) for xp in thresholds]
    battles = [row['battle'] for row in selected]
    assert len(set(battles)) == len(battles)
    assert not set(battles) & {*GROWTH_RESERVED, KEY_RESERVED, 35}
    n = len(battles)
    # 102 total cards minus 3 reserved growth cards minus 1 reserved key card.
    ordinary_slots = 98 - 3*n
    return {
        'milestones': selected, 'total_shared_choice_opportunities': 34,
        'ordinary_mixed_rewards': 34-n, 'relic_only_rewards': n,
        'reserved_growth_slots': 3, 'reserved_key_slots': 1,
        'unreserved_random_slots': ordinary_slots,
        'chapter_relic_only_counts': [sum(r['chapter']==c for r in selected) for c in range(1,6)],
        'chapter_three_share': str(Fraction(sum(r['chapter']==3 for r in selected), n)) if n else None,
        'expected_relic_category_cards_before_eligibility': str(Fraction(ordinary_slots,3)+3*n),
        'expected_growth_category_cards_including_reservations': str(Fraction(ordinary_slots,3)+3),
        'expected_recruit_category_cards': str(Fraction(ordinary_slots,3)),
        'removed_growth_category_cards_vs_baseline': n,
        'removed_recruit_category_cards_vs_baseline': n,
        'removed_growth_available_rounds_idealized': str(Fraction(19*n,27)),
        'removed_recruit_available_rounds_idealized': str(Fraction(19*n,27)),
        'removed_any_nonrelic_available_rounds_idealized': str(Fraction(26*n,27)),
        'added_relic_available_rounds_idealized': str(Fraction(8*n,27)),
        'actual_nonrelic_choice_displacement_bounds': [0,n],
        'replacement_purchase_proxy_recruit_only_gold_upper': 20*n,
        'replacement_purchase_proxy_training_only_gold_upper': 30*n,
        'automatic_extra_gold': 0, 'all_34_rerolls_gold': 170,
        'normal_path_income': 450, 'normal_path_spendable_before_final': 420,
    }

def representative_candidates(candidates, owned, zero_effect, unsupported, locked=()):
    """Eligibility set fixture only. No rarity sampling or combat claim."""
    blocked = set(owned) | set(zero_effect) | set(unsupported) | set(locked)
    return tuple(dict.fromkeys(ident for ident in candidates if ident not in blocked))

def main():
    print(json.dumps({'scope':'arithmetic; idealized independent category slots before eligibility',
                      'pool_source':'relic-catalog.md, numbered rows 1..21 and 26..29',
                      'first25': first25(),
                      'profiles':{name:compare(values) for name,values in PROFILES.items()}},
                     ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
