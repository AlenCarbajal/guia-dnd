/* Armador de personajes D&D 2024 — motor, builder y hoja.
   Datos: window.SRD (data.js). Homebrew por usuario: HB. Personajes: CH. */
(function(){
"use strict";
const SRD=window.SRD;
const AB=["str","dex","con","int","wis","cha"];
const ABN={str:"STR",dex:"DEX",con:"CON",int:"INT",wis:"WIS",cha:"CHA"};
const ABF={str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
const FULL=["bard","cleric","druid","sorcerer","wizard"],HALF=["paladin","ranger"];
const SIZES=["Tiny","Small","Medium","Large"];
const HBTYPES={spells:"Spells",feats:"Feats",species:"Especies",backgrounds:"Backgrounds",classes:"Clases",subclasses:"Subclases"};
const RES={rage_count:"Rage",rage_damage_bonus:"Rage damage",bardic_inspiration_die:"Bardic Inspiration (dado)",channel_divinity_charges:"Channel Divinity",
  wild_shape_uses:"Wild Shape",second_wind_uses:"Second Wind",martial_arts_die:"Martial Arts (dado)",focus_points:"Focus Points",unarmored_movement_bonus:"Unarmored Movement (ft)",
  favored_enemies:"Favored Enemy",sneak_attack:"Sneak Attack",sorcery_points:"Sorcery Points",eldritch_invocations:"Eldritch Invocations",weapon_mastery:"Weapon Mastery (armas)"};

/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const md=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\*(.+?)\*/g,"<i>$1</i>").replace(/\n+/g,"<br>");
const sg=n=>(n>=0?"+":"")+n;
const mod=s=>Math.floor((s-10)/2);
const uid=()=>Math.random().toString(36).slice(2,10);
const clone=o=>JSON.parse(JSON.stringify(o));
const opt=(v,l,sel)=>`<option value="${esc(v)}"${sel?" selected":""}>${esc(l)}</option>`;
const first=s=>{s=String(s||"").replace(/\*\*/g,"");const i=s.search(/[.!?](\s|$)/);return i>0&&i<180?s.slice(0,i+1):s.slice(0,160)+(s.length>160?"…":"")};
function getP(o,p){return p.split(".").reduce((a,k)=>a==null?a:a[k],o)}
function setP(o,p,v){const ks=p.split(".");let a=o;for(let i=0;i<ks.length-1;i++){const k=ks[i];if(a[k]==null||typeof a[k]!=="object")a[k]=/^\d+$/.test(ks[i+1])?[]:{};a=a[k]}
  const l=ks[ks.length-1];if(v===undefined)delete a[l];else a[l]=v}

/* ---------- state ---------- */
let CH={},HB={},cur=null,view="build",step="basicos",hbType="spells",hbEdit=null,spQ="",spLv="",spOnly=true,spSrc="";
function blankHB(){return {spells:{},feats:{},species:{},backgrounds:{},classes:{},subclasses:{}}}
HB=blankHB();
function lib(t){return Object.assign({},SRD[t]||{},HB[t]||{})}
function newChar(){return {id:"c_"+uid(),v:1,info:{name:"Nuevo personaje",player:"",alignment:"",xp:0,languages:"Common",appearance:"",personality:"",backstory:"",notes:""},
  species:{id:"human",lin:"",castAb:"cha",size:""},bg:{id:"soldier",mode:"21",a:"str",b:"con",c:"dex",feat:""},classes:[{id:"fighter",lv:1,sub:""}],
  base:{str:15,dex:14,con:13,int:12,wis:10,cha:8},imp:{},fs:{},extraFeats:[],skills:{athletics:1,intimidation:1},profs:{armor:"",weapons:"",tools:"",other:""},
  spells:[],armor:"none",shield:false,attacks:[{w:"longsword"}],equipment:"",coins:{cp:0,sp:0,ep:0,gp:0,pp:0},features:[],resources:[],mods:[],ov:{},hpMode:"avg",hpRolls:{},hpCur:"",hpTemp:"",insp:false}}
const C=()=>CH[cur];

/* ---------- storage ---------- */
const LKEY="dnd-armador-v1";
const Store={mode:"local",col:null,timers:{},
  local(){try{return JSON.parse(localStorage.getItem(LKEY)||"null")}catch(e){return null}},
  saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify({CH,HB,cur}))}catch(e){}},
  async init(){
    if(!(window.claude&&window.claude.use))return false;
    try{const db=await claude.use("db");if(!db)return false;const user=await claude.use("user");const id=user&&await user.id();if(!id)return false;
      this.col=db.collection("data/users/"+id);this.mode="cloud";return true}catch(e){return false}},
  async loadCloud(){const snap=await this.col.get();const ch={};let hb=null;
    snap.docs.forEach(d=>{const x=d.data();try{if(d.id==="homebrew")hb=JSON.parse(x.json);else if(d.id.startsWith("c_"))ch[d.id]=JSON.parse(x.json)}catch(e){}});return {ch,hb}},
  put(id,obj){this.saveLocal();if(this.mode!=="cloud")return;clearTimeout(this.timers[id]);status("Guardando…");
    this.timers[id]=setTimeout(async()=>{try{await this.col.doc(id).set({json:JSON.stringify(obj),name:obj.info?obj.info.name:"homebrew",updated:Date.now()});status("Guardado en tu cuenta")}
      catch(e){status(e&&e.code==="quota_exceeded"?"Sin espacio en tu cuenta":"No se pudo guardar en tu cuenta; quedó en este navegador")}},1000)},
  async del(id){this.saveLocal();if(this.mode==="cloud")try{await this.col.doc(id).delete()}catch(e){}}
};
function status(t){const e=$("#sync");if(e)e.textContent=t}
const saveChar=()=>{if(C())Store.put(cur,C())};
const saveHB=()=>Store.put("homebrew",HB);

/* ---------- engine ---------- */
function collectMods(c){
  const M=[];const add=(list,src)=>(list||[]).forEach(m=>{if(m&&m.on!==false&&m.t)M.push(Object.assign({src},m))});
  add(c.mods,"Regla de la casa");
  const F=lib("feats"),SP=lib("species"),CL=lib("classes"),SC=lib("subclasses"),BG=lib("backgrounds");
  featList(c).forEach(f=>{const d=F[f.id];if(d)add(d.mods,"Feat: "+d.n)});
  const sp=SP[c.species.id];if(sp)add(sp.mods,"Especie: "+sp.n);
  const bg=BG[c.bg.id];if(bg)add(bg.mods,"Background: "+bg.n);
  c.classes.forEach(k=>{const d=CL[k.id];if(d)add(d.mods,"Clase: "+d.n);const s=SC[k.sub];if(s)(s.mods||[]).forEach(m=>{if(!m.lv||k.lv>=m.lv)add([m],"Subclase: "+s.n)})});
  c.features.forEach(f=>add(f.mods,"Rasgo: "+(f.n||"custom")));
  return M}
function impSlots(c){
  const CL=lib("classes"),out=[];
  c.classes.forEach(k=>{const d=CL[k.id];if(!d)return;
    if(d.lv&&d.lv.length)d.lv.slice(0,k.lv).forEach((L,i)=>L.f.forEach(f=>{
      if(/-ability-score-improvement$/.test(f))out.push({key:k.id+"-"+(i+1),cls:d.n,lv:i+1,kind:"general"});
      else if(/-epic-boon$/.test(f))out.push({key:k.id+"-"+(i+1),cls:d.n,lv:i+1,kind:"epic-boon"});
      else if(/-fighting-style$/.test(f))out.push({key:k.id+"-fs-"+(i+1),cls:d.n,lv:i+1,kind:"fighting-style"})}));
    else String(d.asi||"4,8,12,16,19").split(/[,\s]+/).map(Number).filter(n=>n&&n<=k.lv).forEach(n=>out.push({key:k.id+"-"+n,cls:d.n,lv:n,kind:n>=19?"epic-boon":"general"}))});
  return out}
function featList(c){
  const F=lib("feats"),BG=lib("backgrounds"),out=[];
  const bgf=c.bg.feat||(BG[c.bg.id]||{}).feat;if(bgf)out.push({id:bgf,src:"Background",note:c.bg.feat?"":(BG[c.bg.id]||{}).fn||""});
  impSlots(c).forEach(s=>{const p=c.imp[s.key];const id=p&&p.feat||(s.kind==="general"?"ability-score-improvement":"");if(id)out.push({id,src:s.cls+" "+s.lv,slot:s.key,kind:s.kind})});
  c.extraFeats.forEach((e,i)=>{if(e.id)out.push({id:e.id,src:e.src||"Extra",note:e.note||"",x:i})});
  return out.filter(f=>F[f.id])}
function profList(c){
  const CL=lib("classes"),BG=lib("backgrounds");const P=new Set();
  c.classes.forEach((k,i)=>{const d=CL[k.id];if(!d)return;(Array.isArray(d.prof)?d.prof:String(d.prof||"").split(",")).forEach(x=>{x=String(x).trim();if(x&&(i===0||!/Armor|armor/.test(x)||/Light/.test(x)))P.add(x.replace(/^Tool: /,""))})});
  const bg=BG[c.bg.id];if(bg)(Array.isArray(bg.tools)?bg.tools:String(bg.tools||"").split(",")).forEach(x=>{x=String(x).trim();if(x)P.add(x)});
  return [...P]}

