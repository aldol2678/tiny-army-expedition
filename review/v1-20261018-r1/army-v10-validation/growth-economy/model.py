"""Opportunity-only sensitivity model. No combat, rarity, actual relics or live picker."""
import hashlib, json, statistics
from pathlib import Path
OUT=Path(__file__).parent
XP=[3,1,1,1,1,2,1]
POLICIES=('army','relic','balanced')
def draw(seed,battle,slot):
    return ('recruit','growth','relic')[int.from_bytes(hashlib.sha256(f'{seed}:{battle}:{slot}'.encode()).digest()[:4],'big')%3]
def simulate(seed,policy,milestones,initial,shops,relic_capacity=17,min_second_battle=8,milestone_battles=(6,15,27)):
    units=[0]*initial; relics=0; gold=0; xp=0; key=False
    chosen={'recruit':0,'growth':0,'relic':0,'key':0,'pass':0}; offered={k:0 for k in ('recruit','growth','relic')}
    first_second=None; second_by8=False; recruits_bought=0; training_bought=0; snapshots={}; trace=[]
    for b in range(1,36):
        gold+=30 if b%7==0 else 10; xp+=XP[(b-1)%7]
        if b==35: break
        reservation={2:'evolve',5:'train1',8:'train2',21:'key'}.get(b)
        cards=['relic']*3 if milestones and b in milestone_battles else [draw(seed,b,s) for s in range(3)]
        if reservation: cards[0]=reservation
        for k in offered: offered[k]+=int(k in cards)
        def target(card):
            if card=='recruit': return len(units)<20
            if card=='relic': return relics<relic_capacity # optimistic abstract distinct-ID capacity, NOT a relic sampler
            if card=='key': return 3 in units and not key
            req={'evolve':0,'train1':1,'train2':2}.get(card)
            return (req in units) if req is not None else any(v<3 and (v<2 or b>=min_second_battle) for v in units)
        valid=[c for c in cards if target(c)]
        # Explicit qualification priority common to all; no compulsory award.
        if 'key' in valid: pick='key'
        else:
            cats={('growth' if c in ('evolve','train1','train2') else c):c for c in valid}
            if policy=='army': order=['recruit','growth','relic'] if len(units)<9 else ['growth','relic','recruit']
            elif policy=='relic': order=['relic','growth','recruit']
            else:
                cap=9 if xp>=13 else 8 if xp>=9 else 7 if xp>=4 else 6
                if not 3 in units: order=['growth','recruit','relic']
                elif len(units)<cap: order=['recruit','growth','relic']
                else: order=['relic','growth','recruit'] if relics<min(6,b//5+1) else ['growth','relic','recruit']
            pick=next((cats[c] for c in order if c in cats),'pass')
        category='growth' if pick in ('evolve','train1','train2') else pick
        chosen[category]+=1
        if pick=='recruit': units.append(0)
        elif pick=='relic': relics+=1
        elif pick=='key': key=True
        elif category=='growth':
            req={'evolve':0,'train1':1,'train2':2}.get(pick)
            stage=req if req is not None else max(v for v in units if v<3 and (v<2 or b>=min_second_battle))
            units[units.index(stage)]+=1
        # Hypothetical service sensitivity: at most one item per visit; no evolution sale.
        if shops and (b-1)%7+1 in (2,4):
            if len(units)<9 and gold>=20: gold-=20; units.append(0); recruits_bought+=1
            elif any(v in (1,2) and (v<2 or b>=min_second_battle) for v in units) and gold>=30:
                stage=max(v for v in units if v in (1,2) and (v<2 or b>=min_second_battle));units[units.index(stage)]+=1;gold-=30;training_bought+=1
        if 3 in units and first_second is None: first_second=b
        if b==8: second_by8=3 in units
        if b in (7,14,21,28,34): snapshots[str(b)]={'units':len(units),'second':units.count(3),'relics':relics,'gold':gold,'key':key}
        trace.append({'battle':b,'cards':cards,'pick':pick,'units':len(units),'second':units.count(3),'gold':gold})
    return dict(chosen=chosen,offered=offered,first_second=first_second,second_by8=second_by8, snapshots=snapshots, recruits_bought=recruits_bought,training_bought=training_bought,xp=xp,final_gold=gold,trace=trace)
def mean(xs):return round(statistics.mean(xs),4)
def summarize(rows):
    first=[r['first_second'] for r in rows if r['first_second'] is not None]
    return {'runs':len(rows),'second_by8_fraction':mean([r['second_by8'] for r in rows]),'no_second_fraction':mean([r['first_second'] is None for r in rows]),'first_second_mean_conditional':mean(first) if first else None,'first_second_p90_conditional':sorted(first)[int(.9*(len(first)-1))] if first else None,'chosen_mean':{k:mean([r['chosen'][k] for r in rows]) for k in rows[0]['chosen']},'snapshots_mean':{b:{k:mean([r['snapshots'][b][k] for r in rows]) for k in ('units','second','relics','gold','key')} for b in ('7','14','21','28','34')},'purchases_mean':{k:mean([r[k] for r in rows]) for k in ('recruits_bought','training_bought')}}
def main():
    output={'model':'opportunity-proxy-1','seeds':1000,'combat_connected':False,'results':{},'paired':{}}
    for initial in (4,6):
      for shops in (False,True):
       for policy in POLICIES:
        key=f'initial{initial}/shops{int(shops)}/{policy}'
        both=[]
        for milestones in (False,True):
          rows=[simulate(s,policy,milestones,initial,shops) for s in range(1000)]
          output['results'][key+f'/milestones{int(milestones)}']=summarize(rows);both.append(rows)
        output['paired'][key]={'final_second_delta_mean':mean([b['snapshots']['34']['second']-a['snapshots']['34']['second'] for a,b in zip(*both)]),'final_relic_delta_mean':mean([b['snapshots']['34']['relics']-a['snapshots']['34']['relics'] for a,b in zip(*both)]),'final_units_delta_mean':mean([b['snapshots']['34']['units']-a['snapshots']['34']['units'] for a,b in zip(*both)]),'second_delayed_runs':sum((b['first_second'] or 99)>(a['first_second'] or 99) for a,b in zip(*both))}
    output['capacity_sensitivity']={}
    for policy in POLICIES:
      output['capacity_sensitivity'][policy]={str(m):summarize([simulate(s,policy,m,4,False,34) for s in range(1000)]) for m in (False,True)}
    output['gate_sensitivity']={str(g):summarize([simulate(s,'balanced',True,4,False,17,g) for s in range(1000)]) for g in (1,8)}
    output['timing_sensitivity']={p:{str(t):summarize([simulate(s,p,True,4,False,17,8,(t,15,27)) for s in range(1000)]) for t in (6,9,10)} for p in POLICIES}
    output['total_runs']=41000
    (OUT/'results.json').write_text(json.dumps(output,indent=2)+'\n')
    (OUT/'example-seed-0.json').write_text(json.dumps({p:simulate(0,p,True,4,False) for p in POLICIES},indent=2)+'\n')
    print(json.dumps(output['paired'],indent=2))
if __name__=='__main__':main()
