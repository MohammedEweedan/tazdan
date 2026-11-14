export const globals = {capital:1600000, initialPrefunding:300000, contingency:200000, setup:300000, setupMonths:6, taxRate:0.20, capexMonthly:2000, prefundBuffer:1.3};
export const cases = [
 {name:'Downside', launch:10, churn:.05, cac:35, kycPass:.75, kycCost:2, bankShare:.30, settlementShare:.60, settlementDays:4,
  users:[700,2500,4500,6500,9000], businesses:[10,40,80,130,200], ticket:[350,350,375,375,400], frequency:[1,1,1.1,1.1,1.2],
  take:[.011,.011,.011,.011,.011], fixedFee:[2,2,2,2,2], railRate:[.0075,.0075,.0075,.0075,.0075], railFixed:[1.5,1.5,1.5,1.5,1.5], loss:[.002,.002,.002,.002,.002],
  businessFee:[30,30,30,30,30], opex:[30000,38000,45000,50000,55000]},
 {name:'Base', launch:6, churn:.04, cac:25, kycPass:.75, kycCost:2, bankShare:.20, settlementShare:.40, settlementDays:2,
  users:[3000,8500,14000,21000,29000], businesses:[40,130,250,400,600], ticket:[400,425,450,475,500], frequency:[1.2,1.3,1.4,1.5,1.6],
  take:[.015,.015,.015,.015,.015], fixedFee:[3,3,3,3,3], railRate:[.0065,.0065,.0065,.0065,.0065], railFixed:[1.25,1.25,1.25,1.25,1.25], loss:[.001,.001,.001,.001,.001],
  businessFee:[40,40,40,40,40], opex:[30000,40000,50000,60000,70000]},
 {name:'Upside', launch:4, churn:.03, cac:20, kycPass:.80, kycCost:2, bankShare:.15, settlementShare:.40, settlementDays:2,
  users:[6000,16000,30000,45000,60000], businesses:[100,300,650,1100,1600], ticket:[450,475,500,525,550], frequency:[1.4,1.5,1.6,1.7,1.8],
  take:[.017,.017,.017,.017,.017], fixedFee:[3,3,3,3,3], railRate:[.006,.006,.006,.006,.006], railFixed:[1.1,1.1,1.1,1.1,1.1], loss:[.0008,.0008,.0008,.0008,.0008],
  businessFee:[40,40,40,40,40], opex:[35000,50000,70000,100000,130000]}
];
// A conditional bank distribution/shared-operations case retains Base volume and pricing.
cases.push({...structuredClone(cases[1]),name:'Bank-supported',cac:12,opex:[20000,25000,35000,45000,55000]});
export function evaluate(c,g=globals) {
 let priorUsers=0, priorBusiness=0, priorPrefund=g.initialPrefunding, cash=g.capital-g.initialPrefunding, cumCash=0, cumEarn=0, months=[];
 for(let m=1;m<=60;m++) {
  const yi=Math.floor((m-1)/12), within=(m-1)%12+1;
  const start=yi===0?0:c.users[yi-1], bstart=yi===0?0:c.businesses[yi-1];
  const fraction=yi===0?Math.max(0,(m-c.launch+1)/(13-c.launch)):within/12;
  const users=start+(c.users[yi]-start)*fraction, businesses=bstart+(c.businesses[yi]-bstart)*fraction;
  const avgUsers=(priorUsers+users)/2, avgBusiness=(priorBusiness+businesses)/2;
  const activations=Math.max(0,users-priorUsers*(1-c.churn));
  const checks=activations/c.kycPass, tx=avgUsers*c.frequency[yi], volume=tx*c.ticket[yi];
  const feePool=volume*c.take[yi]+tx*c.fixedFee[yi]+avgBusiness*c.businessFee[yi], bankFee=feePool*c.bankShare, revenue=feePool-bankFee;
  const railCost=volume*c.railRate[yi]+tx*c.railFixed[yi], lossCost=volume*c.loss[yi], kyc=checks*c.kycCost;
  const direct=railCost+lossCost+kyc, contribution=revenue-direct, growth=activations*c.cac, opex=c.opex[yi];
  const op=contribution-opex-growth, tax=Math.max(0,op)*g.taxRate, capex=m>=c.launch?g.capexMonthly:0, setup=m<=g.setupMonths?g.setup/g.setupMonths:0;
  const requiredPrefund=Math.max(g.initialPrefunding,volume*c.settlementShare*c.settlementDays/30*g.prefundBuffer);
  const extraPrefund=Math.max(0,requiredPrefund-priorPrefund), prefund=priorPrefund+extraPrefund;
  const earned=op-tax-capex-setup, fcf=earned-extraPrefund;
  cumCash+=fcf;cumEarn+=earned;cash+=fcf;
  months.push({month:m,year:yi+1,users,businesses,avgUsers,avgBusiness,activations,checks,tx,volume,feePool,bankFee,revenue,railCost,lossCost,kyc,direct,contribution,growth,opex,op,tax,capex,setup,extraPrefund,prefund,fcf,cumCash,cumEarn,cash,spendable:cash-g.contingency});
  priorUsers=users;priorBusiness=businesses;priorPrefund=prefund;
 }
 const years=Array.from({length:5},(_,i)=>{
  const ms=months.slice(i*12,(i+1)*12), o={year:i+1,users:ms.at(-1).users,businesses:ms.at(-1).businesses,cash:ms.at(-1).cash,prefund:ms.at(-1).prefund};
  for(const k of ['volume','feePool','bankFee','revenue','direct','contribution','growth','opex','op','tax','capex','setup','extraPrefund','fcf'])o[k]=ms.reduce((s,m)=>s+m[k],0);
  return o;
 });
 const sustained=months.find((v,i)=>i>=2&&v.op>0&&months[i-1].op>0&&months[i-2].op>0)?.month??null;
 return {name:c.name,months,years,sustainedBreakEven:sustained,firstPositive:months.find(v=>v.op>0)?.month??null,
  lossRecovery:months.find(v=>v.cumEarn>=0)?.month??null,fullCapitalPayback:months.find(v=>v.cumCash>=g.capital)?.month??null,
  reserveTouched:months.find(v=>v.spendable<0)?.month??null,cashExhausted:months.find(v=>v.cash<0)?.month??null,
  peakFundingDeficit:Math.max(0,-Math.min(...months.map(v=>v.cash))),minimumCash:Math.min(...months.map(v=>v.cash)),minimumSpendable:Math.min(...months.map(v=>v.spendable))};
}