function compute(c){
  const K={warn:[],B:{},mods:collectMods(c)};const M=K.mods;
  const CL=lib("classes"),SC=lib("subclasses"),SP=lib("species"),BG=lib("backgrounds"),F=lib("feats"),S=lib("spells");
  const ap=(key,base,label)=>{let v=base,b=[[label,base]];
    M.filter(m=>m.t===key).forEach(m=>{const x=+m.v||0;
      if(m.op==="set"){v=x;b=[[m.src+(m.note?" ("+m.note+")":"")+" fija",x]]}
      else if(m.op==="min"){if(v<x){v=x;b.push([m.src+" mínimo",x])}}
      else if(m.op==="max"){if(v>x){v=x;b.push([m.src+" máximo",x])}}
      else{v+=x;b.push([m.src+(m.note?" ("+m.note+")":""),x])}});
    if(c.ov[key]!==undefined&&c.ov[key]!==""){v=+c.ov[key];b.push(["Override manual","="+v])}
    K.B[key]=b;return v};
  const has=key=>M.some(m=>m.t===key);
  /* levels */
  K.cls=c.classes.filter(k=>CL[k.id]).map(k=>({...k,d:CL[k.id],s:SC[k.sub]}));
  K.TL=Math.max(1,K.cls.reduce((a,k)=>a+(+k.lv||0),0));
  const lvOf=id=>{const k=K.cls.find(k=>k.id===id);return k?+k.lv:0};
  /* abilities */
  const bg=BG[c.bg.id],sp=SP[c.species.id];
  const bgb={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  if(c.bg.mode==="21"){bgb[c.bg.a]+=2;bgb[c.bg.b]+=1;if(c.bg.a===c.bg.b)K.warn.push("Background: el +2 y el +1 van a atributos distintos.")}
  else if(c.bg.mode==="111"){[c.bg.a,c.bg.b,c.bg.c].forEach(a=>bgb[a]+=1);if(new Set([c.bg.a,c.bg.b,c.bg.c]).size<3)K.warn.push("Background: los tres +1 van a atributos distintos.")}
  if(bg&&bg.ab&&c.bg.mode!=="0"){const al=bg.ab;[c.bg.a,c.bg.b].concat(c.bg.mode==="111"?[c.bg.c]:[]).forEach(a=>{if(!al.includes(a))K.warn.push(`Background ${bg.n}: ${ABN[a]} no está entre ${al.map(x=>ABN[x]).join("/")}.`)})}
  const imp={str:0,dex:0,con:0,int:0,wis:0,cha:0},boon={str:0,dex:0,con:0,int:0,wis:0,cha:0};
  impSlots(c).forEach(s=>{const p=c.imp[s.key]||{};const id=p.feat||(s.kind==="general"?"ability-score-improvement":"");if(!id){K.warn.push(`${s.cls} ${s.lv}: elegí ${s.kind==="epic-boon"?"una Epic Boon":"un Fighting Style"}.`);return}
    if(s.kind==="fighting-style")return;
    if(id==="ability-score-improvement"){if(p.a)imp[p.a]+=1;if(p.b)imp[p.b]+=1;if(!p.a||!p.b)K.warn.push(`${s.cls} ${s.lv}: completá la Ability Score Improvement.`)}
    else if(p.a){(F[id]&&F[id].t==="epic-boon"?boon:imp)[p.a]+=1}});
  c.extraFeats.forEach(e=>{if(e.a)imp[e.a]+=1});
  K.ab={};K.mod={};
  AB.forEach(a=>{const raw=(+c.base[a]||0)+bgb[a]+imp[a];const cap=ap("cap:"+a,20,"Tope");let v=Math.min(raw,cap);if(raw>cap)K.warn.push(`${ABN[a]} pasa el tope de ${cap}; se pierden ${raw-cap}.`);
    v=Math.min(v+boon[a],Math.max(cap,30));
    const b0=[["Base",+c.base[a]||0]];if(bgb[a])b0.push(["Background",bgb[a]]);if(imp[a])b0.push(["Feats/ASI",imp[a]]);if(boon[a])b0.push(["Epic Boon",boon[a]]);
    K.ab[a]=ap("ab:"+a,v,"Total");K.B["ab:"+a]=b0.concat(K.B["ab:"+a].slice(1));K.mod[a]=mod(K.ab[a])});
  /* PB */
  K.pb=ap("pb",2+Math.floor((K.TL-1)/4),"Por nivel "+K.TL);
  /* saves */
  const sp0=K.cls[0];const saveP=new Set(sp0?sp0.d.saves||[]:[]);
  M.filter(m=>m.t.startsWith("saveProf:")&&(+m.v||1)).forEach(m=>saveP.add(m.t.split(":")[1]));
  K.saveP=saveP;K.save={};
  AB.forEach(a=>{let v=K.mod[a]+(saveP.has(a)?K.pb:0);const all=M.filter(m=>m.t==="saves"&&m.op!=="set").reduce((s,m)=>s+(+m.v||0),0);K.save[a]=ap("save:"+a,v+all,"Mod"+(saveP.has(a)?" + PB":"")+(all?" + todas":""))});
  /* skills */
  K.sk={};K.skP={};
  SRD.skills.forEach(([id,n,a])=>{let p=+(c.skills[id]||0);M.filter(m=>m.t==="skillProf:"+id).forEach(m=>p=Math.max(p,+m.v||1));K.skP[id]=p;
    K.sk[id]=ap("skill:"+id,K.mod[a]+p*K.pb,ABN[a]+(p?(p>1?" + 2×PB":" + PB"):""))});
  K.pp=ap("pp",10+K.sk.perception,"10 + Perception");
  /* feats */
  K.feats=featList(c);const hasFeat=id=>K.feats.some(f=>f.id===id);
  /* initiative */
  K.init=ap("init",K.mod.dex+(hasFeat("alert")?K.pb:0),"DEX"+(hasFeat("alert")?" + PB (Alert)":""));
  /* species */
  const lin=sp&&c.species.lin&&SRD.lineages[c.species.lin]&&SRD.lineages[c.species.lin].sp===c.species.id?SRD.lineages[c.species.lin]:null;
  const trIds=(sp&&sp.tr||[]).map(t=>[t,1]).concat(lin?lin.tr:[]).filter(([t,l])=>l<=K.TL).map(([t])=>t);
  K.size=c.species.size||(sp?String(sp.size||"Medium").split(/ or |,/)[0].trim():"Medium");
  let dv=0;trIds.forEach(t=>{const m=/^darkvision-(\d+)/.exec(t);if(m)dv=Math.max(dv,+m[1])});if(sp&&sp.dv)dv=Math.max(dv,+sp.dv);
  K.dv=ap("dv",dv,"Especie");
  /* armor & AC */
  const AR=SRD.armor,arm=AR[c.armor];const profs=profList(c);K.profs=profs;
  const hasP=re=>profs.some(p=>re.test(p));
  let ac=10+K.mod.dex,acl="10 + DEX";
  if(arm){ac=arm.b+(arm.dex?(arm.max!=null?Math.min(K.mod.dex,arm.max):K.mod.dex):0);acl=arm.n;
    if(!hasP(/all armor/i)&&!hasP(new RegExp(arm.t+" armor","i")))K.warn.push(`No tenés training con ${arm.t} armor (${arm.n}).`);
    if(arm.str&&K.ab.str<arm.str)K.warn.push(`${arm.n} pide STR ${arm.str}: −10 ft de speed.`)}
  else{if(lvOf("barbarian")){const v=10+K.mod.dex+K.mod.con;if(v>ac){ac=v;acl="Unarmored Defense (DEX + CON)"}}
    if(lvOf("monk")&&!c.shield){const v=10+K.mod.dex+K.mod.wis;if(v>ac){ac=v;acl="Unarmored Defense (DEX + WIS)"}}}
  if(arm&&hasFeat("defense"))ac+=1;
  if(c.shield){ac+=2;acl+=" + Shield";if(!hasP(/shield/i))K.warn.push("No tenés training con shields.")}
  K.ac=ap("ac",ac,acl);
  /* speed */
  let spd=sp?+sp.speed||30:30;if(trIds.includes("wood-elf-speed-increase"))spd+=5;
  const monk=K.cls.find(k=>k.id==="monk");if(monk&&!arm&&!c.shield){const x=(monk.d.lv[monk.lv-1]||{}).x||{};spd+=x.unarmored_movement_bonus||0}
  if(arm&&arm.str&&K.ab.str<arm.str)spd-=10;
  K.speed=ap("speed",spd,"Especie");
  /* HP */
  let hp=0,hpl=[];
  K.cls.forEach((k,ci)=>{const hd=+k.d.hd||8;for(let l=1;l<=k.lv;l++){let v;if(ci===0&&l===1)v=hd;else if(c.hpMode==="roll"&&c.hpRolls[k.id+"-"+l])v=+c.hpRolls[k.id+"-"+l];else v=hd/2+1;hp+=v}});
  hpl.push(["Dados de golpe",hp]);
  const conHp=K.mod.con*K.TL;hp+=conHp;hpl.push(["CON × nivel",conHp]);
  if(trIds.includes("dwarven-toughness")){hp+=K.TL;hpl.push(["Dwarven Toughness",K.TL])}
  const perLv=M.filter(m=>m.t==="hpLv").reduce((s,m)=>s+(+m.v||0),0);if(perLv){hp+=perLv*K.TL;hpl.push(["Por nivel (mods)",perLv*K.TL])}
  K.hp=ap("hp",hp,"Base");K.B.hp=hpl.concat(K.B.hp.slice(1));
  K.hd=K.cls.map(k=>`${k.lv}d${k.d.hd}`).join(" + ");
  /* spellcasting */
  K.casters=[];let casterLv=0,nCasters=0,pact=null;
  const fullTable=SRD.classes.wizard.lv;
  K.cls.forEach(k=>{const d=k.d;const sa=d.sa;if(!sa&&!d.caster)return;const L=d.lv&&d.lv[k.lv-1];
    let type=d.caster||(k.id==="warlock"?"pact":FULL.includes(k.id)?"full":HALF.includes(k.id)?"half":"full");
    if(!d.lv||!d.lv.length){if(type==="none")return}
    const sc=L&&L.sc;const ab=sa||d.caster_ab||"cha";
    const entry={id:k.id,n:d.n,ab,type,cantrips:sc?sc.c:0,prepared:sc?sc.p:0,lv:k.lv};
    entry.cantrips=ap("cantrips:"+k.id,entry.cantrips,"Tabla");entry.prepared=ap("prepared:"+k.id,entry.prepared,"Tabla");
    entry.dc=ap("dc:"+k.id,8+K.pb+K.mod[ab],"8 + PB + "+ABN[ab]);entry.atk=ap("satk:"+k.id,K.pb+K.mod[ab],"PB + "+ABN[ab]);
    const gdc=M.filter(m=>m.t==="dc"&&m.op!=="set").reduce((s,m)=>s+(+m.v||0),0),gat=M.filter(m=>m.t==="satk"&&m.op!=="set").reduce((s,m)=>s+(+m.v||0),0);
    entry.dc+=gdc;entry.atk+=gat;
    if(type==="pact"){const s=sc?sc.s:[];let n=0,lvl=0;s.forEach((x,i)=>{if(x){n=x;lvl=i+1}});
      if(!sc){lvl=Math.min(5,Math.ceil(k.lv/2));n=k.lv>=17?4:k.lv>=11?3:k.lv>=2?2:1}
      pact={n:ap("pact",n,"Tabla Pact Magic"),lv:ap("pactLv",lvl,"Tabla Pact Magic"),cls:d.n}}
    else{nCasters++;casterLv+=type==="full"?k.lv:type==="half"?Math.ceil(k.lv/2):type==="third"?Math.floor(k.lv/3):0;entry.table=sc?sc.s:null}
    K.casters.push(entry)});
  let slots=[0,0,0,0,0,0,0,0,0];
  if(nCasters===1){const e=K.casters.find(e=>e.type!=="pact");slots=e.table?e.table.slice():(casterLv?fullTable[Math.max(0,casterLv-1)].sc.s.slice():slots)}
  else if(nCasters>1&&casterLv)slots=fullTable[Math.min(20,casterLv)-1].sc.s.slice();
  K.slots=slots.map((n,i)=>ap("slot:"+(i+1),n,"Tabla"));K.pact=pact;
  /* spells list (chosen + always) */
  const SPL=[];const seen=new Set();
  const addS=(id,o)=>{if(!S[id])return;const k=id+"|"+o.src;if(seen.has(k))return;seen.add(k);SPL.push(Object.assign({id,d:S[id]},o))};
  if(lin)lin.tr.forEach(([t,l])=>{if(l<=K.TL&&t.startsWith("lineage-spell-")){const id=t.slice(14);addS(id,{src:"Especie",always:true,prep:true,note:S[id]&&S[id].l?"1/Long Rest sin slot":"",ab:c.species.castAb})}});
  K.cls.forEach(k=>{const s=k.s;if(s&&s.sp)s.sp.forEach(r=>{if(k.lv>=(+r.lv||1))String(r.ids||"").split(/[,\s]+/).filter(Boolean).forEach(id=>addS(id,{src:k.id,always:true,prep:true,note:"Subclase"}))})});
  c.spells.forEach((x,i)=>addS(x.id,{src:x.src||"",prep:x.prep!==false,always:!!x.always,note:x.note||"",i}));
  SPL.sort((a,b)=>a.d.l-b.d.l||a.d.n.localeCompare(b.d.n));K.spells=SPL;
  K.casters.forEach(e=>{const mine=SPL.filter(s=>s.src===e.id&&!s.always);const nc=mine.filter(s=>s.d.l===0).length,np=mine.filter(s=>s.d.l>0&&s.prep).length;
    e.nc=nc;e.np=np;if(nc>e.cantrips)K.warn.push(`${e.n}: ${nc} cantrips de ${e.cantrips}.`);if(np>e.prepared)K.warn.push(`${e.n}: ${np} spells prepared de ${e.prepared}.`)});
  /* features */
  const FE=[];
  K.cls.forEach(k=>{const d=k.d;
    if(d.lv&&d.lv.length)d.lv.slice(0,k.lv).forEach((L,i)=>L.f.forEach(f=>{if(/-(ability-score-improvement|epic-boon|subclass)$/.test(f))return;const x=SRD.features[f];if(x)FE.push({n:x.n,src:d.n+" "+(i+1),d:x.d,g:"class"})}));
    (d.fx||[]).forEach(f=>{if(k.lv>=(+f.lv||1))FE.push({n:f.n,src:d.n+" "+f.lv,d:f.d,g:"class"})});
    if(k.s)(k.s.f||[]).forEach(f=>{if(k.lv>=(+f.lv||1))FE.push({n:f.n,src:k.s.n+" "+f.lv,d:f.d,g:"class"})});
    const x=(d.lv&&d.lv[k.lv-1]||{}).x||{};
    K.res=K.res||[];Object.entries(x).forEach(([key,v])=>{if(!RES[key])return;let val=v;if(v&&typeof v==="object")val=v.dice_count?`${v.dice_count}d${v.dice_value}`:JSON.stringify(v);
      if(key==="bardic_inspiration_die")val=`d${v} · ${Math.max(1,K.mod.cha)} usos`;if(key==="martial_arts_die")val="d"+v;
      K.res.push({n:RES[key],v:val,src:d.n})})});
  K.res=(K.res||[]).concat(c.resources.filter(r=>r.n).map(r=>({n:r.n,v:r.max+(r.rec?" · "+r.rec:""),src:"Custom"})));
  const TR=Object.assign({},SRD.traits);
  trIds.forEach(t=>{if(t.startsWith("lineage-spell-")||/^darkvision-/.test(t)&&trIds.some(o=>o!==t&&/^darkvision-/.test(o)&&+o.split("-")[1]>+t.split("-")[1]))return;const x=TR[t];if(x)FE.push({n:x.n,src:sp?sp.n:"Especie",d:x.d,g:"species"})});
  if(sp&&sp.trx)sp.trx.forEach(t=>FE.push({n:t.n,src:sp.n,d:t.d,g:"species"}));
  if(lin)FE.push({n:lin.n,src:sp.n,d:"",g:"species",short:true});
  Object.entries(c.fs||{}).forEach(()=>{});
  K.feats.forEach(f=>{const d=F[f.id];FE.push({n:d.n+(f.note?" ("+f.note+")":""),src:f.src,d:d.d,g:"feat"})});
  c.features.forEach(f=>{if(f.n)FE.push({n:f.n,src:f.src||"Custom",d:f.d||"",g:f.g||"class",uses:f.uses})});
  K.fe=FE;
  /* attacks */
  const W=SRD.weapons;K.atk=[];
  const atkAll=M.filter(m=>m.t==="atk"&&m.op!=="set").reduce((s,m)=>s+(+m.v||0),0),dmgAll=M.filter(m=>m.t==="dmg"&&m.op!=="set").reduce((s,m)=>s+(+m.v||0),0);
  c.attacks.forEach((a,i)=>{const w=W[a.w];
    if(w){const fin=w.p.includes("Finesse");const ab=a.ab||(w.rg==="ranged"?"dex":fin?(K.mod.dex>K.mod.str?"dex":"str"):"str");
      const prof=a.prof!=null?a.prof:(hasP(new RegExp(w.k+" weapons","i"))||hasP(new RegExp("^"+w.n+"s?$","i")));
      const am=K.mod[ab];const hit=am+(prof?K.pb:0)+atkAll+(+a.bonus||0);const dm=am+dmgAll+(+a.dbonus||0);
      const rng=w.range&&w.range.long?`${w.range.normal}/${w.range.long} ft`:"";
      K.atk.push({n:a.n||w.n,hit:sg(hit),dmg:`${w.dmg}${dm?sg(dm):""} ${w.dt}`,notes:[w.ms&&"Mastery: "+w.ms,w.p.join(", "),rng,a.notes].filter(Boolean).join(" · "),i})}
    else if(a.w==="spell"){const e=K.casters.find(e=>e.id===a.cls)||K.casters[0];const hit=a.save?("DC "+(e?e.dc:"—")):sg((e?e.atk:K.pb)+(+a.bonus||0));
      K.atk.push({n:a.n||"Spell",hit,dmg:a.dmg||"",notes:a.notes||"",i})}
    else{const ab=a.ab||"str";const hit=K.mod[ab]+(a.prof!==false?K.pb:0)+atkAll+(+a.bonus||0);const dm=K.mod[ab]+dmgAll+(+a.dbonus||0);
      K.atk.push({n:a.n||"Ataque",hit:sg(hit),dmg:(a.dmg||"")+(a.dmg&&dm?sg(dm):"")+(a.dt?" "+a.dt:""),notes:a.notes||"",i})}});
  /* checks */
  if(K.cls[0]){const d=K.cls[0].d;if(d.sk&&d.sk.n){const got=(d.sk.from||[]).filter(s=>(c.skills[s]||0)>0).length;if(got<d.sk.n)K.warn.push(`${d.n}: elegí ${d.sk.n} skills de su lista (tenés ${got}).`)}}
  if(K.cls.length>1)K.cls.forEach(k=>(k.d.mc||[]).forEach(([a,n])=>{if(K.ab[a]<n)K.warn.push(`Multiclase ${k.d.n} pide ${ABN[a]} ${n}.`)}));
  if(bg&&bg.sk)bg.sk.forEach(s=>{if(!(K.skP[s]>0))K.warn.push(`Background ${bg.n} da ${skName(s)}: no está marcada.`)});
  K.ovs=Object.keys(c.ov).filter(k=>c.ov[k]!==""&&c.ov[k]!==undefined);
  return K}
const skName=id=>(SRD.skills.find(s=>s[0]===id)||[0,id])[1];

/* ---------- UI shell ---------- */
const STEPS=[["basicos","Básicos"],["especie","Especie"],["background","Background"],["clases","Clases"],["atributos","Atributos"],["feats","Mejoras y feats"],["skills","Skills y training"],
  ["spells","Spells"],["equipo","Equipo y ataques"],["rasgos","Rasgos y recursos"],["reglas","Reglas de la casa"],["homebrew","Homebrew"],["detalles","Detalles"],["datos","Importar / exportar"]];
function render(){
  const c=C();if(!c)return;const K=compute(c);
  $("#chars").innerHTML=Object.values(CH).sort((a,b)=>a.info.name.localeCompare(b.info.name)).map(x=>opt(x.id,x.info.name||"(sin nombre)",x.id===cur)).join("");
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.view===view?"true":"false"));
  $("#build").hidden=view!=="build";$("#sheetView").hidden=view!=="sheet";
  if(view==="build"){
    $("#nav").innerHTML=STEPS.map(([k,l])=>`<button type="button" data-act="step" data-v="${k}" aria-current="${k===step?"step":"false"}">${l}</button>`).join("");
    $("#step").innerHTML=SECT[step](c,K);renderSummary(K)}
  else{$("#sheet").innerHTML=sheetHTML(c,K);$("#printBtn").hidden=!!(window.claude&&window.claude.use)}
}
function renderSummary(K){
  K=K||compute(C());const c=C();
  const row=(key,label,val,raw)=>{const ov=c.ov[key];const b=(K.B[key]||[]).map(([l,v])=>`${esc(l)} ${typeof v==="number"?sg(v):esc(v)}`).join(" · ");
    return `<div class="sm-row${ov!==undefined&&ov!==""?" ov":""}"><span class="sm-l">${label}</span><b class="sm-v">${esc(val)}</b>
      <input class="sm-o" type="number" aria-label="Override ${esc(label)}" placeholder="✎" data-k="ov.${key}" data-t="n" data-sum="1" value="${ov===undefined?"":esc(ov)}"><small class="sm-b">${b}</small></div>`};
  let h=`<div class="sm-head"><b>${esc(c.info.name)}</b><span>${K.cls.map(k=>k.d.n+" "+k.lv+(k.s?" ("+k.s.n+")":"")).join(" / ")}</span></div>`;
  if(K.warn.length)h+=`<div class="warns" role="status"><b>${K.warn.length} aviso${K.warn.length>1?"s":""}</b><ul>${K.warn.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`;
  h+=`<div class="sm-ab">${AB.map(a=>`<div class="${c.ov["ab:"+a]!==undefined&&c.ov["ab:"+a]!==""?"ov":""}"><small>${ABN[a]}</small><b>${sg(K.mod[a])}</b><span>${K.ab[a]}</span></div>`).join("")}</div>`;
  h+=row("ac","AC",K.ac)+row("hp","HP máx",K.hp)+row("pb","Proficiency Bonus",sg(K.pb))+row("init","Initiative",sg(K.init))+row("speed","Speed",K.speed+" ft")+row("pp","Passive Perception",K.pp);
  h+=AB.map(a=>row("ab:"+a,ABF[a],K.ab[a])).join("");
  h+=AB.map(a=>row("save:"+a,ABN[a]+" save"+(K.saveP.has(a)?" ●":""),sg(K.save[a]))).join("");
  K.casters.forEach(e=>{h+=row("dc:"+e.id,e.n+" spell DC",e.dc)+row("satk:"+e.id,e.n+" spell attack",sg(e.atk))});
  K.slots.forEach((n,i)=>{if(n||c.ov["slot:"+(i+1)]!==undefined)h+=row("slot:"+(i+1),"Slots nivel "+(i+1),n)});
  if(K.pact)h+=row("pact","Pact slots",K.pact.n)+row("pactLv","Nivel pact slots",K.pact.lv);
  $("#summary").innerHTML=h}

