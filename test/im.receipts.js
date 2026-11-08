// Deterministic browser checks. No messages, calls, or external API mutations.
(async function () {
    let checks=0; const assert=(v,s)=>{if(!v)throw new Error(s);checks++}, sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const calls=[], mutations=[], host=document.querySelector('#host'), rows=document.querySelector('#rows');
    const directory = odd.IM.UI.createView(null,{kind:'Contacts',container:host,skin:{brand:'im',theme:'dark'}});
    directory.add('friend','user','联系人','',{target:{type:'user',id:'friend'}});assert(!!host.querySelector('.im-contact'),'directory works without realtime connection');directory.destroy();
    const data=Array.from({length:4},(_,i)=>({id:String(i),sequence:{high:0,low:i+1},reliable:true,incoming:false,mine:true,text:'消息 '+(i+1),state:'saved'}));
    let active=true, fail=false;
    const messages=new odd.IM.UI.components.Messages('fixture'); rows.appendChild(messages.element());
    const im={historyCapabilities:()=>({publicRead:true}),receipt:async(...args)=>mutations.push(args),
        receipts:async(id,mode,args)=>{calls.push({mode,args});if(fail)throw new Error('offline');if(mode==='policy')return {enabled:false,publicReceipts:true,historyDays:30};
          if(mode==='summary')return {records:data.slice(0,3).map((x,i)=>({sequence:x.sequence,read:i===2?0:17,unknown:i===0?14:0,released:0,state:'retained'}))};
          const offset=args.cursor?32:0;return {records:Array.from({length:32},(_,i)=>({userId:'person-'+(offset+i)})),snapshotRevision:{high:0,low:1},nextCursor:offset?null:new Uint8Array([1]),hasMore:offset===0};}};
    const reading=new odd.IM.UI.Reading(im,{active:()=>active,host:()=>host,visible:()=>data,counts:(id,v)=>messages.receipt(id,v),names:async ids=>ids.map(id=>({id,name:'成员 '+id.split('-')[1]}))});
    await reading.attach({id:'test',room:false,readOnly:false});
    data.forEach(row=>row.receipts=anchor=>reading.inspect(row,anchor));messages.update(data);await reading.refresh();
    const badges=[...rows.querySelectorAll('.im-message-receipts')];
    assert(badges[0].textContent==='17','count before bubble');assert(!!badges[1].querySelector('svg'),'all read uses check');assert(badges[2].textContent==='0'&&!badges[2].querySelector('svg'),'zero is not all read');assert(badges[3].hidden,'unknown count is hidden');
    assert(badges[0].parentElement.className==='im-message-body'&&badges[0].nextElementSibling.className==='im-message-bubble','receipt before bubble');
    assert(!rows.textContent.includes('saved'),'no internal state labels');
    await reading.inspect(data[0],badges[0]);
    assert(!reading.element().hidden,'opens members');assert(!reading.element().querySelector('table,form'),'no statistics form');assert(calls.filter(c=>c.mode==='detail').every(c=>c.args.category==='read'),'read members only');
    assert(reading.element().querySelectorAll('li').length<=18,'bounded rendered member rows');assert(reading.element().textContent.includes('成员 0'),'resolved member names');
    const panel=reading.element().getBoundingClientRect();assert(panel.left>=0&&panel.right<=innerWidth,'popover fits viewport');
    const scroller=reading.element().querySelector('.im-reading-members');scroller.scrollTop=scroller.scrollHeight;scroller.dispatchEvent(new Event('scroll'));await sleep(50);
    assert(calls.filter(c=>c.mode==='detail').length===2,'scroll pages read members');assert(reading.element().querySelectorAll('li').length<=18,'paging remains virtual');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));assert(reading.element().hidden&&document.activeElement===badges[0],'escape closes and restores focus');
    assert(mutations.length===0,'reading details never enables public receipts');
    reading.destroy();messages.destroy();
    const device='receipt-test-'+Date.now(),db=new odd.IM.IndexedDB('app','user',device);await db.open();
    const display={target:{type:'user',id:'friend'},name:'联系人',avatar:''};
    await db.destination('conversation',display);assert((await db.directory(null,32)).length===0,'lookup alone does not create chat');
    await db.destination('conversation',display,true);assert((await db.directory(null,32)).length===1,'explicit send action creates conversation entry');
    await db.saveRead('conversation',{high:0,low:7});await db.destination('conversation',{...display,name:'新备注'},true);
    assert((await db.directory(null,32)).length===1,'opening again does not duplicate chat');assert((await db.projection('conversation')).readSequence.low===7,'opening preserves read state');
    db.close();await new Promise((r,j)=>{const q=indexedDB.deleteDatabase('odd.im.v1:'+JSON.stringify(['app','user',device]));q.onsuccess=r;q.onerror=j;});
    window.testResult={passed:true,checks};
})().catch(error=>window.testResult={passed:false,error:error.stack});
