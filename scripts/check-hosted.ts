import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ChatResult } from '../src/shared';
const url=process.env.CAREPATH_TEST_URL || 'https://carepath-bookingcare-assistant.finitejet1.chatgpt.site';
const base=new URL(url);
if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!(base.protocol==='https:'||base.hostname==='127.0.0.1'&&base.protocol==='http:'))throw Error('Use an HTTPS site origin or http://127.0.0.1 for local testing.');
const cookies=new Map<string,string>();let csrf='';
async function call(path:string,body?:unknown){
  const started=performance.now();
  const response=await fetch(base.origin+path,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(body===undefined?{}:{origin:base.origin,'content-type':'application/json','x-csrf-token':csrf})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  for(const s of response.headers.getSetCookie()){const p=s.split(';')[0],i=p.indexOf('=');cookies.set(p.slice(0,i),p.slice(i+1));}
  const data=await response.json();if(data.csrfToken)csrf=data.csrfToken;
  return {response,data,latencyMs:Math.round(performance.now()-started)};
}
const report:{generatedAt:string;url:string;status:string;checks:Record<string,boolean>;scenarios:unknown[];summary?:unknown}={generatedAt:new Date().toISOString(),url:base.origin,status:'started',checks:{},scenarios:[]};
let signedIn=false;
try{
  const anonymous=await call('/api/health');report.checks.anonymousBlocked=anonymous.response.status===401;
  if(!report.checks.anonymousBlocked)throw Error('Anonymous API protection failed');
  const session=await call('/api/auth/session');if(!session.response.ok||!csrf)throw Error('Auth bootstrap failed');
  const email=`carepath-qa-${randomUUID()}@example.test`,password=randomBytes(24).toString('base64url');
  const signup=await call('/api/auth/register',{name:'CarePath QA',email,password});
  signedIn=signup.response.status===201;report.checks.registration=signedIn;if(!signedIn)throw Error('Registration failed (check signup quota)');
  const health=await call('/api/health');report.checks.claudeConfigured=health.response.ok&&health.data.llmConfigured===true&&health.data.provider==='anthropic';
  if(!report.checks.claudeConfigured)throw Error('Hosted Claude key is not configured');
  const search=await call('/api/search?q=Ti%C3%AAu%20h%C3%B3a&type=specialty');
  const specialty=search.data.items?.find((r:{id:string})=>r.id==='s22');
  report.checks.readableExcerpt=search.response.ok&&!!specialty?.displayExcerpt?.includes('\n\n')&&!specialty?.displayExcerpt?.includes('Tiêu hóaTiêu hóa');
  if(!report.checks.readableExcerpt)throw Error('Readable source excerpt is missing');
  const measurements:{latencyMs:number;inputTokens:number;outputTokens:number}[]=[];
  for(const scenario of [
    {id:'doctor',message:'Bác sĩ Hà Văn Quyết khám chuyên khoa gì?',city:'Hà Nội'},
    {id:'facility',message:'Tôi muốn tìm xét nghiệm tại Diag ở TP. Hồ Chí Minh',city:'TP. Hồ Chí Minh'},
    {id:'booking',message:'Hướng dẫn đặt lịch bác sĩ Hà Văn Quyết sáng mai',city:'Hà Nội'}
  ]){
    const {response,data,latencyMs}=await call('/api/chat',{message:scenario.message,city:scenario.city});const result=data as ChatResult;
    const passed=response.ok&&result.mode==='llm'&&!!result.answer?.trim()&&typeof result.metrics?.inputTokens==='number'&&typeof result.metrics?.outputTokens==='number'&&result.metrics.outputTokens<=500;
    report.scenarios.push({...scenario,httpStatus:response.status,endToEndLatencyMs:latencyMs,passed,result});
    console.log(JSON.stringify({id:scenario.id,passed,mode:result.mode,latencyMs,inputTokens:result.metrics?.inputTokens,outputTokens:result.metrics?.outputTokens}));
    if(passed)measurements.push({latencyMs,inputTokens:result.metrics.inputTokens!,outputTokens:result.metrics.outputTokens!});
  }
  const logout=await call('/api/auth/logout',{});signedIn=false;report.checks.logout=logout.response.ok;
  report.checks.blockedAfterLogout=(await call('/api/health')).response.status===401;
  const mean=(values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
  report.status=measurements.length===3&&Object.values(report.checks).every(Boolean)?'hosted-smoke-complete':'hosted-smoke-incomplete';
  report.summary={total:3,llmSucceeded:measurements.length,meanEndToEndLatencyMs:measurements.length?mean(measurements.map(m=>m.latencyMs)):null,meanInputTokens:measurements.length?mean(measurements.map(m=>m.inputTokens)):null,meanOutputTokens:measurements.length?mean(measurements.map(m=>m.outputTokens)):null,note:'Three authenticated real HTTP conversations. Not the 120-case LLM-as-judge evaluation. Does not measure browser rendering.'};
  console.log(JSON.stringify({status:report.status,checks:report.checks,summary:report.summary},null,2));
  if(report.status!=='hosted-smoke-complete')process.exitCode=1;
}catch{report.status='hosted-smoke-failed';console.error('Hosted smoke failed; check HTTP/auth/configuration. No credentials logged.');process.exitCode=1;}
finally{
  if(signedIn)try{await call('/api/auth/logout',{});}catch{/* Do not log session tokens or raw errors. */}
  await mkdir('reports',{recursive:true});await writeFile('reports/hosted-smoke.json',JSON.stringify(report,null,2)+'\n');
}