/* ---------- builder sections ---------- */
const fld=(label,inner,cls)=>`<label class="fld${cls?" "+cls:""}"><span>${label}</span>${inner}</label>`;
const inp=(k,v,o={})=>`<input id="i-${k.replace(/\./g,"-")}" ${o.type?`type="${o.type}"`:'type="text"'} data-k="${k}"${o.t?` data-t="${o.t}"`:""}${o.rr?' data-rr="1"':""} value="${esc(v)}"${o.min!=null?` min="${o.min}"`:""}${o.max!=null?` max="${o.max}"`:""}${o.ph?` placeholder="${esc(o.ph)}"`:""}>`;
const sel=(k,v,opts,o={})=>`<select id="s-${k.replace(/\./g,"-")}" data-k="${k}"${o.t?` data-t="${o.t}"`:""}>${opts.map(x=>Array.isArray(x)?opt(x[0],x[1],String(x[0])===String(v)):opt(x,x,x===v)).join("")}</select>`;
const chk=(k,v,label)=>`<label class="chk"><input type="checkbox" data-k="${k}" data-t="b"${v?" checked":""}> ${label}</label>`;
const ta=(k,v,rows=4)=>`<textarea id="t-${k.replace(/\./g,"-")}" data-k="${k}" rows="${rows}">${esc(v)}</textarea>`;
const abOpts=(blank)=>(blank?[["","—"]]:[]).concat(AB.map(a=>[a,ABN[a]]));
const libOpts=(t,filter,blank)=>(blank?[["",blank]]:[]).concat(Object.entries(lib(t)).filter(([k,v])=>!filter||filter(v,k)).sort((a,b)=>a[1].n.localeCompare(b[1].n)).map(([k,v])=>[k,v.n+(HB[t]&&HB[t][k]?" ★":"")]));
const card=(title,body,extra)=>`<section class="card"><h3>${title}${extra||""}</h3>${body}</section>`;
const descBox=d=>d?`<details class="desc"><summary>Ver texto</summary><div>${md(d)}</div></details>`:"";
const modsEditor=(base,list,lv)=>`<div class="mods">${(list||[]).map((m,i)=>`<div class="modrow">
  ${chk(base+"."+i+".on",m.on!==false,"")}
  ${sel(base+"."+i+".t",m.t,targetOpts())}
  ${sel(base+"."+i+".op",m.op||"add",[["add","suma"],["set","fija en"],["min","mínimo"],["max","máximo"]])}
  ${inp(base+"."+i+".v",m.v==null?"":m.v,{type:"number",t:"n"})}
  ${lv?inp(base+"."+i+".lv",m.lv||"",{type:"number",t:"n",ph:"nivel"}):""}
  ${inp(base+"."+i+".note",m.note||"",{ph:"nota"})}
  <button type="button" class="x" data-act="del" data-v="${base}.${i}" aria-label="Borrar modificador">×</button></div>`).join("")}
  <button type="button" class="add" data-act="addmod" data-v="${base}">+ Modificador</button></div>`;
