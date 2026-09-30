// Pure candidate policy for the isolated economy lab. No production credentials or writes.
export const policy={humanWin:20,botWins:[3,6,10,15,20],quality:[[92,6],[83,4],[74,2]],maxUpsetBonus:20};
export function medal(score){if(score==null)return 'Unranked';return score>=92?'♚ King':score>=83?'♛ Queen':score>=74?'♜ Rook':score>=65?'♝ Bishop':score>=56?'♞ Knight':'♟ Pawn'}
export function reward({score,won=false,mode='human',botLevel=1,ownRank=75,opponentRank=75,teamSize=1}){
 if(!Number.isFinite(score)||score<0||score>100)throw Error('Score must be 0–100');
 if(!['human','bot','team','open'].includes(mode))throw Error('Unknown format');
 if(!Number.isInteger(teamSize)||teamSize<1||!Number.isInteger(botLevel)||botLevel<1||botLevel>5||![ownRank,opponentRank].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('Invalid reward inputs');
 const quality=policy.quality.find(([threshold])=>score>=threshold)?.[1]||0;
 const difficulty=mode==='bot'?policy.botWins[botLevel-1]:policy.humanWin+Math.min(policy.maxUpsetBonus,Math.floor(Math.max(0,opponentRank-ownRank)/5));
 const win=won?Math.floor(difficulty/(['team','open'].includes(mode)?teamSize:1)):0;
 return {win,quality,total:win+quality,medal:medal(score)};
}
function positive(n){if(!Number.isSafeInteger(n)||n<1||n>1000000)throw Error('Use a whole amount from 1 to 1,000,000')}
export function payout(bets,winner){
 const ids=new Set();for(const b of bets){positive(b.stake);if(ids.has(b.user))throw Error('Duplicate bettor');ids.add(b.user)}
 const wins=bets.filter(b=>b.side===winner),losses=bets.filter(b=>b.side!==winner),returns=Object.fromEntries(bets.map(b=>[b.user,b.stake]));
 if(!winner||!wins.length||!losses.length)return returns;
 const total=wins.reduce((n,b)=>n+b.stake,0);
 for(const loser of losses){const loss=Math.min(loser.stake,total);returns[loser.user]-=loss;
 const allocations=wins.map(b=>({user:b.user,value:Math.floor(loss*b.stake/total),remainder:(loss*b.stake)%total}));
 let residual=loss-allocations.reduce((n,a)=>n+a.value,0);
 allocations.sort((a,b)=>b.remainder-a.remainder||a.user.localeCompare(b.user));
 for(const a of allocations){if(residual>0){a.value++;residual--}returns[a.user]+=a.value}
 }
 return returns;
}
export class Economy {
 constructor(users){this.users=structuredClone(users);this.log=[];this.keys=new Map();this.bets=[];this.phase='lobby';this.countdownEnd=null;this.effects=true;this.betting=true;this.audience=false;this.mode='human';this.endAt=null;this.appealPending=false;this.initial=Object.fromEntries(users.map(u=>[u.id,u.balance]));this.next=0;this.orders=[];this.settled=false;this.historicalDebaters=new Set(users.filter(u=>u.role==='debater').map(u=>u.id))}
 user(id){const u=this.users.find(u=>u.id===id);if(!u)throw Error('Unknown account');return u}
 post(key,kind,changes){const signature=JSON.stringify({kind,changes});if(this.keys.has(key)){if(this.keys.get(key)!==signature)throw Error('Conflicting retry');return false}for(const [id,amount] of Object.entries(changes)){if(!Number.isSafeInteger(amount)||this.user(id).balance+amount<0)throw Error('Insufficient Aura or invalid amount')}
 for(const [id,amount] of Object.entries(changes))this.user(id).balance+=amount;
 this.keys.set(key,signature);this.log.push({key,kind,changes:structuredClone(changes),at:new Date().toISOString()});return true}
 gift(sender,recipient,amount=1,key='gift-'+this.next++){positive(amount);if(!this.effects)throw Error('Aura gifts are disabled');if(this.user(sender).role!=='spectator'||this.historicalDebaters.has(sender)||this.user(recipient).role!=='debater'||sender===recipient)throw Error('Only spectators may gift debaters');this.post(key,'gift',{[sender]:-amount,[recipient]:amount})}
 bet(user,side,amount,now=Date.now()) {positive(amount);if(this.settled||!this.betting||this.audience||this.mode==='bot'||!['lobby','countdown'].includes(this.phase)||(this.countdownEnd!==null&&now>=this.countdownEnd))throw Error('Aura farming is closed');if(!['PRO','CON'].includes(side))throw Error('Select PRO or CON');if(this.user(user).host||this.user(user).role!=='spectator'||this.historicalDebaters.has(user))throw Error('Debaters and the creator cannot stake');if(this.users.filter(u=>u.present&&u.role==='spectator').length<2&&!this.bets.some(b=>b.user!==user))throw Error('Two spectators must be present to open the pool');let b=this.bets.find(b=>b.user===user);if(b&&b.side!==side)throw Error('Your chosen side is locked');if((b?.stake||0)+amount>1000000)throw Error('Stake cap exceeded');this.post('bet-'+this.next++,'reserve stake',{[user]:-amount});if(b)b.stake+=amount;else this.bets.push({user,side,stake:amount})}
 joinDebater(id){this.refund(id);this.user(id).role='debater';this.historicalDebaters.add(id)}
 refund(id){const b=this.bets.find(b=>b.user===id);if(!b)return;this.post('refund-'+this.next++,'automatic refund',{[id]:b.stake});this.bets=this.bets.filter(x=>x!==b)}
 control(id,field,value){const u=this.user(id);if(!u.host||!u.admin)throw Error('Only the admin creator may change this setting');if(!['effects','betting'].includes(field))throw Error('Unknown control');this[field]=!!value;if(field==='betting'&&!value)for(const b of [...this.bets])this.refund(b.user)}
 start(now=Date.now()){if(this.phase!=='lobby')throw Error('Already started');this.phase=this.bets.length?'countdown':'active';if(this.phase==='countdown')this.countdownEnd=now+30000}
 tick(now=Date.now()){if(this.phase==='countdown'&&now>=this.countdownEnd)this.phase='active'}
 end(now=Date.now()){this.tick(now);if(this.phase!=='active')throw Error('Debate must start first');this.phase='ended';this.endAt=now}
 settle(winner,now=Date.now()){if(this.settled)return;if(this.phase!=='ended'||now<this.endAt+7*86400000||this.appealPending)throw Error('Wait for the appeal deadline and pending appeals');const returns=payout(this.bets,winner);this.post('settlement','settlement',returns);this.bets=[];this.settled=true}
 cancel(){for(const b of [...this.bets])this.refund(b.user);this.phase='canceled';this.settled=true}
 award(id,resultId,inputs){const r=reward(inputs);this.post('reward-'+resultId+'-'+id,'candidate reward',{[id]:r.total});return r}
 purchase(id,item,cost,request){positive(cost);if(this.orders.some(o=>o.request===request)){const old=this.orders.find(o=>o.request===request);if(old.user!==id||old.item!==item||old.cost!==cost)throw Error('Conflicting order');return old}this.post('order-'+request,'reserve demo redemption',{[id]:-cost});const order={request,user:id,item,cost,status:'Demo pending review'};this.orders.push(order);return order}
 audit(){return this.users.map(u=>{const expected=this.initial[u.id]+this.log.reduce((n,e)=>n+(e.changes[u.id]||0),0);return {user:u.id,actual:u.balance,expected,ok:expected===u.balance}})}
}
