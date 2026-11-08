// Real renderer, deterministic in-memory service. Never sends network messages.
(async function () {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    function assert(value, label) { if (!value) throw new Error(label); }
    const receipts = [], reads = [], queries = [], events = new Map();
    let enabled = false, active = true, fail = false;
    const row = n => ({ id: String(n), incoming: true, reliable: true, messageId: new Uint8Array([n]),
        sequence: {high:0,low:n}, high:0,low:n, timestamp:n, from:'Friend', text:'Message '+n, state:'saved' });
    const store = {history:async(id,before)=>Array.from({length:32},(_,i)=>row(i+1+(before?0:32))),
        outgoing:async()=>[],outboxEntry:async()=>null,projection:async()=>({readSequence:{high:0,low:0}}),gaps:async()=>[],
        destination:async()=>null,saveRead:async()=>{},eventHistory:async()=>[]};
    const im = {addEventListener:(n,fn)=>{if(!events.has(n))events.set(n,new Set());events.get(n).add(fn)},
        removeEventListener:(n,fn)=>events.get(n)?.delete(fn),dispatchEvent:()=>{},connected:()=>true,
        storage:()=>store,userId:()=> 'me',messageDelivery:()=> 'reliable',
        resolve:async()=>({conversationId:'test',partition:0,partitions:1}),refresh:async()=>{},
        subscribe:async()=>{},unsubscribe:async()=>{},read:async(id,mid,seq)=>reads.push(seq.low),
        historyCapabilities:()=>({history:true,publicRead:true}),
        history:async(id,cursor)=>{queries.push(cursor);await sleep(25);if(fail)throw new Error('offline');
            return {records:Array.from({length:32},(_,i)=>({kind:'message',packet:row(i+1+(cursor?0:32))})),nextCursor:'older',hasMore:!cursor}},
        receipts:async()=>({enabled,publicReceipts:true,historyDays:30}),
        receipt:async(id,mode,options)=>{if(mode==='enable')enabled=true;if(mode==='disable')enabled=false;if(mode==='read')receipts.push(options.messageIds.map(id=>id[0]))},
    };
    odd.IM.UI.History.message = record => ({...(record.packet||record)});
    odd.IM.UI.History.compare = (a,b)=>a.timestamp-b.timestamp;
    const chat=odd.IM.UI.createView(im,{kind:'Conversation',container:document.querySelector('#chat'),isVisible:()=>active,skin:{brand:'im',theme:'dark'}});
    await chat.open({type:'user',id:'friend',name:'Friend'});
    const list=chat.components.messages.element();
    await sleep(650);
    assert(queries.length===1,'open fetches one history page');
    assert(receipts.length===0,'receipts default off');
    assert(reads.length===1 && reads[0]===64,'visible latest messages mark own progress');
    assert(!document.body.innerText.includes('云历史与阅读记录'),'no developer controls');
    assert(document.querySelector('.im-reading').hidden,'receipt panel hidden by default');
    list.scrollTop=5;const first=chat.components.messages.visible()[0].id;
    await sleep(700);
    assert(queries.length===2,'scroll top pages automatically once');
    assert(chat.components.messages.data().length===64,'older messages prepend');
    assert(chat.components.messages.visible()[0].id===first,'prepend preserves visible anchor');
    assert(receipts.length===0,'scroll does not opt in');
    active=false; await chat.readingPreferences(true); await sleep(650);
    assert(receipts.length===0,'settings overlay does not report hidden conversation');
    active=true;window.dispatchEvent(new Event('focus'));await sleep(650);
    assert(receipts.length===1 && receipts[0].length<32,'only viewport messages get opted-in receipts');
    window.dispatchEvent(new Event('focus'));await sleep(650);
    assert(receipts.length===1,'visible receipts deduplicate');
    await chat.readingPreferences(false);list.scrollTop=list.scrollHeight;await sleep(650);
    assert(receipts.length===1,'privacy off stops new receipts');
    fail=true;await chat.open({type:'user',id:'other',name:'Other'});
    assert(document.body.innerText.includes('历史消息暂时无法加载'),'history failure has concise status');
    assert(!document.querySelector('.im-history-tools').hidden,'failure exposes retry');
    const before=queries.length;await sleep(800);assert(queries.length===before,'failure does not retry in a loop');
    chat.destroy();const count=reads.length;window.dispatchEvent(new Event('focus'));await sleep(600);
    assert(reads.length===count,'destroy removes visibility listeners');
    window.testResult={passed:true,checks:13};
})().catch(error=>{window.testResult={passed:false,error:error.stack};});