function targetOpts(){
  const o=[["","— elegí qué modifica —"]];AB.forEach(a=>o.push(["ab:"+a,ABF[a]+" (score)"]));AB.forEach(a=>o.push(["cap:"+a,"Tope de "+ABN[a]]));
  o.push(["pb","Proficiency Bonus"],["ac","AC"],["hp","HP máximo"],["hpLv","HP por nivel"],["init","Initiative"],["speed","Speed"],["pp","Passive Perception"],["dv","Darkvision (ft)"]);
  o.push(["saves","Todos los saves"]);AB.forEach(a=>o.push(["save:"+a,ABN[a]+" save"]));AB.forEach(a=>o.push(["saveProf:"+a,ABN[a]+" save: competencia"]));
  SRD.skills.forEach(([id,n])=>o.push(["skill:"+id,n]));SRD.skills.forEach(([id,n])=>o.push(["skillProf:"+id,n+": competencia (1) / expertise (2)"]));
  o.push(["atk","Ataque con armas"],["dmg","Daño con armas"],["dc","Spell save DC (todas)"],["satk","Spell attack (todas)"]);
  Object.entries(lib("classes")).forEach(([k,v])=>o.push(["dc:"+k,v.n+": spell DC"],["satk:"+k,v.n+": spell attack"],["cantrips:"+k,v.n+": cantrips"],["prepared:"+k,v.n+": prepared"]));
  for(let i=1;i<=9;i++)o.push(["slot:"+i,"Spell slots nivel "+i]);o.push(["pact","Pact slots (cantidad)"],["pactLv","Pact slots (nivel)"]);
  return o}

