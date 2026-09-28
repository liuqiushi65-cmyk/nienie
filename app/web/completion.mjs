export function completionThreadURL(session){
  return typeof session==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session)&&session.length===36
    ?`codex://threads/${session}`:null;
}
export class CompletionNotice {
  constructor({startedAt=Date.now()/1000,seen=[]}={}){
    this.startedAt=startedAt;this.seen=new Set(Array.isArray(seen)?seen.filter(k=>typeof k==='string').slice(-256):[]);
    this.queue=[];this.active=null;this.age=0;
  }
  get seenKeys(){return [...this.seen];}
  receive(events,now=Date.now()/1000){
    if(!Array.isArray(events))return;
    for(const e of events){
      if(!e||e.type!=='agent-turn-complete'||typeof e.session!=='string'||!e.session||typeof e.turn!=='string'||!e.turn||!Number.isFinite(e.at))continue;
      const key=JSON.stringify([e.session,e.turn]);if(this.seen.has(key))continue;
      this.seen.add(key);if(this.seen.size>256)this.seen.delete(this.seen.values().next().value);
      // 启动前的历史及过期事件只去重，不重新打扰。
      if(e.at<this.startedAt||now-e.at>120||e.at>now+5)continue;
      this.queue.push({session:e.session,turn:e.turn,title:String(e.title||'Codex 任务').slice(0,120),at:e.at});
    }
  }
  step(dt,held){
    if(!Number.isFinite(dt)||dt<0)return null;
    if(this.active){this.age+=dt;if(this.age>=12)this.dismiss();}
    if(!this.active&&!held&&this.queue.length){this.active=this.queue.shift();this.age=0;return this.active;}
    return null;
  }
  dismiss(clearQueue=false){this.active=null;this.age=0;if(clearQueue)this.queue=[];}
}
