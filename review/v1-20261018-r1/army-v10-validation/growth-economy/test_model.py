import unittest
from model import simulate,draw
class Tests(unittest.TestCase):
 def test_replay(self):self.assertEqual(simulate(13,'army',True,4,False),simulate(13,'army',True,4,False))
 def test_budget_and_xp(self):
  for p in ('army','balanced','relic'):
   for s in range(50):
    r=simulate(s,p,True,4,False);self.assertEqual(sum(r['chosen'].values()),34);self.assertEqual(r['xp'],50);self.assertEqual(r['final_gold'],450)
 def test_milestones(self):
  r=simulate(0,'balanced',True,4,False)
  for b in (6,15,27):self.assertEqual(r['trace'][b-1]['cards'],['relic']*3)
 def test_reservations(self):
  r=simulate(0,'balanced',True,4,False)
  for b,c in ((2,'evolve'),(5,'train1'),(8,'train2'),(21,'key')):self.assertEqual(r['trace'][b-1]['cards'][0],c)
 def test_gold_ledger(self):
  for s in range(50):
   r=simulate(s,'balanced',True,4,True);self.assertEqual(r['final_gold'],450-r['recruits_bought']*20-r['training_bought']*30);self.assertGreaterEqual(min(t['gold'] for t in r['trace']),0)
 def test_paired_categories(self):
  a=simulate(7,'army',False,4,False);b=simulate(7,'army',True,4,False)
  for x,y in zip(a['trace'],b['trace']):
   if x['battle'] not in (6,15,27):self.assertEqual(x['cards'],y['cards'])
 def test_caps(self):
  for s in range(50):
   r=simulate(s,'relic',True,4,False);self.assertLessEqual(r['chosen']['relic'],17);self.assertLessEqual(r['snapshots']['34']['units'],20)
 def test_no_free_automatic_qualification(self):
  r=simulate(0,'relic',True,4,False);self.assertTrue(all(x['second']<=x['units'] for x in r['trace']));self.assertEqual(r['trace'][0]['second'],0)
if __name__=='__main__':unittest.main()