const SECT={
basicos(c){return card("Básicos",`<div class="g2">${fld("Nombre",inp("info.name",c.info.name))}${fld("Jugador",inp("info.player",c.info.player))}
  ${fld("Alignment",inp("info.alignment",c.info.alignment))}${fld("XP",inp("info.xp",c.info.xp,{type:"number",t:"n"}))}
  ${fld("Languages",inp("info.languages",c.info.languages,{ph:"Common, Elvish…"}))}</div>
  <p class="hint">Todo lo que ves calculado a la derecha se puede pisar con el campo ✎. Las reglas que cambian cálculos van en <a href="#" data-act="step" data-v="reglas">Reglas de la casa</a>; contenido nuevo o modificado, en <a href="#" data-act="step" data-v="homebrew">Homebrew</a>.</p>`)},
especie(c,K){const SP=lib("species"),sp=SP[c.species.id];const lins=sp&&sp.lin?sp.lin:[];
  return card("Especie",`<div class="g2">${fld("Especie",sel("species.id",c.species.id,libOpts("species")))}
   ${lins.length?fld("Lineage / ancestry",sel("species.lin",c.species.lin,[["","— elegí —"]].concat(lins.map(l=>[l,SRD.lineages[l].n])))):""}
   ${fld("Size",sel("species.size",c.species.size,[["","Por defecto ("+(sp?sp.size:"")+")"]].concat(SIZES.map(s=>[s,s]))))}
   ${fld("Spellcasting ability de la especie",sel("species.castAb",c.species.castAb,[["int","INT"],["wis","WIS"],["cha","CHA"]]))}</div>
   ${sp?`<p class="hint">Speed ${sp.speed} ft · Darkvision ${K.dv||"—"} ft</p>`:""}
   <ul class="flist">${K.fe.filter(f=>f.g==="species").map(f=>`<li><b>${esc(f.n)}</b> ${descBox(f.d)}</li>`).join("")}</ul>
   <p class="hint">¿Una especie que no está en el SRD o con reglas distintas? Creala o personalizala en Homebrew → Especies.</p>`)},
background(c){const BG=lib("backgrounds"),bg=BG[c.bg.id]||{};const al=(bg.ab||AB);
  const pick=(k,v)=>sel(k,v,al.map(a=>[a,ABN[a]]));
  return card("Background",`<div class="g2">${fld("Background",sel("bg.id",c.bg.id,libOpts("backgrounds")))}
   ${fld("Aumento de atributos",sel("bg.mode",c.bg.mode,[["21","+2 y +1"],["111","+1, +1, +1"],["0","Ninguno (lo manejo con reglas)"]]))}
   ${c.bg.mode!=="0"?fld(c.bg.mode==="21"?"+2 a":"+1 a",pick("bg.a",c.bg.a))+fld("+1 a",pick("bg.b",c.bg.b))+(c.bg.mode==="111"?fld("+1 a",pick("bg.c",c.bg.c)):""):""}
   ${fld("Origin feat",sel("bg.feat",c.bg.feat,libOpts("feats",v=>v.t==="origin"||v.t==="other","Por defecto: "+((lib("feats")[bg.feat]||{}).n||"—"))))}</div>
   <p class="hint">Skills: ${(bg.sk||[]).map(skName).join(", ")||"—"} · Tools: ${esc((Array.isArray(bg.tools)?bg.tools:[bg.tools]).join(", ")||"—")}</p>
   ${bg.eq?`<p class="hint">Equipo inicial: ${esc(bg.eq)}</p>`:""}
   <button type="button" class="add" data-act="bgskills">Marcar las skills del background</button>`)},
clases(c,K){const CL=lib("classes"),SC=lib("subclasses");
  return card("Clases",c.classes.map((k,i)=>{const d=CL[k.id]||{};const subs=Object.entries(SC).filter(([id,s])=>s.cls===k.id);
   return `<div class="clsrow"><div class="g3">${fld(i?"Multiclase":"Clase inicial",sel(`classes.${i}.id`,k.id,libOpts("classes")))}
     ${fld("Nivel",inp(`classes.${i}.lv`,k.lv,{type:"number",t:"n",rr:1,min:1,max:20}))}
     ${fld("Subclase",sel(`classes.${i}.sub`,k.sub,[["","— ninguna —"]].concat(subs.map(([id,s])=>[id,s.n+(HB.subclasses[id]?" ★":"")]))))}</div>
     <p class="hint">Hit die d${d.hd||"?"} · Saves ${(d.saves||[]).map(a=>ABN[a]).join(", ")}${d.sa?" · Spellcasting "+ABN[d.sa]:""}${i===0&&d.sk?` · Skills: elegí ${d.sk.n} de ${(d.sk.from||[]).map(skName).join(", ")}`:""}</p>
     ${i?`<button type="button" class="x" data-act="del" data-v="classes.${i}" aria-label="Quitar clase">Quitar</button>`:""}</div>`}).join("")+
   `<button type="button" class="add" data-act="addcls">+ Multiclase</button><p class="hint">Nivel total ${K.TL}. Subclase de Great Old One, Archfey u otras: creala en Homebrew → Subclases (podés poner rasgos, spells siempre preparados y modificadores).</p>
   <div class="g2">${fld("HP",sel("hpMode",c.hpMode,[["avg","Promedio fijo"],["roll","Tiradas propias"]]))}</div>
   ${c.hpMode==="roll"?`<div class="rolls">${K.cls.map((k,ci)=>Array.from({length:k.lv},(_,l)=>l+1).filter(l=>!(ci===0&&l===1)).map(l=>fld(`${k.d.n} ${l} (d${k.d.hd})`,inp(`hpRolls.${k.id}-${l}`,c.hpRolls[k.id+"-"+l]||"",{type:"number",t:"n",min:1,max:k.d.hd}))).join("")).join("")}</div>`:""}`)},
atributos(c,K){
  const pb={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};const cost=AB.reduce((s,a)=>s+(pb[c.base[a]]!=null?pb[c.base[a]]:NaN),0);
  return card("Atributos",`<div class="abgrid">${AB.map(a=>`<div class="abc"><b>${ABN[a]}</b>${inp("base."+a,c.base[a],{type:"number",t:"n",min:1,max:30})}
    <small>Final <b>${K.ab[a]}</b> (${sg(K.mod[a])})</small></div>`).join("")}</div>
   <p class="hint">Point buy: ${isNaN(cost)?"valores fuera de 8-15":cost+" / 27"} · Standard array: 15, 14, 13, 12, 10, 8.</p>
   <div class="btnrow"><button type="button" data-act="array">Aplicar standard array</button></div>
   <p class="hint">Puntos extra, topes distintos o atributos fijos: Reglas de la casa → modificador “Strength (score)” o “Tope de STR”.</p>`)},
feats(c,K){const F=lib("feats");const slots=impSlots(c);
  const slotRow=s=>{const p=c.imp[s.key]||{};const id=p.feat||(s.kind==="general"?"ability-score-improvement":"");const d=F[id];
    const filt=s.kind==="fighting-style"?(v=>v.t==="fighting-style"):s.kind==="epic-boon"?(v=>v.t==="epic-boon"||v.t==="general"||v.t==="other"):(v=>v.t==="general"||v.t==="origin"||v.t==="other");
    return `<div class="slotrow"><b>${esc(s.cls)} ${s.lv}</b>${sel(`imp.${s.key}.feat`,id,libOpts("feats",filt,"— elegí —"))}
     ${s.kind!=="fighting-style"?(id==="ability-score-improvement"?sel(`imp.${s.key}.a`,p.a||"",abOpts(1))+sel(`imp.${s.key}.b`,p.b||"",abOpts(1))+`<small>mismo atributo dos veces = +2</small>`
       :sel(`imp.${s.key}.a`,p.a||"",[["","+1 a —"]].concat(AB.map(a=>[a,"+1 "+ABN[a]])))):""}${d?descBox(d.d):""}</div>`};
  return card("Mejoras por nivel",slots.length?slots.map(slotRow).join(""):`<p class="hint">Todavía no hay mejoras por nivel (llegan en nivel 4).</p>`)+
   card("Feats extra",`<p class="hint">Para feats que vienen de otro lado: Human Versatile, una invocation como Lessons of the First Ones, un regalo del DM…</p>`+
   c.extraFeats.map((e,i)=>`<div class="slotrow">${sel(`extraFeats.${i}.id`,e.id,libOpts("feats",null,"— elegí —"))}${inp(`extraFeats.${i}.src`,e.src||"",{ph:"origen"})}
     ${sel(`extraFeats.${i}.a`,e.a||"",[["","sin +1"]].concat(AB.map(a=>[a,"+1 "+ABN[a]])))}${inp(`extraFeats.${i}.note`,e.note||"",{ph:"nota"})}
     <button type="button" class="x" data-act="del" data-v="extraFeats.${i}" aria-label="Quitar">×</button>${F[e.id]?descBox(F[e.id].d):""}</div>`).join("")+
   `<button type="button" class="add" data-act="push" data-v="extraFeats">+ Feat</button><p class="hint">¿Un feat fuera del SRD (Lucky, Tough…)? Crealo en Homebrew → Feats.</p>`)},
skills(c,K){const d=K.cls[0]&&K.cls[0].d;const bg=lib("backgrounds")[c.bg.id]||{};
  return card("Skills",`<p class="hint">Clase: ${d&&d.sk?`elegí ${d.sk.n} de ${(d.sk.from||[]).map(skName).join(", ")}`:"—"} · Background: ${(bg.sk||[]).map(skName).join(", ")||"—"}</p>
   <div class="sktable">${SRD.skills.map(([id,n,a])=>`<div class="skrow"><span>${n} <small>${ABN[a]}</small></span>
     ${sel("skills."+id,String(c.skills[id]||0),[["0","—"],["1","Proficiency"],["2","Expertise"]],{t:"n"})}<b>${sg(K.sk[id])}</b>
     ${inp("ov.skill:"+id,c.ov["skill:"+id]==null?"":c.ov["skill:"+id],{type:"number",t:"n",ph:"✎"})}</div>`).join("")}</div>`)+
   card("Training y otras competencias",`<p class="hint">Automático: ${esc(K.profs.join(", "))}</p><div class="g2">
   ${fld("Armor extra",inp("profs.armor",c.profs.armor))}${fld("Weapons extra",inp("profs.weapons",c.profs.weapons))}${fld("Tools extra",inp("profs.tools",c.profs.tools))}${fld("Otras",inp("profs.other",c.profs.other))}</div>`)},
spells(c,K){const S=lib("spells");
  const srcs=[["","Otro"]].concat(K.casters.map(e=>[e.id,e.n]));if(!spSrc&&K.casters[0])spSrc=K.casters[0].id;
  const head=K.casters.length?K.casters.map(e=>`<div class="pill">${esc(e.n)}: cantrips ${e.nc}/${e.cantrips} · prepared ${e.np}/${e.prepared} · DC ${e.dc} · ${sg(e.atk)}</div>`).join(""):`<p class="hint">Ninguna clase lanza spells; igual podés sumar spells de feats o especie.</p>`;
  const list=K.spells.map(s=>`<div class="sprow"><span class="lv">${s.d.l||"C"}</span><b>${esc(s.d.n)}</b><small>${esc(s.src?((lib("classes")[s.src]||{}).n||s.src):"Otro")}${s.always?" · siempre":""}${s.note?" · "+esc(s.note):""}</small>
    ${s.i!=null?`${s.d.l?chk(`spells.${s.i}.prep`,s.prep,"prepared"):""}${chk(`spells.${s.i}.always`,s.always,"siempre")}<button type="button" class="x" data-act="del" data-v="spells.${s.i}" aria-label="Quitar ${esc(s.d.n)}">×</button>`:""}</div>`).join("");
  return card("Spells",head+`<div class="splist">${list||'<p class="hint">Sin spells todavía.</p>'}</div>`)+
   card("Agregar spells",`<div class="g4">${fld("Buscar",`<input id="spq" type="search" value="${esc(spQ)}" placeholder="nombre…">`)}
    ${fld("Nivel",`<select id="splv">${[["","Todos"]].concat([0,1,2,3,4,5,6,7,8,9].map(n=>[n,n?"Nivel "+n:"Cantrip"])).map(x=>opt(x[0],x[1],String(x[0])===spLv)).join("")}</select>`)}
    ${fld("Para",`<select id="spsrc">${srcs.map(x=>opt(x[0],x[1],x[0]===spSrc)).join("")}</select>`)}
    <label class="chk"><input type="checkbox" id="sponly"${spOnly?" checked":""}> Solo lista de la clase</label></div><div id="spres">${spResults(c,K)}</div>`)},
equipo(c,K){const W=SRD.weapons,A=SRD.armor;
  return card("Armadura",`<div class="g2">${fld("Armor",sel("armor",c.armor,[["none","Sin armadura"]].concat(Object.entries(A).filter(([k,a])=>a.t!=="shield").map(([k,a])=>[k,`${a.n} (${a.t}, AC ${a.b}${a.dex?(a.max!=null?" + DEX máx "+a.max:" + DEX"):""})`]))))}
   ${chk("shield",c.shield,"Shield (+2)")}</div><p class="hint">AC actual: <b>${K.ac}</b>. Fórmulas especiales (Mage Armor, naturales): modificador “AC” con “fija en”.</p>`)+
  card("Ataques y cantrips de daño",c.attacks.map((a,i)=>{const w=W[a.w];const isC=!w&&a.w!=="spell";
   return `<div class="atkrow"><div class="g4">${fld("Arma",sel(`attacks.${i}.w`,a.w,[["custom","Custom"],["spell","Spell / cantrip"]].concat(Object.entries(W).sort((x,y)=>x[1].n.localeCompare(y[1].n)).map(([k,w])=>[k,w.n]))))}
    ${fld("Nombre",inp(`attacks.${i}.n`,a.n||"",{ph:w?w.n:"nombre"}))}
    ${a.w==="spell"?fld("Clase",sel(`attacks.${i}.cls`,a.cls||"",K.casters.map(e=>[e.id,e.n]).concat([["","—"]])))+fld("Tipo",sel(`attacks.${i}.save`,a.save?"1":"",[["","Attack roll"],["1","Saving throw"]]))
      :fld("Atributo",sel(`attacks.${i}.ab`,a.ab||"",[["","Auto"]].concat(AB.map(x=>[x,ABN[x]]))))+fld("Competencia",sel(`attacks.${i}.prof`,a.prof==null?"":a.prof?"1":"0",[["","Auto"],["1","Sí"],["0","No"]]))}
    ${isC||a.w==="spell"?fld("Daño",inp(`attacks.${i}.dmg`,a.dmg||"",{ph:"1d10"}))+(isC?fld("Tipo de daño",inp(`attacks.${i}.dt`,a.dt||"")):""):""}
    ${a.w!=="spell"?fld("+ ataque",inp(`attacks.${i}.bonus`,a.bonus||"",{type:"number",t:"n"}))+fld("+ daño",inp(`attacks.${i}.dbonus`,a.dbonus||"",{type:"number",t:"n"})):fld("+ ataque",inp(`attacks.${i}.bonus`,a.bonus||"",{type:"number",t:"n"}))}
    ${fld("Notas",inp(`attacks.${i}.notes`,a.notes||""))}</div>
    <p class="hint">→ ${esc((K.atk.find(x=>x.i===i)||{}).hit||"")} · ${esc((K.atk.find(x=>x.i===i)||{}).dmg||"")}</p>
    <button type="button" class="x" data-act="del" data-v="attacks.${i}" aria-label="Quitar ataque">Quitar</button></div>`}).join("")+`<button type="button" class="add" data-act="push" data-v="attacks">+ Ataque</button>`)+
  card("Equipo",`${fld("Inventario",ta("equipment",c.equipment,5))}<div class="g5">${["cp","sp","ep","gp","pp"].map(k=>fld(k.toUpperCase(),inp("coins."+k,c.coins[k],{type:"number",t:"n"}))).join("")}</div>
   <p class="hint">Los magic items no se usan en la campaña: si alguno aparece, anotalo en Detalles → notas.</p>`)},
rasgos(c,K){
  return card("Rasgos automáticos",`<ul class="flist">${K.fe.filter(f=>f.g!=="custom").map(f=>`<li><b>${esc(f.n)}</b> <small>${esc(f.src)}</small>${descBox(f.d)}</li>`).join("")}</ul>`)+
  card("Rasgos personalizados",`<p class="hint">Invocations, rasgos de subclases fuera del SRD, dones del DM. Pueden traer modificadores.</p>`+
   c.features.map((f,i)=>`<div class="custom"><div class="g3">${fld("Nombre",inp(`features.${i}.n`,f.n||""))}${fld("Origen",inp(`features.${i}.src`,f.src||"",{ph:"Invocation, DM…"}))}
    ${fld("Va en",sel(`features.${i}.g`,f.g||"class",[["class","Class features"],["species","Species traits"],["feat","Feats"]]))}</div>${fld("Texto",ta(`features.${i}.d`,f.d||"",3))}
    ${modsEditor(`features.${i}.mods`,f.mods)}<button type="button" class="x" data-act="del" data-v="features.${i}">Quitar rasgo</button></div>`).join("")+
   `<button type="button" class="add" data-act="push" data-v="features">+ Rasgo</button>`)+
  card("Recursos",`<ul class="flist">${K.res.filter(r=>r.src!=="Custom").map(r=>`<li><b>${esc(r.n)}</b> ${esc(r.v)} <small>${esc(r.src)}</small></li>`).join("")||"<li>—</li>"}</ul>`+
   c.resources.map((r,i)=>`<div class="slotrow">${inp(`resources.${i}.n`,r.n||"",{ph:"Nombre (p. ej. Luck Points)"})}${inp(`resources.${i}.max`,r.max||"",{ph:"usos"})}
   ${sel(`resources.${i}.rec`,r.rec||"",[["","—"],["Short Rest","Short Rest"],["Long Rest","Long Rest"],["Short o Long Rest","Short o Long Rest"]])}<button type="button" class="x" data-act="del" data-v="resources.${i}">×</button></div>`).join("")+
   `<button type="button" class="add" data-act="push" data-v="resources">+ Recurso</button>`)},
reglas(c,K){
  const ovs=K.ovs.map(k=>`<li><code>${esc(k)}</code> = <b>${esc(c.ov[k])}</b> <button type="button" class="x" data-act="clearov" data-v="${esc(k)}">Quitar</button></li>`).join("");
  return card("Reglas de la casa",`<p class="hint">Modificadores que cambian los cálculos de este personaje. Cada uno queda listado en la última página de la hoja.</p>
   <div class="btnrow"><button type="button" data-act="preset" data-v="pb">Preset: PB fijo</button><button type="button" data-act="preset" data-v="pts">Preset: puntos de atributo extra</button>
   <button type="button" data-act="preset" data-v="pact">Preset: pact slots extra</button><button type="button" data-act="preset" data-v="hp">Preset: HP extra por nivel</button></div>
   ${modsEditor("mods",c.mods)}`)+
  card("Overrides manuales",`<p class="hint">Valores pisados con ✎ en el resumen o en skills.</p><ul class="flist">${ovs||"<li>Ninguno.</li>"}</ul>`)+
  card("Todos los modificadores activos",`<ul class="flist">${K.mods.map(m=>`<li>${esc(tLabel(m.t))}: ${esc(opLabel(m))} <small>${esc(m.src)}${m.note?" · "+esc(m.note):""}</small></li>`).join("")||"<li>Ninguno.</li>"}</ul>`)},
homebrew(c){return homebrewHTML()},
detalles(c){return card("Detalles",`${fld("Apariencia",ta("info.appearance",c.info.appearance,3))}${fld("Personalidad (traits, ideals, bonds, flaws)",ta("info.personality",c.info.personality,4))}
  ${fld("Historia",ta("info.backstory",c.info.backstory,5))}${fld("Notas (incluye magic items si aparecen)",ta("info.notes",c.info.notes,4))}`)},
datos(c){return card("Exportar",`<div class="btnrow"><button type="button" data-act="exjson">Descargar personaje (.json)</button><button type="button" data-act="exall">Descargar todo + homebrew (.json)</button>
  <button type="button" data-act="exsheet">Descargar hoja (.html)</button><button type="button" data-act="copyjson">Copiar JSON</button></div>
  <p class="hint">La hoja descargada se abre en el navegador y se imprime o guarda como PDF desde ahí.</p>`)+
  card("Importar",`<p class="hint">Pegá un JSON exportado (un personaje o todo) o elegí un archivo.</p>${ta("__import","",6).replace('data-k="__import"','id="imp"')}
   <div class="btnrow"><input type="file" id="impfile" accept=".json,application/json"><button type="button" data-act="import">Importar</button></div><p class="hint" id="impmsg"></p>`)}
};
const tLabel=t=>{const o=targetOpts().find(x=>x[0]===t);return o?o[1]:t};
const opLabel=m=>({add:"suma "+sg(+m.v||0),set:"fija en "+m.v,min:"mínimo "+m.v,max:"máximo "+m.v})[m.op||"add"];
function spResults(c,K){const S=lib("spells");const q=spQ.trim().toLowerCase();
  const maxL=spSrc&&K.casters.find(e=>e.id===spSrc);const cap=maxL?(maxL.type==="pact"&&K.pact?K.pact.lv:Math.max(0,...K.slots.map((n,i)=>n?i+1:0))):9;
  const r=Object.entries(S).filter(([k,s])=>(!q||s.n.toLowerCase().includes(q))&&(spLv===""||s.l===+spLv)&&(!spOnly||!spSrc||(s.cl||[]).includes(spSrc))&&(!spOnly||s.l<=cap))
    .sort((a,b)=>a[1].l-b[1].l||a[1].n.localeCompare(b[1].n)).slice(0,60);
  const have=new Set(c.spells.map(x=>x.id+"|"+(x.src||"")));
  return `<p class="hint">${r.length} resultado${r.length===1?"":"s"}${spOnly&&maxL?` (hasta nivel ${cap})`:""}. ¿Falta alguno? Homebrew → Spells.</p>`+r.map(([k,s])=>`<div class="sprow"><span class="lv">${s.l||"C"}</span><b>${esc(s.n)}${HB.spells[k]?" ★":""}</b><small>${esc(s.s)} · ${esc(s.t)} · ${esc(s.r)}${s.co?" · C":""}${s.ri?" · R":""}</small>
    ${have.has(k+"|"+spSrc)?'<span class="ok">agregado</span>':`<button type="button" class="add sm" data-act="addspell" data-v="${k}">+ Agregar</button>`}${descBox(s.d)}</div>`).join("")}

