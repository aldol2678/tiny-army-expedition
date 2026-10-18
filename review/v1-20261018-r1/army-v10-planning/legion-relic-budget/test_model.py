import unittest
from fractions import Fraction
from model import ledger, first25, compare, PROFILES, representative_candidates

class BudgetTests(unittest.TestCase):
    def test_xp_and_caps(self):
        rows = ledger()
        self.assertEqual([rows[i]['xp'] for i in (6,13,20,27,34)], [10,20,30,40,50])
        self.assertEqual([(r['battle'],r['cap']) for r in rows if r['battle'] in (1,2,6,8,35)],
                         [(1,6),(2,7),(6,8),(8,9),(35,9)])
    def test_milestones(self):
        self.assertEqual([r['battle'] for r in compare(PROFILES['relic_three_trial'])['milestones']], [6,15,27])
        self.assertEqual([r['battle'] for r in compare(PROFILES['relic_four_comparison'])['milestones']], [6,15,20,27])
    def test_no_double_boss_or_growth_budget(self):
        for bad in ((4,), (7,), (13,), (30,), (50,), (9,9)):
            with self.subTest(bad=bad), self.assertRaises(AssertionError):
                compare(bad)
    def test_budget_totals(self):
        for thresholds in PROFILES.values():
            result=compare(thresholds)
            self.assertEqual(result['ordinary_mixed_rewards']+result['relic_only_rewards'],34)
            self.assertEqual(result['unreserved_random_slots']+3*len(thresholds)+4,102)
            cards=sum(Fraction(result[k]) for k in ('expected_relic_category_cards_before_eligibility',
                        'expected_growth_category_cards_including_reservations','expected_recruit_category_cards'))
            self.assertEqual(cards+1,102) # independent reserved key card
            self.assertEqual(result['automatic_extra_gold'],0)
    def test_four_vs_three_tradeoff(self):
        three=compare(PROFILES['relic_three_trial']); four=compare(PROFILES['relic_four_comparison'])
        self.assertEqual(three['chapter_three_share'],'1/3')
        self.assertEqual(four['chapter_three_share'],'1/2')
        self.assertEqual(Fraction(four['expected_relic_category_cards_before_eligibility'])-
                         Fraction(three['expected_relic_category_cards_before_eligibility']),2)
        self.assertEqual(four['replacement_purchase_proxy_training_only_gold_upper']-
                         three['replacement_purchase_proxy_training_only_gold_upper'],30)
    def test_exact_document_pool(self):
        pool=first25()
        self.assertEqual(set(pool),set(range(1,22))|set(range(26,30)))
        self.assertNotIn('rear_gambit',pool.values())
        self.assertNotIn('reserve_tent',pool.values())
    def test_representative_candidate_filter(self):
        ids=tuple(first25().values())
        unavailable=('whistle','drum','echo_crystal','emergency_case')
        result=representative_candidates(ids+('banner',),('banner',),('seal',),ids[17:],unavailable)
        self.assertEqual(len(result),len(set(result)))
        self.assertNotIn('banner',result);self.assertNotIn('seal',result)
        self.assertNotIn('iron_oath',result); self.assertNotIn('whistle',result)
        self.assertEqual(result,representative_candidates(ids+('banner',),('banner',),('seal',),ids[17:],unavailable))
    def test_empty_eligibility_is_empty_not_new_category(self):
        ids=tuple(first25().values())
        self.assertEqual(representative_candidates(ids,ids,(),()),())

if __name__=='__main__': unittest.main(verbosity=2)