/* ---------- homebrew ---------- */
const SCHEMA={
 spells:[["n","Nombre"],["l","Nivel (0 = cantrip)","n"],["s","Escuela"],["cl","Clases (ids separados por coma)","list"],["t","Casting time"],["r","Range"],["c","Componentes (V,S,M)"],["m","Material"],["du","Duration"],["co","Concentration","b"],["ri","Ritual","b"],["d","Descripción","ta"],["h","A mayor nivel","ta"]],
 feats:[["n","Nombre"],["t","Tipo","sel",[["origin","Origin"],["general","General"],["fighting-style","Fighting Style"],["epic-boon","Epic Boon"],["other","Otro"]]],["rep","Repetible","b"],["d","Descripción","ta"],["mods","Modificadores","mods"]],
 species:[["n","Nombre"],["size","Size"],["speed","Speed","n"],["dv","Darkvision (ft)","n"],["tr","Traits del SRD (ids)","list"],["trx","Traits propios","rows"],["mods","Modificadores","mods"]],
 backgrounds:[["n","Nombre"],["ab","Atributos posibles (3)","abl"],["feat","Origin feat","feat"],["sk","Skills (ids)","list"],["tools","Tools","list"],["eq","Equipo","ta"],["mods","Modificadores","mods"]],
 classes:[["n","Nombre"],["hd","Hit die","n"],["saves","Saves","abl"],["sa","Spellcasting ability","ab"],["caster","Tipo de caster","sel",[["","Según tabla SRD"],["none","No lanza"],["full","Full"],["half","Half"],["third","Third"],["pact","Pact Magic"]]],
   ["sk","Skills: cantidad y lista","sk"],["prof","Training (texto separado por coma)","list"],["asi","Niveles de mejora (solo clases nuevas)"],["fx","Rasgos extra","rows"],["mods","Modificadores","mods"]],
 subclasses:[["n","Nombre"],["cls","Clase","cls"],["sum","Resumen"],["f","Rasgos","rows"],["sp","Spells siempre preparados","sprows"],["mods","Modificadores (con nivel mínimo)","modslv"]]
};
function hbBlank(t){return {spells:{n:"Nuevo spell",l:1,s:"Evocation",cl:[],t:"Action",r:"60 feet",c:"V,S",m:"",du:"Instantaneous",co:false,ri:false,d:"",h:""},
  feats:{n:"Nuevo feat",t:"general",d:"",mods:[]},species:{n:"Nueva especie",size:"Medium",speed:30,dv:0,tr:[],trx:[],mods:[]},
  backgrounds:{n:"Nuevo background",ab:["str","dex","con"],feat:"alert",sk:[],tools:[],eq:"",mods:[]},
  classes:{n:"Nueva clase",hd:8,saves:["str","con"],sa:"",caster:"none",sk:{n:2,from:[]},prof:[],asi:"4,8,12,16,19",fx:[],mods:[],lv:[]},
  subclasses:{n:"Nueva subclase",cls:"warlock",sum:"",f:[],sp:[],mods:[]}}[t]}
function homebrewHTML(){
  const t=hbType,items=HB[t]||{};
  let h=`<section class="card"><h3>Homebrew</h3><p class="hint">Contenido propio o versiones modificadas del SRD. Es tuyo, no del personaje: lo usan todos tus personajes. ★ marca lo que es homebrew.</p>
   <div class="chips">${Object.entries(HBTYPES).map(([k,l])=>`<button type="button" data-act="hbtype" data-v="${k}" aria-pressed="${k===t}">${l} <small>${Object.keys(HB[k]||{}).length}</small></button>`).join("")}</div>
   <div class="btnrow"><button type="button" data-act="hbnew">+ Nuevo</button>
   <select id="hbsrd">${[["","Personalizar uno del SRD…"]].concat(Object.entries(SRD[t]||{}).sort((a,b)=>a[1].n.localeCompare(b[1].n)).map(([k,v])=>[k,v.n])).map(x=>opt(x[0],x[1])).join("")}</select>
   <button type="button" data-act="hbcopy">Personalizar</button></div>
   <ul class="hblist">${Object.entries(items).map(([k,v])=>`<li${k===hbEdit?' class="on"':""}><button type="button" class="lnk" data-act="hbedit" data-v="${esc(k)}">${esc(v.n)}</button> <small>${SRD[t]&&SRD[t][k]?"SRD modificado":"nuevo"}</small>
     <button type="button" class="x" data-act="hbdel" data-v="${esc(k)}">Borrar</button></li>`).join("")||"<li>Nada todavía.</li>"}</ul></section>`;
  if(hbEdit&&items[hbEdit])h+=hbForm(t,hbEdit,items[hbEdit]);
  return h}
function hbForm(t,id,o){const b=`HB.${t}.${id}`;
  const rows=SCHEMA[t].map(([k,l,ty,x])=>{const v=o[k];const p=b+"."+k;
   if(ty==="n")return fld(l,inp(p,v==null?"":v,{type:"number",t:"n"}));
   if(ty==="b")return chk(p,!!v,l);
   if(ty==="ta")return fld(l,ta(p,v||"",4),"wide");
   if(ty==="sel")return fld(l,sel(p,v||"",x));
   if(ty==="list")return fld(l,`<input type="text" data-k="${p}" data-t="list" value="${esc((Array.isArray(v)?v:[]).join(", "))}">`,"wide");
   if(ty==="ab")return fld(l,sel(p,v||"",[["","Ninguna"]].concat(AB.map(a=>[a,ABN[a]]))));
   if(ty==="abl")return fld(l,(v||[]).map((a,i)=>sel(p+"."+i,a,AB.map(x=>[x,ABN[x]]))).join("")+`<button type="button" class="add sm" data-act="pushv" data-v="${p}">+</button>`);
   if(ty==="feat")return fld(l,sel(p,v||"",libOpts("feats",null,"—")));
   if(ty==="cls")return fld(l,sel(p,v||"",libOpts("classes")));
   if(ty==="sk")return fld(l,inp(p+".n",(v||{}).n||0,{type:"number",t:"n"})+`<input type="text" data-k="${p}.from" data-t="list" value="${esc(((v||{}).from||[]).join(", "))}" placeholder="athletics, stealth…">`,"wide");
   if(ty==="mods")return `<div class="wide"><span class="lbl">${l}</span>${modsEditor(p,v)}</div>`;
   if(ty==="modslv")return `<div class="wide"><span class="lbl">${l}</span>${modsEditor(p,v,true)}</div>`;
   if(ty==="rows")return `<div class="wide"><span class="lbl">${l}</span>${(v||[]).map((r,i)=>`<div class="custom"><div class="g3">${fld("Nombre",inp(`${p}.${i}.n`,r.n||""))}${t!=="species"?fld("Nivel",inp(`${p}.${i}.lv`,r.lv||1,{type:"number",t:"n"})):""}</div>${fld("Texto",ta(`${p}.${i}.d`,r.d||"",3))}<button type="button" class="x" data-act="hbdelrow" data-v="${p}.${i}">Quitar</button></div>`).join("")}<button type="button" class="add sm" data-act="hbrow" data-v="${p}">+ Rasgo</button></div>`;
   if(ty==="sprows")return `<div class="wide"><span class="lbl">${l}</span>${(v||[]).map((r,i)=>`<div class="slotrow">${inp(`${p}.${i}.lv`,r.lv||1,{type:"number",t:"n",ph:"nivel"})}<input type="text" data-k="${p}.${i}.ids" value="${esc(r.ids||"")}" placeholder="ids: dissonant-whispers, hideous-laughter"><button type="button" class="x" data-act="hbdelrow" data-v="${p}.${i}">×</button></div>`).join("")}<button type="button" class="add sm" data-act="hbrow" data-v="${p}">+ Fila</button></div>`;
   return fld(l,inp(p,v==null?"":v),"wide")}).join("");
  return `<section class="card hbform"><h3>Editando: ${esc(o.n)} <small>(${esc(id)})</small></h3><div class="g2">${rows}</div><p class="hint">Los cambios se guardan solos.</p></section>`}

/* ---------- sheet ---------- */
const SHEET_CSS=`
.pg{width:816px;min-height:1056px;margin:0 auto 24px;background:#fffdf8;color:#1d1a24;padding:34px 38px;box-shadow:0 2px 14px rgba(20,10,40,.18);font:11px/1.35 "Alegreya Sans",system-ui,sans-serif;position:relative;box-sizing:border-box}
.pg *{box-sizing:border-box}
.pg h2{font:700 13px/1 "Grenze",Georgia,serif;letter-spacing:.06em;text-transform:uppercase;margin:0 0 6px;color:#3a2a6b}
.pg .bx{border:1.4px solid #2b2350;border-radius:8px;padding:7px 9px;background:#fff}
.pg .lab{font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;color:#6a6280;font-weight:700}
.pg .big{font:700 22px/1 "Grenze",Georgia,serif;color:#1d1a24}
.pg .row{display:flex;gap:8px}.pg .col{display:flex;flex-direction:column;gap:8px}
.s-top{display:grid;grid-template-columns:1.6fr 1fr 78px 1.25fr;gap:8px;margin-bottom:8px}
.s-name{font:700 24px/1.05 "Grenze",Georgia,serif;border-bottom:1.4px solid #2b2350;padding-bottom:3px;margin-bottom:5px}
.s-meta{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px}
.s-meta div{border-bottom:1px solid #d9d4e6;padding:1px 0}.s-meta b{display:block;font-size:11.5px}
.s-ac{display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.6px solid #2b2350;border-radius:8px 8px 40px 40px;background:#fff}
.s-hp{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.s-hp>div{text-align:center}.s-hp .ln{border-bottom:1px solid #2b2350;height:22px;margin-top:2px}
.dots{display:inline-flex;gap:3px;vertical-align:middle}.dots i{width:9px;height:9px;border:1.2px solid #2b2350;border-radius:50%;display:inline-block}.dots i.on{background:#2b2350}
.s-main{display:grid;grid-template-columns:2fr 3fr;gap:8px}
.s-abs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ab{border:1.4px solid #2b2350;border-radius:8px;background:#fff;padding:6px 7px}
.ab .hd{display:flex;align-items:center;gap:6px;border-bottom:1px solid #d9d4e6;padding-bottom:4px;margin-bottom:4px}
.ab .m{font:700 20px/1 "Grenze",Georgia,serif;width:38px;text-align:center}.ab .sc{border:1.2px solid #2b2350;border-radius:999px;padding:0 6px;font-weight:700}
.ab .ln2{display:flex;align-items:center;gap:5px;padding:1px 0}.ab .ln2 span:last-child{margin-left:auto;font-weight:700;min-width:22px;text-align:right}
.ab .ln2.sv{font-weight:700;border-bottom:1px dashed #d9d4e6;margin-bottom:2px}
.stats4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.stats4 .bx{text-align:center}
.tbl{width:100%;border-collapse:collapse;font-size:10.5px}.tbl th{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:#6a6280;text-align:left;border-bottom:1.2px solid #2b2350;padding:2px 3px}
.tbl td{border-bottom:1px solid #e3dfeb;padding:3px;vertical-align:top}
.flist2{columns:2;column-gap:14px;font-size:10.3px}.flist2 p{margin:0 0 4px;break-inside:avoid}
.full p{margin:0 0 6px}.cols2{columns:2;column-gap:18px}.cols2 .it{break-inside:avoid;margin-bottom:8px}
.it h4{margin:0 0 2px;font:700 12px/1.1 "Grenze",Georgia,serif}.it .meta{font-size:9px;color:#6a6280;margin-bottom:2px}
.slots{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;text-align:center}.slots .bx{padding:4px 2px}
.ft{position:absolute;bottom:14px;left:38px;right:38px;font-size:8px;color:#8a83a0;display:flex;justify-content:space-between}
.hr-tag{display:inline-block;background:#efe9fb;color:#4b2fb0;border-radius:4px;padding:0 4px;font-size:9px;font-weight:700}
`;
const PRINT_CSS="@media print{body *{visibility:hidden}#sheet,#sheet *{visibility:visible}#sheet{position:absolute;left:0;top:0}.pg{box-shadow:none;margin:0;page-break-after:always}}";
function dots(n,on){return `<span class="dots">${Array.from({length:n},(_,i)=>`<i class="${i<on?"on":""}"></i>`).join("")}</span>`}
function sheetHTML(c,K){
  const SK={};SRD.skills.forEach(([id,n,a])=>(SK[a]=SK[a]||[]).push([id,n]));
  const cls=K.cls.map(k=>k.d.n+" "+k.lv).join(" / ")||"—",subs=K.cls.filter(k=>k.s).map(k=>k.s.n).join(", ")||"—";
  const sp=lib("species")[c.species.id],bg=lib("backgrounds")[c.bg.id];
  const hr=k=>K.mods.some(m=>m.t===k)||(c.ov[k]!==undefined&&c.ov[k]!=="")?'<span class="hr-tag" title="Regla de la casa u override">★</span>':"";
  const abBox=a=>`<div class="ab"><div class="hd"><span class="m">${sg(K.mod[a])}</span><div><div class="lab">${ABF[a]}</div><span class="sc">${K.ab[a]}</span> ${hr("ab:"+a)}</div></div>
    <div class="ln2 sv">${dots(1,K.saveP.has(a)?1:0)}<span>Saving Throw</span><span>${sg(K.save[a])}</span></div>
    ${(SK[a]||[]).map(([id,n])=>`<div class="ln2">${dots(1,K.skP[id]?1:0)}${K.skP[id]>1?dots(1,1):""}<span>${n}</span><span>${sg(K.sk[id])}</span></div>`).join("")}</div>`;
  const fe=g=>K.fe.filter(f=>f.g===g).map(f=>`<p><b>${esc(f.n)}.</b> ${esc(first(f.d))} <i style="color:#8a83a0">${esc(f.src)}</i></p>`).join("")||"<p>—</p>";
  const foot=n=>`<div class="ft"><span>${esc(c.info.name)} · ${esc(cls)}</span><span>Página ${n}</span></div>`;
  /* page 1 */
  let p1=`<div class="pg"><div class="s-top"><div class="bx"><div class="s-name">${esc(c.info.name)}</div><div class="s-meta">
    <div><span class="lab">Background</span><b>${esc(bg?bg.n:"—")}</b></div><div><span class="lab">Class</span><b>${esc(cls)}</b></div>
    <div><span class="lab">Species</span><b>${esc((sp?sp.n:"—")+(c.species.lin&&SRD.lineages[c.species.lin]?" · "+SRD.lineages[c.species.lin].n.split(":").pop().trim():""))}</b></div><div><span class="lab">Subclass</span><b>${esc(subs)}</b></div>
    <div><span class="lab">Level</span><b>${K.TL}</b></div><div><span class="lab">XP</span><b>${esc(c.info.xp||0)}</b></div></div></div>
   <div class="col"><div class="bx" style="text-align:center"><div class="lab">Proficiency Bonus ${hr("pb")}</div><div class="big">${sg(K.pb)}</div></div>
     <div class="bx" style="text-align:center"><div class="lab">Heroic Inspiration</div>${dots(1,c.insp?1:0)}</div></div>
   <div class="s-ac"><div class="lab">Armor Class</div><div class="big" style="font-size:28px">${K.ac}</div>${hr("ac")}<div class="lab" style="font-size:7.5px">${c.shield?"Shield ✓":"Shield —"}</div></div>
   <div class="bx"><div class="lab">Hit Points ${hr("hp")}</div><div class="s-hp"><div><div class="lab">Current</div><div class="ln">${esc(c.hpCur)}</div></div><div><div class="lab">Temp</div><div class="ln">${esc(c.hpTemp)}</div></div><div><div class="lab">Max</div><div class="big">${K.hp}</div></div></div>
     <div class="row" style="margin-top:6px;justify-content:space-between"><div><div class="lab">Hit Dice</div><b>${esc(K.hd)}</b></div><div><div class="lab">Death Saves</div>✓ ${dots(3,0)} ✗ ${dots(3,0)}</div></div></div></div>
  <div class="s-main"><div class="col"><div class="s-abs"><div class="col">${["str","dex","con"].map(abBox).join("")}</div><div class="col">${["int","wis","cha"].map(abBox).join("")}</div></div>
    <div class="bx"><h2>Equipment Training &amp; Proficiencies</h2>${esc(K.profs.concat([c.profs.armor,c.profs.weapons,c.profs.tools,c.profs.other].filter(Boolean)).join(" · "))}</div></div>
   <div class="col"><div class="stats4"><div class="bx"><div class="lab">Initiative ${hr("init")}</div><div class="big">${sg(K.init)}</div></div><div class="bx"><div class="lab">Speed ${hr("speed")}</div><div class="big">${K.speed}</div><div class="lab">ft</div></div>
     <div class="bx"><div class="lab">Size</div><div class="big" style="font-size:15px;padding-top:4px">${esc(K.size)}</div></div><div class="bx"><div class="lab">Passive Perception</div><div class="big">${K.pp}</div></div></div>
    <div class="bx"><h2>Weapons &amp; Damage Cantrips</h2><table class="tbl"><tr><th>Name</th><th>Atk Bonus / DC</th><th>Damage &amp; Type</th><th>Notes</th></tr>${K.atk.map(a=>`<tr><td><b>${esc(a.n)}</b></td><td>${esc(a.hit)}</td><td>${esc(a.dmg)}</td><td>${esc(a.notes)}</td></tr>`).join("")||"<tr><td colspan=4>—</td></tr>"}</table></div>
    <div class="bx"><h2>Class Features</h2><div class="flist2">${fe("class")}</div>${K.res.length?`<div style="margin-top:4px"><span class="lab">Recursos</span> ${K.res.map(r=>`<b>${esc(r.n)}</b> ${esc(r.v)}`).join(" · ")}</div>`:""}</div>
    <div class="row"><div class="bx" style="flex:1"><h2>Species Traits</h2><div style="font-size:10.3px">${fe("species")}${K.dv&&!K.fe.some(f=>/^Darkvision/.test(f.n))?`<p><b>Darkvision</b> ${K.dv} ft</p>`:""}</div></div><div class="bx" style="flex:1"><h2>Feats</h2><div style="font-size:10.3px">${fe("feat")}</div></div></div>
   </div></div>${foot(1)}</div>`;
  /* page 2 */
  const casters=K.casters;
  const spRows=K.spells.map(s=>`<tr><td>${s.d.l||"C"}</td><td><b>${esc(s.d.n)}</b>${s.always?" ●":""}</td><td>${esc(String(s.d.t).split(",")[0])}</td><td>${esc(String(s.d.r).replace(/ feet/g," ft"))}</td><td>${[s.d.co&&"C",s.d.ri&&"R",/M/.test(s.d.c)&&"M"].filter(Boolean).join(" ")}</td><td>${esc([s.note,s.src&&lib("classes")[s.src]?lib("classes")[s.src].n:s.src].filter(Boolean).join(" · "))}${s.d.l&&!s.prep&&!s.always?" (no preparado)":""}</td></tr>`).join("");
  let p2=`<div class="pg"><div class="row" style="align-items:stretch"><div class="col" style="flex:1.45">
    <div class="bx"><h2>Spellcasting</h2>${casters.length?`<table class="tbl"><tr><th>Clase</th><th>Ability</th><th>Modifier</th><th>Save DC</th><th>Attack Bonus</th></tr>${casters.map(e=>`<tr><td><b>${esc(e.n)}</b></td><td>${ABF[e.ab]}</td><td>${sg(K.mod[e.ab])}</td><td><b>${e.dc}</b> ${hr("dc:"+e.id)}</td><td><b>${sg(e.atk)}</b> ${hr("satk:"+e.id)}</td></tr>`).join("")}</table>`:"<p>—</p>"}
     ${c.species.lin&&K.spells.some(s=>s.src==="Especie")?`<p style="margin:4px 0 0">Spells de especie: ${ABF[c.species.castAb]} · DC ${8+K.pb+K.mod[c.species.castAb]} · ${sg(K.pb+K.mod[c.species.castAb])}</p>`:""}</div>
    <div class="bx"><h2>Spell Slots</h2><div class="slots">${K.slots.map((n,i)=>`<div class="bx"><div class="lab">Nivel ${i+1}</div><b>${n||"—"}</b><div>${n?dots(n,0):""}</div></div>`).join("")}</div>
     ${K.pact?`<p style="margin:6px 0 0"><b>Pact Magic (${esc(K.pact.cls)})</b>: ${K.pact.n} slots de nivel ${K.pact.lv} ${dots(K.pact.n,0)} ${hr("pact")} · se recargan en Short Rest</p>`:""}</div>
    <div class="bx" style="flex:1"><h2>Cantrips &amp; Prepared Spells</h2><table class="tbl"><tr><th>Lvl</th><th>Name</th><th>Casting Time</th><th>Range</th><th>C R M</th><th>Notes</th></tr>${spRows||"<tr><td colspan=6>—</td></tr>"}</table><p class="lab" style="margin-top:4px">● siempre preparado · C concentration · R ritual · M material</p></div></div>
   <div class="col" style="flex:1"><div class="bx"><h2>Appearance</h2><div style="min-height:60px">${md(c.info.appearance)}</div></div>
    <div class="bx"><h2>Backstory &amp; Personality</h2><div style="min-height:110px">${md(c.info.personality)}${c.info.backstory?"<br><br>"+md(c.info.backstory):""}</div></div>
    <div class="bx"><div class="row"><div style="flex:1"><div class="lab">Alignment</div><b>${esc(c.info.alignment||"—")}</b></div><div style="flex:2"><div class="lab">Languages</div><b>${esc(c.info.languages||"—")}</b></div></div></div>
    <div class="bx"><h2>Equipment</h2>${c.armor!=="none"&&SRD.armor[c.armor]?`<p style="margin:0">Armor: ${esc(SRD.armor[c.armor].n)}${c.shield?" + Shield":""}</p>`:c.shield?"<p style=\"margin:0\">Shield</p>":""}<div>${md(c.equipment)}</div>
     <div class="row" style="margin-top:6px">${["cp","sp","ep","gp","pp"].map(k=>`<div class="bx" style="flex:1;text-align:center;padding:3px"><div class="lab">${k}</div><b>${c.coins[k]||0}</b></div>`).join("")}</div></div>
    <div class="bx"><h2>Magic Item Attunement</h2><p style="margin:0;color:#6a6280">No se usan magic items en la campaña.</p>${dots(3,0)}</div></div></div>${foot(2)}</div>`;
  /* page 3: features full */
  const grp={class:"Class Features",species:"Species Traits",feat:"Feats"};
  let p3=`<div class="pg"><h2 style="font-size:16px">Rasgos y feats — texto completo</h2><div class="cols2">${Object.entries(grp).map(([g,t])=>`<div class="it"><h4 style="color:#3a2a6b;text-transform:uppercase;letter-spacing:.05em">${t}</h4></div>`+K.fe.filter(f=>f.g===g&&f.d).map(f=>`<div class="it"><h4>${esc(f.n)}</h4><div class="meta">${esc(f.src)}</div>${md(f.d)}</div>`).join("")).join("")}</div>${foot(3)}</div>`;
  /* page 4: spells full */
  let n=4;let p4=K.spells.length?`<div class="pg"><h2 style="font-size:16px">Grimorio</h2><div class="cols2">${K.spells.map(s=>`<div class="it"><h4>${esc(s.d.n)}</h4><div class="meta">${s.d.l?"Nivel "+s.d.l:"Cantrip"} ${esc(s.d.s)} · ${esc(s.d.t)} · ${esc(s.d.r)} · ${esc(s.d.c)}${s.d.m?" ("+esc(s.d.m)+")":""} · ${esc(s.d.du)}${s.d.co?" · Concentration":""}${s.d.ri?" · Ritual":""}</div>${md(s.d.d)}${s.d.h?`<br><i>A mayor nivel.</i> ${md(s.d.h)}`:""}</div>`).join("")}</div>${foot(n++)}</div>`:"";
  /* page 5: house rules */
  const hbUsed=[];Object.entries(HBTYPES).forEach(([t,l])=>Object.keys(HB[t]||{}).forEach(k=>{const used=t==="spells"?K.spells.some(s=>s.id===k):t==="feats"?K.feats.some(f=>f.id===k):t==="species"?c.species.id===k:t==="backgrounds"?c.bg.id===k:t==="classes"?c.classes.some(x=>x.id===k):c.classes.some(x=>x.sub===k);
    if(used)hbUsed.push(`<li><b>${esc(HB[t][k].n)}</b> <span class="meta">${l} · ${SRD[t]&&SRD[t][k]?"SRD modificado":"homebrew"}</span></li>`)}));
  let p5=`<div class="pg"><h2 style="font-size:16px">Reglas de la casa y personalizaciones</h2><p>Valores marcados con <span class="hr-tag">★</span> en la hoja no siguen el cálculo estándar.</p>
   <div class="it"><h4>Modificadores</h4><ul>${K.mods.map(m=>`<li>${esc(tLabel(m.t))}: ${esc(opLabel(m))} — <i>${esc(m.src)}${m.note?" · "+esc(m.note):""}</i></li>`).join("")||"<li>Ninguno.</li>"}</ul></div>
   <div class="it"><h4>Overrides manuales</h4><ul>${K.ovs.map(k=>`<li>${esc(tLabel(k.replace(/^skill:/,"skill:")))||esc(k)} = ${esc(c.ov[k])}</li>`).join("")||"<li>Ninguno.</li>"}</ul></div>
   <div class="it"><h4>Contenido homebrew en uso</h4><ul>${hbUsed.join("")||"<li>Ninguno.</li>"}</ul></div>
   ${c.info.notes?`<div class="it"><h4>Notas</h4>${md(c.info.notes)}</div>`:""}
   <p class="meta" style="margin-top:20px;color:#8a83a0">Contenido SRD 5.2 © Wizards of the Coast, CC-BY-4.0.</p>${foot(n)}</div>`;
  return p1+p2+p3+p4+p5}
function standalone(c){const K=compute(c);return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.info.name)} — hoja</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grenze:wght@600;700&family=Alegreya+Sans:ital,wght@0,400;0,700;1,400&display=swap">
<style>body{background:#e9e6ef;margin:0;padding:20px 0}${SHEET_CSS}@media print{body{background:#fff;padding:0}.pg{box-shadow:none;margin:0;page-break-after:always}}</style></head><body><div id="sheet">${sheetHTML(c,K)}</div></body></html>`}

/* ---------- files ---------- */
async function saveFile(name,data){
  try{if(window.claude&&window.claude.use){const d=await claude.use("downloads");if(d){await d.save({filename:name,data});return}}}catch(e){if(e&&e.code==="declined")return}
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data]));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
const slug=s=>String(s||"personaje").toLowerCase().normalize("NFD").replace(/[^\w]+/g,"-").replace(/^-|-$/g,"")||"personaje";
function importData(txt){let o;try{o=JSON.parse(txt)}catch(e){return "No es un JSON válido."}
  let n=0;const fix=x=>{const b=newChar();const r=Object.assign(b,x);r.id=CH[x.id]?"c_"+uid():(x.id||"c_"+uid());["info","species","bg","base","profs","coins","ov","imp","fs","hpRolls"].forEach(k=>r[k]=Object.assign({},b[k],x[k]||{}));CH[r.id]=r;Store.put(r.id,r);cur=r.id;n++};
  if(o&&o.CH){Object.values(o.CH).forEach(fix);if(o.HB){Object.keys(HBTYPES).forEach(t=>Object.assign(HB[t],(o.HB||{})[t]||{}));saveHB()}}
  else if(o&&o.info)fix(o);else return "No reconozco el formato.";
  return `Importado: ${n} personaje${n===1?"":"s"}.`}

/* ---------- events ---------- */
function parseVal(el){const t=el.dataset.t;if(t==="b")return el.checked;if(t==="n"){if(el.value==="")return el.dataset.k.startsWith("ov.")?undefined:"";return +el.value}
  if(t==="list")return el.value.split(",").map(s=>s.trim()).filter(Boolean);return el.value}
function bindSet(el){const k=el.dataset.k;const v=parseVal(el);
  if(k.startsWith("HB.")){setP(HB,k.slice(3),v);saveHB();return "hb"}
  setP(C(),k,v);saveChar();return "c"}
document.addEventListener("input",e=>{const el=e.target;
  if(el.id==="spq"){spQ=el.value;$("#spres").innerHTML=spResults(C(),compute(C()));return}
  if(!el.dataset||!el.dataset.k||el.tagName==="SELECT"||el.type==="checkbox")return;
  bindSet(el);if(view==="build")renderSummary()});
document.addEventListener("change",e=>{const el=e.target;
  if(el.id==="chars"){cur=el.value;Store.saveLocal();render();return}
  if(el.id==="splv"){spLv=el.value;$("#spres").innerHTML=spResults(C(),compute(C()));return}
  if(el.id==="spsrc"){spSrc=el.value;$("#spres").innerHTML=spResults(C(),compute(C()));return}
  if(el.id==="sponly"){spOnly=el.checked;$("#spres").innerHTML=spResults(C(),compute(C()));return}
  if(el.id==="impfile"){const f=el.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("#imp").value=r.result};r.readAsText(f);return}
  if(!el.dataset||!el.dataset.k)return;
  if(el.tagName==="SELECT"||el.type==="checkbox"||el.dataset.rr){bindSet(el);
    if(el.dataset.k==="species.id")C().species.lin="";
    rr()}});
function keepScroll(f){const y=scrollY;f();scrollTo(0,y)}
let ptrDown=false,pend=false;
addEventListener("pointerdown",()=>{ptrDown=true},true);
addEventListener("pointerup",()=>{ptrDown=false;if(pend){pend=false;setTimeout(()=>keepScroll(render),0)}},true);
function rr(){if(ptrDown)pend=true;else keepScroll(render)}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,v=b.dataset.v,c=C();
  if(b.tagName==="A")e.preventDefault();
  const done=(hb)=>{hb?saveHB():saveChar();keepScroll(render)};
  switch(a){
   case "view":view=v;render();scrollTo(0,0);return;
   case "step":step=v;render();scrollTo(0,0);return;
   case "new":{const n=newChar();CH[n.id]=n;cur=n.id;step="basicos";view="build";Store.put(n.id,n);render();return}
   case "dup":{const n=clone(c);n.id="c_"+uid();n.info.name+=" (copia)";CH[n.id]=n;cur=n.id;Store.put(n.id,n);render();return}
   case "delask":$("#delbar").hidden=false;return;
   case "delno":$("#delbar").hidden=true;return;
   case "delyes":{const id=cur;delete CH[id];await Store.del(id);if(!Object.keys(CH).length){const n=newChar();CH[n.id]=n}cur=Object.keys(CH)[0];$("#delbar").hidden=true;Store.put(cur,C());render();return}
   case "del":{const ks=v.split(".");const isHB=ks[0]==="HB";const root=isHB?HB:c;const path=isHB?ks.slice(1):ks;const arr=getP(root,path.slice(0,-1).join("."));arr.splice(+path[path.length-1],1);done(isHB);return}
   case "push":{const def={extraFeats:{id:"",src:""},attacks:{w:"custom",n:"",ab:"",dmg:""},features:{n:"",src:"",d:"",g:"class",mods:[]},resources:{n:"",max:"",rec:"Long Rest"}}[v];getP(c,v).push(def);done();return}
   case "addmod":{const isHB=v.startsWith("HB.");const root=isHB?HB:c;const p=isHB?v.slice(3):v;if(!getP(root,p))setP(root,p,[]);getP(root,p).push({on:true,t:"",op:"add",v:0,note:""});done(isHB);return}
   case "addcls":c.classes.push({id:"wizard",lv:1,sub:""});done();return;
   case "bgskills":{const bg=lib("backgrounds")[c.bg.id];(bg&&bg.sk||[]).forEach(s=>c.skills[s]=Math.max(1,c.skills[s]||0));done();return}
   case "array":{const order=AB.slice().sort((x,y)=>(c.base[y]||0)-(c.base[x]||0));[15,14,13,12,10,8].forEach((n,i)=>c.base[order[i]]=n);done();return}
   case "addspell":c.spells.push({id:v,src:spSrc,prep:true});saveChar();keepScroll(render);return;
   case "clearov":delete c.ov[v];done();return;
   case "preset":{const P={pb:{t:"pb",op:"set",v:compute(c).pb,note:"PB fijo"},pts:{t:"ab:"+AB[0],op:"add",v:1,note:"Puntos extra"},pact:{t:"pact",op:"add",v:1,note:"Slot extra"},hp:{t:"hpLv",op:"add",v:1,note:"HP extra"}}[v];
     c.mods.push(Object.assign({on:true},P));done();return}
   case "hbtype":hbType=v;hbEdit=null;render();return;
   case "hbnew":{const id="hb-"+uid();HB[hbType][id]=hbBlank(hbType);hbEdit=id;done(true);return}
   case "hbcopy":{const k=$("#hbsrd").value;if(!k)return;HB[hbType][k]=Object.assign(clone(SRD[hbType][k]),HB[hbType][k]||{});if(!HB[hbType][k].mods)HB[hbType][k].mods=[];hbEdit=k;done(true);return}
   case "hbedit":hbEdit=v;render();return;
   case "hbdel":delete HB[hbType][v];if(hbEdit===v)hbEdit=null;done(true);return;
   case "hbrow":{const p=v.slice(3);if(!getP(HB,p))setP(HB,p,[]);getP(HB,p).push(/\.sp$/.test(p)?{lv:1,ids:""}:{n:"",lv:1,d:""});done(true);return}
   case "hbdelrow":{const ks=v.slice(3).split(".");getP(HB,ks.slice(0,-1).join(".")).splice(+ks[ks.length-1],1);done(true);return}
   case "pushv":{const p=v.slice(3);const arr=getP(HB,p)||[];arr.push("str");setP(HB,p,arr);done(true);return}
   case "exjson":saveFile(slug(c.info.name)+".json",JSON.stringify(c,null,1));return;
   case "exall":saveFile("dnd-personajes.json",JSON.stringify({CH,HB},null,1));return;
   case "exsheet":saveFile(slug(c.info.name)+"-hoja.html",standalone(c));return;
   case "copyjson":try{await navigator.clipboard.writeText(JSON.stringify(c));b.textContent="Copiado"}catch(err){$("#imp").value=JSON.stringify(c);$("#imp").select();b.textContent="Seleccionado abajo"}return;
   case "import":{$("#impmsg").textContent=importData($("#imp").value);render();return}
   case "print":window.print();return;
  }});

/* ---------- boot ---------- */
function boot(data){
  if(data&&data.CH&&Object.keys(data.CH).length){CH=data.CH;if(data.HB)HB=Object.assign(blankHB(),data.HB);cur=data.cur&&CH[data.cur]?data.cur:Object.keys(CH)[0]}
  else{const n=newChar();CH={[n.id]:n};cur=n.id}
  render()}
const st=document.createElement("style");st.textContent=SHEET_CSS+PRINT_CSS;document.head.appendChild(st);
boot(Store.local());status(window.claude&&window.claude.use?"Conectando…":"Guardado en este navegador");
Store.init().then(async ok=>{
  if(!ok){status("Guardado solo en este navegador");return}
  try{const {ch,hb}=await Store.loadCloud();
    if(Object.keys(ch).length){CH=ch;if(hb)HB=Object.assign(blankHB(),hb);if(!CH[cur])cur=Object.keys(CH)[0];Store.saveLocal();render();status("Guardado en tu cuenta")}
    else{Object.values(CH).forEach(x=>Store.put(x.id,x));if(Object.values(HB).some(o=>Object.keys(o).length))saveHB();status("Guardado en tu cuenta")}}
  catch(e){status("No se pudo leer tu cuenta; uso este navegador")}});
window.__armador={compute,CH:()=>CH,HB:()=>HB,sheetHTML,standalone};
})();
