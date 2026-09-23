import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
// [D-93] 고용지원금 매니저 Pro 원본(git-test-kind-cori src/components/app/SubsidyApp.jsx)을 그대로 옮긴 것.
//   바꾼 곳만 [D-93] 으로 적었다: 저장(→ EmploymentOrig.tsx · 모듈 기록), 업체 추가(→ 고객 운영 업체 고르기),
//   로그인·결제·관리자·피드백·샘플·PIN(→ 없음), 브라우저 뒤로가기(→ OS 주소), 엑셀 읽기(→ OS 엑셀 읽개).
//   화면·문장·계산은 원본 그대로다.
import { supabase, validateUploadFile, trackActivity, accessPeriodLabel, hrPortalRoot, readSheetGrid, downloadCsv } from "./stubs";
import * as PD from "./payrollDiagnosis";

// ── 상수 ──────────────────────────────────────────────────
var MIN_WAGE_2026 = 10320;
var MIN_WAGE_MONTH_2026 = 2156880;
var BOSU_FLOOR_2026 = 1240000;
var GROUP_COLORS = {
  "신규채용":{base:"#2563EB",light:"#DBEAFE",text:"#1D4ED8",dark:"#1E40AF",badge:"#EFF6FF",icon:"🆕"},
  "재직자유지":{base:"#475569",light:"#E2E8F0",text:"#334155",dark:"#1E293B",badge:"#F1F5F9",icon:"🔄"},
  "육아":{base:"#059669",light:"#D1FAE5",text:"#047857",dark:"#065F46",badge:"#ECFDF5",icon:"🤱"},
  "커스텀":{base:"#6B7280",light:"#F1F5F9",text:"#4B5563",dark:"#374151",badge:"#F8FAFC",icon:"⚙️"}
};
function gc(group,key){ var g=GROUP_COLORS[group]||GROUP_COLORS["커스텀"]; return g[key]||g.base; }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).substr(2,6); }
function ruuid(){ return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);}); }
// ── 화면 안내 가이드 숨김(하루 동안) · localStorage 만료 시각 기반 ──
var GUIDE_HIDE_PREFIX="hrSubsidyPro_guideHideUntil_";
function guideHidden(key){try{var v=localStorage.getItem(GUIDE_HIDE_PREFIX+key);return !!(v&&Date.now()<Number(v));}catch(e){return false;}}
function guideHideForDay(key){try{localStorage.setItem(GUIDE_HIDE_PREFIX+key,String(Date.now()+86400000));}catch(e){}}
function guideReset(key){try{localStorage.removeItem(GUIDE_HIDE_PREFIX+key);}catch(e){}}
// ── 전체 글자 크기(설정) 적용 ──
function applyFontScale(v){try{document.documentElement.setAttribute("data-fontscale",v==="large"||v==="xlarge"?v:"normal");}catch(e){}}
function fD(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"."+(d.getMonth()+1)+"."+d.getDate(); }
function fDFull(ds){ if(!ds) return ""; var d=new Date(ds); return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+d.getDate()+"일"; }
function fMan(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000).toLocaleString()+"만 원":((n||0).toLocaleString())+"원"; }
function fManS(n){ var v=Math.abs(n||0); return v>=10000?Math.round(n/10000)+"만":String(n||0); }
function fProgramAmt(p){ var r=p.rounds||[]; if(r.length===1&&(r[0].label||"").indexOf("월")>=0){return"월 최대 "+fMan(r[0].amount);} return"1인당 최대 "+fMan(p.totalAmount||0); }
// 직원의 지원 연도: 저장된 programYear 우선, 없으면 프로그램 기본 연도, 없으면 올해
function empProgYear(e,programs){ if(e&&e.programYear)return Number(e.programYear); var p=programs&&programs[e&&e.programId]; if(p&&p.year)return Number(p.year); return new Date().getFullYear(); }
function addMo(ds,m){ if(!ds) return ""; var d=new Date(ds); d.setMonth(d.getMonth()+m); return d.toISOString().split("T")[0]; }
function getDday(ds){ if(!ds) return null; var today=new Date(); today.setHours(0,0,0,0); var target=new Date(ds); target.setHours(0,0,0,0); return Math.ceil((target-today)/(1000*60*60*24)); }
function formatDday(d){ if(d===null) return ""; if(d===0) return "D-Day"; if(d<0) return "D+"+Math.abs(d); return "D-"+d; }
function isFuture(ds){ if(!ds) return true; return new Date(ds)>new Date(); }
function calcAgeDetailed(b,r){ if(!b) return null; var bd=new Date(b); var rd=r?new Date(r):new Date(); var years=rd.getFullYear()-bd.getFullYear(); var months=rd.getMonth()-bd.getMonth(); if(rd.getDate()<bd.getDate()) months--; if(months<0){years--;months+=12;} return {years:years,months:months,totalMonths:years*12+months}; }
function cAge(b,r){ var d=calcAgeDetailed(b,r); return d?d.years:null; }
function calcMilitaryLimit(milMonths){ var base=34*12; var ext=base+(milMonths||0); var capped=Math.min(ext,39*12); return{maxTotalMonths:capped,maxYears:Math.floor(capped/12),maxRemainMonths:capped%12,isBorderline:milMonths>0&&capped>34*12}; }
function fDateTime(ds){ if(!ds) return ""; var d=new Date(ds); var y=d.getFullYear(); var mo=d.getMonth()+1; var day=d.getDate(); var h=d.getHours(); var mi=d.getMinutes(); var ampm=h>=12?"오후":"오전"; var h12=h%12; if(h12===0)h12=12; return y+"."+mo+"."+day+" "+ampm+" "+h12+":"+(mi<10?"0"+mi:mi); }
function parseJumin(jumin){ if(!jumin||jumin.length<7) return null; var clean=jumin.replace(/[^0-9]/g,""); if(clean.length<7) return null; var yy=parseInt(clean.substring(0,2)); var mm=parseInt(clean.substring(2,4)); var dd=parseInt(clean.substring(4,6)); var gc2=parseInt(clean.substring(6,7)); var century=1900; var gender="male"; if(gc2===1||gc2===2){century=1900;}else if(gc2===3||gc2===4){century=2000;}else if(gc2===9||gc2===0){century=1800;} if(gc2%2===0){gender="female";} var year=century+yy; var bd=year+"-"+(mm<10?"0"+mm:mm)+"-"+(dd<10?"0"+dd:dd); return{birthDate:bd,gender:gender,year:year}; }
// ── 입력값 검증/포맷 유틸 (보안: 잘못된/위험한 값 차단) ──────
function fmtBizNo(v){ var d=(v||"").replace(/[^0-9]/g,"").substring(0,10); if(d.length<4)return d; if(d.length<6)return d.substring(0,3)+"-"+d.substring(3); return d.substring(0,3)+"-"+d.substring(3,5)+"-"+d.substring(5); }
function fmtPhone(v){ var d=(v||"").replace(/[^0-9]/g,"").substring(0,11); if(d.length<3)return d; if(d.startsWith("02")){ if(d.length<6)return d.substring(0,2)+"-"+d.substring(2); if(d.length<10)return d.substring(0,2)+"-"+d.substring(2,5)+"-"+d.substring(5); return d.substring(0,2)+"-"+d.substring(2,6)+"-"+d.substring(6,10); } if(d.length<8)return d.substring(0,3)+"-"+d.substring(3); if(d.length<11)return d.substring(0,3)+"-"+d.substring(3,6)+"-"+d.substring(6); return d.substring(0,3)+"-"+d.substring(3,7)+"-"+d.substring(7); }
function isValidEmail(v){ if(!v)return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
var MAX_MONEY=10000000000; // 100억 — 비정상 입력 방지 상한
function clampMoney(v){ var n=Number(v); if(isNaN(n)||n<0)return 0; if(n>MAX_MONEY)return MAX_MONEY; return n; }
function clampRate(v){ var n=Number(v); if(isNaN(n)||n<0)return 0; if(n>100)return 100; return n; }
function checkWage(monthlyPay,weeklyHours){ if(!monthlyPay||monthlyPay<=0) return null; var wh=weeklyHours||40; var mh=wh>=40?209:Math.round((wh+(wh>=15?wh/40*8:0))*4.345); var hourlyWage=Math.round(monthlyPay/mh); var minMonthly=Math.round(MIN_WAGE_2026*mh); return{hourlyWage:hourlyWage,monthlyHours:mh,minMonthly:minMonthly,minHourly:MIN_WAGE_2026,isAboveMin:hourlyWage>=MIN_WAGE_2026,isAboveFloor:monthlyPay>=BOSU_FLOOR_2026,gap:hourlyWage-MIN_WAGE_2026}; }
function makeExcelData(companies,employees,programs){ var rows=[["업체명","사업자번호","대표자","직원명","지원금","상태","입사일","총예정","수령완료"]]; employees.forEach(function(emp){ var c=companies.find(function(x){return x.id===emp.companyId;}); var p=programs[emp.programId]; var st=STS.find(function(s){return s.key===emp.status;}); var rcv=(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0); rows.push([c?c.name:"",c?c.bizNo||"":"",c?c.ceoName||"":"",emp.name,p?p.name:"",st?st.label:"",emp.startDate||"",emp.totalExpected||0,rcv]); }); return rows.map(function(r){return r.join("\t");}).join("\n"); }
function makeExcelTemplate(){ return "이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID\n예시직원\t9501011\t2026-01-15\t010-1234-5678\thong@email.com\tyouth_jump"; }
function parseExcelData(text,programs){ var lines=text.trim().split("\n"); if(lines.length<2) return []; var results=[]; for(var i=1;i<lines.length;i++){ var cols=lines[i].split("\t"); if(cols.length<3) continue; var name=(cols[0]||"").trim(); var parsed=parseJumin((cols[1]||"").trim()); if(!name) continue; var pid=(cols[5]||"youth_jump").trim(); results.push({name:name,birthDate:parsed?parsed.birthDate:"2000-01-01",gender:parsed?parsed.gender:"male",startDate:(cols[2]||"").trim(),phone:(cols[3]||"").trim(),email:(cols[4]||"").trim(),programId:programs[pid]?pid:"youth_jump"}); } return results; }

// ── 지원금 데이터 ───────────────────────────────────────────
export var DEFAULT_PROGRAMS = { // [D-93] export — 옛 기록(D-91 켜고 끄기)을 옮길 때 쓴다
  youth_jump:{id:"youth_jump",name:"청년일자리도약장려금",year:2026,group:"신규채용",color:"#1D4ED8",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],companyDocs:["사업자등록증","사업참여신청서","사업주확인서","협약서","기업통장사본","4대보험가입자명부","개인정보동의서(사업주)","고용보험취득확인서"],employeeDocs:["근로계약서","임금대장(6개월)","급여이체확인서류","개인정보동의서(근로자)","최종학력확인서(졸업증명서)","사실증명확인서"],hasEligibility:true,isCustom:false,isBuiltIn:true,note:"수도권: 기업 720만(취업애로요건 필수). 비수도권: 기업 720만+청년 근속인센티브 480~720만. 사전신청 후 채용(예외: 입사일 기준 3개월 내). 6개월 유지 후 1차 지급.",applyUrl:"고용24(work24.go.kr)",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["정규직"],preApply:true,companyMax:null,regionSensitive:true,bosuFloor:true}},
  work_exp:{id:"work_exp",name:"미래내일 일경험",year:2026,group:"신규채용",color:"#2563EB",totalAmount:1400000,rounds:[{month:1,amount:200000,label:"1개월"},{month:2,amount:200000,label:"2개월"},{month:3,amount:200000,label:"3개월"},{month:4,amount:200000,label:"4개월"}],companyDocs:["사업자등록증","사업참여신청서","운영계획서","협약서","개인정보동의서"],employeeDocs:["참여신청서","동의서및서약서","출근부","수당지급확인서"],isCustom:false,isBuiltIn:true,note:"인턴형 기준 기업 월20만+멘토수당 별도. 청년 주35만 수당. 기업 고용보험 10인↑(예외 벤처/이노/메인). 청년 미취업·사업자등록 불가.",applyUrl:"고용24 / 1811-8447",match:{cats:["청년"],ageMin:15,ageMax:34,milExtend:true,gender:"any",empTypes:["인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  saeil_women:{id:"saeil_women",name:"새일여성인턴제",year:2026,group:"신규채용",color:"#2563EB",totalAmount:4000000,rounds:[{month:1,amount:800000,label:"인턴1개월"},{month:2,amount:800000,label:"인턴2개월"},{month:3,amount:800000,label:"인턴3개월"},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],companyDocs:["사업자등록증","사업참여신청서","인턴약정서","협약서","기업통장사본"],employeeDocs:["구직등록확인서","근로계약서","임금대장","급여이체확인서류"],isCustom:false,isBuiltIn:true,note:"기업 최대 400만. 새일센터 연계·인턴약정 먼저. 고용보험 5인↑~1000인미만. 가족채용 영구배제.",applyUrl:"여성새로일하기센터(saeil.mogef.go.kr)",match:{cats:["여성"],ageMin:null,ageMax:null,gender:"female",empTypes:["인턴","정규직"],preApply:true,companyMax:1000,regionSensitive:false,bosuFloor:false,special:["경력단절"]}},
  emp_promo:{id:"emp_promo",name:"고용촉진장려금",year:2026,group:"신규채용",color:"#0284C7",totalAmount:7200000,rounds:[{month:6,amount:3600000,label:"1회차(6개월)"},{month:12,amount:3600000,label:"2회차(12개월)"}],companyDocs:["사업자등록증","고용촉진장려금 지급신청서","근로계약서","고용보험확인서"],employeeDocs:["근로계약서","월별급여대장","급여이체증빙","취업지원프로그램 이수증"],isCustom:false,isBuiltIn:true,note:"우선지원/중견 연 720만. 취업지원프로그램 이수자·중증장애인·여성가장 정규직. 보수 124만↑. 12개월 내 첫 신청.",applyUrl:"고용24(work24.go.kr)",match:{cats:["취약계층"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["프로그램이수"]}},
  senior_intern:{id:"senior_intern",name:"시니어 인턴십",year:2026,group:"신규채용",color:"#2563EB",totalAmount:5500000,rounds:[{month:3,amount:1200000,label:"1단계(3개월)"},{month:9,amount:1500000,label:"2단계(6개월)"},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],companyDocs:["사업자등록증","사업참여신청서","협약서","4대보험가입자명부"],employeeDocs:["근로계약서","사전교육 이수증","월별급여대장"],isCustom:false,isBuiltIn:true,note:"일반형 최대 550만. 만60세↑. 한국노인인력개발원 사전승인 필수. 요양보호사·경비·청소 등 단순노무 제외.",applyUrl:"한국노인인력개발원 / seniorro.or.kr",match:{cats:["고령자"],ageMin:60,ageMax:null,gender:"any",empTypes:["정규직","인턴"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:false}},
  disabled_emp:{id:"disabled_emp",name:"장애인 고용장려금",year:2026,group:"신규채용",color:"#1E3A5F",totalAmount:5400000,rounds:[{month:1,amount:450000,label:"월(예시·중증여)"}],companyDocs:["고용장려금 지급신청서","장애인 근로자 명부","근로계약서"],employeeDocs:["장애인증명서","근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"경증 남35/여50, 중증 남70/여90만 매월. 고용보험 가입+최저임금↑ 필수.",applyUrl:"한국장애인고용공단 e-신고(esingo.or.kr)",match:{cats:["장애인"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직","계약직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["장애"]}},
  regular_convert:{id:"regular_convert",name:"정규직 전환 지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1차(3개월)"},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],companyDocs:["사업참여신청서","정규직전환 근로계약서","사업자등록증","취업규칙"],employeeDocs:["전환 전 근로계약서","전환 후 근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"기본 월40만+임금인상보전 월20만=연720. 5~30인미만. 2026 예산 한정·상반기 사전승인 필수. 6개월↑ 기간제→정규직. 먼저 전환하면 0원.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직"],preApply:true,companyMax:30,regionSensitive:false,bosuFloor:true,special:["정규직전환"]}},
  senior_continue:{id:"senior_continue",name:"고령자 계속고용 장려금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:900000,label:"1분기"},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],companyDocs:["지급신청서","취업규칙(정년 명문화)","재고용 근로계약서"],employeeDocs:["근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"수도권 분기90만 2년 최대720. 비수도권 분기120만 3년 최대1440(2026). 정년연장/폐지/재고용 취업규칙 필수. 100인미만.",applyUrl:"고용24(work24.go.kr)",match:{cats:["고령자","재직"],ageMin:55,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:100,regionSensitive:true,bosuFloor:false,special:["정년도달"]}},
  worklife45:{id:"worklife45",name:"워라밸+4.5 프로젝트",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1분기"},{month:6,amount:1800000,label:"2분기"},{month:9,amount:1800000,label:"3분기"},{month:12,amount:1800000,label:"4분기"}],companyDocs:["노사합의서","사업참여신청서(재단)","근태관리 증빙","취업규칙"],employeeDocs:["변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"기존직원 부분단축 연240/전면단축 연720. 신규채용 보너스 별도. 20인↑. 노사발전재단(nosa.or.kr) 사전신청.",applyUrl:"노사발전재단(nosa.or.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:true,companyMin:20,companyMax:null,regionSensitive:false,bosuFloor:false,special:["주4.5일제"]}},
  parental_leave:{id:"parental_leave",name:"육아휴직 지원금(사업주)",year:2026,group:"육아",color:"#059669",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["육아휴직 확인서","사업자등록증","근로계약서"],employeeDocs:["육아휴직 신청서","가족관계증명서","휴직 발령 증빙"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 생후12개월내 특례 첫3개월 월100만. 우선지원대상+30일↑ 허용.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["육아휴직"]}},
  parental_reduce:{id:"parental_reduce",name:"육아기 근로시간 단축(사업주)",year:2026,group:"육아",color:"#059669",totalAmount:3600000,rounds:[{month:3,amount:900000,label:"1차(3개월)"},{month:6,amount:900000,label:"2차(6개월)"},{month:9,amount:900000,label:"3차(9개월)"},{month:12,amount:900000,label:"4차(12개월)"}],companyDocs:["근로시간 단축 확인서","사업자등록증","변경 근로계약서"],employeeDocs:["단축 신청서","가족관계증명서","변경 근로계약서"],isCustom:false,isBuiltIn:true,note:"사업주 월30만(남성 +10만). 근로자 단축급여 월최대250만. 만12세↓ 자녀, 최대3년.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["근로시간단축"]}},
  replace_worker:{id:"replace_worker",name:"대체인력 지원금",year:2026,group:"육아",color:"#047857",totalAmount:21000000,rounds:[{month:1,amount:1400000,label:"월(예시·30인미만)"}],companyDocs:["대체인력 채용 증빙","육아휴직 확인서","사업자등록증"],employeeDocs:["대체인력 근로계약서","월별임금대장","급여이체증빙"],isCustom:false,isBuiltIn:true,note:"육아휴직 대체 30인미만 월최대140(최대15개월=2100). 100% 즉시 선지급. 채용전3개월~후1년 감원 시 전액환수.",applyUrl:"고용24 + 인재채움뱅크",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["계약직","정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:true,special:["대체인력"]}},
  work_share:{id:"work_share",name:"동료 업무분담 지원금",year:2026,group:"육아",color:"#059669",totalAmount:600000,rounds:[{month:1,amount:600000,label:"월(예시)"}],companyDocs:["업무분담수당 지급 증빙","육아휴직 확인서"],employeeDocs:["임금명세서(업무분담수당 명시)"],isCustom:false,isBuiltIn:true,note:"육아휴직 분담 30인미만 월최대60(2026 3배인상). 대체인력과 중복불가.",applyUrl:"고용24(work24.go.kr)",match:{cats:["육아"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:false,companyMax:null,regionSensitive:false,bosuFloor:false,special:["업무분담"]}},
  emp_retention:{id:"emp_retention",name:"고용유지지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:6000000,rounds:[{month:1,amount:1500000,label:"1개월"},{month:2,amount:1500000,label:"2개월"},{month:3,amount:1500000,label:"3개월"},{month:4,amount:1500000,label:"4개월"}],companyDocs:["고용유지조치계획서","사업자등록증","임금대장","고용보험 피보험자 명부","휴업·단축 협약서"],employeeDocs:["고용유지조치 동의서","월별임금대장","출근부(단축 확인)"],isCustom:false,isBuiltIn:true,note:"경영 위기 시 해고 대신 휴업·단축 선택 기업 지원. 우선지원 2/3, 대규모 1/2 보전. 연간 최대 180일(고용위기지역 등 특례). 사전 계획 신청 필수.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직","계약직"],preApply:true,companyMax:null,regionSensitive:false,bosuFloor:true}},
  job_sharing:{id:"job_sharing",name:"일자리함께하기 지원금",year:2026,group:"재직자유지",color:"#475569",totalAmount:7200000,rounds:[{month:3,amount:1800000,label:"1분기"},{month:6,amount:1800000,label:"2분기"},{month:9,amount:1800000,label:"3분기"},{month:12,amount:1800000,label:"4분기"}],companyDocs:["사업참여신청서","노사합의서(단축협약)","취업규칙","4대보험 피보험자 명부","근태관리 증빙"],employeeDocs:["변경 근로계약서","월별임금대장"],isCustom:false,isBuiltIn:true,note:"재직자 근로시간 단축 후 신규 채용 시 지원. 교대제 도입·심야근로 단축·정년연장형 등 유형별 지원. 우선지원 연최대 720만. 사전승인 필수.",applyUrl:"고용24(work24.go.kr)",match:{cats:["재직"],ageMin:null,ageMax:null,gender:"any",empTypes:["정규직"],preApply:true,companyMin:null,companyMax:null,regionSensitive:false,bosuFloor:false,special:["일자리나누기"]}}
};

// 기본 활성 지원금 (신규 사용자 기준: 청년일자리도약장려금만 ON)
export var PROGRAM_ENABLED_DEFAULTS={youth_jump:true};

// 지원금별 확인 체크리스트
var PROGRAM_CHECKLISTS={
  youth_jump:["청년 나이 확인 (만 15~34세, 군복무 연장 적용 가능)","수도권 사업장: 취업애로요건 최소 1개 해당 여부 확인","사전신청 완료 여부 (또는 입사 후 3개월 내 사후신청)","보수 월 124만 원 이상 지급 계획 확인","6개월 이상 계속 고용 계획","최근 3개월 내 감원 이력 없음 확인"],
  replace_worker:["육아휴직·출산전후휴가·근로시간 단축 등 대체인력 발생 사유 확인","대체인력 채용일 확인","대체인력 고용보험 가입 여부 확인","대체 대상 근로자의 휴직·휴가 기간 확인","대체인력 근무기간 요건 확인","임금 지급 및 근로계약서 작성 여부 확인","동일 근로자 중복 지원 여부 확인","신청 기한 확인"],
  senior_intern:["연령 요건 확인 (만 60세 이상)","참여 가능 직무 여부 확인 (단순노무직 제외)","인턴 약정 기간 확인","고용보험 가입 여부 확인","운영기관(한국노인인력개발원) 사전 승인 여부 확인","기존 근로자 전환 여부 확인","중복 지원 제한 여부 확인"],
  regular_convert:["전환 전 고용형태 확인 (6개월↑ 기간제·파견)","정규직 전환일 확인","임금 감소 여부 확인","고용유지 기간 확인","전환 대상자 중복 지원 여부 확인","신청 기한 확인","사전 신청 또는 승인(전환계획서) 필요 여부 확인"],
  senior_continue:["정년제도 운영 여부 확인","계속고용제도(연장·폐지·재고용) 도입 여부 확인","대상 근로자 연령 요건 확인 (만 55세 이상)","고용유지 여부 확인","취업규칙 또는 사내규정 정비 여부 확인","신청 기한 확인","중복 지원 여부 확인"],
  work_exp:["신청 대상 사업장 여부 확인 (고용보험 10인↑ 등 요건)","대상 근로자 요건 확인 (미취업 청년, 사업자등록 없음)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(고용24/1811-8447) 기준 추가 확인 필요"],
  saeil_women:["신청 대상 사업장 여부 확인 (고용보험 5인↑~1000인미만)","대상 근로자 요건 확인 (경력단절 여성, 새일센터 연계)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(여성새로일하기센터) 기준 추가 확인 필요"],
  emp_promo:["신청 대상 사업장 여부 확인","대상 근로자 요건 확인 (취업지원프로그램 이수 등)","고용보험 가입 및 보수 124만↑ 확인","신청 기한 확인 (12개월 내 첫 신청)","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  disabled_emp:["신청 대상 사업장 여부 확인","장애 등급 확인 (경증·중증)","고용보험 가입 및 최저임금 이상 지급 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인 (장애인증명서 등)","운영기관(한국장애인고용공단) 기준 추가 확인 필요"],
  worklife45:["신청 대상 사업장 여부 확인 (20인↑)","노사합의서 및 취업규칙 정비 여부 확인","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관(노사발전재단) 기준 추가 확인 필요"],
  parental_leave:["신청 대상 사업장 여부 확인 (우선지원대상기업)","대상 근로자 요건 확인 (육아휴직 30일↑ 허용)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  parental_reduce:["신청 대상 사업장 여부 확인","대상 근로자 요건 확인 (만 12세↓ 자녀, 최대 3년)","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  work_share:["신청 대상 사업장 여부 확인 (30인미만)","업무분담수당 지급 계획 확인","고용보험 가입 여부 확인","신청 기한 확인","대체인력과 중복 신청 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  emp_retention:["경영 위기 사유 확인 (매출 감소 등)","고용유지조치계획서 사전 신청 여부 확인","대상 근로자 요건 확인","신청 기한 확인 (연간 180일 한도)","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"],
  job_sharing:["신청 대상 사업장 여부 확인","근로시간 단축 유형 확인 (교대제·심야단축·정년연장형 등)","신규 채용 계획 확인","사전 신청(승인) 여부 확인","고용보험 가입 여부 확인","신청 기한 확인","운영기관 또는 공고문 기준 추가 확인 필요"]
};

// 업체 기본 서류 템플릿 (카테고리별)
var COMPANY_DEFAULT_DOCS=[
  {cat:"기본 사업자 서류",docs:["사업자등록증","법인등기사항전부증명서 (법인)","대표자 신분증 사본","기업 통장 사본"]},
  {cat:"고용보험 관련",docs:["고용보험 성립 신고서","4대보험 가입자 명부","고용보험 피보험자격 취득·상실 이력"]},
  {cat:"세무·재무",docs:["법인세(소득세) 신고서","재무제표 (손익계산서·대차대조표)","국세 완납 증명서"]},
  {cat:"근로자 관련",docs:["근로계약서 (전 직원)","임금대장","취업규칙"]},
  {cat:"지원금별 추가",docs:["협약서","사업참여신청서","개인정보 동의서 (사업주)"]}
];

// 업종 선택지
var INDUSTRY_OPTIONS=["제조업","건설업","도소매업","음식·숙박업","운수·창고업","정보통신업","금융·보험업","부동산업","전문·과학·기술업","교육 서비스업","보건·사회복지업","예술·스포츠·여가업","협회·단체","기타 서비스업","기타/직접입력"];

var ELIG = [
  {id:"e1",label:"실업 4개월 이상",desc:"고용보험 피보험자격 상실 후 연속 4개월 이상 실업"},
  {id:"e2",label:"고졸 이하 학력",desc:"대학 미진학, 최종학력 고등학교 졸업 이하"},
  {id:"e3",label:"고용보험 가입 12개월 미만",desc:"생애 전체 고용보험 총 피보험기간 12개월 미만"},
  {id:"e4",label:"고용촉진장려금 대상자",desc:"취업지원프로그램 이수자"},
  {id:"e5",label:"국민취업지원제도 참여자",desc:"국취제(I/II유형) 참여"},
  {id:"e6",label:"청년도전 지원사업 수료자",desc:"청년도전 지원사업 프로그램 수료"},
  {id:"e7",label:"자립준비청년",desc:"보호종료 청년"},
  {id:"e8",label:"북한이탈청년",desc:"북한이탈주민 중 청년"},
  {id:"e9",label:"폐업 경험 청년",desc:"창업 후 폐업 경험(2년 이내)"},
  {id:"e10",label:"기타 장관 인정",desc:"기타 고용노동부 장관이 취업애로청년으로 인정"}
];
var EXCL = [
  {id:"x1",label:"재학 중이 아닐 것",desc:"정규 교육기관 재학 중 제외"},
  {id:"x2",label:"사업주 가족이 아닐 것",desc:"배우자·직계존비속·형제자매 제외"},
  {id:"x3",label:"외국인이 아닐 것",desc:"외국인 제외(F-2,F-5,F-6 예외)"},
  {id:"x4",label:"중복수급이 아닐 것",desc:"타 고용지원금과 중복수급 불가"},
  {id:"x5",label:"자영업자·사업자가 아닐 것",desc:"사업자등록증 소지자 제외"}
];
var STS = [
  {key:"preparing",label:"준비중",color:"#64748B",bg:"#F1F5F9",icon:"⏳"},
  {key:"submitted",label:"서류접수",color:"#2563EB",bg:"#EFF6FF",icon:"📨"},
  {key:"reviewing",label:"심사중",color:"#475569",bg:"#E2E8F0",icon:"🔍"},
  {key:"approved",label:"승인",color:"#059669",bg:"#ECFDF5",icon:"✅"},
  {key:"inprogress",label:"지급중",color:"#2563EB",bg:"#DBEAFE",icon:"💸"},
  {key:"completed",label:"최종지급완료",color:"#059669",bg:"#D1FAE5",icon:"🎉"},
  {key:"resigned",label:"퇴사",color:"#94A3B8",bg:"#F1F5F9",icon:"🚪"}
];
// 진행 보드 단계별 컬러 (단계 구분을 강하게 — 컬럼 헤더 채움 + 카드 톤)
var KANBAN_COL = {
  preparing:  {main:"#64748B", soft:"#F8FAFC", border:"#E2E8F0"}, // 준비중 · 회색
  submitted:  {main:"#2563EB", soft:"#EFF6FF", border:"#DBEAFE"}, // 서류접수 · 파랑
  reviewing:  {main:"#7C3AED", soft:"#F5F3FF", border:"#E9D5FF"}, // 심사중 · 보라
  approved:   {main:"#059669", soft:"#ECFDF5", border:"#A7F3D0"}, // 승인 · 초록
  inprogress: {main:"#0D9488", soft:"#F0FDFA", border:"#99F6E4"}, // 지급중 · 청록
  completed:  {main:"#15803D", soft:"#F0FDF4", border:"#BBF7D0"}, // 최종지급완료 · 진초록
  resigned:   {main:"#94A3B8", soft:"#F8FAFC", border:"#E2E8F0"}  // 퇴사 · 연회색
};
function kcol(key){ return KANBAN_COL[key]||KANBAN_COL.preparing; }
var TAGS = [
  {id:"vip",label:"VIP",color:"#1D4ED8",bg:"#EFF6FF"},
  {id:"new",label:"신규",color:"#2563EB",bg:"#DBEAFE"},
  {id:"caution",label:"주의",color:"#DC2626",bg:"#FEE2E2"},
  {id:"priority",label:"우선",color:"#2563EB",bg:"#EFF6FF"},
  {id:"hold",label:"보류",color:"#64748B",bg:"#F1F5F9"},
  {id:"stop",label:"중단",color:"#6B7280",bg:"#E5E7EB"},
  {id:"star",label:"⭐즐겨찾기",color:"#475569",bg:"#F1F5F9"}
];
var CERT_TYPES = [
  {id:"venture",label:"벤처기업 인증",color:"#2563EB"},
  {id:"innobiz",label:"이노비즈 인증",color:"#059669"},
  {id:"mainbiz",label:"메인비즈 인증",color:"#1E40AF"},
  {id:"research",label:"기업부설연구소",color:"#DC2626"},
  {id:"family",label:"가족친화기업",color:"#059669"},
  {id:"youth",label:"청년친화기업",color:"#2563EB"},
  {id:"other",label:"기타",color:"#6B7280"}
];
var COMMON_EXTRA_DOCS = ["신분증 사본","근로자 통장사본","연차사용 증빙","재직증명서","사직서","육아휴직서","주민등록등본","원천징수영수증","4대보험 가입확인서","운영기관 자체 서식"];
// 업체 서류 탭 기본 표시·빠른추가 목록
var COMPANY_DOC_DEFAULTS = ["사업자등록증","법인등기부등본","기업통장사본","협약서","4대보험 사업장 가입자 명부","4대보험 가입확인서","원천징수영수증","급여대장","급여이체증","운영기관 자체 서식"];
var COMPANY_QUICK_DOCS = COMPANY_DOC_DEFAULTS;
var EMP_QUICK_DOCS = ["근로계약서","임금대장","급여이체증","졸업증명서","사실증명확인서","신분증 사본","근로자 통장사본","재직증명서","주민등록등본"];
// 서류명 정규화 — 공백·괄호·점·중점·대소문자 차이를 무시하고 중복 판정
function normDoc(s){ return (s||"").replace(/[\s()（）·.\-]/g,"").toLowerCase(); }

// 업무 일지 유형
var NOTE_TYPES = [
  {id:"전화",icon:"📞"},{id:"카톡",icon:"💬"},{id:"이메일",icon:"✉️"},
  {id:"서류요청",icon:"📤"},{id:"서류수령",icon:"📥"},{id:"신청완료",icon:"📨"},
  {id:"지급확인",icon:"💸"},{id:"고객미응답",icon:"🔕"},{id:"보완요청",icon:"📝"},
  {id:"수수료청구",icon:"🧾"},{id:"수수료입금",icon:"💰"},{id:"상태변경",icon:"🔄"},{id:"기타",icon:"🗒️"}
];
function noteTypeMeta(id){ return NOTE_TYPES.find(function(t){return t.id===id;})||NOTE_TYPES[NOTE_TYPES.length-1]; }

// 서류 진행 상태 (체크박스 done 과 병행)
var DOC_STATUS = [
  {id:"none",label:"미요청",color:"#94A3B8",bg:"#F1F5F9"},
  {id:"requested",label:"요청완료",color:"#2563EB",bg:"#EFF6FF"},
  {id:"submitted",label:"제출완료",color:"#0D9488",bg:"#F0FDFA"},
  {id:"revise",label:"보완필요",color:"#DC2626",bg:"#FEF2F2"},
  {id:"confirmed",label:"확인완료",color:"#059669",bg:"#ECFDF5"}
];
function docStatusMeta(id){ return DOC_STATUS.find(function(s){return s.id===id;})||DOC_STATUS[0]; }
// 서류 done(boolean) ↔ status(string) 동기화 유틸
function docEffStatus(d){ if(d.status)return d.status; return d.done?"confirmed":"none"; }
function docIsDone(d){ var s=docEffStatus(d); return s==="submitted"||s==="confirmed"||d.done===true&&!d.status; }

// ── 스타일 상수 ──────────────────────────────────────────
var FF = "'Pretendard','Pretendard Variable',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif";
// 반응형 타이포 스케일 (clamp: 모바일 축소 · 데스크톱 균형)
var FS_INPUT="clamp(15px,4vw,17px)";   // 입력창·기본 버튼
var FS_BTN_SM="var(--fs-btn)"; // 보조 버튼 (PC 상향)
var FS_LABEL="var(--fs-label)";  // 라벨 (PC 상향)
var FS_BADGE="var(--fs-badge)";    // 배지 (PC 상향)
var FS_PAGE_TITLE="clamp(22px,5vw,30px)"; // 페이지 메인 제목
var FS_SECTION="clamp(19px,4.4vw,24px)";  // 섹션 제목
var FS_CARD_TITLE="clamp(16px,4vw,19px)"; // 카드 제목
var FS_HERO_NUM="clamp(28px,8.5vw,44px)"; // 히어로 수치(시뮬레이터 총액 등)
var FS_BODY="var(--fs-body)";     // 본문/설명 (PC 상향)
var FS_LIST="var(--fs-list)";     // 표/리스트 (PC 상향)
var inp = {width:"100%",padding:"12px 15px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:FS_INPUT,outline:"none",boxSizing:"border-box",fontFamily:FF,color:"#1E293B",background:"#fff",transition:"border-color 0.15s"};
var inpKo = Object.assign({},inp,{lang:"ko"});
var btnP = {background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:600,cursor:"pointer",fontFamily:FF,boxShadow:"0 1px 2px rgba(37,99,235,0.18)",whiteSpace:"nowrap"};
var btnS = {background:"#fff",color:"#475569",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 24px",fontSize:FS_INPUT,fontWeight:500,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"};
var btnSm = {background:"#F8FAFC",color:"#475569",border:"1px solid #E2E8F0",borderRadius:9,padding:"10px 18px",fontSize:FS_BTN_SM,fontWeight:600,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"};

// ── 공통 색상 토큰 (의미 기반) ─────────────────────────────
var COLORS = {
  primary:"#2563EB", primarySoft:"#EFF6FF",
  danger:"#DC2626",  dangerSoft:"#FEF2F2",
  success:"#059669", successSoft:"#ECFDF5",
  warning:"#475569", warningSoft:"#F1F5F9",
  text:"#0F172A", subtext:"#64748B",
  grayText:"#64748B",
  border:"#E5E7EB", bg:"#F8FAFC",
  card:"#FFFFFF", sidebar:"#0F172A"
};

// ── 전역 토스트 ───────────────────────────────────────────
var _toastFn=null;
function toast(msg,type){ if(_toastFn)_toastFn(msg,type||"success"); }
function ToastHost(){
  var st=useState([]);
  useEffect(function(){
    _toastFn=function(msg,type){
      var id=Date.now()+"-"+Math.random();
      st[1](function(a){return a.concat([{id:id,msg:msg,type:type}]);});
      setTimeout(function(){ st[1](function(a){return a.filter(function(t){return t.id!==id;});}); },3400);
    };
    return function(){_toastFn=null;};
  },[]);
  var C={success:{bg:"#ECFDF5",bd:"#6EE7B7",c:"#047857",i:"✅"},warn:{bg:"#F1F5F9",bd:"#CBD5E1",c:"#475569",i:"⚠️"},error:{bg:"#FEF2F2",bd:"#FECACA",c:"#DC2626",i:"⛔"},info:{bg:"#EFF6FF",bd:"#BFDBFE",c:"#1D4ED8",i:"ℹ️"}};
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:6000,display:"flex",flexDirection:"column",gap:10,pointerEvents:"none"}}>
    {st[0].map(function(t){var s=C[t.type]||C.success;return(
      <div key={t.id} className="slide-in" style={{display:"flex",alignItems:"center",gap:10,background:s.bg,border:"1.5px solid "+s.bd,color:s.c,borderRadius:12,padding:"13px 18px",fontSize:15,fontWeight:600,fontFamily:FF,boxShadow:"0 8px 28px rgba(15,23,42,0.16)",maxWidth:400}}>
        <span style={{fontSize:18,flexShrink:0}}>{s.i}</span><span style={{lineHeight:1.4}}>{t.msg}</span>
      </div>
    );})}
  </div>);
}

// ── 요금제(플랜) 기능 게이트 ───────────────────────────────
var PLAN_TIERS={
  individual:{key:"individual",label:"개인 업체",maxCompanies:1,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:false,advancedAlerts:false,bulkUpload:true,agencyReport:true,team:false}},
  light:{key:"light",label:"컨설턴트 라이트",maxCompanies:5,maxEmployees:30,reportPerMonth:3,
    feat:{commission:false,advancedAlerts:false,bulkUpload:true,agencyReport:true,team:false}},
  pro:{key:"pro",label:"컨설턴트 프로",maxCompanies:Infinity,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:true,advancedAlerts:true,bulkUpload:true,agencyReport:true,team:false}},
  team:{key:"team",label:"팀 · 노무법인",maxCompanies:Infinity,maxEmployees:Infinity,reportPerMonth:Infinity,
    feat:{commission:true,advancedAlerts:true,bulkUpload:true,agencyReport:true,team:true}}
};
// sub.plan_type(individual|agency) + 체험여부 → 유효 등급
function effPlanKey(planType,isTrial){ if(isTrial)return "pro"; if(planType==="agency")return "pro"; return "individual"; }
function planTier(planType,isTrial){ return PLAN_TIERS[effPlanKey(planType,isTrial)]||PLAN_TIERS.individual; }
function PlanBadge(props){ return <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:"#DBEAFE",color:"#1D4ED8",marginLeft:6,verticalAlign:"middle"}}>{props.label||"PRO"}</span>; }

// ── 기본 UI 컴포넌트 ─────────────────────────────────────
// [D-94] Esc 로 닫기 — 창이 겹치면 맨 위 창만 닫는다(원본에는 없었다)
var _hrModalStack=[];
function Modal(props){
  // 부모(.page-enter 등)의 transform 영향을 받지 않도록 body로 포탈 + 화면 전체 기준 fixed
  useEffect(function(){
    if(!props.open||typeof document==="undefined")return;
    document.body.classList.add("no-scroll");
    return function(){document.body.classList.remove("no-scroll");};
  },[props.open]);
  var closeRef=useRef(props.onClose); closeRef.current=props.onClose;
  useEffect(function(){
    if(!props.open||typeof window==="undefined")return;
    var entry={};
    _hrModalStack.push(entry);
    function onKey(e){
      if(e.key!=="Escape"||_hrModalStack[_hrModalStack.length-1]!==entry)return;
      var t=e.target; var tag=t&&t.tagName?t.tagName.toLowerCase():"";
      if(tag==="textarea"||(t&&t.isContentEditable))return; // 긴 글을 쓰다 Esc 로 날리지 않게
      if(closeRef.current)closeRef.current();
    }
    window.addEventListener("keydown",onKey);
    return function(){ window.removeEventListener("keydown",onKey); var i=_hrModalStack.indexOf(entry); if(i>=0)_hrModalStack.splice(i,1); };
  },[props.open]);
  if(!props.open||typeof document==="undefined")return null;
  return createPortal(
    <div className="modal-overlay" style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,0.48)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"16px",overflowY:"auto",WebkitOverflowScrolling:"touch"}} onClick={props.onClose}>
      <div className="modal-pop" style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:props.width||640,margin:"auto",maxHeight:"calc(100dvh - 32px)",display:"flex",flexDirection:"column",minHeight:0,boxShadow:"0 24px 64px rgba(15,23,42,0.28)"}} onClick={function(e){e.stopPropagation();}}>
        <div style={{padding:"18px clamp(16px,4vw,28px)",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexShrink:0,borderRadius:"16px 16px 0 0",background:"#fff"}}>
          <h3 style={{margin:0,fontSize:FS_SECTION,fontWeight:700,wordBreak:"keep-all",minWidth:0}}>{props.title}</h3>
          <button onClick={props.onClose} style={{background:"none",border:"none",fontSize:28,cursor:"pointer",color:"#94A3B8",flexShrink:0,lineHeight:1}}>✕</button>
        </div>
        <div style={{padding:"clamp(16px,4vw,28px)",overflowY:"auto",flex:1,minHeight:0}}>{props.children}</div>
      </div>
    </div>,
    hrPortalRoot()
  );
}
function Label(props){ return <label style={{fontSize:FS_LABEL,fontWeight:600,color:props.color||"#475569",marginBottom:6,display:"block"}}>{props.children}</label>; }
function Card(props){ return <div onClick={props.onClick} style={Object.assign({background:"#fff",borderRadius:14,border:"1px solid #F1F5F9",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},props.style||{})}>{props.children}</div>; }
function Badge(props){ return <span style={{fontSize:FS_BADGE,fontWeight:600,padding:"4px 11px",borderRadius:20,background:props.bg||"#EFF6FF",color:props.color||"#2563EB",whiteSpace:"nowrap",display:"inline-block"}}>{props.children}</span>; }
// 지원 연도 배지 (지원금명과 시각적으로 구분되는 앰버 톤)
function YearBadge(props){ if(!props.year)return null; return <span style={{fontSize:"var(--fs-badge)",fontWeight:700,padding:"2px 9px",borderRadius:999,background:"#FEF3C7",color:"#B45309",border:"1px solid #FDE68A",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",lineHeight:1.4}}>{props.year}년</span>; }
// ── 통일 배지 시스템 (연한 배경 + 의미 텍스트 색만) ────────
var BADGE_BASE={fontSize:"var(--fs-badge)",fontWeight:700,padding:"3px 10px",borderRadius:999,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4,lineHeight:1.4,border:"1px solid transparent"};
function neutralBadge(){ return Object.assign({},BADGE_BASE,{background:"#F1F5F9",color:"#475569",borderColor:"#E2E8F0"}); }
function primaryBadge(){ return Object.assign({},BADGE_BASE,{background:"#EFF6FF",color:"#1D4ED8",borderColor:"#DBEAFE"}); }
function dangerBadge(){ return Object.assign({},BADGE_BASE,{background:"#FEF2F2",color:"#DC2626",borderColor:"#FECACA"}); }
function successBadge(){ return Object.assign({},BADGE_BASE,{background:"#ECFDF5",color:"#059669",borderColor:"#A7F3D0"}); }
function UBadge(props){ var kind=props.kind||"neutral"; var st=kind==="danger"?dangerBadge():kind==="primary"?primaryBadge():kind==="success"?successBadge():neutralBadge(); return <span style={Object.assign(st,props.style||{})}>{props.children}</span>; }
function DdayBadge(props){ var d=props.dday; if(d===null) return null; var st=d<=0?dangerBadge():d<=7?primaryBadge():neutralBadge(); return <span style={st}>{formatDday(d)}</span>; }
function Notice(props){ return <div style={{padding:"10px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,fontSize:17,color:"#475569",lineHeight:1.5,marginBottom:10}}>{props.children}</div>; }

// ── FileAt: 클라우드 파일 업로드 지원 ───────────────────
function FileAt(props){
  var ref=useRef(); var camRef=useRef(); var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var stUp=useState(false); var uploading=stUp[0],setUploading=stUp[1];

  async function handleFile(file, nameOverride){
    if(disabled||uploading) return;
    var reason=validateUploadFile(file);
    if(reason){ toast(reason,"error"); return; }
    if(uploadFn){
      setUploading(true);
      try{
        var f2 = nameOverride ? new File([file],nameOverride,{type:file.type}) : file;
        var obj = await uploadFn(f2);
        props.onAdd(obj);
        toast("파일 업로드가 완료되었습니다.","success");
      }catch(e){ toast("파일 업로드 실패: "+(e.message||"오류"),"error"); }
      finally{ setUploading(false); }
    }else{
      var r=new FileReader();
      r.onload=function(){ props.onAdd({id:uid(),name:nameOverride||file.name,dataUrl:r.result,type:file.type}); };
      r.readAsDataURL(file);
    }
  }

  async function viewFile(f){
    if(f.storagePath&&getUrlFn){
      try{ var url=await getUrlFn(f.storagePath); if(url) window.open(url,"_blank"); }
      catch(e){ toast("파일 열기 실패","error"); }
    }else if(f.dataUrl){ window.open(f.dataUrl,"_blank"); }
  }

  return(
    <div>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,image/*" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,null); e.target.value=""; }}/>
      <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={function(e){ if(disabled) return; var f=e.target.files&&e.target.files[0]; if(!f) return; handleFile(f,"사진_"+fD(new Date())+".jpg"); e.target.value=""; }}/>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {(props.files||[]).map(function(f){
          var isImg=f.type&&f.type.startsWith("image/");
          var canView=isImg||f.storagePath||f.dataUrl;
          return(<div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:4,background:disabled?"#F1F5F9":"#EFF6FF",border:disabled?"1px solid #E2E8F0":"1px solid #BFDBFE",borderRadius:8,padding:"5px 10px",fontSize:15,opacity:disabled?0.6:1,cursor:canView?"pointer":"default"}} onClick={canView?function(){viewFile(f);}:undefined} title={f.name}>
            <span style={{color:disabled?"#94A3B8":"#1D4ED8",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isImg?"🖼️":"📎"}{f.name}</span>
            {!disabled&&<button onClick={function(e){e.stopPropagation();props.onRemove(f.id);}} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:17,padding:0,lineHeight:1}}>×</button>}
          </div>);
        })}
        {uploading&&<span style={{fontSize:15,color:"#94A3B8"}}>업로드 중...</span>}
        {!disabled&&!uploading&&(<React.Fragment>
          <button onClick={function(){camRef.current&&camRef.current.click();}} style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"6px 11px",fontSize:16,color:"#64748B",cursor:"pointer"}} title="카메라 촬영">📷</button>
          <button onClick={function(){ref.current&&ref.current.click();}} style={{background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:8,padding:"6px 11px",fontSize:16,color:"#64748B",cursor:"pointer"}} title="파일 첨부">📁</button>
        </React.Fragment>)}
      </div>
    </div>
  );
}

function ChkItem(props){
  var item=props.item; var isDisabled=props.disabled;
  var done=docIsDone(item); var eff=docEffStatus(item); var sm=docStatusMeta(eff);
  return(
    <div style={{padding:"12px 14px",borderRadius:10,background:isDisabled?"#F1F5F9":(done?"#F8FAFC":"#fff"),border:isDisabled?"1px solid #E2E8F0":(done?"1px solid #E2E8F0":"1px solid #E2E8F0"),borderLeft:isDisabled?"1px solid #E2E8F0":(done?"3px solid #059669":"3px solid #CBD5E1"),opacity:isDisabled?0.6:1}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4,marginBottom:6}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:isDisabled?"not-allowed":"pointer",flex:1,minWidth:0}}>
          <input type="checkbox" checked={done} onChange={isDisabled?undefined:props.onToggle} disabled={isDisabled} style={{width:20,height:20,accentColor:"#059669",flexShrink:0}}/>
          <span style={{fontSize:16,fontWeight:500,color:isDisabled?"#94A3B8":(done?"#059669":"#334155"),textDecoration:done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis"}}>{item.label}{item.isCustom&&<span style={{fontSize:13,color:"#94A3B8",marginLeft:4}}>(추가)</span>}</span>
        </label>
        <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
          {!isDisabled&&props.onCopyReq&&<button onClick={props.onCopyReq} style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:7,color:"#1D4ED8",cursor:"pointer",fontSize:13,padding:"3px 7px"}} title="이 서류 요청 문구 복사">📋</button>}
          {!isDisabled&&props.onDelete&&<button onClick={props.onDelete} style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:17}} title="삭제">🗑️</button>}
        </div>
      </div>
      {!isDisabled&&(
        <div style={{marginLeft:24,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <select value={eff} onChange={props.onStatus} style={{fontSize:13,fontWeight:700,padding:"4px 8px",borderRadius:7,border:"1px solid "+sm.bg,background:sm.bg,color:sm.color,cursor:"pointer",fontFamily:FF,outline:"none"}}>
            {DOC_STATUS.map(function(s){return <option key={s.id} value={s.id}>{s.label}</option>;})}
          </select>
          <FileAt files={item.files||[]} onAdd={props.onFA} onRemove={props.onFR} uploadFn={props.uploadFn} getUrlFn={props.getUrlFn}/>
        </div>
      )}
    </div>
  );
}

function DocSection(props){
  var docs=props.docs||[]; var disabled=props.disabled;
  var uploadFn=props.uploadFn; var getUrlFn=props.getUrlFn;
  var st2=useState(""); var newName=st2[0],setNewName=st2[1];
  var stOther=useState(false); var showOther=stOther[0],setShowOther=stOther[1];
  var seeded=useState(false);
  var quickList=props.quickDocs||[];
  var done=docs.filter(function(d){return docIsDone(d);}).length;
  var missing=docs.filter(function(d){return !docIsDone(d);});

  // 서류 목록이 비어 있을 때만 기본 서류를 자동 표시(seed) — 기존 데이터는 건드리지 않음
  useEffect(function(){
    if(disabled)return;
    if(seeded[0])return;
    if(docs.length===0&&props.defaultDocs&&props.defaultDocs.length>0){
      seeded[1](true);
      props.onChange(props.defaultDocs.map(function(label){return {id:uid(),label:label,done:false,status:"none",files:[]};}));
    }
  },[]);

  function hasDoc(name){ var n=normDoc(name); return docs.some(function(d){return normDoc(d.label)===n;}); }
  function addDoc(name){
    if(!name||!name.trim())return false;
    var label=name.trim();
    if(hasDoc(label)){ toast("이미 추가된 서류입니다.","info"); return false; }
    props.onChange(docs.concat([{id:uid(),label:label,done:false,status:"none",files:[],isCustom:true}]));
    toast(label+"이(가) 추가되었습니다.","success");
    return true;
  }
  function delDoc(idx){ props.onChange(docs.filter(function(_,i){return i!==idx;})); }
  function copyOne(d){ var msg="대표님, "+(props.progName?props.progName+" ":"고용지원금 ")+"신청을 위해 '"+d.label+"' 서류가 필요합니다. 사진 또는 PDF 파일로 전달 부탁드립니다. 감사합니다."; navigator.clipboard.writeText(msg).then(function(){toast("서류 요청 문구가 복사되었습니다.","success");}); if(props.onLog)props.onLog("'"+d.label+"' 요청 문구 생성","서류요청"); }

  // 요청 메시지 — 미요청/요청완료 상태만 포함, 제출/확인완료 제외, 보완필요는 별도
  var reqDocs=docs.filter(function(d){var s=docEffStatus(d);return s==="none"||s==="requested";});
  var reviseDocs=docs.filter(function(d){return docEffStatus(d)==="revise";});
  // 급여일 연계 — 요청 목록에 급여 관련 서류(급여이체증·임금/급여대장)가 있으면 발급 시점 안내
  var hasPayDoc=reqDocs.some(function(d){var n=normDoc(d.label);return n.indexOf("급여이체")>=0||n.indexOf("이체증")>=0||n.indexOf("급여대장")>=0||n.indexOf("임금대장")>=0||n.indexOf("급여명세")>=0;});
  var greet=props.contactName?props.contactName+" 담당자님":"대표님";
  function buildRequestMsg(){
    var lines=reqDocs.length>0?reqDocs.map(function(d){return "- "+d.label;}).join("\n"):"- (요청할 서류가 없습니다)";
    var msg="안녕하세요 "+greet+".\n고용지원금 신청을 위해 필요한 서류 안내드립니다.\n\n필요한 서류는 아래와 같습니다.\n\n"+lines+"\n\n준비되시는 대로 사진 또는 PDF 파일로 전달 부탁드립니다.\n감사합니다.";
    if(reviseDocs.length>0){ msg+="\n\n[보완 필요 서류]\n"+reviseDocs.map(function(d){return "- "+d.label;}).join("\n"); }
    return msg;
  }
  function copyRequestMsg(){ navigator.clipboard.writeText(buildRequestMsg()).then(function(){toast("서류 요청 메시지를 복사했습니다.","success");}); if(props.onLog)props.onLog("서류 요청 메시지 복사("+reqDocs.length+"건)","서류요청"); }

  return(
    <Card style={{padding:"18px 20px",marginBottom:props.mb||12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <h4 style={{margin:0,fontSize:19,fontWeight:700}}>{props.icon} {props.title}</h4>
        <span style={done===docs.length&&docs.length>0?successBadge():neutralBadge()}>{done}/{docs.length}</span>
      </div>

      {/* 자주 쓰는 서류 빠른 추가 — 항상 표시 */}
      {!disabled&&(quickList.length>0)&&(
        <div style={{marginBottom:14,padding:"12px 14px",background:"#F8FAFC",borderRadius:10,border:"1px solid #F1F5F9"}}>
          <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:8}}>⚡ 자주 쓰는 서류 빠른 추가</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {quickList.map(function(d){var added=hasDoc(d);return(
              <button key={d} onClick={function(){if(added){toast("이미 추가된 서류입니다.","info");}else{addDoc(d);}}}
                style={{fontSize:13,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:FF,border:"1px solid "+(added?"#E2E8F0":"#BFDBFE"),background:added?"#F1F5F9":"#EFF6FF",color:added?"#94A3B8":"#1D4ED8",fontWeight:added?400:600}}>
                {added?"✓ ":"+ "}{d}
              </button>
            );})}
            <button onClick={function(){setShowOther(!showOther);}} style={{fontSize:13,padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:FF,border:"1px dashed #CBD5E1",background:"#fff",color:"#475569"}}>＋ 기타 서류</button>
          </div>
          {showOther&&(
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <input style={Object.assign({},inpKo,{flex:1,fontSize:15,padding:"9px 12px"})} value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="서류명 직접 입력 후 Enter" autoFocus onKeyDown={function(e){if(e.key==="Enter"){if(addDoc(newName))setNewName("");}}}/>
              <button style={Object.assign({},btnP,{padding:"9px 16px",fontSize:15})} onClick={function(){if(addDoc(newName))setNewName("");}}>추가</button>
            </div>
          )}
        </div>
      )}

      {docs.length===0?<p style={{margin:"4px 0 14px",fontSize:15,color:"#94A3B8"}}>위 버튼으로 필요한 서류를 추가하세요.</p>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:8,marginBottom:6}}>
          {docs.map(function(d,i){return <ChkItem key={d.id||i} item={d} disabled={disabled}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onToggle={function(){var ds=docs.slice();var nd=!docIsDone(ds[i]);ds[i]=Object.assign({},ds[i],{done:nd,status:nd?"confirmed":"none"});props.onChange(ds);}}
            onStatus={function(e){var v=e.target.value;var ds=docs.slice();ds[i]=Object.assign({},ds[i],{status:v,done:(v==="confirmed"||v==="submitted")});props.onChange(ds);if(props.onLog)props.onLog("'"+d.label+"' 서류 "+docStatusMeta(v).label,"상태변경");}}
            onCopyReq={function(){copyOne(d);}}
            onDelete={function(){delDoc(i);}}
            onFA={function(f){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).concat([f])});props.onChange(ds);}}
            onFR={function(fid){var ds=docs.slice();ds[i]=Object.assign({},ds[i],{files:(ds[i].files||[]).filter(function(f){return f.id!==fid;})});props.onChange(ds);}}/>;
          })}
        </div>
      )}

      {/* 서류 요청 메시지 — 항상 표시 */}
      {!disabled&&(
        <div style={{marginTop:14,padding:"14px 16px",background:"#F0F9FF",borderRadius:12,border:"1px solid #BAE6FD"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#0284C7"}}>📨 서류 요청 메시지 {reqDocs.length>0&&<span style={{fontSize:12,color:"#64748B",fontWeight:500}}>· {reqDocs.length}건</span>}</span>
            <button style={Object.assign({},btnSm,{padding:"7px 14px",fontSize:13,background:"#0284C7",color:"#fff",border:"none"})} onClick={copyRequestMsg}>📋 복사하기</button>
          </div>
          {hasPayDoc&&<div style={{fontSize:12,color:"#B45309",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",marginBottom:8,lineHeight:1.5}}>💸 급여 관련 서류(급여이체증·임금대장 등)가 포함되어 있습니다. {props.payday?"이 업체 급여일은 매월 "+props.payday+"일이므로, 급여일 이후 발급이 가능합니다.":"급여 지급 이후 발급 가능한 서류이므로 급여일을 확인해 요청하세요."}</div>}
          <div style={{whiteSpace:"pre-line",fontSize:13,color:"#334155",lineHeight:1.7,background:"#fff",borderRadius:8,padding:"12px 14px",border:"1px solid #E0F2FE",maxHeight:240,overflow:"auto"}}>{buildRequestMsg()}</div>
        </div>
      )}
    </Card>
  );
}

// ── 진단·계산기 컴포넌트 ─────────────────────────────────
var DIAG_CATS=[{id:"청년",label:"청년 (만 15~34세)",icon:"🧑"},{id:"여성",label:"경력단절 여성",icon:"👩"},{id:"고령자",label:"만 60세 이상",icon:"👴"},{id:"장애인",label:"장애인",icon:"♿"},{id:"취약계층",label:"취업취약계층(프로그램 이수)",icon:"🪪"},{id:"일반",label:"해당 없음/일반",icon:"👤"}];

function diagnoseHiring(a,programs){ var results=[]; Object.keys(programs).forEach(function(key){ var p=programs[key]; var m=p.match||{}; var score=0; var reasons=[]; var blockers=[]; if(m.deprecated){results.push({program:p,status:"exclude",score:0,reasons:["2026년 신규 종료"],blockers:[]});return;} var catHit=(m.cats||[]).some(function(c){return(a.cats||[]).indexOf(c)>=0;}); if(catHit){score+=40;reasons.push("대상 유형 일치");} if(m.special&&m.special.length){var spHit=m.special.some(function(s){return(a.specials||[]).indexOf(s)>=0;});if(spHit){score+=35;reasons.push("상황 조건 일치");}} if(m.ageMin!=null||m.ageMax!=null){var maxAge=m.ageMax; if(m.milExtend&&a.gender==="male"&&a.milMonths>0){maxAge=calcMilitaryLimit(a.milMonths).maxYears;} if(a.age!=null){var ageOk=true; if(m.ageMin!=null&&a.age<m.ageMin)ageOk=false; if(maxAge!=null&&a.age>maxAge)ageOk=false; if(ageOk){score+=15;reasons.push("나이 요건 충족");}else{blockers.push("나이 요건 미충족");}}} if(m.gender&&m.gender!=="any"&&a.gender&&a.gender!==m.gender){blockers.push(m.gender==="female"?"여성 대상 제도":"성별 요건");} if(m.empTypes&&a.empType){if(m.empTypes.indexOf(a.empType)<0)blockers.push("채용형태("+m.empTypes.join("/")+") 요건");else score+=8;} if(m.companyMax!=null&&a.companySize!=null&&a.companySize>=m.companyMax){blockers.push(m.companyMax+"인 미만 대상");} if(m.companyMin!=null&&a.companySize!=null&&a.companySize<m.companyMin){blockers.push(m.companyMin+"인 이상 대상");} if(m.preApply&&a.preApply===false){if(p.id==="youth_jump"){reasons.push("사전신청 원칙(입사 3개월 내 예외)");}else{blockers.push("사전신청 필수");}} if(m.bosuFloor&&a.aboveFloor===false){blockers.push("월보수 124만↑ 필요");} if(a.noLayoff===false){blockers.push("최근 감원 이력—신청 제한");} if(p.id==="youth_jump"&&a.region==="수도권"&&a.youthEligible===false){blockers.push("수도권은 취업애로요건 필수");} if(p.id==="youth_jump"&&a.region==="비수도권"&&catHit){score+=12;reasons.push("비수도권: 기업+청년 합산 가능");} var status; if(blockers.length>0&&!catHit&&score<30)status="exclude"; else if(blockers.length>0)status="maybe"; else if(score>=55)status="recommend"; else if(score>=22)status="maybe"; else status="exclude"; results.push({program:p,status:status,score:score,reasons:reasons,blockers:blockers});}); results.sort(function(x,y){var o={recommend:0,maybe:1,exclude:2}; if(o[x.status]!==o[y.status])return o[x.status]-o[y.status]; return y.score-x.score;}); return results; }

function DiagRow(props){ var r=props.r; var p=r.program; var st1=useState(false); var gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]; return(<div style={{borderRadius:12,border:"1.5px solid "+gp.light,marginBottom:8,overflow:"hidden",background:gp.badge}}><div style={{padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={function(){st1[1](!st1[0]);}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{width:10,height:10,borderRadius:5,background:gp.base,display:"inline-block",flexShrink:0}}></span><Badge color={gp.dark} bg={gp.light}>{gp.icon} {p.group}</Badge><span style={{fontSize:17,fontWeight:700,color:gp.dark}}>{p.name}</span><Badge color={gp.dark} bg="rgba(255,255,255,0.8)">{fMan(p.totalAmount)}</Badge></div><span style={{fontSize:16,color:"#94A3B8",flexShrink:0,marginLeft:8}}>{st1[0]?"▾":"▸"}</span></div>{st1[0]&&(<div style={{padding:"0 16px 16px",borderTop:"1px solid #F1F5F9"}}>{r.reasons.length>0&&<div style={{marginTop:10,fontSize:16,color:"#059669",lineHeight:1.6}}>👍 {r.reasons.join(" · ")}</div>}{r.blockers.length>0&&<div style={{marginTop:8,fontSize:16,color:"#DC2626",lineHeight:1.6}}>⚠️ {r.blockers.join(" · ")}</div>}<div style={{marginTop:10,fontSize:16,color:"#475569",lineHeight:1.7}}>{p.note}</div><div style={{marginTop:8,fontSize:16,color:"#2563EB",fontWeight:600}}>📍 {p.applyUrl}</div></div>)}</div>); }

function HiringDiagnosis(props){ var programs=props.programs; var st1=useState("new"),st2=useState([]),st3=useState(""),st4=useState(""),st5=useState(0),st6=useState("수도권"),st7=useState(""),st8=useState("정규직"),st9=useState(true),st10=useState(true),st11=useState(true),st12=useState(true),st13=useState([]),st14=useState(null); function toggle(arr,setArr,v){if(arr.indexOf(v)>=0)setArr(arr.filter(function(x){return x!==v;}));else setArr(arr.concat([v]));} var situation=st1[0]; var SPECIAL_OPTIONS=situation==="retain"?[{id:"정규직전환",label:"비정규직→정규직 전환"},{id:"정년도달",label:"정년 도달 직원"},{id:"유연근무",label:"유연근무 도입"},{id:"주4.5일제",label:"주 4.5일제 도입(20인↑)"}]:situation==="childcare"?[{id:"육아휴직",label:"직원 육아휴직"},{id:"근로시간단축",label:"육아기 근로시간 단축"},{id:"대체인력",label:"빈자리 대체 채용"},{id:"업무분담",label:"동료 업무분담"}]:[]; function runDiagnose(){var cats=st2[0].slice();if(situation==="childcare"&&cats.indexOf("육아")<0)cats.push("육아");if(situation==="retain"&&cats.indexOf("재직")<0)cats.push("재직");var specials=st13[0].slice();if(st2[0].indexOf("여성")>=0)specials.push("경력단절");if(st2[0].indexOf("취약계층")>=0)specials.push("프로그램이수");if(st2[0].indexOf("장애인")>=0)specials.push("장애");var answers={situation:situation,cats:cats,specials:specials,age:st3[0]!==""?Number(st3[0]):null,gender:st4[0]||null,milMonths:Number(st5[0])||0,region:st6[0],companySize:st7[0]!==""?Number(st7[0]):null,empType:st8[0],preApply:st9[0],noLayoff:st10[0],aboveFloor:st11[0],youthEligible:st12[0]};st14[1](diagnoseHiring(answers,programs));} var result=st14[0]; var recommend=result?result.filter(function(r){return r.status==="recommend";}):[];var maybe=result?result.filter(function(r){return r.status==="maybe";}):[];
  function SegBtn(cur,setCur,val,label){var on=cur===val;return <button onClick={function(){setCur(val);}} style={Object.assign({},btnSm,{background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:18})}>{label}</button>;}
  return(<div><div style={{marginBottom:20}}><h3 style={{margin:"0 0 6px",fontSize:22,fontWeight:800}}>🎯 채용 예정 진단</h3><p style={{margin:0,fontSize:17,color:"#64748B",lineHeight:1.6}}>채용 조건을 체크하면 가능성 높은 고용지원금을 안내해드려요. (가능성 안내이며, 실제 신청 전 공고 확인 필요)</p></div>
  <Card style={{padding:22,marginBottom:18}}>
    <div style={{marginBottom:18}}><Label>1. 상황</Label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{[["new","신규채용","🆕 신규 채용"],["retain","재직자유지","🔄 재직자 처우개선"],["childcare","육아","🤱 출산·육아"]].map(function(arr){var gp=GROUP_COLORS[arr[1]]||GROUP_COLORS["커스텀"];var on=st1[0]===arr[0];return(<button key={arr[0]} onClick={function(){st1[1](arr[0]);}} style={{padding:"18px 12px",borderRadius:14,cursor:"pointer",textAlign:"center",background:on?gp.base:gp.badge,color:on?"#fff":gp.dark,border:"2px solid "+(on?gp.base:gp.light),fontWeight:on?700:500,fontSize:17}}><div style={{fontSize:28,marginBottom:6}}>{arr[2].split(" ")[0]}</div><div>{arr[2].split(" ").slice(1).join(" ")}</div></button>);})}</div></div>
    {situation==="new"&&(<div style={{marginBottom:18}}><Label>2. 채용 대상자 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>{DIAG_CATS.map(function(c){var on=st2[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st2[0],st2[1],c.id);}} style={{padding:"11px 14px",borderRadius:10,cursor:"pointer",fontSize:17,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.icon} {c.label}</button>;})}</div></div>)}
    {SPECIAL_OPTIONS.length>0&&(<div style={{marginBottom:18}}><Label>2. 구체적 상황 (복수 선택)</Label><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>{SPECIAL_OPTIONS.map(function(c){var on=st13[0].indexOf(c.id)>=0;return <button key={c.id} onClick={function(){toggle(st13[0],st13[1],c.id);}} style={{padding:"11px 14px",borderRadius:10,cursor:"pointer",fontSize:17,textAlign:"left",background:on?"#EFF6FF":"#fff",border:on?"2px solid #93C5FD":"1px solid #E2E8F0",color:on?"#2563EB":"#475569",fontWeight:on?600:400}}>{c.label}</button>;})}</div></div>)}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:16}}>
      <div><Label>나이(만)</Label><input type="number" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="29"/></div>
      <div><Label>성별</Label><div style={{display:"flex",gap:6}}>{SegBtn(st4[0],st4[1],"male","남")}{SegBtn(st4[0],st4[1],"female","여")}</div></div>
      {st4[0]==="male"&&<div><Label>군복무(월)</Label><input type="number" style={inp} value={st5[0]} onChange={function(e){st5[1](e.target.value);}} placeholder="18"/></div>}
      <div><Label>회사 규모(고용보험)</Label><input type="number" style={inp} value={st7[0]} onChange={function(e){st7[1](e.target.value);}} placeholder="피보험자 수"/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:16}}>
      <div><Label>지역</Label><div style={{display:"flex",gap:6}}>{SegBtn(st6[0],st6[1],"수도권","수도권")}{SegBtn(st6[0],st6[1],"비수도권","비수도권")}</div></div>
      <div><Label>채용형태</Label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{["정규직","계약직","인턴","대체인력"].map(function(t){return SegBtn(st8[0],st8[1],t,t);})}</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:16}}>
      {[["채용 전(사전신청 가능)",st9],["최근 감원 이력 없음",st10],["월보수 124만원 이상",st11]].map(function(arr,i){var st=arr[1];return(<label key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:st[0]?"#ECFDF5":"#FEF2F2",border:st[0]?"1px solid #A7F3D0":"1px solid #FECACA",cursor:"pointer",fontSize:17}}><input type="checkbox" checked={st[0]} onChange={function(){st[1](!st[0]);}} style={{width:18,height:18,accentColor:"#059669"}}/><span style={{color:st[0]?"#059669":"#DC2626"}}>{arr[0]}</span></label>);})}
      {st2[0].indexOf("청년")>=0&&st6[0]==="수도권"&&(<label style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:st12[0]?"#ECFDF5":"#FEF2F2",border:st12[0]?"1px solid #A7F3D0":"1px solid #FECACA",cursor:"pointer",fontSize:17}}><input type="checkbox" checked={st12[0]} onChange={function(){st12[1](!st12[0]);}} style={{width:18,height:18,accentColor:"#059669"}}/><span style={{color:st12[0]?"#059669":"#DC2626"}}>취업애로요건 해당(청년·수도권)</span></label>)}
    </div>
    <button style={Object.assign({},btnP,{width:"100%",padding:16,fontSize:20})} onClick={runDiagnose}>🎯 지원금 가능성 진단</button>
  </Card>
  {result&&(<div>{recommend.length>0&&(<Card style={{padding:20,marginBottom:16,border:"2px solid #6EE7B7"}}><h4 style={{margin:"0 0 12px",fontSize:20,fontWeight:700,color:"#059669"}}>✅ 가능성 높음 ({recommend.length})</h4>{recommend.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{maybe.length>0&&(<Card style={{padding:20,marginBottom:16,border:"1px solid #E2E8F0"}}><h4 style={{margin:"0 0 12px",fontSize:20,fontWeight:700,color:"#475569"}}>⚠️ 조건 확인 필요 ({maybe.length})</h4>{maybe.map(function(r){return <DiagRow key={r.program.id} r={r}/>;})}</Card>)}{recommend.length===0&&maybe.length===0&&(<Card style={{padding:36,textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>🔍</div><p style={{color:"#94A3B8",fontSize:18,margin:0}}>입력 조건에 뚜렷하게 맞는 지원금이 없어요.</p></Card>)}<Notice>진단 결과는 가능성 안내이며 확정이 아닙니다. 실제 신청 전 최신 공고를 확인하세요.</Notice></div>)}</div>);
}

function WageCalc(){
  var st1=useState(""),st2=useState(40),st3=useState(1),stTab=useState("deduct");
  var stAnnual=useState(""); // 연봉→월급 변환
  var monthly=Number(st1[0])||0;
  var result=useMemo(function(){
    if(!monthly)return null;
    var wh=Number(st2[0])||40;
    var mh=wh>=40?209:Math.round((wh+(wh>=15?wh/40*8:0))*4.345);
    var hourlyWage=Math.round(monthly/mh);
    var minMonthly=Math.round(MIN_WAGE_2026*mh);
    // 4대보험 근로자
    var pensionBase=Math.min(monthly,5900000);
    var pension_ee=Math.round(pensionBase*0.045);
    var health_ee=Math.round(monthly*0.03545);
    var care_ee=Math.round(health_ee*0.1295);
    var employ_ee=Math.round(monthly*0.009);
    var total4_ee=pension_ee+health_ee+care_ee+employ_ee;
    // 4대보험 사업주
    var pension_er=Math.round(pensionBase*0.045);
    var health_er=Math.round(monthly*0.03545);
    var care_er=Math.round(health_er*0.1295);
    var employ_er=Math.round(monthly*0.009);
    var injury_er=Math.round(monthly*0.0143);
    var total4_er=pension_er+health_er+care_er+employ_er+injury_er;
    // 소득세 (간이세액표 근사)
    var annual=monthly*12;
    var emDed; if(annual<=5000000)emDed=annual*0.70; else if(annual<=15000000)emDed=3500000+(annual-5000000)*0.40; else if(annual<=45000000)emDed=7500000+(annual-15000000)*0.15; else if(annual<=100000000)emDed=12000000+(annual-45000000)*0.05; else emDed=14750000+(annual-100000000)*0.02;
    var deps=Math.max(1,Number(st3[0])||1);
    var taxBase=Math.max(0,annual-emDed-1500000*deps);
    var annTax; if(taxBase<=14000000)annTax=taxBase*0.06; else if(taxBase<=50000000)annTax=840000+(taxBase-14000000)*0.15; else if(taxBase<=88000000)annTax=6240000+(taxBase-50000000)*0.24; else if(taxBase<=150000000)annTax=15360000+(taxBase-88000000)*0.35; else annTax=37060000+(taxBase-150000000)*0.38;
    var credit=Math.min(annTax<=1300000?annTax*0.55:715000+(annTax-1300000)*0.30,740000);
    var incomeTax=Math.max(0,Math.round((annTax-credit)/12));
    var localTax=Math.round(incomeTax*0.10);
    return{
      hourlyWage:hourlyWage,monthlyHours:mh,minMonthly:minMonthly,isAboveMin:hourlyWage>=MIN_WAGE_2026,isAboveFloor:monthly>=BOSU_FLOOR_2026,gap:hourlyWage-MIN_WAGE_2026,
      pension_ee:pension_ee,health_ee:health_ee,care_ee:care_ee,employ_ee:employ_ee,total4_ee:total4_ee,
      pension_er:pension_er,health_er:health_er,care_er:care_er,employ_er:employ_er,injury_er:injury_er,total4_er:total4_er,
      incomeTax:incomeTax,localTax:localTax,
      totalDeduct:total4_ee+incomeTax+localTax,
      netPay:monthly-total4_ee-incomeTax-localTax,
      totalEmployerCost:monthly+total4_er
    };
  },[monthly,st2[0],st3[0]]);

  function DRow(label,pct,amount,accent){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",fontSize:15}}><div><span style={{color:"#1E293B"}}>{label}</span>{pct&&<span style={{fontSize:12,color:"#94A3B8",marginLeft:6}}>{pct}</span>}</div><span style={{fontWeight:600,color:accent||"#DC2626"}}>−{(amount||0).toLocaleString()}원</span></div>);}
  function ERow(label,pct,amount){return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:"1px solid rgba(0,0,0,0.04)",fontSize:15}}><div><span style={{color:"#1E293B"}}>{label}</span>{pct&&<span style={{fontSize:12,color:"#94A3B8",marginLeft:6}}>{pct}</span>}</div><span style={{fontWeight:600,color:"#059669"}}>+{(amount||0).toLocaleString()}원</span></div>);}

  return(
    <div className="fade-in">
      <Card style={{padding:"20px 24px",marginBottom:16}}>
        <h2 style={{margin:"0 0 4px",fontSize:FS_PAGE_TITLE,fontWeight:800}}>🧮 급여 계산기</h2>
        <p style={{margin:"0 0 20px",fontSize:FS_BODY,color:"#64748B",lineHeight:1.6}}>2026년 기준 · 최저임금 시급 <strong>{MIN_WAGE_2026.toLocaleString()}원</strong> · 월환산 <strong>{MIN_WAGE_MONTH_2026.toLocaleString()}원</strong>(209h)</p>

        {/* 연봉↔월급 변환 */}
        <div style={{padding:"12px 16px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,marginBottom:20,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:15,fontWeight:700,color:"#475569",flexShrink:0}}>💡 연봉 → 월급</span>
          <input type="number" style={Object.assign({},inp,{flex:1,minWidth:140,maxWidth:220,margin:0})} value={stAnnual[0]} onChange={function(e){stAnnual[1](e.target.value);var m=Math.round(Number(e.target.value)/12);if(m)st1[1](String(m));}} placeholder="연봉 입력 (예: 30000000)"/>
          {stAnnual[0]&&Number(stAnnual[0])>0&&<span style={{fontSize:15,color:"#1D4ED8",fontWeight:700}}>→ 월 {Math.round(Number(stAnnual[0])/12).toLocaleString()}원</span>}
        </div>

        {/* 주요 입력 */}
        <div className="wage-input-grid" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:8}}>
          <div>
            <Label>월 급여 (세전, 원)</Label>
            <input type="number" style={inp} value={st1[0]} onChange={function(e){st1[1](e.target.value);stAnnual[1]("");}} placeholder="2,200,000"/>
            <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
              {[2060000,2156880,2500000,3000000,4000000].map(function(v){return(
                <button key={v} onClick={function(){st1[1](String(v));stAnnual[1]("");}}
                  style={{padding:"3px 8px",fontSize:11,borderRadius:5,border:"1px solid #E2E8F0",background:monthly===v?"#DBEAFE":"#F8FAFC",color:monthly===v?"#2563EB":"#64748B",cursor:"pointer",fontFamily:FF}}>
                  {fManS(v)}
                </button>
              );})}
            </div>
          </div>
          <div>
            <Label>주 소정근로시간</Label>
            <select style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}}>
              {[[40,"40시간 (통상)"],[35,"35시간"],[30,"30시간"],[20,"20시간"],[15,"15시간"]].map(function(arr){return <option key={arr[0]} value={arr[0]}>{arr[1]}</option>;})}
            </select>
          </div>
          <div>
            <Label>부양가족 수 (본인포함)</Label>
            <select style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}}>
              {[1,2,3,4,5].map(function(n){return <option key={n} value={n}>{n}명</option>;})}
            </select>
          </div>
        </div>
      </Card>

      {!monthly&&(
        <Card style={{padding:"48px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>🧮</div>
          <p style={{color:"#94A3B8",fontSize:18,margin:0}}>월 급여를 입력하면 실수령액, 4대보험, 사업주 부담금을 자동으로 계산해 드립니다.</p>
        </Card>
      )}

      {result&&(
        <div className="fade-in">
          {/* 탭 */}
          <div style={{display:"flex",gap:0,borderBottom:"2px solid #E2E8F0",marginBottom:20,background:"#fff",borderRadius:"12px 12px 0 0",overflow:"hidden"}}>
            {[["deduct","💰 실수령액"],["employer","🏢 사업주 부담"],["minwage","📊 최저임금 판정"]].map(function(arr){var on=stTab[0]===arr[0];return(
              <button key={arr[0]} onClick={function(){stTab[1](arr[0]);}}
                style={{flex:1,padding:"13px 6px",fontSize:FS_BODY,fontWeight:on?700:500,color:on?"#2563EB":"#64748B",background:on?"#EFF6FF":"transparent",border:"none",borderBottom:on?"3px solid #2563EB":"3px solid transparent",cursor:"pointer",fontFamily:FF,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                {arr[1]}
              </button>
            );})}
          </div>

          {stTab[0]==="deduct"&&(
            <div className="fade-in">
              {/* 요약 배너 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
                {[["세전 월급",monthly,"#1E293B"],["총 공제액",result.totalDeduct,"#DC2626"],["실수령액",result.netPay,"#2563EB"]].map(function(arr,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px",textAlign:"center"}}>
                    <div style={{fontSize:13,color:"#64748B",marginBottom:4}}>{arr[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:arr[2]}}>{arr[1].toLocaleString()}원</div>
                  </Card>
                );})}
              </div>
              {/* 공제 명세 */}
              <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"11px 16px",background:"#F8FAFC",borderBottom:"2px solid #E2E8F0",fontSize:15,fontWeight:700,color:"#1E293B"}}>급여 공제 내역</div>
                <div style={{background:"#F8FAFC"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#475569",letterSpacing:"0.05em"}}>▸ 4대보험 (총 {result.total4_ee.toLocaleString()}원)</div>
                  {DRow("국민연금","4.5%",result.pension_ee,"#475569")}
                  {DRow("건강보험","3.545%",result.health_ee,"#475569")}
                  {DRow("장기요양","건보×12.95%",result.care_ee,"#475569")}
                  {DRow("고용보험","0.9%",result.employ_ee,"#475569")}
                </div>
                <div style={{background:"#FEF2F2"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#991B1B",letterSpacing:"0.05em"}}>▸ 세금 (총 {(result.incomeTax+result.localTax).toLocaleString()}원)</div>
                  {DRow("소득세","근사치",result.incomeTax,"#DC2626")}
                  {DRow("지방소득세","소득세×10%",result.localTax,"#DC2626")}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"#2563EB"}}>
                  <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>💵 실수령액</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{result.netPay.toLocaleString()}원</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>세전의 {Math.round(result.netPay/monthly*100)}%</div>
                  </div>
                </div>
              </Card>
              <p style={{fontSize:12,color:"#94A3B8",margin:0}}>* 소득세는 간이세액표 근사치입니다. 실제 공제액은 연말정산 결과에 따라 달라질 수 있습니다.</p>
            </div>
          )}

          {stTab[0]==="employer"&&(
            <div className="fade-in">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                {[["사업주 4대보험 부담",result.total4_er,"#059669"],["월 총 인건비",result.totalEmployerCost,"#2563EB"]].map(function(arr,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px",textAlign:"center"}}>
                    <div style={{fontSize:13,color:"#64748B",marginBottom:4}}>{arr[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:arr[2]}}>{arr[1].toLocaleString()}원</div>
                  </Card>
                );})}
              </div>
              <Card style={{padding:0,overflow:"hidden",marginBottom:12}}>
                <div style={{padding:"11px 16px",background:"#F8FAFC",borderBottom:"2px solid #E2E8F0",fontSize:15,fontWeight:700,color:"#1E293B"}}>사업주 비용 명세</div>
                <div style={{padding:"11px 16px",display:"flex",justifyContent:"space-between",fontSize:16,borderBottom:"1px solid #F1F5F9"}}>
                  <span style={{color:"#1E293B"}}>근로자 월급</span><span style={{fontWeight:700}}>{monthly.toLocaleString()}원</span>
                </div>
                <div style={{background:"#F8FAFC"}}>
                  <div style={{padding:"8px 16px",fontSize:12,fontWeight:700,color:"#475569",letterSpacing:"0.05em"}}>▸ 4대보험 사업주 부담 (총 {result.total4_er.toLocaleString()}원)</div>
                  {ERow("국민연금","4.5%",result.pension_er)}
                  {ERow("건강보험","3.545%",result.health_er)}
                  {ERow("장기요양","건보×12.95%",result.care_er)}
                  {ERow("고용보험","0.9% (150인↓)",result.employ_er)}
                  {ERow("산재보험","1.43% (평균)",result.injury_er)}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px",background:"#0F172A"}}>
                  <span style={{fontSize:17,fontWeight:700,color:"#fff"}}>🏢 월 총 인건비</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#fff"}}>{result.totalEmployerCost.toLocaleString()}원</div>
                    <div style={{fontSize:13,color:"rgba(255,255,255,0.75)"}}>연간 약 {Math.round(result.totalEmployerCost*12/10000).toLocaleString()}만원</div>
                  </div>
                </div>
              </Card>
              <div style={{padding:"12px 16px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,fontSize:14,color:"#475569"}}>
                💡 사업주 부담 비율은 월급의 약 <strong style={{color:"#1D4ED8"}}>{Math.round(result.total4_er/monthly*100)}%</strong>입니다. 산재보험율은 업종별 상이(평균 1.43% 적용).
              </div>
            </div>
          )}

          {stTab[0]==="minwage"&&(
            <div className="fade-in">
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <Card style={{padding:"18px",textAlign:"center",border:"1.5px solid "+(result.isAboveMin?"#6EE7B7":"#FECACA")}}>
                  <div style={{fontSize:14,color:"#64748B",marginBottom:4}}>환산 시급</div>
                  <div style={{fontSize:34,fontWeight:800,color:result.isAboveMin?"#059669":"#DC2626"}}>{result.hourlyWage.toLocaleString()}원</div>
                  <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{result.monthlyHours}시간/월 기준</div>
                </Card>
                <Card style={{padding:"18px",textAlign:"center",border:"1.5px solid "+(result.gap>=0?"#6EE7B7":"#FECACA")}}>
                  <div style={{fontSize:14,color:"#64748B",marginBottom:4}}>최저임금 대비</div>
                  <div style={{fontSize:34,fontWeight:800,color:result.gap>=0?"#059669":"#DC2626"}}>{result.gap>=0?"+":""}{result.gap.toLocaleString()}원</div>
                  <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>기준: {MIN_WAGE_2026.toLocaleString()}원/h</div>
                </Card>
              </div>
              <div style={{display:"grid",gap:10}}>
                <div style={{padding:"16px 20px",borderRadius:12,fontSize:17,fontWeight:600,background:result.isAboveMin?"#D1FAE5":"#FEE2E2",color:result.isAboveMin?"#059669":"#DC2626",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>{result.isAboveMin?"✅ 최저임금 충족":"❌ 최저임금 미달"}</span>
                  {!result.isAboveMin&&<span style={{fontSize:14,opacity:0.8}}>월 {result.minMonthly.toLocaleString()}원 이상 필요</span>}
                </div>
                <div style={{padding:"16px 20px",borderRadius:12,fontSize:17,fontWeight:600,background:result.isAboveFloor?"#EFF6FF":"#F1F5F9",color:result.isAboveFloor?"#2563EB":"#64748B"}}>
                  {result.isAboveFloor?"✅ 월보수 하한선(124만원) 충족 — 주요 지원금 신청 가능":"⚠️ 월보수 124만원 미만 — 고용촉진장려금·청년도약 등 원천 제외"}
                </div>
                <div style={{padding:"14px 20px",borderRadius:12,background:"#F8FAFC",border:"1px solid #E2E8F0",fontSize:15,color:"#475569",lineHeight:1.7}}>
                  <strong style={{color:"#1E293B"}}>참고</strong> · 2026년 최저임금 시급 {MIN_WAGE_2026.toLocaleString()}원 · 월환산 {MIN_WAGE_MONTH_2026.toLocaleString()}원(주40h·월209h 기준) · 고용보험 보수 하한선 {BOSU_FLOOR_2026.toLocaleString()}원<br/>
                  <span style={{color:"#94A3B8",fontSize:13}}>※ 4대보험·세액은 근사치이며, 실제 신고·근로계약 조건 및 연도별 최신 기준은 별도 확인이 필요합니다.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Simulator(props){ var programs=props.programs; var st1=useState("youth_jump"),st2=useState(1),st3=useState(""); var selectedProgram=programs[st1[0]]; var results=useMemo(function(){if(!selectedProgram||!st2[0])return{monthly:[],total:0}; var count=parseInt(st2[0])||0; var startDate=st3[0]||new Date().toISOString().split("T")[0]; var monthly=[]; var totalAmount=0; for(var i=0;i<count;i++){(selectedProgram.rounds||[]).forEach(function(r){var eligDate=addMo(startDate,r.month);var ym=eligDate.substring(0,7);var existing=monthly.find(function(m){return m.month===ym;});if(existing){existing.amount+=r.amount;existing.count++;}else{monthly.push({month:ym,amount:r.amount,count:1});}totalAmount+=r.amount;});} return{monthly:monthly.sort(function(a,b){return a.month.localeCompare(b.month);}),total:totalAmount,perPerson:selectedProgram.totalAmount||0};}, [selectedProgram,st2[0],st3[0]]);
  return(<Card style={{padding:"clamp(16px,4vw,24px)",marginBottom:20}}>
    <h4 style={{margin:"0 0 16px",fontSize:FS_SECTION,fontWeight:800}}>📊 예상 수령액 시뮬레이터</h4>
    <div className="sim-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.1fr)",gap:20,alignItems:"start"}}>
      {/* 좌: 입력 */}
      <div style={{minWidth:0}}>
        <div style={{marginBottom:16}}><Label>지원금 선택</Label>{["신규채용","재직자유지","육아"].map(function(grp){var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];var items=Object.values(programs).filter(function(p){return p.group===grp;});if(!items.length)return null;return(<div key={grp} style={{marginBottom:10,padding:"12px 14px",borderRadius:12,background:gp.badge,border:"1.5px solid "+gp.light}}><div style={{fontSize:FS_BODY,fontWeight:700,color:gp.dark,marginBottom:8}}>{gp.icon} {grp}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{items.map(function(p){var on=st1[0]===p.id;return(<button key={p.id} onClick={function(){st1[1](p.id);}} style={{padding:"7px 13px",borderRadius:8,fontSize:FS_BTN_SM,cursor:"pointer",fontWeight:on?700:500,background:on?gp.base:"#fff",color:on?"#fff":gp.text,border:on?"none":"1.5px solid "+gp.light}}>{p.name}</button>);})}</div></div>);})}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><Label>채용 예정 인원</Label><input type="number" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}} min="1" placeholder="1"/></div><div><Label>예상 입사일</Label><input type="date" style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}}/></div></div>
      </div>
      {/* 우: 결과 */}
      <div style={{minWidth:0}}>
      {results.total>0?(<React.Fragment><div style={{padding:"20px 18px",background:"#2563EB",borderRadius:14,color:"#fff",marginBottom:16,textAlign:"center"}}><div style={{fontSize:FS_BODY,opacity:0.85,marginBottom:6,fontWeight:600}}>예상 총 수령액 (최대치)</div><div style={{fontSize:FS_HERO_NUM,fontWeight:800,letterSpacing:"-1px",lineHeight:1.1,wordBreak:"keep-all"}}>{fMan(results.total)}</div><div style={{fontSize:FS_BODY,opacity:0.75,marginTop:6}}>1인당 {fMan(results.perPerson)} × {st2[0]}명</div></div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}><span style={{fontSize:FS_CARD_TITLE,fontWeight:700}}>📅 월별 예상 수령</span>{(function(){var bd=new Date((st3[0]||new Date().toISOString().split("T")[0])+"T00:00:00");var lbl=bd.getFullYear()+"년 "+(bd.getMonth()+1)+"월";return <span style={{fontSize:FS_BADGE,fontWeight:700,padding:"3px 10px",borderRadius:999,background:"#EFF6FF",color:"#2563EB",border:"1px solid #BFDBFE",whiteSpace:"nowrap"}}>{lbl} {st3[0]?"입사":"신청"} 기준</span>;})()}</div><div style={{maxHeight:280,overflow:"auto",display:"grid",gap:4}}>{results.monthly.map(function(m,i){var d=new Date(m.month+"-01");return(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,padding:"10px 14px",background:i%2===0?"#F8FAFC":"#fff",borderRadius:8,border:"1px solid #F1F5F9"}}><span style={{fontSize:FS_BODY,color:"#475569",fontWeight:500,whiteSpace:"nowrap"}}>{d.getFullYear()}년 {d.getMonth()+1}월</span><div style={{textAlign:"right",whiteSpace:"nowrap"}}><span style={{fontSize:FS_LIST,fontWeight:700,color:"#2563EB"}}>{fMan(m.amount)}</span><span style={{fontSize:FS_BADGE,color:"#94A3B8",marginLeft:6}}>({m.count}건)</span></div></div>);})}</div><div style={{marginTop:14}}><button style={Object.assign({},btnP,{width:"100%",padding:"12px 18px"})} onClick={function(){var pname=(programs[st1[0]]||{}).name||"";var lines=results.monthly.map(function(m){var d=new Date(m.month+"-01");return d.getFullYear()+"년 "+(d.getMonth()+1)+"월 "+fMan(m.amount);});var txt="대표님, 현재 "+pname+" 기준으로 "+st2[0]+"명을 채용하실 경우\n총 예상 지원금은 최대 "+fMan(results.total)+"이며,\n"+lines.join(", ")+" 순으로 수령 가능성이 있습니다.\n단, 실제 지급 여부는 요건 충족 및 기관 심사 결과에 따라 달라질 수 있습니다.";navigator.clipboard.writeText(txt).then(function(){toast("상담용 문구가 복사되었습니다. 고객에게 바로 보내세요.","success");});}}>📋 상담용 문구 복사</button></div><div style={{marginTop:12,padding:"11px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,fontSize:FS_BADGE,color:"#64748B",lineHeight:1.7}}>※ 예상 수령액은 공고 기준과 입력값을 바탕으로 계산한 <strong>참고 금액</strong>입니다. 실제 지급액은 심사 결과·예산·고용 유지 여부 등에 따라 달라질 수 있습니다.</div></React.Fragment>):(<div style={{padding:"40px 20px",textAlign:"center",background:"#F8FAFC",borderRadius:14,border:"1px dashed #CBD5E1"}}><div style={{fontSize:40,marginBottom:10}}>📊</div><div style={{fontSize:FS_BODY,color:"#94A3B8"}}>지원금·인원·입사일을 입력하면<br/>월별 예상 수령액이 표시됩니다.</div></div>)}
      </div>
    </div>
  </Card>); }

// ── 보조 컴포넌트 ─────────────────────────────────────────
function JuminInput(props){ var st1=useState(""); function handleChange(e){ var val=e.target.value.replace(/[^0-9]/g,"").substring(0,7); st1[1](val); if(val.length>=7){var parsed=parseJumin(val);if(parsed){props.onParsed(parsed);}}} return(<div><Label color="#1D4ED8">주민번호 앞 7자리 (자동입력)</Label><input style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff"})} value={st1[0]} onChange={handleChange} placeholder="9501011" maxLength={7}/>{st1[0].length===7&&(<div style={{fontSize:11,color:"#059669",marginTop:4}}>✅ 생년월일/성별만 추출되어 저장됩니다 (주민번호 원본은 저장되지 않음)</div>)}<div style={{fontSize:11,color:"#475569",marginTop:6,padding:"7px 9px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:6,lineHeight:1.5}}>🔒 민감정보 보호를 위해 주민등록번호 전체 저장은 권장하지 않습니다. 생년월일과 성별만으로 지원금 요건을 판정합니다. 입력한 7자리는 생년월일·성별 변환에만 쓰이고 저장되지 않습니다.</div></div>); }

function EligChk(props){ var bd=props.bd,gen=props.gen,mil=props.mil,ec=props.ec,xc=props.xc,hd=props.hd; var ageD=calcAgeDetailed(bd,hd); var age=ageD?ageD.years:null; var ageMonths=ageD?ageD.totalMonths:0; var milLimit=gen==="male"?calcMilitaryLimit(mil):{maxTotalMonths:34*12,maxYears:34,maxRemainMonths:0}; var aOk=ageD!==null&&ageMonths>=15*12&&ageMonths<=milLimit.maxTotalMonths; var anyE=Object.values(ec).some(function(v){return v;}); var failedX=EXCL.filter(function(x){return xc[x.id]===false;}); var allXok=EXCL.every(function(x){return xc[x.id]===true;}); var ok=aOk&&anyE&&allXok; var has=bd&&bd!=="2000-01-01"; var maxLabel=milLimit.maxRemainMonths>0?"만"+milLimit.maxYears+"세"+milLimit.maxRemainMonths+"개월":"만"+milLimit.maxYears+"세"; var nearBorder=ageD&&gen==="male"&&mil>0&&ageMonths>34*12&&ageMonths<=milLimit.maxTotalMonths;
  return(<div style={{border:"2px solid #BFDBFE",borderRadius:10,padding:12,background:"#F0F7FF"}}><div style={{fontSize:14,fontWeight:700,color:"#1D4ED8",marginBottom:8}}>🔍 청년도약 자격요건</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}><div><Label color="#1D4ED8">생년월일</Label><input type="date" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={bd||"2000-01-01"} onChange={function(e){props.setBd(e.target.value);}}/></div><div><Label color="#1D4ED8">성별</Label><div style={{display:"flex",gap:3}}>{[["male","남"],["female","여"]].map(function(arr){return <button key={arr[0]} onClick={function(){props.setGen(arr[0]);}} style={Object.assign({},btnSm,{flex:1,background:gen===arr[0]?"#DBEAFE":"#fff",color:gen===arr[0]?"#2563EB":"#64748B",border:gen===arr[0]?"2px solid #93C5FD":"1px solid #E2E8F0",fontSize:11})}>{arr[1]}</button>;})}</div></div>{gen==="male"&&<div><Label color="#1D4ED8">군복무(월)</Label><input type="number" style={Object.assign({},inp,{borderColor:"#93C5FD",background:"#fff",fontSize:12,padding:"8px 10px"})} value={mil||""} onChange={function(e){props.setMil(Number(e.target.value));}} placeholder="18"/></div>}</div>{age!==null&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:aOk?"#D1FAE5":"#FEE2E2",fontSize:12,fontWeight:600}}>{aOk?<span style={{color:"#059669"}}>✅ 만{age}세 (상한: {maxLabel})</span>:<span style={{color:"#DC2626"}}>❌ 만{age}세 미충족</span>}</div>}{nearBorder&&<div style={{padding:"4px 8px",borderRadius:4,marginBottom:6,background:"#F1F5F9",fontSize:11,color:"#64748B"}}>⚠️ 경계선 — 관할기관 확인 필요</div>}<div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#1D4ED8"}}>📋 취업애로요건 (1개↑)</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>{ELIG.map(function(e){var isChecked=!!ec[e.id];return(<label key={e.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#ECFDF5":"#fff",border:isChecked?"1px solid #A7F3D0":"1px solid #E2E8F0",fontSize:11}} title={e.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setEc(function(p){var n=Object.assign({},p);n[e.id]=!p[e.id];return n;});}} style={{accentColor:"#059669",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#475569"}}>{e.label}</span></label>);})}</div></div><div style={{marginBottom:8}}><div style={{fontSize:12,fontWeight:600,marginBottom:4,color:"#DC2626"}}>🚫 제외요건 확인</div><div style={{display:"grid",gap:3}}>{EXCL.map(function(x){var isChecked=!!xc[x.id];return(<label key={x.id} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 6px",borderRadius:4,cursor:"pointer",background:isChecked?"#ECFDF5":"#FEF2F2",border:isChecked?"1px solid #A7F3D0":"1px solid #FECACA",fontSize:11}} title={x.desc}><input type="checkbox" checked={isChecked} onChange={function(){props.setXc(function(p){var n=Object.assign({},p);n[x.id]=!p[x.id];return n;});}} style={{accentColor:"#059669",width:12,height:12}}/><span style={{color:isChecked?"#059669":"#DC2626"}}>{x.label}</span></label>);})}</div></div>{has&&failedX.length>0&&<div style={{padding:"7px 10px",marginBottom:6,borderRadius:6,background:"#FEF2F2",border:"1px solid #FECACA",fontSize:11,color:"#DC2626",fontWeight:600,lineHeight:1.5}}>🚫 제외요건 {failedX.length}개에 해당할 수 있습니다. 진행 전 반드시 운영기관 확인이 필요합니다. (저장은 가능하며, 상태를 '보류'로 관리하세요)</div>}<div style={{padding:"8px",borderRadius:6,textAlign:"center",background:ok?"#ECFDF5":has?"#F1F5F9":"#F1F5F9",fontSize:13,fontWeight:700}}>{ok?<span style={{color:"#059669"}}>✅ 대상자 예상</span>:has?<span style={{color:"#64748B"}}>⚠️ 일부 요건 확인 필요</span>:<span style={{color:"#64748B"}}>정보입력</span>}</div></div>);
}

function BulkUpload(props){ var programs=props.programs,onUpload=props.onUpload; var st1=useState(false),st2=useState(""),st3=useState([]),st4=useState(""); function parseData(){if(!st2[0].trim()){st4[1]("데이터를 붙여넣어 주세요");return;}var parsed=parseExcelData(st2[0],programs);if(parsed.length===0){st4[1]("유효한 데이터가 없습니다.");return;}st3[1](parsed);st4[1]("");} function doUpload(){if(st3[0].length===0)return;var n=st3[0].length;onUpload(st3[0]);st1[1](false);st2[1]("");st3[1]([]);toast(n+"명이 등록되었습니다.","success");} function copyTemplate(){navigator.clipboard.writeText(makeExcelTemplate());toast("엑셀 양식이 복사되었습니다.","success");} return(<React.Fragment><button style={btnSm} onClick={function(){st1[1](true);st2[1]("");st3[1]([]);st4[1]("");}}>📥 일괄등록</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📥 직원 일괄 등록" width={600}><div style={{display:"grid",gap:16}}><div style={{padding:14,background:"#EFF6FF",borderRadius:10,border:"1px solid #BFDBFE"}}><div style={{fontSize:14,fontWeight:700,color:"#2563EB",marginBottom:8}}>Step 1. 양식 복사</div><button style={btnSm} onClick={copyTemplate}>📋 양식 복사</button></div><div style={{padding:14,background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}><div style={{fontSize:14,fontWeight:700,color:"#475569",marginBottom:8}}>Step 2. 데이터 붙여넣기</div><textarea style={Object.assign({},inp,{height:110,resize:"none",fontFamily:"monospace",fontSize:11})} value={st2[0]} onChange={function(e){st2[1](e.target.value);st3[1]([]);}} placeholder={"이름\t주민번호앞7자리\t입사일\t연락처\t이메일\t지원금ID"}/>{st4[0]&&<p style={{fontSize:12,color:"#DC2626",marginTop:4}}>{st4[0]}</p>}<button style={Object.assign({},btnP,{marginTop:8})} onClick={parseData}>데이터 확인</button></div>{st3[0].length>0&&(<div style={{padding:14,background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0"}}><div style={{fontSize:14,fontWeight:700,color:"#475569",marginBottom:8}}>Step 3. 확인 및 등록 ({st3[0].length}명)</div><div style={{maxHeight:150,overflow:"auto",marginBottom:8}}>{st3[0].map(function(row,i){return(<div key={i} style={{fontSize:11,padding:"4px 0",borderBottom:"1px solid #F1F5F9"}}>{row.name} · {row.birthDate} · {row.startDate} · {row.phone}</div>);})}</div><button style={Object.assign({},btnP,{width:"100%"})} onClick={doUpload}>✅ {st3[0].length}명 등록하기</button></div>)}</div></Modal></React.Fragment>); }

function PDFReport(props){ var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile; var st1=useState(false); var rd=useMemo(function(){ var emps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";}); var totalReceived=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0); var totalExpected=emps.reduce(function(s,e){return s+(e.totalExpected||0);},0); var upcoming=[]; emps.forEach(function(e){var p=programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(e.startDate,r.month);var dd=getDday(ed);if(dd!==null&&dd>=0&&dd<=90)upcoming.push({empName:e.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:r.expectedAmount});});}); upcoming.sort(function(a,b){return a.dday-b.dday;}); return{empCount:emps.length,totalExpected:totalExpected,totalReceived:totalReceived,remaining:totalExpected-totalReceived,upcomingRounds:upcoming.slice(0,10),employees:emps}; },[company,employees,programs]);
  function generatePDF(){ var cl=company.corpType==="법인"?(company.juPosition==="앞"?"(주)"+company.name:company.name+"(주)"):company.name; var today=new Date(); var rd2=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일"; var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+cl+' 고용지원금 현황</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1E293B}h1{font-size:24px;border-bottom:3px solid #2563EB;padding-bottom:10px;margin-bottom:20px}h2{font-size:16px;color:#2563EB;margin-top:30px;border-left:4px solid #2563EB;padding-left:10px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:30px}.sc{background:#F8FAFC;border-radius:8px;padding:15px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:24px;font-weight:700;color:#2563EB}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E2E8F0;padding:8px 12px;text-align:left;font-size:13px}th{background:#F8FAFC}@media print{body{padding:20px}}</style></head><body>'; html+='<h1>📋 '+cl+' 고용지원금 현황</h1><p style="color:#64748B;font-size:13px">작성일: '+rd2+' | 작성자: '+(profile.display_name||"")+" "+(profile.title||"")+'</p>'; html+='<div class="summary"><div class="sc"><div class="l">대상자</div><div class="v">'+rd.empCount+'명</div></div><div class="sc"><div class="l">수령완료</div><div class="v">'+fMan(rd.totalReceived)+'</div></div><div class="sc"><div class="l">수령예정</div><div class="v">'+fMan(rd.remaining)+'</div></div></div>'; if(rd.upcomingRounds.length>0){html+='<h2>🔔 향후 90일 내 신청 예정</h2><table><tr><th>직원</th><th>회차</th><th>신청가능일</th><th>D-Day</th><th>예상금액</th></tr>';rd.upcomingRounds.forEach(function(r){html+='<tr><td>'+r.empName+'</td><td>'+r.roundLabel+'</td><td>'+fD(r.eligDate)+'</td><td>D-'+r.dday+'</td><td>'+fMan(r.amount)+'</td></tr>';});html+='</table>';} html+='<h2>👤 직원별 현황</h2><table><tr><th>이름</th><th>지원금</th><th>상태</th><th>입사일</th><th>수령액</th></tr>';rd.employees.forEach(function(e){var p2=programs[e.programId];var s2=STS.find(function(s){return s.key===e.status;});var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);html+='<tr><td>'+e.name+'</td><td>'+(p2?p2.name:"")+'</td><td>'+(s2?s2.label:"")+'</td><td>'+(e.startDate||"-")+'</td><td>'+fMan(rcv)+'</td></tr>';});html+='</table>'; html+='<div style="margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;font-size:12px;color:#64748B">고용지원금 매니저 Pro에서 자동 생성 · 신청 전 최신 공고 확인 필요</div></body></html>'; var blob=new Blob([html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=cl+"_고용지원금_"+today.toISOString().split("T")[0]+".html";a.click();URL.revokeObjectURL(url);st1[1](false); if(props.onLog)props.onLog(company.id,"내부 관리 보고서 출력","기타"); toast("내부 보고서가 생성되었습니다.","success"); }
  return(<React.Fragment><button className="prog-tap" style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0"})} onClick={function(){st1[1](true);}}>📄 내부 보고서</button><Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📄 내부 관리 보고서" width={480}><div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:48,marginBottom:16}}>📄</div><h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:700}}>{company.name}</h3><p style={{color:"#64748B",fontSize:13,marginBottom:24}}>대상자 {rd.empCount}명 | 수령완료 {fMan(rd.totalReceived)}</p><button style={Object.assign({},btnP,{padding:"14px 40px",fontSize:15})} onClick={generatePDF}>📥 HTML 보고서 다운로드</button><p style={{fontSize:11,color:"#94A3B8",marginTop:12}}>브라우저에서 열어 인쇄(Ctrl+P)하면 PDF로 저장됩니다</p><div style={{marginTop:10,padding:"8px 12px",background:"#D1FAE5",borderRadius:8,fontSize:12,color:"#065F46",textAlign:"left"}}>💡 <strong>영업 팁:</strong> 보고서를 고객사 담당자에게 정기 공유하면 재계약률·추가 의뢰 확률이 높아집니다!</div></div></Modal></React.Fragment>); }

function CommissionReport(props){
  var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile;
  var st1=useState(false);
  var stRate=useState(String((company.commission&&company.commission.rate)!=null?company.commission.rate:20));
  var activeEmps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";});
  var totalReceived=activeEmps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
  var fee=Math.round(totalReceived*(Number(stRate[0])||0)/100);
  function generateReport(){
    var cl=company.name; var today=new Date(); var rd2=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일";
    var rows=activeEmps.map(function(e){var p=programs[e.programId];var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);return{name:e.name,program:p?p.name:"",received:rcv,fee:Math.round(rcv*(Number(stRate[0])||0)/100)};}).filter(function(r){return r.received>0;});
    var totalFee=rows.reduce(function(s,r){return s+r.fee;},0);
    var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>수수료 정산서</title><style>body{font-family:-apple-system,sans-serif;padding:40px;max-width:700px;margin:0 auto;color:#1E293B}h1{font-size:22px;border-bottom:3px solid #059669;padding-bottom:10px;margin-bottom:16px}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:20px 0}.sc{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;text-align:center}.sc .l{font-size:12px;color:#64748B}.sc .v{font-size:22px;font-weight:700;color:#2563EB}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #E2E8F0;padding:10px 12px;font-size:13px;text-align:left}th{background:#F8FAFC;font-weight:700}.num{text-align:right}tfoot td{font-weight:700;background:#F8FAFC}@media print{body{padding:20px}}</style></head><body>';
    html+='<h1>💰 수수료 정산서</h1><p style="color:#64748B;font-size:13px">업체: <strong>'+cl+'</strong> | 정산일: '+rd2+' | 작성자: '+(profile&&profile.display_name||"")+'</p><p style="font-size:14px">수수료율: <strong style="color:#059669">'+stRate[0]+'%</strong></p>';
    html+='<div class="summary"><div class="sc"><div class="l">수령완료 합계</div><div class="v">'+fMan(totalReceived)+'</div></div><div class="sc"><div class="l">수수료율</div><div class="v">'+stRate[0]+'%</div></div><div class="sc"><div class="l">정산 수수료</div><div class="v" style="color:#059669">'+fMan(totalFee)+'</div></div></div>';
    html+='<table><thead><tr><th>직원명</th><th>지원금</th><th class="num">수령액 합계</th><th class="num">수수료 ('+stRate[0]+'%)</th></tr></thead><tbody>';
    rows.forEach(function(r){html+='<tr><td>'+r.name+'</td><td>'+r.program+'</td><td class="num">'+fMan(r.received)+'</td><td class="num" style="color:#059669;font-weight:600">'+fMan(r.fee)+'</td></tr>';});
    html+='</tbody><tfoot><tr><td colspan="2">합계</td><td class="num">'+fMan(totalReceived)+'</td><td class="num" style="color:#059669">'+fMan(totalFee)+'</td></tr></tfoot></table>';
    html+='<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center">고용지원금 매니저 Pro 자동 생성 · 실제 수수료는 계약서에 따름</div></body></html>';
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=cl+"_수수료정산_"+today.toISOString().split("T")[0]+".html";a.click();URL.revokeObjectURL(url);st1[1](false);
    if(props.onLog)props.onLog(company.id,"수수료 정산서 출력","수수료청구");
    toast("수수료 정산서가 생성되었습니다.","success");
  }
  return(
    <React.Fragment>
      <button className="prog-tap" style={Object.assign({},btnSm,{background:"#ECFDF5",color:"#047857",border:"1px solid #A7F3D0",fontWeight:700})} onClick={function(){st1[1](true);}}>💰 수수료 정산</button>
      <Modal open={st1[0]} onClose={function(){st1[1](false);}} title="💰 수수료 정산서" width={440}>
        <div>
          <div style={{marginBottom:16}}>
            <Label>수수료율 (%)</Label>
            <input type="number" style={inp} value={stRate[0]} onChange={function(e){stRate[1](e.target.value);}} min="0" max="100" step="0.5" placeholder="5"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <Card style={{padding:"14px 16px",textAlign:"center"}}><div style={{fontSize:13,color:"#64748B",marginBottom:4}}>수령완료 합계</div><div style={{fontSize:22,fontWeight:700,color:"#2563EB"}}>{fMan(totalReceived)}</div></Card>
            <Card style={{padding:"14px 16px",textAlign:"center"}}><div style={{fontSize:13,color:"#64748B",marginBottom:4}}>예상 수수료</div><div style={{fontSize:22,fontWeight:700,color:"#059669"}}>{fMan(fee)}</div></Card>
          </div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:8,color:"#1E293B"}}>직원별 내역</div>
          <div style={{maxHeight:200,overflow:"auto",marginBottom:16}}>
            {(function(){var hasPaid=activeEmps.filter(function(e){return(e.rounds||[]).some(function(r){return r.isPaid;});});if(hasPaid.length===0)return <p style={{color:"#94A3B8",textAlign:"center",fontSize:14,padding:"16px 0"}}>수령 완료된 직원이 없습니다.</p>;return hasPaid.map(function(e){var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);var f=Math.round(rcv*(Number(stRate[0])||0)/100);return(<div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:7,background:"#F8FAFC",marginBottom:4,fontSize:14}}><span style={{fontWeight:500}}>{e.name}</span><div style={{textAlign:"right"}}><div style={{color:"#64748B",fontSize:12}}>{fMan(rcv)}</div><div style={{fontWeight:700,color:"#059669"}}>{fMan(f)}</div></div></div>);})})()}
          </div>
          <button style={Object.assign({},btnP,{width:"100%",padding:"12px",fontSize:15})} onClick={generateReport}>📥 수수료 정산서 다운로드</button>
          <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:8}}>브라우저에서 열어 인쇄하면 PDF로 저장됩니다</p>
        </div>
      </Modal>
    </React.Fragment>
  );
}

function AgencyReport(props){
  var company=props.company,employees=props.employees,programs=props.programs,profile=props.profile;
  var st1=useState(false);
  var stName=useState((profile&&profile.display_name)||"");
  var stTitle2=useState((profile&&profile.title)||"");
  var stFirm=useState("");
  var stPhone=useState("");
  var stEmail=useState("");
  var stComment=useState("");
  var stCommentEdited=useState(false);

  var rd=useMemo(function(){
    var emps=employees.filter(function(e){return e.companyId===company.id&&e.status!=="resigned";});
    var totalRcv=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
    var totalExp=emps.reduce(function(s,e){return s+(e.totalExpected||0);},0);
    var pct=totalExp>0?Math.round(totalRcv/totalExp*100):0;
    var upcoming=[]; var overdue=[];
    var riskItems=[]; var docItems=[]; var byProg={};
    var planWeek=[],planMonth=[],planNext=[];
    emps.forEach(function(e){
      var p=programs[e.programId]; var pname=p?p.name:"(지원금 미지정)";
      var stx=STS.find(function(s){return s.key===e.status;}); var statusLabel=stx?stx.label:"";
      var rcv=(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);
      if(!byProg[e.programId])byProg[e.programId]={name:pname,count:0,expected:0,received:0,delay:0,missingDocs:0};
      var bp=byProg[e.programId]; bp.count++; bp.expected+=e.totalExpected||0; bp.received+=rcv;
      // 필수 정보 누락
      var missInfo=[]; if(!e.startDate)missInfo.push("입사일"); if(!e.salary)missInfo.push("급여");
      if(missInfo.length>0){riskItems.push({empName:e.name,prog:pname,status:statusLabel,problem:"필수 정보 누락 ("+missInfo.join("·")+")",impact:0,action:missInfo.join("·")+" 입력 후 신청 일정 확정"});}
      // 직원별 미제출 서류
      var empMissing=(e.employeeDocs||[]).filter(function(d){return !docIsDone(d);}).map(function(d){return d.label;});
      if(empMissing.length>0){docItems.push({empName:e.name,prog:pname,docs:empMissing}); bp.missingDocs+=empMissing.length;}
      // 회차별 기한
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid||!e.startDate)return;
        var ed=addMo(e.startDate,r.month); var dd=getDday(ed); if(dd===null)return;
        var amt=r.expectedAmount||r.amount||0;
        if(dd<0){overdue.push({empName:e.name,prog:pname,roundLabel:r.label,eligDate:ed,dday:dd,amount:amt});bp.delay++;
          riskItems.push({empName:e.name,prog:pname,status:statusLabel,problem:"신청기한 "+Math.abs(dd)+"일 지연",impact:amt,action:"보완서류 확인 후 즉시 신청"});
          planWeek.push(e.name+" · "+r.label+" 지연분 즉시 신청 검토");
        }else if(dd<=90){upcoming.push({empName:e.name,prog:pname,roundLabel:r.label,eligDate:ed,dday:dd,amount:amt});
          if(dd<=14){riskItems.push({empName:e.name,prog:pname,status:statusLabel,problem:"신청기한 D-"+dd+" 임박",impact:amt,action:"필요 서류 점검 후 신청 준비"}); planWeek.push(e.name+" · "+r.label+" 신청 준비 (D-"+dd+")");}
          else if(dd<=30){planMonth.push(e.name+" · "+r.label+" 신청 여부 확인 (D-"+dd+")");}
          else{planNext.push(e.name+" · "+r.label+" 급여이체증·재직확인 준비 (D-"+dd+")");}
        }
      });
      // 서류 미제출로 신청 지연 가능
      if(empMissing.length>0){
        var hasNear=(e.rounds||[]).some(function(r){if(r.isPaid||!e.startDate)return false;var dd=getDday(addMo(e.startDate,r.month));return dd!==null&&dd<=90;});
        if(hasNear)riskItems.push({empName:e.name,prog:pname,status:statusLabel,problem:"미제출 서류 "+empMissing.length+"건으로 신청 지연 가능",impact:0,action:"서류 요청: "+empMissing.slice(0,3).join("·")+(empMissing.length>3?" 외":"")});
      }
    });
    upcoming.sort(function(a,b){return a.dday-b.dday;});
    overdue.sort(function(a,b){return a.dday-b.dday;});
    // 업체 공통 필수 정보 누락 — 급여일은 급여 증빙 요청 시점 산정에 필요
    if(emps.length>0&&!company.payday){riskItems.push({empName:company.name+" (업체)",prog:"공통",status:"-",problem:"급여일 미입력",impact:0,action:"급여일 입력 후 급여 증빙 요청 시점 확정"});}
    riskItems.sort(function(a,b){return b.impact-a.impact;});
    var sc={}; STS.forEach(function(s){sc[s.key]=0;});
    emps.forEach(function(e){if(sc[e.status]!==undefined)sc[e.status]++;});
    // 미제출 서류 집계
    var companyMissingDocs=(company.companyDocs||[]).filter(function(d){return !docIsDone(d);}).map(function(d){return d.label;});
    var missingDocsCount=companyMissingDocs.length; docItems.forEach(function(it){missingDocsCount+=it.docs.length;});
    if(missingDocsCount>0)planWeek.unshift("미제출 서류 "+missingDocsCount+"건 요청·회수");
    var reqSet={}; companyMissingDocs.forEach(function(l){reqSet[l]=true;}); docItems.forEach(function(it){it.docs.forEach(function(l){reqSet[l]=true;});});
    var reqDocs=Object.keys(reqSet);
    // 예상 수수료
    var rate=(company.commission&&company.commission.rate)||0;
    var estFee=Math.round(totalExp*rate/100);
    // 지원금별 목록
    var progList=Object.keys(byProg).map(function(k){var b=byProg[k];b.remaining=b.expected-b.received;return b;}).sort(function(a,b){return b.expected-a.expected;});
    return{emps:emps,totalRcv:totalRcv,totalExp:totalExp,pct:pct,upcoming:upcoming,overdue:overdue,sc:sc,
      riskItems:riskItems,riskCount:riskItems.length,docItems:docItems,companyMissingDocs:companyMissingDocs,
      missingDocsCount:missingDocsCount,reqDocs:reqDocs,rate:rate,estFee:estFee,
      planWeek:planWeek,planMonth:planMonth,planNext:planNext,progList:progList};
  },[company,employees,programs]);

  function manWon(n){var v=Math.abs(n||0);if(v>=100000000)return Math.round(n/100000000)+"억 원";if(v>=10000)return Math.round(n/10000).toLocaleString()+"만 원";return(n||0).toLocaleString()+"원";}
  var autoComment=useMemo(function(){
    var parts=[];
    if(rd.totalExp>0)parts.push("현재 귀사에서 신청 가능한 고용지원금 예상 총액은 약 "+manWon(rd.totalExp)+"이며, 이 중 "+manWon(rd.totalRcv)+"을 이미 수령하셨습니다.");
    if(rd.riskCount>0)parts.push("다만 신청 기한이 임박했거나 지연된 항목이 "+rd.riskCount+"건 있어 우선적으로 확인하시는 것이 좋습니다.");
    else parts.push("현재 신청 일정상 급히 지연된 항목은 없어 전반적으로 양호하게 진행되고 있습니다.");
    if(rd.missingDocsCount>0)parts.push("미제출 서류 "+rd.missingDocsCount+"건을 보완하시면 이후 회차 신청이 한결 수월해집니다.");
    parts.push("회차별 지급 시점에는 급여이체증과 재직 여부 확인이 필요하니 미리 준비해두시길 권장드립니다.");
    return parts.join(" ");
  },[rd]);
  // 모달 열릴 때 코멘트 자동 채움(사용자가 직접 수정한 경우 유지)
  useEffect(function(){ if(st1[0]&&!stCommentEdited[0])stComment[1](autoComment); },[st1[0],autoComment]);

  function copyText(text,label){
    function ok(){toast((label||"문구")+"가 복사되었습니다.","success");}
    function fail(){
      try{var ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}
      catch(e){toast("복사에 실패했습니다. 직접 선택해 복사해주세요.","error");}
    }
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(text).then(ok).catch(fail); else fail();
  }
  function summaryText(){
    var s="대표님, 현재 확인된 고용지원금 예상 수령액은 약 "+manWon(rd.totalExp)+"이며, 이 중 "+manWon(rd.totalExp-rd.totalRcv)+"은 향후 신청 및 서류 보완 여부에 따라 달라질 수 있습니다.";
    var tail=[];
    if(rd.missingDocsCount>0)tail.push("미제출 서류 "+rd.missingDocsCount+"건");
    if(rd.riskCount>0)tail.push("신청 일정 확인이 필요한 항목 "+rd.riskCount+"건");
    if(tail.length>0)s+=" 현재 "+tail.join("과 ")+"이 있어 우선 해당 부분부터 정리해드리겠습니다.";
    else s+=" 현재 급히 처리할 지연 항목은 없으며, 회차별 지급 일정에 맞춰 계속 관리해드리겠습니다.";
    return s;
  }
  function docRequestText(){
    var docs=rd.reqDocs;
    if(docs.length===0)return "대표님 안녕하세요. 현재 추가로 요청드릴 미제출 서류는 없습니다. 감사합니다.";
    var lines=docs.map(function(d,i){return(i+1)+". "+d;});
    return "대표님 안녕하세요. 고용지원금 신청을 위해 아래 서류 확인이 필요합니다.\n\n"+lines.join("\n")+"\n\n확인 후 전달 부탁드립니다.";
  }

  function genHTML(){
    var today=new Date();
    var dateStr=today.getFullYear()+"년 "+(today.getMonth()+1)+"월 "+today.getDate()+"일";
    var cl=company.name;
    var stcol={preparing:"#64748B",submitted:"#2563EB",reviewing:"#475569",approved:"#059669",inprogress:"#2563EB",completed:"#059669",resigned:"#94A3B8"};
    var stmap={}; STS.forEach(function(s){stmap[s.key]=s;});
    function fN(n){return(n||0).toLocaleString();}
    function fM2(n){var v=Math.abs(n||0);return v>=100000000?Math.round(n/100000000)+"억 원":v>=10000?Math.round(n/10000).toLocaleString()+"만 원":fN(n)+"원";}

    var statusBarHtml=STS.map(function(s){
      var cnt=rd.sc[s.key]||0; if(!cnt||!rd.emps.length)return"";
      var w=Math.round(cnt/rd.emps.length*100);
      return'<div style="width:'+w+'%;background:'+stcol[s.key]+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;overflow:hidden;min-width:0">'+(w>9?cnt+"명":"")+'</div>';
    }).join("");

    var legendHtml=STS.map(function(s){
      var cnt=rd.sc[s.key]||0; if(!cnt)return"";
      return'<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569"><div style="width:10px;height:10px;border-radius:3px;background:'+stcol[s.key]+';flex-shrink:0"></div>'+s.label+' '+cnt+'명</div>';
    }).join("");

    var upcomingHtml=rd.upcoming.slice(0,12).map(function(u){
      var ddStyle=u.dday<=7?'background:#FEE2E2;color:#DC2626;font-weight:800':u.dday<=30?'background:#EFF6FF;color:#2563EB;font-weight:700':'background:#DBEAFE;color:#2563EB;font-weight:600';
      var ddLabel=u.dday===0?"D-Day":"D-"+u.dday;
      return'<tr><td style="font-weight:600;color:#0F172A">'+u.empName+'</td><td style="color:#64748B">'+u.prog+'</td><td>'+u.roundLabel+'</td><td style="color:#475569">'+fD(u.eligDate)+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:12px;'+ddStyle+'">'+ddLabel+'</span></td><td style="text-align:right;font-weight:700;color:#2563EB">'+fN(u.amount)+'원</td></tr>';
    }).join("");

    var empHtml=rd.emps.map(function(e){
      var p=programs[e.programId]; var s=stmap[e.status]||STS[0];
      var rcv=(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);
      var exp=e.totalExpected||0; var epct=exp>0?Math.round(rcv/exp*100):0;
      var sc2=stcol[e.status]||"#64748B";
      var paidRounds=(e.rounds||[]).filter(function(r){return r.isPaid;}).length;
      var totalRounds=(e.rounds||[]).length;
      return'<tr><td style="font-weight:700;color:#0F172A">'+e.name+'</td><td style="color:#64748B;font-size:12px">'+(p?p.name:"-")+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:'+sc2+'22;color:'+sc2+'">'+s.icon+" "+s.label+'</span></td><td style="color:#64748B;font-size:12px">'+(e.startDate?fD(e.startDate):"-")+'</td><td style="color:#059669;font-weight:700">'+fN(rcv)+'원</td><td style="color:#2563EB">'+fN(exp-rcv)+'원</td><td style="min-width:90px"><div style="font-size:10px;color:#94A3B8;margin-bottom:3px">'+epct+'% · '+paidRounds+'/'+totalRounds+'회차</div><div style="height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden"><div style="height:100%;width:'+epct+'%;background:#2563EB;border-radius:3px"></div></div></td></tr>';
    }).join("");

    var overdueHtml=rd.overdue.slice(0,12).map(function(o){
      return'<tr><td style="font-weight:600;color:#0F172A">'+o.empName+'</td><td style="color:#64748B">'+o.prog+'</td><td>'+o.roundLabel+'</td><td style="color:#475569">'+fD(o.eligDate)+'</td><td><span style="padding:3px 10px;border-radius:20px;font-size:12px;background:#FEE2E2;color:#DC2626;font-weight:800">'+Math.abs(o.dday)+'일 경과</span></td><td style="text-align:right;font-weight:700;color:#DC2626">'+fN(o.amount)+'원</td></tr>';
    }).join("");
    // 동적 섹션 번호 (순차 카운터)
    var secO=rd.overdue.length>0, secU=rd.upcoming.length>0;
    var secRisk=rd.riskItems.length>0, secDoc=rd.missingDocsCount>0, secProg=rd.progList.length>0;
    var SNO=0;
    function shx(title){ SNO++; return '<div class="sh"><div class="sn">'+SNO+'</div><div class="st">'+title+'</div></div>'; }
    // 놓치면 손해 보는 항목
    var riskHtml=rd.riskItems.slice(0,16).map(function(it){
      return '<tr><td style="font-weight:700;color:#0F172A">'+it.empName+'</td><td style="color:#64748B;font-size:12px">'+it.prog+'</td><td style="color:#475569;font-size:12px;white-space:nowrap">'+(it.status||"-")+'</td><td><span style="padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;background:#FEE2E2;color:#DC2626">'+it.problem+'</span></td><td style="text-align:right;font-weight:700;color:#DC2626">'+(it.impact>0?fM2(it.impact):'-')+'</td><td style="color:#475569;font-size:12px">'+it.action+'</td></tr>';
    }).join("");
    // 30일 액션 플랜
    function planList(arr){ if(!arr.length)return '<div style="font-size:13px;color:#94A3B8;padding:4px 0">예정된 작업이 없습니다.</div>'; return '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.95;color:#334155">'+arr.slice(0,7).map(function(x){return '<li>'+x+'</li>';}).join("")+'</ul>'; }
    // 지원금별 진행 현황
    var progHtml=rd.progList.map(function(b){
      return '<tr><td style="font-weight:700;color:#0F172A">'+b.name+'</td><td style="text-align:center">'+b.count+'명</td><td style="text-align:right;color:#2563EB;font-weight:700">'+fM2(b.expected)+'</td><td style="text-align:right;color:#059669;font-weight:700">'+fM2(b.received)+'</td><td style="text-align:right;color:#2563EB">'+fM2(b.remaining)+'</td><td style="text-align:center;color:'+(b.delay>0?'#DC2626':'#94A3B8')+';font-weight:700">'+b.delay+'건</td><td style="text-align:center;color:'+(b.missingDocs>0?'#D97706':'#94A3B8')+';font-weight:700">'+b.missingDocs+'건</td></tr>';
    }).join("");
    // 미제출 서류
    var docRows='';
    if(rd.companyMissingDocs.length>0)docRows+='<tr><td style="font-weight:700;color:#0F172A">업체 서류</td><td style="color:#64748B;font-size:12px">'+company.name+'</td><td>'+rd.companyMissingDocs.join(", ")+'</td><td style="text-align:center"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#FEF3C7;color:#D97706">요청 필요</span></td></tr>';
    rd.docItems.forEach(function(it){docRows+='<tr><td style="font-weight:700;color:#0F172A">'+it.empName+'</td><td style="color:#64748B;font-size:12px">'+it.prog+'</td><td>'+it.docs.join(", ")+'</td><td style="text-align:center"><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#FEF3C7;color:#D97706">요청 필요</span></td></tr>';});
    // 6-카드 요약
    var kpiHtml=[
      '<div class="kc"><div class="l">예상 총 수령액</div><div class="v" style="color:#2563EB">'+fM2(rd.totalExp)+'</div></div>',
      '<div class="kc"><div class="l">이미 수령한 금액</div><div class="v" style="color:#059669">'+fM2(rd.totalRcv)+'</div></div>',
      '<div class="kc"><div class="l">앞으로 받을 잔여</div><div class="v" style="color:#2563EB">'+fM2(rd.totalExp-rd.totalRcv)+'</div></div>',
      '<div class="kc" style="'+(rd.riskCount>0?'background:#FEF2F2;border-color:#FECACA':'')+'"><div class="l">신청 지연·위험</div><div class="v" style="color:'+(rd.riskCount>0?'#DC2626':'#059669')+'">'+rd.riskCount+'건</div></div>',
      '<div class="kc" style="'+(rd.missingDocsCount>0?'background:#FFFBEB;border-color:#FDE68A':'')+'"><div class="l">미제출 서류</div><div class="v" style="color:'+(rd.missingDocsCount>0?'#D97706':'#059669')+'">'+rd.missingDocsCount+'건</div></div>',
      '<div class="kc"><div class="l">예상 컨설팅 수수료'+(rd.rate>0?' ('+rd.rate+'%)':'')+'</div><div class="v" style="color:#334155">'+(rd.rate>0?fM2(rd.estFee):'-')+'</div></div>'
    ].join("");
    var narrative='현재 <strong>'+cl+'</strong>은(는) 총 <strong>'+rd.emps.length+'명</strong>의 근로자에 대해 고용지원금 검토 및 관리를 진행 중입니다. 현재까지 수령 완료된 금액은 <strong style="color:#059669">'+fM2(rd.totalRcv)+'</strong>이며, 향후 예상 수령액은 <strong style="color:#2563EB">'+fM2(rd.totalExp-rd.totalRcv)+'</strong>입니다. 향후 90일 이내 신청 또는 확인이 필요한 건은 총 <strong>'+rd.upcoming.length+'건</strong>'+(secO?', 그중 신청기한이 지나 즉시 점검이 필요한 건은 <strong style="color:#DC2626">'+rd.overdue.length+'건</strong>':'')+'입니다.';
    var CSS=[
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}',
      'body{font-family:-apple-system,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Segoe UI",sans-serif;color:#0F172A;background:#fff;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact;}',
      '.cover{min-height:100vh;background:linear-gradient(145deg,#0F172A 0%,#1E3A8A 45%,#2563EB 100%);color:#fff;padding:80px 70px;display:flex;flex-direction:column;position:relative;overflow:hidden;}',
      '.cover-glow1{position:absolute;top:-120px;right:-120px;width:560px;height:560px;background:radial-gradient(circle,rgba(59,130,246,0.35) 0%,transparent 70%);border-radius:50%;pointer-events:none;}',
      '.cover-glow2{position:absolute;bottom:-80px;left:-80px;width:400px;height:400px;background:radial-gradient(circle,rgba(16,185,129,0.18) 0%,transparent 70%);border-radius:50%;pointer-events:none;}',
      '.page{padding:64px 70px;}',
      '.page+.page{border-top:10px solid #F1F5F9;}',
      '.sh{display:flex;align-items:center;gap:12px;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #E2E8F0;}',
      '.sn{width:32px;height:32px;background:#2563EB;color:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0;}',
      '.st{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.5px;}',
      '.kr{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}',
      '.kc{background:#F8FAFC;border-radius:14px;padding:22px 18px;border:1px solid #E2E8F0;}',
      '.kc .l{font-size:11px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;}',
      '.kc .v{font-size:26px;font-weight:900;letter-spacing:-1px;}',
      'table{width:100%;border-collapse:collapse;font-size:13px;}',
      'thead tr{background:#F8FAFC;border-bottom:2px solid #E2E8F0;}',
      'th{padding:11px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;}',
      'td{padding:12px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}',
      'tr:last-child td{border-bottom:none;}',
      '.notice{background:#F8FAFC;border-left:4px solid #CBD5E1;border-radius:0 8px 8px 0;padding:14px 18px;font-size:12px;color:#475569;margin-top:24px;line-height:1.7;}',
      '.rfooter{background:#0F172A;color:#475569;padding:28px 70px;display:flex;justify-content:space-between;align-items:center;font-size:12px;gap:24px;flex-wrap:wrap;}',
      '@page{margin:0;}',
      '@media print{.cover{page-break-after:always;}.page{page-break-before:always;}}'
    ].join("");

    var parts=[
      '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>',cl,' 고용지원금 현황보고서</title><style>',CSS,'</style></head><body>',

      // ── COVER ──
      '<div class="cover">',
        '<div class="cover-glow1"></div><div class="cover-glow2"></div>',
        '<div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column">',
          '<div style="font-size:12px;font-weight:700;letter-spacing:0.14em;opacity:0.5;text-transform:uppercase;margin-bottom:14px">Employment Subsidy Management Report</div>',
          '<div style="font-size:46px;font-weight:900;line-height:1.1;letter-spacing:-2px;margin-bottom:44px">고용지원금<br>관리 현황보고서</div>',
          '<div style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.20);border-radius:20px;padding:36px 40px;margin-bottom:32px">',
            '<div style="font-size:32px;font-weight:900;margin-bottom:8px;letter-spacing:-0.5px">',cl,'</div>',
            '<div style="font-size:14px;opacity:0.55;margin-bottom:28px;line-height:1.8">',
              (company.bizNo?'사업자등록번호 '+company.bizNo+'&nbsp;&nbsp;':''),
              (company.ceoName?'대표 '+company.ceoName+'&nbsp;&nbsp;':''),
              (company.addr||''),
            '</div>',
            '<div style="display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr;gap:0;align-items:center">',
              '<div style="padding-right:24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">지원 대상자</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',rd.emps.length,'명</div></div>',
              '<div style="background:rgba(255,255,255,0.2);height:52px"></div>',
              '<div style="padding:0 24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">수령완료</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',fM2(rd.totalRcv),'</div></div>',
              '<div style="background:rgba(255,255,255,0.2);height:52px"></div>',
              '<div style="padding-left:24px"><div style="font-size:10px;opacity:0.5;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">예상 잔여</div><div style="font-size:40px;font-weight:900;letter-spacing:-2px">',fM2(rd.totalExp-rd.totalRcv),'</div></div>',
            '</div>',
          '</div>',
          '<div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;padding-top:28px;border-top:1px solid rgba(255,255,255,0.15)">',
            '<div>',
              (stName[0]?'<div style="font-size:18px;font-weight:800;margin-bottom:4px">'+stName[0]+'</div>':""),
              ((stTitle2[0]||stFirm[0])?'<div style="font-size:13px;opacity:0.6;line-height:1.9">'+(stTitle2[0]||"")+(stTitle2[0]&&stFirm[0]?" &middot; ":"")+(stFirm[0]||"")+'</div>':""),
              (stPhone[0]?'<div style="font-size:13px;opacity:0.6">&#128222; '+stPhone[0]+'</div>':""),
              (stEmail[0]?'<div style="font-size:13px;opacity:0.6">&#9993; '+stEmail[0]+'</div>':""),
            '</div>',
            '<div style="font-size:13px;opacity:0.45">보고일: '+dateStr+'</div>',
          '</div>',
        '</div>',
      '</div>',

      // ── SEC: 요약 현황 ──
      '<div class="page">',
        shx('요약 현황'),
        '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:16px 20px;margin-bottom:22px;font-size:13.5px;line-height:1.7;color:#1E40AF;font-weight:600">대표님 회사의 고용지원금 진행 현황과 앞으로 챙겨야 할 항목 — 받을 수 있는 지원금, 놓치면 손해 볼 수 있는 일정, 보완이 필요한 서류를 기준으로 한눈에 정리한 상담용 보고서입니다.</div>',
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid #2563EB;border-radius:0 10px 10px 0;padding:18px 22px;margin-bottom:26px;font-size:14px;line-height:1.85;color:#334155">',narrative,'</div>',
        '<div class="kr" style="grid-template-columns:repeat(3,1fr)">',kpiHtml,'</div>',
        '<div style="display:flex;justify-content:space-between;font-size:13px;color:#64748B;margin-bottom:8px"><span>지원금 수령 진행률</span><span style="font-weight:700;color:#2563EB">'+fN(rd.totalRcv)+'원 / '+fN(rd.totalExp)+'원</span></div>',
        '<div style="height:14px;background:#E2E8F0;border-radius:7px;overflow:hidden;margin-bottom:36px"><div style="height:100%;width:'+rd.pct+'%;background:#2563EB;border-radius:7px;transition:width 0.5s"></div></div>',
        '<div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:14px">진행 단계별 인원 현황</div>',
        '<div style="display:flex;border-radius:10px;overflow:hidden;height:40px;margin-bottom:14px">',statusBarHtml,'</div>',
        '<div style="display:flex;flex-wrap:wrap;gap:14px">',legendHtml,'</div>',
      '</div>',

      // ── SEC: 놓치면 손해 보는 항목 ──
      secRisk?[
        '<div class="page">',
          shx('🚨 놓치면 손해 보는 항목'),
          '<table><thead><tr><th>직원명</th><th>지원금</th><th>상태</th><th>문제 요약</th><th style="text-align:right">예상 영향</th><th>권장 조치</th></tr></thead><tbody>',riskHtml,'</tbody></table>',
          '<div class="notice" style="border-left-color:#DC2626;background:#FEF2F2;color:#7F1D1D">위 항목은 신청기한·서류·필수정보를 기준으로 자동 점검된 결과입니다. 예상 영향 금액은 해당 회차 예상 수령액 기준이며, 실제 신청 가능 여부는 담당기관 심사에 따라 달라질 수 있습니다.</div>',
        '</div>'
      ].join(""):""
      ,
      // ── SEC: 앞으로 30일 액션 플랜 ──
      '<div class="page">',
        shx('✅ 앞으로 30일 액션 플랜'),
        '<div style="display:grid;grid-template-columns:1fr;gap:14px">',
          '<div style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden"><div style="background:#FEF2F2;color:#DC2626;font-weight:800;font-size:13px;padding:11px 16px">이번 주 안에 처리할 일</div><div style="padding:14px 18px">'+planList(rd.planWeek)+'</div></div>',
          '<div style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden"><div style="background:#EFF6FF;color:#2563EB;font-weight:800;font-size:13px;padding:11px 16px">이번 달 안에 처리할 일</div><div style="padding:14px 18px">'+planList(rd.planMonth)+'</div></div>',
          '<div style="border:1px solid #E2E8F0;border-radius:12px;overflow:hidden"><div style="background:#F0FDF4;color:#059669;font-weight:800;font-size:13px;padding:11px 16px">다음 달 준비할 일</div><div style="padding:14px 18px">'+planList(rd.planNext)+'</div></div>',
        '</div>',
      '</div>',
      // ── SEC: 지원금별 진행 현황 ──
      secProg?[
        '<div class="page">',
          shx('지원금별 진행 현황'),
          '<table><thead><tr><th>지원금</th><th style="text-align:center">대상자</th><th style="text-align:right">예상 수령액</th><th style="text-align:right">수령 완료</th><th style="text-align:right">남은 금액</th><th style="text-align:center">지연</th><th style="text-align:center">미제출</th></tr></thead><tbody>',progHtml,'</tbody></table>',
        '</div>'
      ].join(""):""
      ,

      // ── SEC: 향후 일정 (conditional) ──
      secU?[
        '<div class="page">',
          shx('향후 90일 신청 일정'),
          '<table><thead><tr><th>직원명</th><th>지원금</th><th>회차</th><th>신청가능일</th><th>D-Day</th><th style="text-align:right">예상 수령액</th></tr></thead><tbody>',upcomingHtml,'</tbody></table>',
          '<div class="notice">⚠️ 위 일정은 입사일 기준으로 자동 산출된 예상 일정입니다. 실제 신청가능일은 심사 상황에 따라 달라질 수 있으니, 신청 전 고용24(work24.go.kr)에서 반드시 최신 공고를 확인하시기 바랍니다.</div>',
        '</div>'
      ].join(""):""
      ,

      // ── SEC: 미제출 서류 ──
      secDoc?[
        '<div class="page">',
          shx('📋 미제출 서류'),
          '<table><thead><tr><th>대상</th><th>구분</th><th>서류명</th><th style="text-align:center">상태</th></tr></thead><tbody>',docRows,'</tbody></table>',
          '<div class="notice">위 서류는 신청·심사에 필요한 미제출 항목입니다. 보고서 생성 화면의 "서류 요청 문구 복사" 버튼으로 대표님께 보낼 메시지를 바로 만들 수 있습니다.</div>',
        '</div>'
      ].join(""):""
      ,
      // ── SEC: 직원별 상세 ──
      '<div class="page">',
        shx('직원별 상세 현황'),
        '<table><thead><tr><th>직원명</th><th>지원금</th><th>진행 상태</th><th>입사일</th><th>수령완료</th><th>잔여 예상</th><th style="min-width:100px">수령률</th></tr></thead><tbody>',empHtml,'</tbody></table>',
        '<div class="notice" style="margin-top:26px;background:#F8FAFC;border-left-color:#94A3B8;color:#475569">본 보고서는 고용지원금 관리 현황 공유를 위한 참고 자료이며, 실제 신청 가능 여부와 지급 여부는 담당기관의 심사 결과에 따라 달라질 수 있습니다. 지원금 요건·금액·신청기간은 매년 공고에 따라 변경될 수 있으므로, 신청 전 반드시 고용24(work24.go.kr) 등 담당기관의 최신 공고를 확인하시기 바랍니다.</div>',
      '</div>',

      // ── SEC: 컨설턴트 코멘트 ──
      '<div class="page">',
        shx('컨설턴트 코멘트'),
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;padding:24px 26px;font-size:14px;line-height:1.95;color:#334155;white-space:pre-wrap">'+((stComment[0]||autoComment)||"")+'</div>',
        (stName[0]?'<div style="text-align:right;margin-top:16px;font-size:13px;color:#64748B">'+stName[0]+(stTitle2[0]?' · '+stTitle2[0]:'')+' 드림</div>':''),
      '</div>',

      // ── FOOTER ──
      '<div class="rfooter">',
        '<div style="line-height:1.9">',
          (stName[0]?'<div style="color:#94A3B8;font-weight:600">'+stName[0]+(stTitle2[0]?' &middot; '+stTitle2[0]:'')+'</div>':""),
          (stFirm[0]?'<div>'+stFirm[0]+'</div>':""),
          (stPhone[0]?'<div>'+stPhone[0]+'</div>':""),
          (stEmail[0]?'<div>'+stEmail[0]+'</div>':""),
        '</div>',
        '<div style="text-align:right;line-height:1.9;flex-shrink:0">',
          '<div style="color:#64748B">고용지원금 매니저 Pro &middot; '+dateStr+' 생성</div>',
          '<div>본 보고서는 관리 현황 안내용이며, 지원금 신청 전 최신 공고를 반드시 확인하시기 바랍니다.</div>',
        '</div>',
      '</div>',

      '</body></html>'
    ];
    return parts.flat().join("");
  }

  function download(){
    var html=genHTML();
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;
    a.download=company.name+"_고용지원금_현황보고서_"+new Date().toISOString().split("T")[0]+".html";
    a.click();
    URL.revokeObjectURL(url);
    st1[1](false);
    if(props.onLog)props.onLog(company.id,"고객 보고서 출력","기타");
    toast("고객 보고서가 생성되었습니다.","success");
  }
  // 새 창에서 보고서를 열고 인쇄 대화상자 호출 → 사용자가 'PDF로 저장' 선택.
  // 보고서는 독립 HTML 문서라 앱 사이드바·메뉴가 포함되지 않음(자동으로 본문만 출력).
  function printReport(){
    var html=genHTML();
    var w=window.open("","_blank");
    if(!w){toast("팝업이 차단되어 인쇄 창을 열 수 없습니다. 팝업을 허용해주세요.","error");return;}
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(function(){try{w.print();}catch(e){}},400);
    if(props.onLog)props.onLog(company.id,"고객 보고서 인쇄/PDF","기타");
  }

  return(
    <React.Fragment>
      <button className="prog-tap" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"11px 20px",fontSize:15,fontWeight:800,letterSpacing:"-0.3px",cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(37,99,235,0.28)"}} onClick={function(){st1[1](true);}}>📊 고객 보고서</button>
      <Modal open={st1[0]} onClose={function(){st1[1](false);}} title="📊 전문가 고객 보고서" width={540}>
        <div style={{display:"grid",gap:16}}>
          {/* 미리보기 배너 */}
          <div style={{padding:"20px 24px",background:"linear-gradient(145deg,#0F172A,#1E3A8A,#2563EB)",borderRadius:16,color:"#fff"}}>
            <div style={{fontSize:12,opacity:0.5,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>고용지원금 관리 현황보고서</div>
            <div style={{fontSize:22,fontWeight:900,letterSpacing:"-0.5px",marginBottom:12}}>{company.name}</div>
            {rd.overdue.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(220,38,38,0.92)",borderRadius:20,padding:"4px 13px",fontSize:12,fontWeight:700,marginBottom:14}}>🚨 지연 {rd.overdue.length}건 · 보고서에 별도 강조</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:0}}>
              {[["대상자",rd.emps.length+"명"],["수령완료",fMan(rd.totalRcv)],["예상잔여",fMan(rd.totalExp-rd.totalRcv)]].map(function(arr,i){return(
                <div key={i} style={{paddingRight:i<2?20:0,borderRight:i<2?"1px solid rgba(255,255,255,0.2)":0,paddingLeft:i>0?20:0}}>
                  <div style={{fontSize:10,opacity:0.5,fontWeight:700,letterSpacing:"0.08em",marginBottom:6}}>{arr[0].toUpperCase()}</div>
                  <div style={{fontSize:20,fontWeight:900,letterSpacing:"-0.5px"}}>{arr[1]}</div>
                </div>
              );})}
            </div>
          </div>
          {/* 위험·서류 요약 칩 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["놓치면 손해",rd.riskCount+"건",rd.riskCount>0?"#DC2626":"#059669",rd.riskCount>0?"#FEF2F2":"#F0FDF4"],["미제출 서류",rd.missingDocsCount+"건",rd.missingDocsCount>0?"#D97706":"#059669",rd.missingDocsCount>0?"#FFFBEB":"#F0FDF4"],["예상 수수료",rd.rate>0?fMan(rd.estFee):"-","#334155","#F8FAFC"]].map(function(arr,i){return(
              <div key={i} style={{padding:"12px 14px",borderRadius:10,background:arr[3],textAlign:"center"}}>
                <div style={{fontSize:11,color:"#64748B",fontWeight:600,marginBottom:4}}>{arr[0]}</div>
                <div style={{fontSize:18,fontWeight:800,color:arr[2]}}>{arr[1]}</div>
              </div>
            );})}
          </div>
          {/* 구성 */}
          <div style={{padding:"12px 16px",background:"#F8FAFC",borderRadius:10,fontSize:13}}>
            <div style={{fontWeight:700,color:"#1E293B",marginBottom:8}}>📋 보고서 구성</div>
            <div style={{display:"grid",gap:4}}>
              {[["표지","업체명·핵심 수령 현황·담당자"],["요약 현황","6대 핵심 지표 + 진행률"],rd.riskCount?["놓치면 손해 보는 항목","기한·서류·필수정보 위험 "+rd.riskCount+"건"]:null,["앞으로 30일 액션 플랜","이번 주/이번 달/다음 달 할 일"],rd.progList.length?["지원금별 진행 현황","지원금별 금액·지연·미제출"]:null,rd.upcoming.length?["향후 90일 일정","D-Day 하이라이트"]:null,rd.missingDocsCount?["미제출 서류","업체·직원 서류 "+rd.missingDocsCount+"건"]:null,["직원별 상세","수령률 시각화"],["컨설턴트 코멘트","상담 코멘트(편집 가능)"]].filter(Boolean).map(function(arr,i){return(<div key={i} style={{display:"flex",gap:10,color:"#475569"}}><span style={{color:"#2563EB",fontWeight:700,flexShrink:0}}>{("0"+(i+1)).slice(-2)}</span><span><strong style={{color:"#1E293B"}}>{arr[0]}</strong> — {arr[1]}</span></div>);})}
            </div>
          </div>
          {/* 담당자 정보 입력 */}
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#1E293B",marginBottom:10}}>🪪 담당자 정보 (표지에 표시됩니다)</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><Label>담당자 이름</Label><input style={inp} value={stName[0]} onChange={function(e){stName[1](e.target.value);}} placeholder="홍길동"/></div>
              <div><Label>직함</Label><input style={inp} value={stTitle2[0]} onChange={function(e){stTitle2[1](e.target.value);}} placeholder="공인노무사"/></div>
              <div style={{gridColumn:"1/-1"}}><Label>사무소 · 업체명</Label><input style={inp} value={stFirm[0]} onChange={function(e){stFirm[1](e.target.value);}} placeholder="홍길동 노무사 사무소"/></div>
              <div><Label>연락처</Label><input style={inp} value={stPhone[0]} onChange={function(e){stPhone[1](e.target.value);}} placeholder="010-0000-0000"/></div>
              <div><Label>이메일</Label><input style={inp} value={stEmail[0]} onChange={function(e){stEmail[1](e.target.value);}} placeholder="hong@example.com"/></div>
            </div>
          </div>
          {/* 컨설턴트 코멘트 (편집 가능 · 보고서 하단·인쇄 포함) */}
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:14,fontWeight:700,color:"#1E293B"}}>🗒️ 컨설턴트 코멘트 <span style={{fontWeight:400,color:"#94A3B8",fontSize:12}}>(편집 가능 · 보고서에 포함)</span></div>
              <button onClick={function(){stCommentEdited[1](false);stComment[1](autoComment);}} style={{background:"none",border:"none",color:"#2563EB",fontSize:12,cursor:"pointer",fontFamily:FF,fontWeight:600}}>자동 코멘트로 되돌리기</button>
            </div>
            <textarea style={Object.assign({},inp,{height:110,resize:"vertical",fontSize:13,lineHeight:1.7})} value={stComment[0]} onChange={function(e){stCommentEdited[1](true);stComment[1](e.target.value);}} placeholder="고객 상담용 코멘트를 입력하세요."/>
          </div>
          {/* 공유 문구 복사 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <button style={Object.assign({},btnS,{padding:"12px",fontSize:14,fontWeight:600})} onClick={function(){copyText(summaryText(),"상담 요약 문구");}}>💬 상담 요약 복사</button>
            <button style={Object.assign({},btnS,{padding:"12px",fontSize:14,fontWeight:600})} onClick={function(){copyText(docRequestText(),"서류 요청 문구");}}>📋 서류 요청 복사</button>
          </div>
          {/* 출력 */}
          <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:8}}>
            <button style={Object.assign({},btnP,{padding:"15px",fontSize:16,background:"linear-gradient(135deg,#1E40AF,#2563EB)",boxShadow:"0 4px 20px rgba(37,99,235,0.35)"})} onClick={printReport}>🖨 인쇄 / PDF 저장</button>
            <button style={Object.assign({},btnS,{padding:"15px",fontSize:15,fontWeight:600})} onClick={download}>📥 HTML 저장</button>
          </div>
          <p style={{fontSize:11,color:"#94A3B8",textAlign:"center",margin:"0 0 4px"}}>인쇄 창에서 "대상 → PDF로 저장"을 선택하면 PDF가 됩니다. 사이드바·앱 메뉴는 인쇄에 포함되지 않습니다.</p>
        </div>
      </Modal>
    </React.Fragment>
  );
}

// ── Dashboard 보조 컴포넌트 ───────────────────────────────
function DdayAlerts(props){
  var ddayLimit=(props.settings&&props.settings.ddayAlert)||7;
  var stAll=useState(false); // 전체 보기 토글 (기본 상위 7건만)
  var tasks=useMemo(function(){
    var list=[];
    // 1) 신청기한 초과/임박 + 지급 예정 확인 (회차 기한 기준)
    props.employees.forEach(function(emp){
      if(emp.status==="resigned")return;
      var company=props.companies.find(function(c){return c.id===emp.companyId;});
      var program=props.programs[emp.programId];
      if(!emp.startDate||!program)return;
      (emp.rounds||[]).forEach(function(r,ri){
        if(r.isPaid)return;
        var dday=getDday(addMo(emp.startDate,r.month));
        if(dday===null||dday>ddayLimit)return;
        // 승인·지급중 상태에서 기한 도래 → 입금 확인 업무, 그 외 → 신청 업무
        var paying=emp.status==="approved"||emp.status==="inprogress";
        list.push({
          id:emp.id+"-"+ri,
          kind:dday<0?(paying?"지급 확인":"신청 지연"):(paying?"지급 예정":"신청 임박"),
          kindColor:dday<0?"#DC2626":(paying?"#059669":"#2563EB"),
          title:emp.name,
          sub:(company?company.name:"")+(r.label?" · "+r.label:""),
          dday:dday,companyId:emp.companyId,
          pri:dday<0?0:1,sort:dday
        });
      });
    });
    // 2) 서류 미완료 (업체 단위 집계)
    props.companies.forEach(function(c){
      var miss=0;
      (c.companyDocs||[]).forEach(function(d){if(!d.done)miss++;});
      props.employees.forEach(function(e){if(e.companyId!==c.id||e.status==="resigned")return;(e.employeeDocs||[]).forEach(function(d){if(!d.done)miss++;});});
      if(miss>0)list.push({id:"doc-"+c.id,kind:"서류",kindColor:"#475569",title:c.name,sub:"미완료 서류 "+miss+"건 보완 필요",dday:null,companyId:c.id,pri:2,sort:-miss});
    });
    // 3) 급여일 미입력 (급여 증빙 서류 일정 계산에 필요)
    props.companies.forEach(function(c){
      var hasEmp=props.employees.some(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      if(hasEmp&&!c.payday)list.push({id:"pay-"+c.id,kind:"정보 누락",kindColor:"#B45309",title:c.name,sub:"급여일 미입력 — 급여 증빙 요청 시점 계산에 필요",dday:null,companyId:c.id,pri:3,sort:0});
    });
    return list.sort(function(a,b){return a.pri-b.pri||a.sort-b.sort;});
  },[props.employees,props.companies,props.programs,ddayLimit]);
  if(tasks.length===0)return null;
  var overdueCount=tasks.filter(function(t){return t.pri===0;}).length;
  var LIMIT=7;
  var shown=stAll[0]?tasks:tasks.slice(0,LIMIT);
  var top=tasks[0]; // 최우선 1건 (기한 초과 → 임박 순 정렬의 첫 항목)
  return(
    <DashGroup id="today" icon="🔔" title="오늘 바로 해야 할 일" badge="필수 확인" accent={overdueCount>0?"#DC2626":"#2563EB"}
      summary={
        <span>
          총 {tasks.length}건
          {overdueCount>0&&<span style={{color:"#DC2626",fontWeight:700}}> / 기한 초과 {overdueCount}건</span>}
          {top&&top.dday!==null&&<span className="hide-mobile"> / 최우선: <strong style={{color:overdueCount>0?"#DC2626":"#0F172A",fontWeight:700}}>{top.title} {formatDday(top.dday)}</strong></span>}
        </span>
      }>
      <div>
        {shown.map(function(t){
          var isOverdue=t.pri===0;
          return(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:8,background:isOverdue?"#FFF5F5":"transparent"}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                  <span style={{fontSize:11.5,fontWeight:800,color:"#fff",background:t.kindColor,borderRadius:6,padding:"2px 8px",whiteSpace:"nowrap"}}>{t.kind}</span>
                  <span style={{fontSize:"var(--fs-name)",fontWeight:700,color:isOverdue?"#DC2626":"#0F172A"}}>{t.title}</span>
                  {t.dday!==null&&<DdayBadge dday={t.dday}/>}
                </div>
                <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:2}}>{t.sub}</div>
              </div>
              <button onClick={function(){props.goCompany(t.companyId);}} style={{flexShrink:0,background:isOverdue?"#DC2626":"#F1F5F9",color:isOverdue?"#fff":"#475569",border:"none",borderRadius:8,padding:"7px 14px",fontSize:"var(--fs-btn)",fontWeight:700,cursor:"pointer",fontFamily:FF}}>처리 →</button>
            </div>
          );
        })}
        {tasks.length>LIMIT&&(
          <button onClick={function(){stAll[1](!stAll[0]);}} style={{width:"100%",padding:"9px 0",marginTop:2,background:"#F8FAFC",border:"1px solid #F1F5F9",borderRadius:8,fontSize:"var(--fs-btn)",fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:FF}}>
            {stAll[0]?"접기 ⌃":"전체 "+tasks.length+"건 보기 ⌄"}
          </button>
        )}
      </div>
    </DashGroup>
  );
}

function GlobalSearch(props){ var st1=useState(""); var results=useMemo(function(){if(!st1[0].trim())return [];var q=st1[0].toLowerCase();return props.employees.filter(function(e){return e.name.toLowerCase().includes(q)||(e.phone||"").includes(q);}).slice(0,10);},[props.employees,st1[0]]); return(<div style={{marginBottom:14}}><div style={{position:"relative"}}><input style={Object.assign({},inpKo,{paddingLeft:32,fontSize:13})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}} placeholder="직원 검색..."/><span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:12}}>🔍</span></div>{results.length>0&&(<Card style={{marginTop:6,maxHeight:200,overflow:"auto",position:"relative",zIndex:10}}>{results.map(function(emp){var company=props.companies.find(function(c){return c.id===emp.companyId;});var st=STS.find(function(s){return s.key===emp.status;})||STS[0];return(<div key={emp.id} style={{padding:"8px 12px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",fontSize:12}} onClick={function(){props.goCompany(emp.companyId);st1[1]("");}}><div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontWeight:600}}>{emp.name}</span><Badge color={st.color} bg={st.bg}>{st.label}</Badge></div><div style={{fontSize:11,color:"#64748B"}}>{company?company.name:""}</div></div>);})}</Card>)}</div>); }

function MonthlyReport(props){ var st1=useState(new Date().getFullYear()); var data=useMemo(function(){var arr=[];for(var m=1;m<=12;m++){var rcv=0;props.employees.forEach(function(emp){(emp.rounds||[]).forEach(function(r){if(r.isPaid&&r.paidDate){var pd=new Date(r.paidDate);if(pd.getFullYear()===st1[0]&&pd.getMonth()+1===m){rcv+=r.received||0;}}});});arr.push({month:m,received:rcv});}return arr;},[props.employees,st1[0]]); var total=data.reduce(function(s,d){return s+d.received;},0); var maxR=Math.max.apply(null,data.map(function(d){return d.received;}))||1; return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:14,fontWeight:700}}>📈 월별 수령</h4><div style={{display:"flex",alignItems:"center",gap:6}}><button onClick={function(){st1[1](st1[0]-1);}} style={btnSm}>◀</button><span style={{fontWeight:600,fontSize:12}}>{st1[0]}</span><button onClick={function(){st1[1](st1[0]+1);}} style={btnSm}>▶</button></div></div><div style={{display:"flex",gap:3,height:80,alignItems:"flex-end",marginBottom:8}}>{data.map(function(d){var h=d.received>0?Math.max(12,(d.received/maxR)*60):3;return(<div key={d.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}><div style={{fontSize:8,color:"#64748B",marginBottom:1}}>{d.received>0?fManS(d.received):""}</div><div style={{width:"100%",height:h,background:d.received>0?"#2563EB":"#E2E8F0",borderRadius:2}}/><div style={{fontSize:9,color:"#64748B",marginTop:2}}>{d.month}</div></div>);})}</div><div style={{textAlign:"center",fontSize:13}}><span style={{color:"#64748B"}}>연간: </span><span style={{fontWeight:700,color:"#2563EB"}}>{fMan(total)}</span></div></Card>); }

function CompanyRanking(props){ var ranking=useMemo(function(){return props.companies.map(function(c){var emps=props.employees.filter(function(e){return e.companyId===c.id;});var total=emps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);return{id:c.id,name:c.name,total:total,empCount:emps.filter(function(e){return e.status!=="resigned";}).length};}).sort(function(a,b){return b.total-a.total;}).slice(0,5);},[props.companies,props.employees]); if(ranking.length===0)return null; return(<Card style={{padding:16,marginBottom:16}}><h4 style={{margin:"0 0 12px",fontSize:"var(--fs-name)",fontWeight:700}}>🏆 업체별 수령 순위</h4>{ranking.map(function(r,i){var medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":(i+1)+""; return(<div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 10px",marginBottom:4,borderRadius:6,background:"#FAFBFC",cursor:"pointer",fontSize:"var(--fs-row)"}} onClick={function(){props.goCompany(r.id);}}><div style={{display:"flex",alignItems:"center",gap:8}}><span>{medal}</span><div><div style={{fontWeight:700,fontSize:"var(--fs-name)"}}>{r.name}</div><div style={{fontSize:"var(--fs-meta)",color:"#64748B"}}>{r.empCount}명</div></div></div><div style={{fontWeight:700,color:"#059669"}}>{fMan(r.total)}</div></div>);})}</Card>); }

function PendingPaymentsList(props){ var employees=props.employees,programs=props.programs; var pendingList=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned"||emp.status==="completed")return;var program=programs[emp.programId];if(!program)return;var paidCount=0,totalRounds=(emp.rounds||[]).length,remainingAmount=0,nextEligDate=null;(emp.rounds||[]).forEach(function(r){if(r.isPaid){paidCount++;}else{remainingAmount+=r.expectedAmount||0;var ed=emp.startDate?addMo(emp.startDate,r.month):null;if(ed&&(!nextEligDate||new Date(ed)<new Date(nextEligDate))){nextEligDate=ed;}}});if(paidCount<totalRounds&&totalRounds>0){list.push({id:emp.id,name:emp.name,companyId:emp.companyId,paidCount:paidCount,totalRounds:totalRounds,remainingAmount:remainingAmount,nextDday:nextEligDate?getDday(nextEligDate):null});}});return list.sort(function(a,b){if(a.nextDday===null)return 1;if(b.nextDday===null)return-1;return a.nextDday-b.nextDday;});},[employees,programs]); var totalRemaining=pendingList.reduce(function(s,p){return s+p.remainingAmount;},0); return(<Card style={{padding:16,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h4 style={{margin:0,fontSize:"var(--fs-name)",fontWeight:700}}>💳 미지급 대상자</h4><Badge color="#2563EB" bg="#EFF6FF">{pendingList.length}명/{fMan(totalRemaining)}</Badge></div>{pendingList.length===0?(<p style={{color:"#94A3B8",fontSize:"var(--fs-meta)",textAlign:"center",padding:16}}>없음</p>):(<div style={{maxHeight:180,overflow:"auto"}}>{pendingList.map(function(p){return(<div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 10px",marginBottom:4,borderRadius:6,background:"#FAFBFC",border:"1px solid #F1F5F9",cursor:"pointer",fontSize:"var(--fs-row)"}} onClick={function(){props.goCompany(p.companyId);}}><div><span style={{fontWeight:700,fontSize:"var(--fs-name)"}}>{p.name}</span><span style={{color:"#64748B",marginLeft:6}}>{p.paidCount}/{p.totalRounds}회차</span></div><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,color:"#2563EB"}}>{fMan(p.remainingAmount)}</span>{p.nextDday!==null&&<DdayBadge dday={p.nextDday}/>}</div></div>);})}</div>)}</Card>); }

function CalendarView(props){ var employees=props.employees,companies=props.companies,programs=props.programs; var calendarMemos=props.calendarMemos||{}; var onSaveMemo=props.onSaveMemo; var st1=useState(new Date()); var st2=useState(null); var st3=useState(""); var year=st1[0].getFullYear(),month=st1[0].getMonth(); var events=useMemo(function(){var list=[];employees.forEach(function(emp){if(emp.status==="resigned")return;var company=companies.find(function(c){return c.id===emp.companyId;});var program=programs[emp.programId];if(!emp.startDate||!program)return;(emp.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(emp.startDate,r.month);var d=new Date(ed);if(d.getFullYear()===year&&d.getMonth()===month){list.push({day:d.getDate(),empName:emp.name,companyId:emp.companyId,color:program.color});}});});return list;},[employees,companies,programs,year,month]); var firstDay=new Date(year,month,1).getDay(); var daysInMonth=new Date(year,month+1,0).getDate(); var weeks=[]; var day=1; for(var w=0;w<6;w++){var week=[];for(var d2=0;d2<7;d2++){if(w===0&&d2<firstDay){week.push(null);}else if(day>daysInMonth){week.push(null);}else{week.push(day);day++;}}weeks.push(week);if(day>daysInMonth)break;} var today=new Date(); function isToday(d){return d&&today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d;} function getMemoKey(d){return year+"-"+(month+1)+"-"+d;} function addMemoFn(){if(!st3[0].trim()||!st2[0])return;var key=getMemoKey(st2[0]);var existing=calendarMemos[key]||[];onSaveMemo(key,existing.concat([{id:uid(),text:st3[0].trim(),at:new Date().toISOString()}]));st3[1]("");} function delMemo(memoId){var key=getMemoKey(st2[0]);onSaveMemo(key,(calendarMemos[key]||[]).filter(function(m){return m.id!==memoId;}));}
  return(<Card style={{padding:20,marginBottom:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h4 style={{margin:0,fontSize:16,fontWeight:700}}>📅 신청 일정</h4><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={function(){st1[1](new Date(year,month-1,1));st2[1](null);}} style={btnSm}>◀</button><span style={{fontWeight:700,minWidth:100,textAlign:"center"}}>{year}년 {month+1}월</span><button onClick={function(){st1[1](new Date(year,month+1,1));st2[1](null);}} style={btnSm}>▶</button></div></div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:8}}>{["일","월","화","수","목","금","토"].map(function(dd,i){return <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,color:i===0?"#DC2626":i===6?"#2563EB":"#64748B",padding:4}}>{dd}</div>;})}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{weeks.map(function(week,wi){return week.map(function(dd,di){var dayEvents=dd?events.filter(function(e){return e.day===dd;}):[]; var dayKey=dd?getMemoKey(dd):null; var dayMemos=dayKey&&calendarMemos[dayKey]?calendarMemos[dayKey]:[]; var isSelected=st2[0]===dd; return(<div key={wi+"-"+di} onClick={dd?function(){st2[1](isSelected?null:dd);}:undefined} style={{minHeight:54,padding:3,background:dd?(isSelected?"#DBEAFE":"#FAFBFC"):"transparent",borderRadius:4,border:isSelected?"2px solid #2563EB":(isToday(dd)?"2px solid #059669":"1px solid #F1F5F9"),cursor:dd?"pointer":"default"}}>{dd&&(<React.Fragment><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1}}><span style={{fontSize:11,fontWeight:isToday(dd)?700:500,color:di===0?"#DC2626":di===6?"#2563EB":"#334155"}}>{dd}</span>{dayMemos.length>0&&<span style={{fontSize:7}}>📝</span>}</div>{dayEvents.slice(0,2).map(function(e,i2){return <div key={i2} style={{fontSize:8,padding:"1px 3px",marginBottom:1,borderRadius:3,background:e.color+"20",color:e.color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={function(ev){ev.stopPropagation();props.goCompany(e.companyId);}}>{e.empName}</div>;})} {dayEvents.length>2&&<div style={{fontSize:8,color:"#64748B"}}>+{dayEvents.length-2}</div>}</React.Fragment>)}</div>);}).flat()})}</div>{st2[0]&&(<div style={{marginTop:12,padding:12,background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:13,fontWeight:700}}>{month+1}월 {st2[0]}일</span><button onClick={function(){st2[1](null);}} style={{background:"none",border:"none",fontSize:14,cursor:"pointer",color:"#94A3B8"}}>×</button></div><div style={{display:"flex",gap:4,marginBottom:8}}><input style={Object.assign({},inpKo,{flex:1,fontSize:12,padding:"6px 10px"})} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="메모..." onKeyDown={function(e){if(e.key==="Enter")addMemoFn();}}/><button style={Object.assign({},btnP,{padding:"6px 12px",fontSize:11})} onClick={addMemoFn}>추가</button></div>{(calendarMemos[getMemoKey(st2[0])]||[]).map(function(memo){return(<div key={memo.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 8px",background:"#fff",borderRadius:4,marginBottom:3,border:"1px solid #E2E8F0",fontSize:11}}><span>{memo.text}</span><button onClick={function(){delMemo(memo.id);}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:10}}>×</button></div>);})}</div>)}</Card>); }

// ── 지원금별 파이프라인 (퍼널) ────────────────────────────
function ProgramPipeline(props){
  var employees=props.employees,programs=props.programs;
  var rows=useMemo(function(){
    var map={};
    employees.forEach(function(e){
      if(e.status==="resigned")return;
      var p=programs[e.programId]; if(!p)return;
      if(!map[e.programId])map[e.programId]={program:p,count:0,sc:{},received:0,expected:0};
      var m=map[e.programId]; m.count++;
      var s=STS.find(function(x){return x.key===e.status;})?e.status:"preparing";
      m.sc[s]=(m.sc[s]||0)+1;
      m.expected+=p.totalAmount||0;
      m.received+=(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);
    });
    return Object.values(map).sort(function(a,b){return b.count-a.count;});
  },[employees,programs]);
  if(rows.length===0)return null;
  return(
    <Card style={{padding:20,marginTop:12,border:"1px solid #E2E8F0"}}>
      <h4 style={{margin:"0 0 16px",fontSize:19,fontWeight:700,color:"#0F172A"}}>지원금별 파이프라인</h4>
      {rows.map(function(r){
        var pct=r.expected>0?Math.round(r.received/r.expected*100):0;
        return(
          <div key={r.program.id} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                <span style={{fontSize:"var(--fs-name)",fontWeight:700,color:"#334155"}}>{r.program.name}</span>
                <span style={{fontSize:"var(--fs-sub)",color:"#94A3B8"}}>{r.count}명</span>
              </div>
              <div style={{fontSize:"var(--fs-sub)",color:"#64748B"}}>
                <span style={{fontWeight:700,color:"#059669"}}>{fMan(r.received)}</span>
                <span style={{color:"#CBD5E1"}}> / {fMan(r.expected)}</span>
                <span style={{marginLeft:6,fontWeight:700,color:"#0F172A"}}>{pct}%</span>
              </div>
            </div>
            {/* 수령 진행률 — 수령(green) / 잔여(gray) */}
            <div style={{height:10,borderRadius:5,overflow:"hidden",background:"#F1F5F9"}}>
              <div style={{height:"100%",width:pct+"%",background:"#059669",borderRadius:5,transition:"width 0.5s ease"}}/>
            </div>
          </div>
        );
      })}
      <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:14,paddingTop:12,borderTop:"1px solid #F1F5F9"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:"var(--fs-meta)",color:"#64748B"}}><span style={{width:10,height:10,borderRadius:3,background:"#059669",display:"inline-block"}}/>수령 완료</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:"var(--fs-meta)",color:"#64748B"}}><span style={{width:10,height:10,borderRadius:3,background:"#E2E8F0",display:"inline-block"}}/>수령 예정</div>
      </div>
    </Card>
  );
}

// ── 업체별 위험도 랭킹 (지연·임박·서류·수령예정액 종합) ──────
function CompanyRiskRanking(props){
  var rows=useMemo(function(){
    return props.companies.map(function(c){
      var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      var overdue=0,next7=0,remaining=0,docMiss=0,nextDday=null;
      emps.forEach(function(e){
        (e.rounds||[]).forEach(function(r){
          if(r.isPaid)return; remaining+=r.expectedAmount||r.amount||0;
          if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0)overdue++;else if(dd<=7)next7++;if(dd>=0&&(nextDday===null||dd<nextDday))nextDday=dd;}}
        });
        (e.employeeDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
      });
      (c.companyDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
      var level=emps.length===0?{t:"대기",c:"#94A3B8",bg:"#F1F5F9"}:overdue>0?{t:"지연",c:"#DC2626",bg:"#FEF2F2"}:next7>0?{t:"임박",c:"#2563EB",bg:"#EFF6FF"}:docMiss>0?{t:"서류 미비",c:"#475569",bg:"#E2E8F0"}:remaining>=10000000?{t:"고액 관리",c:"#2563EB",bg:"#DBEAFE"}:remaining>0?{t:"정상",c:"#059669",bg:"#ECFDF5"}:{t:"완료",c:"#059669",bg:"#ECFDF5"};
      return{c:c,empCount:emps.length,overdue:overdue,next7:next7,remaining:remaining,docMiss:docMiss,nextDday:nextDday,level:level,score:overdue*1e6+next7*1e4+docMiss*100+remaining/1e6};
    }).sort(function(a,b){return b.score-a.score;}).slice(0,6);
  },[props.companies,props.employees]);
  if(rows.length===0)return null;
  return(
    <Card style={{padding:"20px 22px",marginTop:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <h4 style={{margin:0,fontSize:20,fontWeight:700}}>🛡️ 업체별 위험도</h4>
        <span style={{fontSize:"var(--fs-meta)",color:"#94A3B8"}}>지연·임박·서류·수령예정액 종합</span>
      </div>
      <div style={{display:"grid",gap:8}}>
        {rows.map(function(r){return(
          <div key={r.c.id} className="hover-card" onClick={function(){props.goCompany(r.c.id);}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid #E2E8F0",borderLeft:r.overdue>0?"3px solid #DC2626":"1px solid #E2E8F0",background:"#fff",cursor:"pointer",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:140}}>
              <div style={{fontSize:"var(--fs-name)",fontWeight:700,color:"#1E293B"}}>{r.c.name}</div>
              <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:2}}>대상자 {r.empCount}명{r.nextDday!==null?" · 다음 신청 "+formatDday(r.nextDday):""}</div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {r.overdue>0&&<span style={dangerBadge()}>지연 {r.overdue}</span>}
              {r.next7>0&&<span style={primaryBadge()}>임박 {r.next7}</span>}
              {r.docMiss>0&&<span style={neutralBadge()}>서류 {r.docMiss}</span>}
            </div>
            <div style={{textAlign:"right",minWidth:96}}>
              <div style={{fontSize:"var(--fs-row)",fontWeight:800,color:"#0F172A"}}>{fMan(r.remaining)}</div>
              <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8"}}>수령 예정</div>
            </div>
            <span style={{fontSize:"var(--fs-badge)",fontWeight:700,padding:"4px 12px",borderRadius:20,background:r.level.bg,color:r.level.c,flexShrink:0}}>{r.level.t}</span>
          </div>
        );})}
      </div>
    </Card>
  );
}

// ── Dashboard: Empty State ────────────────────────────────
function EmptyState(props){
  return(<Card className="fade-in-up" style={{padding:"56px 32px",textAlign:"center",border:"2px dashed #E2E8F0",background:"linear-gradient(180deg,#FFFFFF,#F8FAFC)"}}>
    <div style={{fontSize:64,marginBottom:16}}>{props.icon||"📋"}</div>
    <h3 style={{margin:"0 0 8px",fontSize:24,fontWeight:800,color:"#1E293B"}}>{props.title}</h3>
    <p style={{margin:"0 auto 24px",fontSize:18,color:"#64748B",maxWidth:440,lineHeight:1.6}}>{props.desc}</p>
    {props.action&&<button className="hover-lift" style={Object.assign({},btnP,{padding:"15px 36px"})} onClick={props.action}>{props.actionLabel}</button>}
  </Card>);
}

// ── Dashboard ─────────────────────────────────────────────
// ── 화면 크기 감지 (모바일 ≤860px) ──────────────────────────
function useIsMobile(){
  var st=useState(function(){return typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(max-width:860px)").matches;});
  useEffect(function(){
    if(typeof window==="undefined"||!window.matchMedia)return;
    var mq=window.matchMedia("(max-width:860px)");
    function on(){st[1](mq.matches);}
    try{mq.addEventListener("change",on);}catch(e){mq.addListener(on);}
    return function(){try{mq.removeEventListener("change",on);}catch(e){mq.removeListener(on);}};
  },[]);
  return st[0];
}

// ── 대시보드 섹션 (데스크톱: 항상 펼침 / 모바일: 접기·펴기) ──
// bare=true 이면 헤더+자식만(자식이 자체 카드를 그릴 때), false 이면 흰 카드로 감쌈.
function DashSection(props){
  var isMobile=useIsMobile();
  var st=useState(props.openMobile!==false);
  var collapsible=isMobile;
  var open=collapsible?st[0]:true;
  var bare=props.bare;
  var header=(
    <button onClick={collapsible?function(){st[1](!st[0]);}:undefined}
      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:bare?"2px 2px 12px":"15px 18px",background:"none",border:"none",cursor:collapsible?"pointer":"default",fontFamily:FF,textAlign:"left"}}>
      <span style={{display:"flex",alignItems:"center",gap:8,fontSize:bare?18:16,fontWeight:700,color:"#0F172A"}}>
        {props.icon&&<span style={{fontSize:bare?18:16}}>{props.icon}</span>}{props.title}
        {props.hint&&<span className="hide-mobile" style={{fontSize:13,color:"#94A3B8",fontWeight:500}}>{props.hint}</span>}
      </span>
      {collapsible&&<span style={{fontSize:15,color:"#94A3B8",transition:"transform .2s ease",transform:open?"rotate(180deg)":"none",display:"inline-block",lineHeight:1}}>⌄</span>}
    </button>
  );
  if(bare){
    return(<div style={{marginBottom:14}}>{header}{open&&<div className="dash-sec-body">{props.children}</div>}</div>);
  }
  return(
    <div className="card" style={{marginBottom:14,overflow:"hidden"}}>
      {header}
      {open&&<div className="dash-sec-body" style={{padding:"0 18px 18px"}}>{props.children}</div>}
    </div>
  );
}

// ── 접기/펼치기 그룹 (PC·모바일 공통 · 기본 접힘 · localStorage 상태 저장) ──
// 대시보드 정보 과밀을 줄이기 위해 보조 정보를 카드형 버튼 안에 접어둔다.
function DashGroup(props){
  var lsKey="hrsp_dashGroup_"+props.id;
  var st=useState(function(){try{return localStorage.getItem(lsKey)==="1";}catch(e){return false;}});
  var open=st[0];
  function toggle(){var v=!st[0];st[1](v);try{localStorage.setItem(lsKey,v?"1":"0");}catch(e){}}
  return(
    <div className="card dash-group" style={{marginBottom:14,overflow:"hidden",border:"1px solid #E2E8F0",borderLeft:props.accent?("3px solid "+props.accent):"1px solid #E2E8F0",background:"#fff",borderRadius:14}}>
      <button onClick={toggle} className="dash-group-head"
        style={{width:"100%",display:"flex",alignItems:"center",gap:11,padding:"18px 18px",background:open?"#FAFBFC":"transparent",border:"none",cursor:"pointer",fontFamily:FF,textAlign:"left",transition:"background 0.18s ease"}}>
        <span style={{width:32,height:32,borderRadius:10,background:open?"#DBEAFE":"#E2E8F0",color:open?"#1D4ED8":"#475569",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:800,flexShrink:0,lineHeight:1}}>{open?"−":"+"}</span>
        <span style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap",minWidth:0,flex:1}}>
          <span style={{fontSize:17,fontWeight:700,color:"#0F172A",whiteSpace:"nowrap"}}>{props.icon&&<span style={{marginRight:6}}>{props.icon}</span>}{props.title}</span>
          {props.badge&&<span style={{fontSize:11,fontWeight:800,color:"#B91C1C",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:999,padding:"2px 8px",whiteSpace:"nowrap",alignSelf:"center"}}>{props.badge}</span>}
          {props.summary&&<span style={{fontSize:14,color:"#64748B",fontWeight:500}}>· {props.summary}</span>}
        </span>
        <span style={{display:"inline-flex",alignItems:"center",gap:5,flexShrink:0,color:"#64748B",fontSize:13,fontWeight:600}}>
          <span className="hide-mobile">{open?"접기":"펼치기"}</span>
          <span style={{fontSize:15,transition:"transform .2s ease",transform:open?"rotate(180deg)":"none",display:"inline-block",lineHeight:1}}>⌄</span>
        </span>
      </button>
      {open&&<div style={{padding:"4px 18px 18px"}}>{props.children}</div>}
    </div>
  );
}

// ── 업체 리스트 표시 헬퍼 (정렬·업력·지역 요약 — 화면 표시용, DB 순서 불변) ──
// 가나다 정렬용 이름: 주식회사/(주)/㈜/유한회사 표기는 무시하고 비교
function coSortName(name){
  return String(name||"")
    .replace(/^\s*(주식회사|\(주\)|㈜|유한회사|\(유\))\s*/,"")
    .replace(/\s*(주식회사|\(주\)|㈜|\(유\))\s*$/,"")
    .trim();
}
function byCompanyName(a,b){return coSortName(a.name).localeCompare(coSortName(b.name),"ko");}
// 업력(N년차): establishedDate(설립일/개업일) 우선, 없으면 기존 설립일 계열 →
// 고용보험 성립일 순으로 fallback. 설립 연도=1년차.
// 반환: 숫자(N년차) | null(미입력) | "invalid"(미래 날짜·잘못된 값 → 확인 필요)
function companyYears(c){
  var d=c.establishedDate||c.foundedDate||c.foundedAt||c.establishedAt||c.insuranceDate;
  if(!d)return null;
  var dt=new Date(d);
  if(isNaN(dt.getTime()))return "invalid";
  if(dt.getTime()>Date.now())return "invalid";
  var y=new Date().getFullYear()-dt.getFullYear()+1;
  return y<1?"invalid":y;
}
// 주소 요약: "충북 청주시 흥덕구 오송읍 …" → "충북 청주시" (도/광역시 + 시/군/구)
function shortAddr(addr){
  if(!addr)return null;
  var parts=String(addr).trim().split(/\s+/);
  if(parts.length===0||!parts[0])return null;
  return parts.slice(0,2).join(" ");
}
// 지원금명 → 업체 카드 배지용 짧은 이름 ("청년일자리도약장려금" → "청년일자리도약")
var PROG_SHORT_NAMES={
  "청년일자리도약장려금":"청년일자리도약",
  "고령자 계속고용 장려금":"고령자 계속고용",
  "고령자 계속고용장려금":"고령자 계속고용",
  "새일여성인턴제":"새일여성인턴제",
  "정규직 전환 지원금":"정규직 전환",
  "고용촉진장려금":"고용촉진",
  "시니어 인턴십":"시니어 인턴십"
};
function shortProgName(name){
  if(!name)return "";
  if(PROG_SHORT_NAMES[name])return PROG_SHORT_NAMES[name];
  var s=String(name).replace(/\s*(장려금|지원금)?\s*(\(사업주\))?\s*$/,"").trim();
  return s||String(name);
}
// 업체 소속 대상자들의 지원금 종류를 중복 제거해 짧은 이름 목록으로 반환
function companyProgramShorts(emps,programs){
  var seen={},out=[];
  emps.forEach(function(e){
    var p=programs[e.programId]; if(!p||!p.name)return;
    var sn=shortProgName(p.name);
    if(!seen[sn]){seen[sn]=true;out.push(sn);}
  });
  return out;
}

// ── 엑셀 가져오기 (업로드 → 컬럼 매핑 → 미리보기 · 검증 → 등록) ──
// 시스템 필드 정의 + 컬럼명 유사어 사전 — 사무실마다 다른 양식을 자동 인식
var XL_FIELDS=[
  {key:"companyName",label:"업체명",required:true,aliases:["업체명","회사명","기업명","고객사명","거래처명","사업장명","법인명","상호","상호명"]},
  {key:"bizNo",label:"사업자등록번호",required:true,aliases:["사업자등록번호","사업자번호","사업자","사업자NO","사업자No","등록번호","사업장번호"]},
  {key:"empName",label:"직원명",required:true,aliases:["직원명","근로자명","성명","이름","대상자명","신청자명","근로자","직원","대상자"]},
  {key:"ceoName",label:"대표자명",required:false,aliases:["대표자","대표","대표자명","사업주","대표이사","원장","사장"]},
  {key:"corpType",label:"법인구분",required:false,aliases:["법인구분","법인/개인","구분","사업자구분","사업장구분","개인법인","유형"]},
  {key:"region",label:"지역",required:false,aliases:["지역","소재지","주소","사업장주소","본점주소","관할지역","시군구"]},
  {key:"empCount",label:"전체직원수",required:false,aliases:["전체직원수","직원수","상시근로자수","근로자수","총직원수","인원","총인원","고용인원"]},
  {key:"birthDate",label:"생년월일",required:false,aliases:["생년월일","생일","생년","주민앞자리","주민번호앞자리","주민등록번호앞자리","생년월일6자리"]},
  {key:"startDate",label:"입사일",required:false,aliases:["입사일","입사일자","채용일","채용일자","고용일","고용일자","근무시작일","입직일"]},
  {key:"programName",label:"지원금명",required:false,aliases:["지원금명","지원금","지원사업","지원사업명","장려금명","장려금","프로그램명","제도명","사업명"]},
  {key:"status",label:"신청상태",required:false,aliases:["신청상태","상태","진행상태","진행단계","처리상태","접수상태","신청여부","지급상태"]},
  {key:"round",label:"회차",required:false,aliases:["회차","신청회차","지급회차","차수","몇회차"]},
  {key:"payMonth",label:"지급월",required:false,aliases:["지급월","신청월","예정월","지급예정월","수령월","입금월","정산월"]},
  {key:"memo",label:"메모",required:false,aliases:["메모","비고","특이사항","참고","코멘트","내용","상담메모"]}
];
// 헤더 정규화: 괄호 부가설명·공백·특수문자 제거 + 소문자 ("사업자 등록 번호(필수)" → "사업자등록번호")
function xlNormHead(h){
  return String(h==null?"":h).replace(/\(.*?\)|（.*?）/g,"").toLowerCase().replace(/[^0-9a-z가-힣]/g,"");
}
// 한 행을 헤더로 가정하고 자동 매핑: 완전 일치=높음 → 단독 부분 일치=보통 → 복수 후보=확인 필요
function xlAutoMap(headerCells){
  var norm=(headerCells||[]).map(xlNormHead);
  var map={},conf={};
  XL_FIELDS.forEach(function(f){
    var exact=-1,partial=-1,partialCnt=0;
    norm.forEach(function(h,idx){
      if(!h)return;
      if(f.aliases.some(function(a){return xlNormHead(a)===h;})){if(exact===-1)exact=idx;return;}
      if(f.aliases.some(function(a){var an=xlNormHead(a);return an.length>=2&&h.length>=2&&(h.indexOf(an)>=0||an.indexOf(h)>=0);})){if(partial===-1)partial=idx;partialCnt++;}
    });
    if(exact>=0){map[f.key]=exact;conf[f.key]="high";}
    else if(partial>=0){map[f.key]=partial;conf[f.key]=partialCnt>1?"low":"mid";}
    else{map[f.key]=-1;conf[f.key]="none";}
  });
  // 같은 엑셀 컬럼이 두 필드에 잡히면 신뢰도 높은 쪽만 유지
  var used={},rank={high:3,mid:2,low:1,none:0};
  XL_FIELDS.forEach(function(f){
    var c=map[f.key]; if(c==null||c<0)return;
    if(used[c]!==undefined){
      if(rank[conf[f.key]]>rank[conf[used[c]]]){map[used[c]]=-1;conf[used[c]]="none";used[c]=f.key;}
      else{map[f.key]=-1;conf[f.key]="none";}
    }else used[c]=f.key;
  });
  return{map:map,conf:conf};
}
// 헤더 행 자동 탐지: 첫 10행 중 핵심 필드(필수 3점·선택 1점) 매칭 점수가 가장 높은 행
function xlDetectHeader(grid){
  var best=0,bestScore=0;
  for(var i=0;i<Math.min(10,grid.length);i++){
    var r=xlAutoMap(grid[i]||[]);
    var score=0;
    XL_FIELDS.forEach(function(f){if(r.map[f.key]>=0)score+=f.required?3:1;});
    if(score>bestScore){bestScore=score;best=i;}
  }
  return best;
}
// 날짜 정규화: yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd / 20260115 / 엑셀 일련번호 / m/d/yy
function xlNormDate(v){
  if(v==null||String(v).trim()==="")return{value:"",ok:true,empty:true};
  var s=String(v).trim();
  if(/^\d{5}$/.test(s)){var d=new Date(Date.UTC(1899,11,30)+Number(s)*86400000);if(!isNaN(d))return{value:d.toISOString().split("T")[0],ok:true};}
  var us=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(us){var y=Number(us[3]);if(y<100)y+=y<50?2000:1900;s=y+"-"+us[1]+"-"+us[2];}
  var m=s.replace(/[.·/년월]/g,"-").replace(/일/g,"").replace(/\s+/g,"").replace(/-+/g,"-").replace(/-$/,"");
  if(/^\d{8}$/.test(m))m=m.slice(0,4)+"-"+m.slice(4,6)+"-"+m.slice(6,8);
  var mm=m.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(mm){
    var dt=new Date(Number(mm[1]),Number(mm[2])-1,Number(mm[3]));
    if(!isNaN(dt.getTime())&&dt.getMonth()===Number(mm[2])-1)return{value:mm[1]+"-"+("0"+mm[2]).slice(-2)+"-"+("0"+mm[3]).slice(-2),ok:true};
  }
  return{value:String(v),ok:false};
}
// 사업자번호 검증: 숫자 10자리 + 하이픈을 쓴 경우 123-45-67890 형태만 정상
function xlBizNoCheck(s){
  var raw=String(s||"").trim();
  var d=raw.replace(/\D/g,"");
  if(d.length!==10)return{ok:false,reason:"숫자 10자리가 아님"};
  if(raw.indexOf("-")>=0&&!/^\d{3}-\d{2}-\d{5}$/.test(raw))return{ok:false,reason:"하이픈 위치 이상 (123-45-67890 형식 권장)"};
  return{ok:true};
}

function ExcelImport(props){
  var stOpen=useState(false);
  var stStep=useState(1);   // 1 업로드 → 2 컬럼 매핑 → 3 미리보기 → 4 등록/결과
  var stBusy=useState(false);
  var stSaving=useState(false);
  var stGrid=useState(null);    // 시트 원본 (브라우저 메모리에만 보관)
  var stHeader=useState(0);     // 헤더 행 index (0-based)
  var stMap=useState(null);     // {fieldKey: colIndex | -1}
  var stConf=useState(null);    // {fieldKey: "high"|"mid"|"low"|"none"}
  var stResult=useState(null);  // 저장 결과
  var stPreview=useState(null); // importPreview={companies,employees,rows,errors,warnings,duplicates,...}
  var stAdv=useState(false);    // 컬럼 매핑 '직접 수정하기'(고급 설정) 펼침
  var fileRef=useRef(null);

  function reset(){stStep[1](1);stGrid[1](null);stMap[1](null);stConf[1](null);stPreview[1](null);stResult[1](null);stUndo[1](null);stAdv[1](false);if(fileRef.current)fileRef.current.value="";}
  function softReset(){stStep[1](1);stGrid[1](null);stMap[1](null);stConf[1](null);stPreview[1](null);stResult[1](null);stUndo[1](null);stAdv[1](false);}

  // 지원금명 → programId (기존 프로그램에만 매칭 · 자동 생성 없음)
  function matchProgramId(name){
    var programs=props.programs||{};
    if(!name)return "";
    var n=String(name).replace(/\s+/g,"");
    var ids=Object.keys(programs);
    for(var i=0;i<ids.length;i++){var pn=String(programs[ids[i]].name||"").replace(/\s+/g,"");if(pn&&pn===n)return ids[i];}
    var aliases={youth_jump:["청년일자리도약","청년도약"],emp_promo:["고용촉진"],senior_continue:["고령자계속고용"],saeil_women:["새일여성인턴"],regular_convert:["정규직전환"],senior_intern:["시니어인턴"]};
    var keys=Object.keys(aliases);
    for(var k=0;k<keys.length;k++){
      if(!programs[keys[k]])continue;
      if(aliases[keys[k]].some(function(a){return n.indexOf(a)>=0;}))return keys[k];
    }
    for(var j=0;j<ids.length;j++){var pn2=String(programs[ids[j]].name||"").replace(/\s+/g,"");if(pn2&&n.length>=4&&(pn2.indexOf(n)>=0||n.indexOf(pn2)>=0))return ids[j];}
    return "";
  }
  function findStatusKey(raw){
    if(!raw)return null;
    var n=String(raw).replace(/\s+/g,"");
    var hit=STS.find(function(s){var l=s.label.replace(/\s+/g,"");return l===n||n.indexOf(l)>=0;});
    return hit?hit.key:null;
  }
  function matchStatusKey(raw){return findStatusKey(raw)||"preparing";}

  async function handleFile(file){
    if(!file)return;
    var ext=(file.name.split(".").pop()||"").toLowerCase();
    if(["xlsx","xls","csv"].indexOf(ext)===-1){toast("xlsx·xls·csv 파일만 지원합니다.","error");return;}
    stBusy[1](true);
    try{
      // 파일은 브라우저 메모리에서만 읽음 — 서버·Storage 업로드 없음
      var grid=await readSheetGrid(file); // [D-93] OS 엑셀 읽개 (라이브러리 없이 · 첫 시트)
      if(!grid||grid.length<2)throw new Error("데이터 행이 없습니다. 헤더 행과 데이터 행이 필요합니다.");
      var h=xlDetectHeader(grid);
      var am=xlAutoMap(grid[h]||[]);
      stGrid[1](grid);stHeader[1](h);stMap[1](am.map);stConf[1](am.conf);
      stStep[1](2);
    }catch(e){
      toast("파일을 읽지 못했습니다: "+(e.message||"오류"),"error");
    }finally{
      stBusy[1](false);
      if(fileRef.current)fileRef.current.value="";
    }
  }

  // 헤더 행 변경 시 자동 매핑 재계산
  function changeHeader(idx){
    var grid=stGrid[0]; if(!grid)return;
    var am=xlAutoMap(grid[idx]||[]);
    stHeader[1](idx);stMap[1](am.map);stConf[1](am.conf);
  }

  // 샘플 양식 다운로드 — 브라우저에서 xlsx 생성 (서버/DB 저장 없음)
  async function downloadTemplate(){
    try{
      var headers=["업체명","사업자등록번호","대표자","법인구분","지역","전체직원수","직원명","생년월일","입사일","지원금명","신청상태","회차","지급월","메모"];
      var rows=[
        ["(주)한빛테크","123-45-67890","김한빛","법인","경기 성남시","12","박청년","2000-03-15","2026-04-01","청년일자리도약장려금","진행중","1","2026-10","사전신청 완료"],
        ["(주)한빛테크","123-45-67890","김한빛","법인","경기 성남시","12","이도약","1999-11-02","2026-05-12","청년일자리도약장려금","준비중","","",""],
        ["바른상사","987-65-43210","최바른","개인","서울 강서구","6","정새일","1988-07-21","2026-03-02","새일여성인턴제","신청완료","1","2026-09","새일센터 연계"]
      ];
      downloadCsv("고용지원금_가져오기_샘플양식.csv",[headers].concat(rows)); // [D-93] 엑셀에서 바로 열리는 CSV
    }catch(e){toast("샘플 양식 생성에 실패했습니다: "+(e.message||"오류"),"error");}
  }

  // 현재 헤더 행·매핑 기준으로 미리보기/검증 생성 (DB 저장 없음)
  function buildPreview(){
    var grid=stGrid[0],hIdx=stHeader[0],colMap=stMap[0];
    function cell(row,key){var i=colMap[key];return(i==null||i<0)?"":String(row[i]==null?"":row[i]).trim();}
    var existingByBiz={};
    (props.companies||[]).forEach(function(c){var d=String(c.bizNo||"").replace(/\D/g,"");if(d&&!existingByBiz[d])existingByBiz[d]=c;});
    var rows=[],errors=[],warnings=[],duplicates=[],dupPreview=[];
    var compMap={},empList=[],progSet={},seenPair={},seenSave={};
    var junk=0,bizWarnCount=0,exclNoEmp=0,reviewRowCnt=0;
    for(var i=hIdx+1;i<grid.length;i++){
      var raw=grid[i];
      if(!raw||raw.every(function(v){return String(v==null?"":v).trim()==="";}))continue; // 완전 빈 행
      var rowNo=i+1; // 엑셀 행 번호
      var companyName=cell(raw,"companyName"),bizNo=cell(raw,"bizNo"),empName=cell(raw,"empName");
      // 합계/소계/안내 문구 등 데이터가 아닌 행 자동 제외
      if(!companyName&&!bizNo&&!empName){junk++;continue;}
      if(/^(합계|총계|소계)$/.test(companyName)||/^(합계|총계|소계)$/.test(empName)){junk++;continue;}
      var startD=xlNormDate(cell(raw,"startDate")),birthD=xlNormDate(cell(raw,"birthDate"));
      var programName=cell(raw,"programName");
      // 저장 정책: 형식 이상은 저장 허용 + reviewIssues 로 기록. 제외는 이름 누락·중복만.
      var warns=[],compIss=[],empIss=[],bizWarn=false;
      var excluded=null;
      if(!companyName)excluded="업체명 없음 — 저장 제외";
      else if(!empName){excluded="직원명 없음 — 저장 제외";exclNoEmp++;}
      if(bizNo){
        var bc=xlBizNoCheck(bizNo);
        if(!bc.ok){bizWarn=true;bizWarnCount++;warns.push("사업자번호 확인 필요 — "+bc.reason);compIss.push({field:"bizNo",message:"사업자등록번호 형식 확인 필요",originalValue:bizNo});}
      }else if(!excluded){
        bizWarn=true;bizWarnCount++;warns.push("사업자번호 미입력 — 확인 필요");compIss.push({field:"bizNo",message:"사업자등록번호 미입력",originalValue:""});
      }
      var corpTypeVal=cell(raw,"corpType");
      if(corpTypeVal&&corpTypeVal.indexOf("법인")<0&&corpTypeVal.indexOf("개인")<0){warns.push("법인구분 값 확인 필요");compIss.push({field:"corpType",message:"법인구분 값 확인 필요",originalValue:corpTypeVal});}
      var empCountVal=cell(raw,"empCount");
      if(empCountVal&&!(Number(String(empCountVal).replace(/\D/g,""))>0)){warns.push("전체직원수 숫자 확인 필요");compIss.push({field:"empCount",message:"전체직원수 숫자 확인 필요",originalValue:empCountVal});}
      if(!startD.ok){warns.push("입사일 날짜 형식 확인 필요");empIss.push({field:"startDate",message:"입사일 형식 확인 필요",originalValue:cell(raw,"startDate")});}
      if(!birthD.ok){warns.push("생년월일 날짜 형식 확인 필요");empIss.push({field:"birthDate",message:"생년월일 형식 확인 필요",originalValue:cell(raw,"birthDate")});}
      var pid=matchProgramId(programName);
      var progMatchedName=pid?String((props.programs||{})[pid].name||""):"";
      if(programName&&!pid){warns.push("지원금명 자동 매칭 실패 — 미지정으로 등록");empIss.push({field:"programName",message:"지원금명을 자동 매칭하지 못해 지원금 미지정으로 등록됨",originalValue:programName});}
      else if(!programName)warns.push("지원금명 미입력 — 미지정으로 등록");
      var rawStatusVal=cell(raw,"status");
      if(rawStatusVal&&!findStatusKey(rawStatusVal)){warns.push("신청상태 미매칭 — 준비중으로 등록");empIss.push({field:"status",message:"신청상태 '"+rawStatusVal+"' 미매칭 — 준비중으로 등록됨",originalValue:rawStatusVal});}
      var bizDigits=bizNo.replace(/\D/g,"");
      var isDup=false;
      var pairBase=bizDigits||companyName;
      if(pairBase&&empName){
        var pairKey=pairBase+"|"+empName;
        if(seenPair[pairKey]){isDup=true;warns.push("같은 업체+직원명 중복 의심 ("+seenPair[pairKey]+"행과 동일)");}
        else seenPair[pairKey]=rowNo;
      }
      var exComp=bizDigits?existingByBiz[bizDigits]:null;
      if(exComp)warns.push("기존 업체에 직원 추가 예정 ("+exComp.name+")");
      var issueCnt=compIss.length+empIss.length;
      var status=excluded?"저장 제외":isDup?"중복 의심":warns.length>0?"주의":"정상";
      var row={rowNo:rowNo,companyName:companyName,bizNo:bizNo,empName:empName,
        startDate:startD.value,birthDate:birthD.value,programName:programName,progMatchedName:progMatchedName,
        rawStatus:rawStatusVal,round:cell(raw,"round"),payMonth:cell(raw,"payMonth"),memo:cell(raw,"memo"),
        status:status,messages:(excluded?[excluded]:[]).concat(warns),hasError:!!excluded,isDup:isDup,bizWarn:bizWarn,
        issueCnt:issueCnt,existing:!!exComp};
      rows.push(row);
      if(excluded)errors.push({rowNo:rowNo,messages:[excluded]});
      if(warns.length>0)warnings.push({rowNo:rowNo,messages:warns});
      if(isDup)duplicates.push({rowNo:rowNo});
      if(programName)progSet[programName]=true;
      // 저장용 구조 (이름 누락 행만 제외 — 형식 이상은 issues 와 함께 저장)
      if(!excluded){
        if(issueCnt>0)reviewRowCnt++;
        var ck=bizDigits||companyName;
        if(!compMap[ck])compMap[ck]={name:companyName,bizNo:bizNo,ceoName:cell(raw,"ceoName"),corpType:corpTypeVal,region:cell(raw,"region"),years:cell(raw,"years"),empCount:empCountVal,existing:!!exComp,issues:compIss};
        empList.push({companyKey:ck,name:empName,birthDate:birthD.ok?birthD.value:"",startDate:startD.ok?startD.value:"",programName:programName,rawStatus:rawStatusVal,round:cell(raw,"round"),payMonth:cell(raw,"payMonth"),memo:cell(raw,"memo"),rowNo:rowNo,isDup:isDup,issues:empIss});
        // 저장 시 중복 제외 예정 미리 계산 (기존 DB + 배치 내 — doImport 와 동일 기준)
        var sd=startD.ok?startD.value:"";
        var isDupDb=exComp?(props.employees||[]).some(function(ex){
          if(ex.companyId!==exComp.id||String(ex.name||"").trim()!==empName)return false;
          if(sd&&ex.startDate)return ex.startDate===sd;
          return true;
        }):false;
        var sk=ck+"|"+empName+"|"+sd;
        if(isDupDb||seenSave[sk])dupPreview.push({rowNo:rowNo,name:empName});
        else seenSave[sk]=true;
      }
    }
    if(rows.length===0)throw new Error("읽을 수 있는 데이터 행이 없습니다. 헤더 행 설정을 확인해주세요.");
    return{companies:Object.keys(compMap).map(function(k){return compMap[k];}),employees:empList,
      rows:rows,errors:errors,warnings:warnings,duplicates:duplicates,dupPreview:dupPreview,
      programKinds:Object.keys(progSet),junk:junk,bizWarnCount:bizWarnCount,
      exclNoEmp:exclNoEmp,reviewRowCnt:reviewRowCnt};
  }

  function gotoPreview(){
    var colMap=stMap[0]||{};
    var missing=XL_FIELDS.filter(function(f){return f.required&&(colMap[f.key]==null||colMap[f.key]<0);});
    if(missing.length>0){toast("필수 필드 매핑이 필요합니다: "+missing.map(function(f){return f.label;}).join(", "),"warn");return;}
    try{stPreview[1](buildPreview());stStep[1](3);}
    catch(e){toast(e.message||"미리보기 생성 실패","error");}
  }

  // 실제 등록 — 마지막 단계에서 버튼 클릭 + confirm 후에만 호출됨
  async function doImport(){
    if(stSaving[0])return;
    var io=props.io||{};
    if(io.requirePlan&&!io.requirePlan())return;
    var pv0=stPreview[0];
    if(!pv0||pv0.employees.length===0)return;
    var msg="중복 직원을 제외한 데이터가 등록됩니다. 사업자번호, 날짜, 지원금명 등 확인이 필요한 항목은 등록 후 '수정 필요'로 표시됩니다. 기존 업체와 사업자등록번호가 같은 경우 해당 업체에 직원이 추가됩니다."
      +(pv0.reviewRowCnt>0?"\n\n⚠️ 수정 필요 표시 예정 "+pv0.reviewRowCnt+"건 (사업자번호 형식 주의 "+pv0.bizWarnCount+"건 포함)":"")
      +(pv0.dupPreview.length>0?"\nℹ️ 중복 직원 "+pv0.dupPreview.length+"명은 자동 제외됩니다.":"")
      +(pv0.errors.length>0?"\nℹ️ 업체명/직원명 없는 "+pv0.errors.length+"행은 저장에서 제외됩니다.":"")
      +"\n\n등록을 진행할까요?";
    if(!window.confirm(msg))return;
    stSaving[1](true);
    try{
      // 이번 가져오기 배치 식별자 — 이번에 생성되는 모든 신규 행에 기록 (가져오기 취소의 삭제 조건)
      var batchId=(typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():ruuid();
      // 1) 기존 업체 매핑 (사업자번호 숫자 10자리 기준 · 기존 업체 정보는 덮어쓰지 않음)
      var existing={};
      (props.companies||[]).forEach(function(c){var d=String(c.bizNo||"").replace(/\D/g,"");if(d&&!existing[d])existing[d]=c;});
      var newComps=[],keyToId={},mergedSet={};
      pv0.companies.forEach(function(pc){
        var key=String(pc.bizNo||"").replace(/\D/g,"")||pc.name;
        if(existing[key]){keyToId[key]=existing[key].id;mergedSet[existing[key].id]=true;return;}
        var id=ruuid();
        keyToId[key]=id;
        var comp={id:id,createdAt:new Date().toISOString(),name:pc.name,bizNo:pc.bizNo,
          ceoName:pc.ceoName||"",
          corpType:String(pc.corpType||"").indexOf("법인")>=0?"법인":String(pc.corpType||"").indexOf("개인")>=0?"개인":"",
          importedFromExcel:true,importBatchId:batchId,
          notes:[],companyDocs:[]};
        var ec=Number(String(pc.empCount||"").replace(/\D/g,""));
        if(ec>0)comp.empCount=ec;
        if(pc.region==="수도권"||pc.region==="비수도권")comp.region=pc.region;
        else if(pc.region)comp.addr=pc.region;
        // 업력 칸이 날짜(설립일)로 해석되는 경우에만 establishedDate 저장 — 그 외 형식은 보류
        var estD=xlNormDate(pc.years);
        if(!estD.empty&&estD.ok&&/^\d{4}-/.test(estD.value))comp.establishedDate=estD.value;
        // 확인이 필요한 값은 저장하되 reviewIssues 로 표시 (수정 필요 배지의 근거)
        if(pc.issues&&pc.issues.length>0){comp.reviewNeeded=true;comp.reviewIssues=pc.issues;}
        newComps.push(comp);
      });
      // 2) 직원 payload 구성 + 중복 제외 (기존 DB·배치 내: 같은 업체+이름+입사일, 입사일 없으면 업체+이름)
      var existingEmps=props.employees||[];
      var dupExcluded=[],toSave=[],noProg=0,seen={};
      pv0.employees.forEach(function(pe){
        var cid=keyToId[pe.companyKey];
        if(!cid)return;
        var isDupDb=existingEmps.some(function(ex){
          if(ex.companyId!==cid||String(ex.name||"").trim()!==pe.name)return false;
          if(pe.startDate&&ex.startDate)return ex.startDate===pe.startDate;
          return true;
        });
        var bk=cid+"|"+pe.name+"|"+(pe.startDate||"");
        if(isDupDb||seen[bk]){dupExcluded.push({rowNo:pe.rowNo,name:pe.name});return;}
        seen[bk]=true;
        var pid=matchProgramId(pe.programName);
        if(!pid)noProg++;
        var p=pid?(props.programs||{})[pid]:null;
        var memo=pe.memo||"";
        var extra=[];
        if(pe.programName&&!pid)extra.push("지원금(원본): "+pe.programName);
        if(pe.round)extra.push("회차: "+pe.round);
        if(pe.payMonth)extra.push("지급월: "+pe.payMonth);
        if(extra.length>0)memo=(memo?memo+" · ":"")+extra.join(" · ");
        // 직원 추가 폼과 동일한 구조: rounds/서류는 프로그램 템플릿에서 생성
        toSave.push({
          id:ruuid(),companyId:cid,name:pe.name,
          birthDate:pe.birthDate||"",startDate:pe.startDate||"",
          programId:pid,status:matchStatusKey(pe.rawStatus),
          totalExpected:p?p.totalAmount||0:0,
          rounds:p?JSON.parse(JSON.stringify(p.rounds||[])).map(function(r){return Object.assign({},r,{id:uid(),isPaid:false,received:0});}):[],
          employeeDocs:p?(p.employeeDocs||[]).map(function(dd){return{id:uid(),label:typeof dd==="string"?dd:dd.label||"",done:false,files:[]};}):[],
          memo:memo,importedFromExcel:true,importBatchId:batchId,
          reviewNeeded:!!(pe.issues&&pe.issues.length>0),
          reviewIssues:pe.issues&&pe.issues.length>0?pe.issues:[]
        });
      });
      // 3) 저장: 회사 bulk INSERT 커밋 후 직원 bulk INSERT (FK 순서) · 직원 bulk 실패 시 단건 폴백으로 실패 행 식별
      if(newComps.length>0)await io.onBulkCompanies(newComps);
      var failedRows=[],savedIds=[];
      if(toSave.length>0){
        try{ await io.onBulkEmployees(toSave); savedIds=toSave.map(function(t){return t.id;}); }
        catch(e1){
          console.error("[엑셀 가져오기] bulk 저장 실패 — 단건 저장으로 전환:",e1);
          for(var i2=0;i2<toSave.length;i2++){
            try{ await io.onSaveEmployee(toSave[i2]); savedIds.push(toSave[i2].id); }
            catch(e2){ failedRows.push({name:toSave[i2].name,error:e2.message||"오류"}); }
          }
        }
      }
      // 취소(undo)용: importBatchId 가 이번 배치와 일치하는 행의 id 만 보관
      var undoEmpIds=toSave.filter(function(t){return t.importBatchId===batchId&&savedIds.indexOf(t.id)>=0;}).map(function(t){return t.id;});
      var undoCompIds=newComps.filter(function(c){return c.importBatchId===batchId;}).map(function(c){return c.id;});
      stResult[1]({newComps:newComps.length,merged:Object.keys(mergedSet).length,
        saved:toSave.length-failedRows.length,excludedErrors:pv0.errors.length,
        noProg:noProg,dupExcluded:dupExcluded,failedRows:failedRows,bizWarn:pv0.bizWarnCount,
        reviewCnt:pv0.reviewRowCnt,exclNoEmp:pv0.exclNoEmp,
        batchId:batchId,undoEmpIds:undoEmpIds,undoCompIds:undoCompIds});
      if(failedRows.length===0)toast("엑셀 데이터 등록이 완료되었습니다. 신규 업체 "+newComps.length+"개, 직원 "+(toSave.length-failedRows.length)+"명이 등록되었습니다.","success");
      else toast("일부 행 저장에 실패했습니다 ("+failedRows.length+"건) — 결과 화면을 확인해주세요.","error");
    }catch(e){
      console.error("[엑셀 가져오기] 등록 실패:",e);
      toast("등록 중 오류가 발생했습니다: "+(e.message||"오류"),"error");
    }finally{
      stSaving[1](false);
    }
  }

  // ── 이번 가져오기 취소 (방금 등록한 importBatchId 데이터만 삭제) ──
  var stUndoBusy=useState(false);
  var stUndo=useState(null); // {emps,comps,kept} 성공 | {error} 실패
  async function undoImport(){
    var r=stResult[0]; var io=props.io||{};
    if(!r||stUndoBusy[0]||(stUndo[0]&&!stUndo[0].error))return;
    if(!window.confirm("방금 엑셀로 등록한 업체/직원만 삭제됩니다. 기존 업체 정보는 삭제되지 않습니다. 진행할까요?"))return;
    stUndoBusy[1](true);
    try{
      // 삭제 대상: 이번 배치(importBatchId)에서 생성된 행의 id 만.
      // 기존 업체에 병합된 업체 id 는 undoCompIds 에 포함되지 않으므로 절대 삭제되지 않음.
      var empIds=r.undoEmpIds||[],compIds=r.undoCompIds||[];
      var failParts=[];
      try{ if(empIds.length>0)await io.onDeleteRows(empIds,[]); }
      catch(e1){ console.error("[엑셀 취소] 직원 삭제 실패:",e1); failParts.push("직원 삭제 실패: "+(e1.message||"오류")); }
      var compsDeleted=0;
      if(failParts.length===0){
        // 직원 삭제가 끝난 뒤에만 신규 업체 삭제 (이번 배치로 새로 만든 업체만)
        try{ if(compIds.length>0){await io.onDeleteRows([],compIds);compsDeleted=compIds.length;} }
        catch(e2){ console.error("[엑셀 취소] 신규 업체 삭제 실패:",e2); failParts.push("신규 업체 삭제 실패: "+(e2.message||"오류")); }
      }
      if(failParts.length>0){
        stUndo[1]({error:failParts.join(" / ")});
        toast("가져오기 취소 중 일부 실패 — "+failParts.join(" / "),"error");
      }else{
        stUndo[1]({emps:empIds.length,comps:compsDeleted,kept:r.merged});
        toast("이번 가져오기가 취소되었습니다. (직원 "+empIds.length+"명 · 신규 업체 "+compsDeleted+"개 삭제)","success");
      }
    }finally{
      stUndoBusy[1](false);
    }
  }

  var pv=stPreview[0];
  var stColor={"정상":["#059669","#ECFDF5"],"주의":["#D97706","#FFFBEB"],"오류":["#DC2626","#FEF2F2"],"저장 제외":["#DC2626","#FEF2F2"],"중복 의심":["#7C3AED","#F5F3FF"]};
  var confBadge={high:["높음","#059669","#ECFDF5"],mid:["보통","#D97706","#FFFBEB"],low:["확인 필요","#DC2626","#FEF2F2"],none:["미매칭","#94A3B8","#F1F5F9"]};
  var steps=["파일 선택","자동 인식","미리보기","최종 등록"];
  var headerCells=(stGrid[0]&&stGrid[0][stHeader[0]])||[];

  return(
    <React.Fragment>
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3}}>
        <button onClick={function(){stOpen[1](true);}} className="prog-tap" style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:15,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.28)"}}>📥 기존 엑셀 불러오기</button>
        <span style={{fontSize:12,color:"#94A3B8",whiteSpace:"nowrap"}}>기존 고객사·직원 엑셀을 올려 한 번에 정리하세요.</span>
      </div>
      <Modal open={stOpen[0]} onClose={function(){stOpen[1](false);reset();}} title="📥 엑셀로 업체/직원 가져오기" width={780}>
        <div style={{display:"grid",gap:14}}>
          {/* 단계 표시 */}
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {steps.map(function(s,i){var cur=stStep[0]===i+1;var done=stStep[0]>i+1;return(
              <React.Fragment key={s}>
                {i>0&&<span style={{flex:1,height:3,background:done||cur?"#93C5FD":"#E8EDF3",borderRadius:2}}/>}
                <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:14,fontWeight:800,color:cur?"#2563EB":done?"#059669":"#94A3B8",whiteSpace:"nowrap"}}>
                  <span style={{width:26,height:26,borderRadius:13,background:cur?"#2563EB":done?"#D1FAE5":"#F1F5F9",color:cur?"#fff":done?"#059669":"#94A3B8",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,boxShadow:cur?"0 2px 6px rgba(37,99,235,0.3)":"none"}}>{done?"✓":i+1}</span>
                  <span className="hide-mobile">{s}</span>
                </span>
              </React.Fragment>
            );})}
          </div>
          <div style={{padding:"10px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10,fontSize:12.5,color:"#0369A1",lineHeight:1.6}}>
            🔒 엑셀의 개인정보는 현재 브라우저에서만 읽어 미리보기로 표시됩니다. 최종 등록 전에는 저장되지 않습니다.
          </div>

          {/* 1단계: 파일 선택 */}
          {stStep[0]===1&&(
            <div style={{display:"grid",gap:10}}>
              <div style={{padding:"13px 16px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:12,fontSize:14,color:"#065F46",lineHeight:1.7}}>
                <strong>아직 저장되지 않습니다.</strong> 파일을 올린 뒤 <strong>미리보기에서 확인한 다음 최종 등록</strong>됩니다. 엑셀 양식이 달라도 자동으로 맞춰봅니다.
              </div>
              <div onClick={function(){if(!stBusy[0]&&fileRef.current)fileRef.current.click();}}
                style={{border:"2px dashed #BFDBFE",borderRadius:14,padding:"38px 20px",textAlign:"center",cursor:"pointer",background:"#F8FBFF"}}>
                <div style={{fontSize:40,marginBottom:12}}>📄</div>
                <div style={{fontSize:16.5,fontWeight:800,color:"#1E293B",marginBottom:7,letterSpacing:"-0.3px"}}>{stBusy[0]?"파일을 읽는 중…":"클릭해서 엑셀 파일 선택"}</div>
                <div style={{fontSize:13.5,color:"#64748B"}}>.xlsx · .xls · .csv · 권장 컬럼: 업체명, 사업자등록번호, 직원명, 입사일, 지원금명</div>
                <div style={{fontSize:12.5,color:"#94A3B8",marginTop:5}}>제목·안내 문구가 위에 있어도 헤더 행을 자동으로 찾아냅니다.</div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}}
                onChange={function(e){handleFile(e.target.files&&e.target.files[0]);}}/>
              <button onClick={downloadTemplate} style={Object.assign({},btnS,{padding:"10px 16px",fontSize:13.5})}>⬇️ 샘플 양식 다운로드 (.xlsx)</button>
            </div>
          )}

          {/* 2단계: 컬럼 매핑 — 기본은 쉬운 요약, 상세 수정은 '직접 수정하기'로 펼침 */}
          {stStep[0]===2&&stGrid[0]&&(function(){
            var colMap=stMap[0]||{},conf=stConf[0]||{};
            var reqFields=XL_FIELDS.filter(function(f){return f.required;});
            var reqMissingList=reqFields.filter(function(f){return colMap[f.key]==null||colMap[f.key]<0;});
            var optionalHit=XL_FIELDS.filter(function(f){return !f.required&&colMap[f.key]>=0;}).length;
            var needCheck=XL_FIELDS.filter(function(f){return colMap[f.key]>=0&&conf[f.key]==="low";}).length+reqMissingList.length;
            var showAdv=stAdv[0]||reqMissingList.length>0;
            var keyFieldKeys=["companyName","bizNo","empName","programName"];
            return(
            <div style={{display:"grid",gap:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#1E293B",marginBottom:4}}>✅ 엑셀의 컬럼을 자동으로 인식했습니다.</div>
                <div style={{fontSize:12.5,color:"#64748B",lineHeight:1.65}}>대부분은 그대로 진행하면 됩니다. 잘못 인식된 항목이 있으면 ‘직접 수정하기’를 눌러 바꿀 수 있습니다.<br/>아직 저장되지 않았습니다 — 다음 화면에서 오류와 중복을 확인할 수 있습니다.</div>
              </div>
              {/* 요약 카드 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:8}}>
                <div style={{padding:"10px 12px",borderRadius:10,background:reqMissingList.length===0?"#F0FDF4":"#FEF2F2",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#64748B",fontWeight:600,marginBottom:3}}>필수 항목 (업체명·사업자번호·직원명)</div>
                  <div style={{fontSize:15,fontWeight:800,color:reqMissingList.length===0?"#059669":"#DC2626"}}>{reqMissingList.length===0?"인식 완료 ✓":"미인식 "+reqMissingList.length+"개"}</div>
                </div>
                <div style={{padding:"10px 12px",borderRadius:10,background:"#EFF6FF",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#64748B",fontWeight:600,marginBottom:3}}>선택 항목 인식</div>
                  <div style={{fontSize:15,fontWeight:800,color:"#2563EB"}}>{optionalHit}개</div>
                </div>
                <div style={{padding:"10px 12px",borderRadius:10,background:needCheck>0?"#FEF3C7":"#F0FDF4",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#64748B",fontWeight:600,marginBottom:3}}>확인 필요</div>
                  <div style={{fontSize:15,fontWeight:800,color:needCheck>0?"#B45309":"#059669"}}>{needCheck}개</div>
                </div>
              </div>
              {/* 주요 필드 간단 확인 */}
              <div style={{border:"1px solid #E2E8F0",borderRadius:10,padding:"11px 14px",display:"grid",gap:7}}>
                {keyFieldKeys.map(function(k){
                  var f=XL_FIELDS.find(function(x){return x.key===k;});
                  var idx=colMap[k];
                  return(
                    <div key={k} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,flexWrap:"wrap"}}>
                      <span style={{width:110,color:"#64748B",fontWeight:600,flexShrink:0}}>{f.label}{f.required&&<span style={{color:"#DC2626"}}> *</span>}</span>
                      {idx!=null&&idx>=0?(
                        <span style={{color:"#1E293B",fontWeight:600}}>엑셀의 “{String(headerCells[idx]||"").trim()||(idx+1)+"열"}”</span>
                      ):(
                        <span style={{color:f.required?"#DC2626":"#B45309",fontWeight:600}}>미인식{f.required?" — 직접 선택 필요":" (선택 항목)"}</span>
                      )}
                    </div>
                  );
                })}
                <div style={{fontSize:11.5,color:"#94A3B8",borderTop:"1px solid #F1F5F9",paddingTop:7}}>컬럼 제목이 있는 줄: <strong style={{color:"#475569"}}>{stHeader[0]+1}행</strong> — 제목 줄이 다르면 ‘직접 수정하기’에서 변경할 수 있습니다.</div>
              </div>
              {reqMissingList.length>0&&(
                <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:12.5,color:"#991B1B",lineHeight:1.6}}>
                  필수 항목({reqMissingList.map(function(f){return f.label;}).join(", ")})을 찾지 못했습니다. 아래에서 해당 엑셀 컬럼을 직접 선택해주세요.
                </div>
              )}
              <button onClick={gotoPreview} disabled={reqMissingList.length>0}
                style={Object.assign({},btnP,{padding:"13px",fontSize:15,opacity:reqMissingList.length>0?0.45:1,cursor:reqMissingList.length>0?"not-allowed":"pointer"})}>
                이대로 미리보기 진행 →
              </button>
              <button onClick={function(){stAdv[1](!stAdv[0]);}} style={Object.assign({},btnS,{padding:"10px 16px",fontSize:13.5})}>
                {showAdv&&reqMissingList.length===0?"상세 설정 접기 ⌃":"🔧 직접 수정하기 (컬럼·제목 줄 변경)"}
              </button>
              {/* 고급 설정: 제목 줄 변경 + 상세 컬럼 매핑 (기존 기능 그대로) */}
              {showAdv&&(
                <div style={{display:"grid",gap:10,padding:"12px 12px 4px",background:"#F8FAFC",borderRadius:12,border:"1px solid #E2E8F0"}}>
                  <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:12.5,color:"#475569",flexWrap:"wrap"}}>
                    컬럼 제목이 있는 줄:
                    <select value={stHeader[0]} onChange={function(e){changeHeader(Number(e.target.value));}} style={Object.assign({},inp,{width:"auto",margin:0,fontSize:12.5,padding:"6px 8px"})}>
                      {Array.from({length:Math.min(10,stGrid[0].length)},function(_,i){return i;}).map(function(i){
                        var preview=(stGrid[0][i]||[]).slice(0,3).map(function(v){return String(v||"").slice(0,8);}).filter(Boolean).join(" | ");
                        return <option key={i} value={i}>{(i+1)+"행"+(preview?" — "+preview:"")}</option>;
                      })}
                    </select>
                    <span style={{fontSize:11.5,color:"#94A3B8"}}>엑셀에서 컬럼 이름(업체명·직원명 등)이 적혀 있는 줄을 선택하세요.</span>
                  </label>
                  <div style={{border:"1px solid #E2E8F0",borderRadius:10,overflow:"hidden",background:"#fff",marginBottom:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"150px 1fr 90px",gap:0,background:"#F8FAFC",borderBottom:"2px solid #E2E8F0",padding:"8px 12px",fontSize:11,fontWeight:700,color:"#64748B"}}>
                      <span>등록될 항목</span><span>엑셀 컬럼</span><span style={{textAlign:"center"}}>자동 인식</span>
                    </div>
                    <div style={{maxHeight:300,overflow:"auto"}}>
                      {XL_FIELDS.map(function(f){
                        var cIdx=(stMap[0]||{})[f.key];
                        var cf=(stConf[0]||{})[f.key]||"none";
                        var cb=confBadge[cf];
                        var reqMiss=f.required&&(cIdx==null||cIdx<0);
                        return(
                          <div key={f.key} style={{display:"grid",gridTemplateColumns:"150px 1fr 90px",gap:0,alignItems:"center",padding:"7px 12px",borderBottom:"1px solid #F1F5F9",background:reqMiss?"#FFF8F8":"transparent"}}>
                            <span style={{fontSize:13,fontWeight:600,color:"#1E293B"}}>{f.label}{f.required&&<span style={{color:"#DC2626",marginLeft:3}}>*</span>}</span>
                            <select value={cIdx==null?-1:cIdx} onChange={function(e){var m=Object.assign({},stMap[0]);m[f.key]=Number(e.target.value);stMap[1](m);var c2=Object.assign({},stConf[0]);c2[f.key]=Number(e.target.value)>=0?"high":"none";stConf[1](c2);}}
                              style={Object.assign({},inp,{margin:0,fontSize:12.5,padding:"6px 8px",width:"95%"})}>
                              <option value={-1}>— 사용 안 함 —</option>
                              {headerCells.map(function(h,idx){return <option key={idx} value={idx}>{(idx+1)+"열: "+(String(h||"").trim()||"(빈 컬럼)")}</option>;})}
                            </select>
                            <span style={{textAlign:"center"}}>
                              <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:reqMiss?"#FEF2F2":cb[2],color:reqMiss?"#DC2626":cb[1],whiteSpace:"nowrap"}}>{reqMiss?"선택 필요":cb[0]}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div style={{display:"flex"}}>
                <button style={Object.assign({},btnS,{padding:"10px 16px"})} onClick={function(){softReset();}}>← 다른 파일 선택</button>
              </div>
            </div>);
          })()}

          {/* 3단계: 미리보기/검증 */}
          {stStep[0]===3&&pv&&(
            <div style={{display:"grid",gap:12}}>
              <div style={{padding:"9px 13px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,fontSize:12,color:"#475569",lineHeight:1.6}}>
                대부분의 데이터는 등록되며, 확인이 필요한 항목은 등록 후 <strong>수정 필요</strong>로 표시됩니다. 중복 직원과 완전한 빈 행은 제외됩니다. 사업자번호·날짜·지원금명 등 확인이 필요한 값은 저장 후에도 경고로 표시됩니다.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:8}}>
                {[["감지된 업체",pv.companies.length+"개","#2563EB","#EFF6FF"],
                  ["감지된 직원",pv.employees.length+"명","#2563EB","#EFF6FF"],
                  ["지원금 종류",pv.programKinds.length+"종","#334155","#F8FAFC"],
                  ["수정 필요",pv.reviewRowCnt+"건",pv.reviewRowCnt>0?"#B45309":"#059669",pv.reviewRowCnt>0?"#FEF3C7":"#F0FDF4"],
                  ["저장 제외",pv.errors.length+"행",pv.errors.length>0?"#DC2626":"#059669",pv.errors.length>0?"#FEF2F2":"#F0FDF4"],
                  ["중복 의심",pv.duplicates.length+"건",pv.duplicates.length>0?"#7C3AED":"#059669",pv.duplicates.length>0?"#F5F3FF":"#F0FDF4"],
                  ["사업자번호 주의",pv.bizWarnCount+"건",pv.bizWarnCount>0?"#DC2626":"#059669",pv.bizWarnCount>0?"#FEF2F2":"#F0FDF4"]
                ].map(function(a,i){return(
                  <div key={i} style={{padding:"13px 12px",borderRadius:12,background:a[3],textAlign:"center"}}>
                    <div style={{fontSize:12,color:"#64748B",fontWeight:600,marginBottom:5}}>{a[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:a[2],letterSpacing:"-0.5px"}}>{a[1]}</div>
                  </div>
                );})}
              </div>
              {pv.junk>0&&<div style={{fontSize:12,color:"#94A3B8"}}>합계·빈 행 등 데이터가 아닌 {pv.junk}행은 자동 제외되었습니다.</div>}
              <div style={{maxHeight:320,overflow:"auto",border:"1px solid #E2E8F0",borderRadius:10}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12.5}}>
                  <thead><tr style={{background:"#F8FAFC",position:"sticky",top:0}}>
                    {["행","업체명","사업자번호","직원명","입사일","지원금명 → 매칭","상태","오류/주의"].map(function(h){return <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:11,fontWeight:700,color:"#64748B",whiteSpace:"nowrap",borderBottom:"2px solid #E2E8F0"}}>{h}</th>;})}
                  </tr></thead>
                  <tbody>
                    {pv.rows.map(function(r){var sc=stColor[r.status]||stColor["정상"];return(
                      <tr key={r.rowNo} style={{background:r.hasError?"#FFF8F8":"transparent"}}>
                        <td style={{padding:"7px 10px",color:"#94A3B8",borderBottom:"1px solid #F1F5F9"}}>{r.rowNo}</td>
                        <td style={{padding:"7px 10px",fontWeight:600,color:"#1E293B",borderBottom:"1px solid #F1F5F9"}}>{r.companyName||"-"}{r.existing&&<span style={{marginLeft:4,fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#EFF6FF",color:"#2563EB",whiteSpace:"nowrap"}}>기존 업체에 추가</span>}</td>
                        <td style={{padding:"7px 10px",color:r.bizWarn?"#DC2626":"#475569",fontWeight:r.bizWarn?700:400,borderBottom:"1px solid #F1F5F9",whiteSpace:"nowrap"}}>{r.bizNo||"-"}{r.bizWarn&&" ⚠️"}</td>
                        <td style={{padding:"7px 10px",fontWeight:600,color:"#1E293B",borderBottom:"1px solid #F1F5F9"}}>{r.empName||"-"}</td>
                        <td style={{padding:"7px 10px",color:"#475569",borderBottom:"1px solid #F1F5F9",whiteSpace:"nowrap"}}>{r.startDate||"-"}</td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #F1F5F9"}}>
                          {r.programName?(
                            r.progMatchedName?(
                              <span><span style={{color:"#475569"}}>{r.programName}</span><span style={{color:"#059669",fontWeight:700}}> → {r.progMatchedName}</span></span>
                            ):(
                              <span><span style={{color:"#475569"}}>{r.programName}</span><span style={{color:"#B45309",fontWeight:700}}> → 미지정 등록 예정</span></span>
                            )
                          ):"-"}
                        </td>
                        <td style={{padding:"7px 10px",borderBottom:"1px solid #F1F5F9"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:10,background:sc[1],color:sc[0],whiteSpace:"nowrap"}}>{r.status}</span></td>
                        <td style={{padding:"7px 10px",fontSize:11.5,color:r.hasError?"#DC2626":"#B45309",borderBottom:"1px solid #F1F5F9"}}>{r.messages.join(" · ")||"-"}</td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"space-between"}}>
                <button style={Object.assign({},btnS,{padding:"10px 16px"})} onClick={function(){stStep[1](2);}}>← 컬럼 매핑 수정</button>
                <button style={Object.assign({},btnP,{padding:"10px 22px"})} onClick={function(){stStep[1](4);}}>다음: 등록 →</button>
              </div>
            </div>
          )}

          {/* 4단계: 등록 확인 */}
          {stStep[0]===4&&pv&&!stResult[0]&&(function(){
            var preNoProg=pv.employees.filter(function(e){return !matchProgramId(e.programName);}).length;
            var mergeCnt=pv.companies.filter(function(c){return c.existing;}).length;
            var willSave=pv.employees.length-pv.dupPreview.length;
            var canSave=willSave>0&&!stSaving[0];
            return(
            <div style={{display:"grid",gap:12}}>
              <div style={{padding:"16px 18px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:12,fontSize:13.5,lineHeight:1.9,color:"#334155"}}>
                <div style={{fontWeight:800,color:"#0F172A",marginBottom:6}}>등록 예정 요약</div>
                <div>· 신규 업체 생성: <strong>{pv.companies.length-mergeCnt}개</strong></div>
                <div>· 기존 업체 병합(직원 추가): <strong>{mergeCnt}개</strong></div>
                <div>· 등록 예정 직원: <strong>{willSave}명</strong></div>
                {pv.reviewRowCnt>0&&<div style={{color:"#B45309"}}>· 수정 필요 표시: {pv.reviewRowCnt}건 (등록 후 업체/직원에 ⚠️ 표시)</div>}
                {pv.dupPreview.length>0&&<div style={{color:"#7C3AED"}}>· 중복 제외: {pv.dupPreview.length}명 (이미 등록된 동일 직원)</div>}
                {pv.errors.length>0&&<div style={{color:"#DC2626"}}>· 저장 제외: {pv.errors.length}행{pv.exclNoEmp>0?" (직원명 없음 "+pv.exclNoEmp+"건 포함)":""}</div>}
                {preNoProg>0&&<div style={{color:"#B45309"}}>· 지원금 미지정 등록 예정: {preNoProg}명</div>}
              </div>
              <button disabled={!canSave} onClick={doImport}
                style={Object.assign({},btnP,{padding:"13px",fontSize:15,opacity:canSave?1:0.45,cursor:canSave?"pointer":"not-allowed"})}>
                {stSaving[0]?"등록 중…":"💾 검토한 데이터 등록하기"}
              </button>
              <p style={{fontSize:11.5,color:"#94A3B8",textAlign:"center",margin:0}}>등록 버튼을 누른 뒤에는 오류가 없는 데이터만 고객사 계정에 저장됩니다. 기존 업체와 사업자등록번호가 같은 경우 해당 업체에 직원이 추가됩니다. 엑셀 원본 파일은 저장되지 않습니다.</p>
              <button disabled={stSaving[0]} style={Object.assign({},btnS,{padding:"10px 16px"})} onClick={function(){stStep[1](3);}}>← 미리보기로 돌아가기</button>
            </div>);
          })()}

          {/* 4단계: 저장 결과 */}
          {stStep[0]===4&&stResult[0]&&(function(){
            var r=stResult[0];
            return(
            <div style={{display:"grid",gap:12}}>
              <div style={{padding:"16px 18px",background:r.failedRows.length>0?"#FFFBEB":"#F0FDF4",border:"1px solid "+(r.failedRows.length>0?"#FDE68A":"#BBF7D0"),borderRadius:12,fontSize:14,fontWeight:700,color:r.failedRows.length>0?"#92400E":"#166534"}}>
                {r.failedRows.length>0?"⚠️ 등록이 일부 실패와 함께 완료되었습니다.":"✅ 엑셀 데이터 등록이 완료되었습니다."}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(105px,1fr))",gap:8}}>
                {[["신규 등록 업체",r.newComps+"개","#2563EB"],["기존 업체 병합",r.merged+"개","#0891B2"],["등록된 직원",r.saved+"명","#059669"],
                  ["수정 필요 표시",(r.reviewCnt||0)+"건",(r.reviewCnt||0)>0?"#B45309":"#94A3B8"],
                  ["저장 제외",r.excludedErrors+"행",r.excludedErrors>0?"#DC2626":"#94A3B8"],
                  ["중복 제외",r.dupExcluded.length+"건",r.dupExcluded.length>0?"#7C3AED":"#94A3B8"],
                  ["지원금 미지정",r.noProg+"명",r.noProg>0?"#B45309":"#94A3B8"],
                  ["사업자번호 주의",r.bizWarn+"건",r.bizWarn>0?"#DC2626":"#94A3B8"],
                  ["실패 행",r.failedRows.length+"건",r.failedRows.length>0?"#DC2626":"#94A3B8"]
                ].map(function(a,i){return(
                  <div key={i} style={{padding:"13px 12px",borderRadius:12,background:"#F8FAFC",textAlign:"center"}}>
                    <div style={{fontSize:12,color:"#64748B",fontWeight:600,marginBottom:5}}>{a[0]}</div>
                    <div style={{fontSize:22,fontWeight:800,color:a[2],letterSpacing:"-0.5px"}}>{a[1]}</div>
                  </div>
                );})}
              </div>
              {(r.exclNoEmp||0)>0&&(
                <div style={{fontSize:12,color:"#94A3B8"}}>직원명 없음으로 제외 {r.exclNoEmp}건 — 해당 행은 직원 등록 없이 건너뛰었습니다.</div>
              )}
              {r.dupExcluded.length>0&&(
                <div style={{padding:"10px 14px",background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:10,fontSize:12.5,color:"#5B21B6",lineHeight:1.6}}>
                  중복으로 제외: {r.dupExcluded.slice(0,6).map(function(d){return d.name+"("+d.rowNo+"행)";}).join(", ")}{r.dupExcluded.length>6?" 외 "+(r.dupExcluded.length-6)+"건":""}
                </div>
              )}
              {r.failedRows.length>0&&(
                <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:12.5,color:"#991B1B",lineHeight:1.6}}>
                  저장 실패: {r.failedRows.slice(0,6).map(function(f){return f.name+" — "+f.error;}).join(" / ")}{r.failedRows.length>6?" 외 "+(r.failedRows.length-6)+"건":""}
                </div>
              )}
              <button style={Object.assign({},btnP,{padding:"12px",fontSize:15})} onClick={function(){stOpen[1](false);softReset();}}>🏢 업체 목록에서 확인하기</button>
              {(function(){
                var undone=stUndo[0]&&!stUndo[0].error;
                var undoDisabled=stUndoBusy[0]||undone||((r.undoEmpIds||[]).length===0&&(r.undoCompIds||[]).length===0);
                return(
                  <button disabled={undoDisabled} onClick={undoImport}
                    style={{background:"#fff",color:undoDisabled?"#94A3B8":"#DC2626",border:"1px solid "+(undoDisabled?"#E2E8F0":"#FECACA"),borderRadius:10,padding:"10px 16px",fontSize:13.5,fontWeight:700,cursor:undoDisabled?"default":"pointer",fontFamily:FF,opacity:undoDisabled?0.7:1}}>
                    {stUndoBusy[0]?"취소 중…":undone?"✓ 가져오기 취소 완료":"↩️ 이번 가져오기 취소 (방금 등록한 데이터만 삭제)"}
                  </button>
                );
              })()}
              {stUndo[0]&&!stUndo[0].error&&(
                <div style={{padding:"10px 14px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,fontSize:12.5,color:"#166534",lineHeight:1.7}}>
                  이번 가져오기가 취소되었습니다 — 삭제된 직원 <strong>{stUndo[0].emps}명</strong> · 삭제된 신규 업체 <strong>{stUndo[0].comps}개</strong> · 유지된 기존 업체 <strong>{stUndo[0].kept}개</strong> (기존 업체와 그 기존 데이터는 삭제되지 않았습니다)
                </div>
              )}
              {stUndo[0]&&stUndo[0].error&&(
                <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:12.5,color:"#991B1B",lineHeight:1.7}}>
                  취소 실패: {stUndo[0].error} — 다시 시도하거나, 업체 목록에서 해당 데이터를 직접 삭제해주세요.
                </div>
              )}
              <p style={{fontSize:11.5,color:"#94A3B8",textAlign:"center",margin:0}}>업체 목록은 자동으로 갱신되었습니다. 이 창은 닫기 전까지 결과를 계속 확인할 수 있습니다.</p>
            </div>);
          })()}
        </div>
      </Modal>
    </React.Fragment>
  );
}

// ── 4대보험 명부 자동진단 (업로드 → 1차 검토 · 세액공제 예상 · 결과 복사) ──
// 안전: 파일/주민번호 원본 미저장(메모리만), Supabase/localStorage 저장 없음.
function PayrollDiagnosis(props){
  var compact=props.compact;
  var stOpen=useState(false);
  var stBusy=useState(false);
  var stEmps=useState(null);        // 추출된 직원 배열(메모리)
  var stFile=useState(null);        // 선택된 파일(분석 전, 메모리만 · 저장 안 함)
  var stBase=useState(function(){return new Date().toISOString().split("T")[0];});
  var stTab=useState("emp");
  var stCopied=useState(false);
  var stPhase=useState("");          // PDF 분석 진행 상태 문구
  var stMissing=useState(0);         // 일부 항목 미확인(확인 필요) 직원 수
  var stErr=useState("");            // 모달 내부에 유지되는 오류 안내(앱 튕김 방지)
  var stStep=useState(1);            // 1 파일 선택 · 2 추출 내용 확인 · 3 명부 정리 · 4 진단 결과
  var stMode=useState("file");       // step1: 'file' | 'paste'
  var stText=useState("");           // PDF에서 읽은/붙여넣은/검수한 텍스트
  var stCand=useState([]);           // 직원 후보(검수·수정용)
  var stOnlyCheck=useState(false);   // '확인 필요만 보기'
  var stStats=useState(null);        // 분석 로그(텍스트 길이·주민번호 수·날짜 수·후보 수)
  var stIssueDate=useState(null);    // 명부 발급/출력일(최신성 경고용)
  var stPick=useState({clicked:false,returned:false,name:"",type:"",ext:"",supported:null}); // 파일 선택 로그
  var fileRef=useRef(null);
  var pickerOpenRef=useRef(false);   // 파일 선택기 열림 상태(복귀 시 상태 보호용)
  var changedRef=useRef(false);      // 이번 선택에서 onChange 발생 여부(취소 감지)

  // 모바일 환경 추정 + PDF 안전 제한값
  function isMobileEnv(){
    try{ return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.innerWidth||1024) < 768; }
    catch{ return false; }
  }
  var PDF_MOBILE_MAX_MB=5;
  var PDF_MAX_PAGES_MOBILE=5, PDF_MAX_PAGES_DESKTOP=30;
  var PDF_TIMEOUT_MS_MOBILE=15000, PDF_TIMEOUT_MS_DESKTOP=30000;
  // 추가 입력값
  var stRegion=useState("metro");   // metro|local (수도권/비수도권 세그먼트)
  var stSize=useState("sme");       // sme|mid|other
  var stIndustry=useState("normal");// normal|excluded|check
  var stYear=useState(function(){return new Date().getFullYear();});
  var stPrevTotal=useState("");     // "" | number | "unknown"
  var stPrevYouth=useState("");
  var stCurTotal=useState("");      // 명부 자동추정 후 수정 가능
  var stCurYouth=useState("");
  var stUnitY=useState(0);
  var stUnitN=useState(0);

  function reset(){
    stEmps[1](null);stFile[1](null);stBusy[1](false);stTab[1]("emp");stCopied[1](false);stPhase[1]("");stMissing[1](0);stErr[1]("");
    stStep[1](1);stMode[1]("file");stText[1]("");stCand[1]([]);stOnlyCheck[1](false);stStats[1](null);stIssueDate[1](null);
    stPrevTotal[1]("");stPrevYouth[1]("");stCurTotal[1]("");stCurYouth[1]("");
    if(fileRef.current)fileRef.current.value="";
  }

  // 기본 단가 자동 세팅(소재지/기업구분 변경 시)
  useEffect(function(){
    var u=PD.defaultTaxUnits(stRegion[0],stSize[0]);
    stUnitY[1](u.youth);stUnitN[1](u.normal);
  },[stRegion[0],stSize[0]]);

  function fileExt(f){return f?(f.name.split(".").pop()||"").toLowerCase():"";}
  function fmtSize(bytes){
    if(bytes==null)return "";
    if(bytes<1024)return bytes+" B";
    if(bytes<1024*1024)return (Math.round(bytes/102.4)/10)+" KB";
    return (Math.round(bytes/104857.6)/10)+" MB";
  }

  // 파일 형식 판정 헬퍼 (MIME 만 믿지 않고 확장자도 확인)
  function isPdfFile(f){ if(!f)return false; var nm=(f.name||"").toLowerCase(); return nm.endsWith(".pdf")||f.type==="application/pdf"; }
  function isExcelCsv(f){ if(!f)return false; var e=fileExt(f); return ["xlsx","xls","csv"].indexOf(e)>=0; }
  function isImageFile(f){ if(!f)return false; var e=fileExt(f); if((f.type||"").indexOf("image/")===0)return true; return ["jpg","jpeg","png","heic","heif","webp","gif","bmp","tif","tiff"].indexOf(e)>=0; }
  function isSupportedFile(f){ return isPdfFile(f)||isExcelCsv(f); }

  // 1) 파일 선택창 열기 — mode: 'pdf' | 'excel' | 'any'
  //  - capture/multiple 사용 안 함(카메라·사진첩 우선 방지)
  //  - 복귀 시 상태 보호: pickerOpenRef 로 표시(앱 전체 언마운트는 useAuth 에서 이미 방지)
  function openPicker(mode){
    try{
      if(!fileRef.current)throw new Error("no ref");
      var accept = mode==="pdf" ? ".pdf,application/pdf"
        : mode==="excel" ? ".xlsx,.xls,.csv"
        : "";   // 'any' → accept 비움(안드로이드/구글드라이브에서 파일이 보이도록)
      fileRef.current.accept=accept;
      fileRef.current.value="";        // 같은 파일 재선택 가능하도록 초기화
      pickerOpenRef.current=true; changedRef.current=false;
      stPick[1](Object.assign({},stPick[0],{clicked:true,returned:false,supported:null}));
      // 선택기 복귀(window focus) 감지 → 취소 안내(모달은 그대로 유지)
      var onFocus=function(){
        window.removeEventListener("focus",onFocus);
        setTimeout(function(){
          pickerOpenRef.current=false;
          stPick[1](function(p){return Object.assign({},p,{returned:true});});
          if(!changedRef.current){ toast("파일이 선택되지 않았습니다. 다시 선택해주세요.","error"); }
        },700);
      };
      window.addEventListener("focus",onFocus);
      fileRef.current.click();
    }catch(err){
      console.error("[명부진단] 파일 선택창 열기 실패:",err);
      toast("파일 선택창을 열 수 없습니다. 다시 시도해주세요.","error");
    }
  }

  // 2) 파일 선택됨 — 분석 전에 파일 정보만 표시(저장 안 함). 이미지/미지원은 거부.
  function onFileChange(file){
    changedRef.current=true; pickerOpenRef.current=false;
    if(!file){ return; }   // 선택 취소 — 모달 유지
    var ext=fileExt(file);
    stPick[1](Object.assign({},stPick[0],{clicked:true,returned:true,name:file.name,type:file.type||"(없음)",ext:ext||"(없음)",supported:isSupportedFile(file)}));
    stEmps[1](null);
    if(isImageFile(file)){
      // 사진/이미지: OCR 미지원 → 분석하지 않음. 모달 유지, 파일은 보류.
      stFile[1](file); stErr[1]("사진/이미지 파일은 아직 자동진단에서 지원하지 않습니다. 4대보험 명부 PDF(또는 엑셀)를 올려주세요. 사진으로 저장된 명부는 글자가 이미지라 정확히 읽기 어렵습니다 — 4대보험 EDI/사회보험통합징수포털에서 PDF·엑셀로 내려받는 것이 가장 안정적입니다.");
      return;
    }
    stErr[1]("");
    stFile[1](file);        // 선택 시점에는 파일 정보만 저장(무거운 분석 실행 안 함)
    if(!isSupportedFile(file)){
      stErr[1]("지원하지 않는 형식입니다. PDF 또는 엑셀(xlsx·xls)·CSV 파일을 올려주세요.");
    }else{
      toast("파일을 선택했습니다: "+file.name+" (아직 저장되지 않음)","success");
    }
  }

  // PDF 진행 상태 콜백 → 사용자 친화 문구
  function onPdfProgress(phase,cur,total){
    if(phase==="read")stPhase[1]("PDF를 읽는 중입니다…");
    else if(phase==="extract")stPhase[1]("페이지 텍스트를 추출하는 중입니다… ("+cur+"/"+total+")");
    else if(phase==="find")stPhase[1]("직원 정보를 찾는 중입니다…");
  }

  // 타임아웃 래퍼 — PDF 분석이 너무 오래 걸리면 대기를 끊고 안내(앱 유지)
  function withTimeout(promise,ms){
    return new Promise(function(resolve){
      var done=false;
      var t=setTimeout(function(){ if(!done){ done=true; resolve({ok:false,error:"timeout"}); } },ms);
      promise.then(function(v){ if(!done){ done=true; clearTimeout(t); resolve(v); } },
                   function(e){ if(!done){ done=true; clearTimeout(t); console.error("[명부진단] 분석 예외:",e); resolve({ok:false,error:"read_failed",message:e&&e.message}); } });
    });
  }

  // 후보 변환/편집 헬퍼
  function toCandidates(emps){
    return (emps||[]).map(function(e){
      var c=Object.assign({},e);
      c.id=uid(); c.excluded=false; c.confirmed=false;
      c.ins=c.ins||{np:false,hi:false,ei:false,wc:false};
      c.rel=c.rel||"none";
      return c;
    });
  }
  function candNeedsCheck(c){ return !c.name || c.name==="(이름 확인 필요)" || !c.birthDate || !c.hireDate; }
  function updateCand(id,patch){ stCand[1](stCand[0].map(function(c){ return c.id===id?Object.assign({},c,patch):c; })); }
  function updateIns(id,key,val){ stCand[1](stCand[0].map(function(c){ return c.id===id?Object.assign({},c,{ins:Object.assign({},c.ins||{},(function(){var o={};o[key]=val;return o;})())}):c; })); }
  function addCand(){ stCand[1](stCand[0].concat([{id:uid(),name:"",birthDate:"",gender:"",rrnMasked:null,hireDate:"",loseDate:null,statusRaw:"취득",insuranceRaw:"",ins:{np:false,hi:false,ei:false,wc:false},workplace:"",bizNo:"",excluded:false,confirmed:false}])); }
  function confirmAll(){ stCand[1](stCand[0].map(function(c){ return c.excluded?c:Object.assign({},c,{confirmed:true}); })); }
  // 후보 0명일 때: 빈 명부로 직접 입력 진행
  function goManual(){ stErr[1](""); stCand[1]([{id:uid(),name:"",birthDate:"",gender:"",rrnMasked:null,hireDate:"",loseDate:null,statusRaw:"취득",insuranceRaw:"",ins:{np:false,hi:false,ei:false,wc:false},workplace:"",bizNo:"",excluded:false,confirmed:false}]); stStep[1](3); }

  // 1단계 → : 엑셀/CSV 는 곧장 명부 정리(3), PDF 는 글자 읽기 후 검수(2)
  async function startFromFile(){
    var file=stFile[0];
    if(!file){toast("먼저 명부 파일을 선택해주세요.","error");return;}
    var isPdf=isPdfFile(file);
    if(isImageFile(file)){ stErr[1]("사진/이미지 파일은 자동진단에서 지원하지 않습니다. 4대보험 명부 PDF(또는 엑셀)를 올려주세요."); return; }
    if(!isSupportedFile(file)){ stErr[1]("지원하지 않는 형식입니다. PDF 또는 엑셀(xlsx·xls)·CSV 파일을 올려주세요."); return; }
    stErr[1]("");
    var mobile=isMobileEnv();
    if(isPdf&&mobile&&file.size>PDF_MOBILE_MAX_MB*1024*1024){
      stErr[1]("스마트폰에서는 큰 PDF("+PDF_MOBILE_MAX_MB+"MB 초과)에서 글자 읽기가 불안정할 수 있습니다. PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올리면 더 안정적입니다.");
      stMode[1]("paste"); stText[1](""); stStep[1](1);
      return;
    }
    stBusy[1](true);
    if(isPdf){
      stPhase[1]("PDF에서 글자를 읽는 중입니다…");
      var opts={maxPages:mobile?PDF_MAX_PAGES_MOBILE:PDF_MAX_PAGES_DESKTOP};
      var to=mobile?PDF_TIMEOUT_MS_MOBILE:PDF_TIMEOUT_MS_DESKTOP;
      var r=await withTimeout(PD.extractPdfText(file,onPdfProgress,opts),to);
      stBusy[1](false);stPhase[1]("");
      if(!r||!r.ok){
        if(r&&r.message)console.error("[명부진단] PDF 텍스트 추출 실패:",r.error,r.message);
        // 실패해도 검수 화면으로 보내 직접 붙여넣을 수 있게(앱 유지)
        stText[1]((r&&r.text)||"");
        stErr[1](r&&r.error==="timeout"?"PDF에서 글자 읽기가 길어 중단했습니다. 아래에 PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요.":"PDF에서 글자를 충분히 읽지 못했습니다. 아래에 PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요.");
        stStep[1](2);
        return;
      }
      stText[1](r.text||"");
      if(r.truncated)toast("PDF "+r.totalPages+"쪽 중 앞부분만 읽었습니다. 필요하면 직접 보완해주세요.","success");
      stStep[1](2);
    }else{
      stPhase[1]("명부를 읽는 중입니다…");
      var r2=await withTimeout(PD.parseRosterFile(file),20000);
      stBusy[1](false);stPhase[1]("");
      if(!r2||!r2.ok){
        var e2=r2?r2.error:"read_failed";
        if(r2&&r2.message)console.error("[명부진단] 엑셀/CSV 읽기 실패:",e2,r2.message);
        stErr[1]((e2==="empty"||e2==="no_rows")?"명부에서 직원 행을 찾지 못했습니다. 성명·생년월일(또는 주민번호)·자격취득일 항목이 있는지 확인해주세요.":"파일을 읽지 못했습니다. 엑셀 파일인지 확인해주세요.");
        return;
      }
      stCand[1](toCandidates(r2.employees));
      stStep[1](3);
    }
  }

  // 2단계(또는 붙여넣기) → 3단계: 텍스트에서 직원 후보 추출
  function textToCandidates(){
    var text=stText[0]||"";
    if(!text.trim()){ stErr[1]("내용이 비어 있습니다. PDF 내용을 복사해 붙여넣거나, 엑셀 파일로 올려주세요."); return; }
    var res=PD.parseTextRoster(text);
    stStats[1](res.stats);
    if(res.meta&&res.meta.issueDate)stIssueDate[1](res.meta.issueDate);
    if(!res.employees.length){ stErr[1]("직원 후보를 찾지 못했습니다. 주민번호(예: 900101-1******)나 생년월일이 보이도록 정리해 보거나, 아래 ‘직원 직접 입력’으로 진행하거나 엑셀 파일로 올려주세요."); return; }
    stErr[1]("");
    stCand[1](toCandidates(res.employees));
    stStep[1](3);
  }

  // 3단계 → 4단계: 검수된 명부로 1차 진단 실행
  function runDiagnosis(){
    var list=stCand[0].filter(function(c){return !c.excluded;}).map(function(c){
      var ins=c.ins||{};
      var insStr=[ins.np?"국민":"",ins.hi?"건강":"",ins.ei?"고용":"",ins.wc?"산재":""].filter(Boolean).join("·");
      return {name:(c.name||"").trim()||"(이름 확인 필요)",birthDate:c.birthDate||null,gender:c.gender||null,rrnMasked:c.rrnMasked||null,hireDate:c.hireDate||null,loseDate:c.loseDate||null,statusRaw:c.statusRaw||"",ins:c.ins,insKnown:c.insKnown,rel:c.rel||"none",insuranceRaw:insStr||c.insuranceRaw||"",workplace:c.workplace||"",bizNo:c.bizNo||""};
    });
    if(!list.length){ stErr[1]("진단할 직원이 없습니다. 직원을 추가하거나 ‘제외’를 해제해주세요."); return; }
    stErr[1]("");
    var an=PD.analyzeRoster(list,{baseDate:stBase[0],year:stYear[0]});
    stCurTotal[1](String(an.counts.activeCount));
    stCurYouth[1](String(an.counts.youthCount));
    stMissing[1](list.filter(function(c){return !c.birthDate||!c.hireDate||c.name==="(이름 확인 필요)";}).length);
    stEmps[1](list);
    stStep[1](4);
  }

  var analysis=useMemo(function(){
    if(!stEmps[0])return null;
    return PD.analyzeRoster(stEmps[0],{baseDate:stBase[0],year:stYear[0]});
  },[stEmps[0],stBase[0],stYear[0]]);

  function numOrNull(v){var s=String(v).trim();if(s===""||s==="unknown")return null;var n=Number(s);return isFinite(n)?n:null;}
  var estimate=useMemo(function(){
    return PD.estimateTaxCredit({
      region:stRegion[0],sizeType:stSize[0],
      prevTotal:numOrNull(stPrevTotal[0]),prevYouth:numOrNull(stPrevYouth[0]),
      curTotal:numOrNull(stCurTotal[0]),curYouth:numOrNull(stCurYouth[0]),
      unitYouth:stUnitY[0],unitNormal:stUnitN[0],
    });
  },[stRegion[0],stSize[0],stPrevTotal[0],stPrevYouth[0],stCurTotal[0],stCurYouth[0],stUnitY[0],stUnitN[0]]);

  var stale=useMemo(function(){
    return stIssueDate[0]?PD.rosterStaleness(stIssueDate[0],stBase[0]):null;
  },[stIssueDate[0],stBase[0]]);
  // 영업용 최대 예상 혜택 (지원금 + 세액공제)
  var subsidyMax=analysis?PD.estimateSubsidyTotal(analysis.subsidySummary):0;
  var creditMax=(estimate.computable&&!estimate.overYouth&&estimate.creditTotal!=null)?estimate.creditTotal:0;
  var totalBenefit=subsidyMax+creditMax;
  function staleText(){ return stale?("발급 후 "+stale.days+"일 경과"):""; }

  function doCopy(){
    if(!analysis)return;
    var text=PD.buildCopyText({
      company:(props.companyName||""),
      totalEmp:analysis.counts.totalEmp,youthCount:analysis.counts.youthCount,seniorCount:analysis.counts.seniorCount,
      eiCheckCount:analysis.eiCheckCount,wcCheckCount:analysis.wcCheckCount,partialInsCount:analysis.partialInsCount,relCheckCount:analysis.relCheckCount,
      candidateSubsidyCount:analysis.candidateSubsidyCount,estimate:estimate,
      issueDate:stIssueDate[0],staleText:staleText(),
    });
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){stCopied[1](true);setTimeout(function(){stCopied[1](false);},2200);toast("상담용 요약을 복사했습니다. (주민번호·직원별 정보 미포함)","success");},function(){toast("복사에 실패했습니다.","error");});
    }else{toast("이 브라우저에서는 복사를 지원하지 않습니다.","error");}
  }

  var inpS={width:"100%",boxSizing:"border-box",padding:"11px 13px",fontSize:19,borderRadius:9,border:"1.5px solid #E2E8F0",fontFamily:FF,background:"#fff",color:"#1E293B"};
  var labS={fontSize:17.5,fontWeight:700,color:"#475569",marginBottom:6,display:"block"};

  // 진입 버튼 (업체 관리 상단 / 채용 진단 등에서 재사용)
  var btn=compact?(
    <button onClick={function(){stOpen[1](true);}} className="prog-tap" style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"12px 20px",fontSize:21.5,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(15,118,110,0.28)"}}>🩺 4대보험 명부 진단</button>
  ):(
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:4}}>
      <button onClick={function(){stOpen[1](true);}} className="prog-tap" style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"13px 22px",fontSize:21.5,fontWeight:800,whiteSpace:"nowrap",cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(15,118,110,0.28)"}}>🩺 4대보험 명부 진단</button>
      <span style={{fontSize:17,color:"#64748B",whiteSpace:"nowrap",fontWeight:600}}>가입자 명부를 올리면 지원금 후보와 세액공제 가능성을 자동으로 분류합니다.</span>
    </div>
  );

  return(
    <React.Fragment>
      {btn}
      <Modal open={stOpen[0]} onClose={function(){if(stBusy[0])return;var dirty=(stStep[0]>1||stFile[0]||(stText[0]&&stText[0].trim())||stCand[0].length);if(dirty&&!window.confirm("정말 닫을까요? 분석 내용은 저장되지 않습니다."))return;stOpen[1](false);}} title={<span style={{fontSize:26.5,fontWeight:800}}>🩺 4대보험 명부 자동진단 (1차 검토)</span>} width={920}>
        <div style={{display:"grid",gap:14}}>
          {/* 단계 이동(뒤로/앞으로) — 제목 바로 아래 보조 버튼 */}
          {(function(){
            var maxReach=stEmps[0]?4:(stCand[0].length?3:((stText[0]&&stText[0].trim())?2:1));
            var canBack=stStep[0]>1, canFwd=stStep[0]<maxReach;
            return(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button type="button" disabled={!canBack||stBusy[0]} onClick={function(){if(canBack)stStep[1](stStep[0]-1);}}
                  style={{padding:"7px 14px",fontSize:17,fontWeight:800,borderRadius:9,border:"1.5px solid #E2E8F0",background:canBack?"#fff":"#F1F5F9",color:canBack?"#0F766E":"#CBD5E1",cursor:canBack?"pointer":"default",fontFamily:FF}}>← 뒤로가기</button>
                <button type="button" disabled={!canFwd||stBusy[0]} onClick={function(){if(canFwd)stStep[1](stStep[0]+1);}}
                  style={{padding:"7px 14px",fontSize:17,fontWeight:800,borderRadius:9,border:"1.5px solid #E2E8F0",background:canFwd?"#fff":"#F1F5F9",color:canFwd?"#0F766E":"#CBD5E1",cursor:canFwd?"pointer":"default",fontFamily:FF}}>앞으로가기 →</button>
                <span style={{fontSize:15.5,color:"#94A3B8",marginLeft:"auto"}}>{stStep[0]}/4 단계</span>
              </div>
            );
          })()}
          {/* 개인정보/면책 안내 (항상 표시) */}
          <div style={{padding:"12px 15px",background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:10,fontSize:17,color:"#0F766E",lineHeight:1.7,wordBreak:"keep-all"}}>
            🔒 <strong>분석은 브라우저에서만 처리됩니다.</strong> 파일은 아직 저장되지 않으며, 서버·DB에 업로드하지 않습니다.
            주민등록번호 등 민감정보는 화면에 <strong>마스킹</strong>(예: 900101-1******)되어 표시되고, 결과 복사에도 포함되지 않습니다.
          </div>

          {/* 숨김 파일 input — 항상 렌더되어 ref 가 끊기지 않도록 모달 최상위에 둠 */}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{display:"none"}}
            onChange={function(e){var f=e.target.files&&e.target.files[0];onFileChange(f);}}/>

          {/* 단계 표시 (1 파일 선택 · 2 추출 내용 확인 · 3 명부 정리 · 4 진단 결과) */}
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {[[1,"파일 선택"],[2,"추출 내용 확인"],[3,"명부 정리"],[4,"1차 진단 결과"]].map(function(s,i){
              var n=s[0],on=stStep[0]===n,done=stStep[0]>n;
              return(<React.Fragment key={n}>
                {i>0&&<span style={{flex:"0 0 12px",height:2,background:(done||on)?"#5EEAD4":"#E2E8F0"}}/>}
                <span style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:17.5,fontWeight:800,color:(on||done)?"#0F766E":"#94A3B8",whiteSpace:"nowrap"}}>
                  <span style={{width:25,height:25,borderRadius:13,background:on?"#0F766E":done?"#CCFBF1":"#F1F5F9",color:on?"#fff":done?"#0F766E":"#94A3B8",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800}}>{done?"✓":n}</span>
                  <span className="hide-mobile">{s[1]}</span>
                </span>
              </React.Fragment>);
            })}
          </div>

          {/* 진행 상태 (공통) */}
          {stBusy[0]&&stPhase[0]&&(
            <div style={{display:"flex",alignItems:"center",gap:9,padding:"11px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:9,fontSize:18,color:"#1D4ED8",fontWeight:700}}>
              <span className="spin" style={{width:16,height:16,border:"2px solid #BFDBFE",borderTopColor:"#1D4ED8",borderRadius:"50%",display:"inline-block"}}/>
              {stPhase[0]}
            </div>
          )}
          {/* 오류/안내 (공통, 모달 내부 유지 — 앱이 홈으로 튕기지 않음) */}
          {stErr[0]&&!stBusy[0]&&stStep[0]!==4&&(
            <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,fontSize:17.5,color:"#991B1B",lineHeight:1.7}}>⚠️ {stErr[0]}</div>
          )}

          {/* ── 1단계: 파일 선택 / 텍스트 붙여넣기 ── */}
          {stStep[0]===1&&(
            <div style={{display:"grid",gap:12}}>
              <div style={{padding:"13px 16px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:12,fontSize:16,color:"#065F46",lineHeight:1.7}}>
                명부를 올리면 <strong>읽은 내용을 먼저 확인·수정</strong>한 뒤, <strong>지원금 후보</strong>와 <strong>통합고용세액공제</strong>를 <strong>1차 검토</strong>합니다. (확정 아님)
              </div>
              {/* 모드 탭 */}
              <div style={{display:"flex",gap:8}}>
                {[["file","📎 파일 올리기"],["paste","✍️ 텍스트 붙여넣기"]].map(function(m){var on=stMode[0]===m[0];return(
                  <button key={m[0]} type="button" onClick={function(){stMode[1](m[0]);stErr[1]("");}}
                    style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid "+(on?"#0F766E":"#E2E8F0"),background:on?"#0F766E":"#fff",color:on?"#fff":"#475569",fontSize:17,fontWeight:800,cursor:"pointer",fontFamily:FF}}>{m[1]}</button>
                );})}
              </div>

              {stMode[0]==="file"&&(
                <React.Fragment>
                  <div style={{border:"2px dashed #99F6E4",borderRadius:14,padding:"22px 18px",background:"#F8FFFE"}}>
                    <div style={{fontSize:38.5,marginBottom:8,textAlign:"center"}}>🗂️</div>
                    <div style={{display:"flex",flexDirection:"column",gap:9,maxWidth:420,margin:"0 auto"}}>
                      <button type="button" onClick={function(){openPicker("pdf");}} className="prog-tap"
                        style={{background:"#0F766E",color:"#fff",border:"none",borderRadius:11,padding:"13px 18px",fontSize:19,fontWeight:800,cursor:"pointer",fontFamily:FF}}>📄 PDF 명부 선택</button>
                      <button type="button" onClick={function(){openPicker("excel");}}
                        style={{background:"#fff",color:"#0F766E",border:"1.5px solid #99F6E4",borderRadius:11,padding:"12px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>📊 엑셀/CSV 선택</button>
                      <button type="button" onClick={function(){openPicker("any");}}
                        style={{background:"#F1F5F9",color:"#475569",border:"1px solid #E2E8F0",borderRadius:11,padding:"11px 18px",fontSize:17,fontWeight:700,cursor:"pointer",fontFamily:FF}}>📁 파일이 안 보이면 전체 파일에서 선택</button>
                    </div>
                    <div style={{fontSize:15.5,color:"#64748B",marginTop:11,lineHeight:1.7,wordBreak:"keep-all"}}>
                      📱 스마트폰에서는 ‘내 파일’ 또는 ‘구글드라이브’에서 PDF 명부를 선택해주세요.<br/>
                      PDF가 목록에 안 보이면 ‘전체 파일에서 선택’을 눌러 직접 고를 수 있습니다.<br/>
                      사진첩 이미지나 캡처본은 현재 분석하지 않습니다. 글자 선택이 가능한 PDF가 가장 안정적입니다.
                    </div>
                  </div>
                  {/* N: PDF 인식 차이 안내 */}
                  <details style={{fontSize:15,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700,color:"#475569"}}>PDF가 어떤 건 읽히고 어떤 건 안 읽히나요?</summary>
                    <div style={{marginTop:7,padding:"11px 13px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:9,lineHeight:1.75}}>
                      같은 PDF라도 저장 방식에 따라 다르게 인식될 수 있습니다.<br/>
                      · <strong>글자 선택/복사가 되는 PDF</strong>: 텍스트가 들어 있어 자동으로 읽을 수 있어요.<br/>
                      · <strong>글자 선택이 안 되는 PDF</strong>: 스캔 이미지 PDF일 가능성이 높아 자동으로 읽기 어렵습니다.<br/>
                      · 일부 PDF는 한글 폰트·보안·출력 방식 때문에 글자 순서가 깨질 수 있습니다(검수 단계에서 직접 수정 가능).<br/>
                      · 가장 안정적인 방법은 <strong>4대보험 EDI / 사회보험통합징수포털</strong>에서 명부를 <strong>엑셀로 내려받아 올리기</strong>입니다.
                    </div>
                  </details>
                  {stFile[0]&&(function(){
                    var ext=fileExt(stFile[0]);
                    var isPdf=isPdfFile(stFile[0]);
                    var isImg=isImageFile(stFile[0]);
                    var supported=isSupportedFile(stFile[0]);
                    return(
                      <div style={{border:"1px solid "+(supported?"#A7F3D0":"#FDE68A"),background:supported?"#F0FDF4":"#FFFBEB",borderRadius:12,padding:"14px 16px",display:"grid",gap:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontSize:29}}>{isPdf?"📄":(ext==="csv"?"📑":supported?"📊":isImg?"🖼️":"📁")}</span>
                          <div style={{minWidth:0,flex:"1 1 220px"}}>
                            <div style={{fontSize:18.5,fontWeight:800,color:"#1E293B",wordBreak:"break-all"}}>선택된 파일: {stFile[0].name}</div>
                            <div style={{fontSize:16,color:"#64748B",marginTop:2}}>형식: {ext?ext.toUpperCase():(isPdf?"PDF":"알 수 없음")} · 크기: {fmtSize(stFile[0].size)} · {supported?"처리 가능":isImg?"이미지(미지원)":"미지원 형식"}</div>
                          </div>
                        </div>
                        <div style={{fontSize:15.5,color:"#475569",lineHeight:1.6}}>파일은 아직 저장되지 않습니다. 브라우저에서만 읽고, 주민등록번호 등 민감정보는 화면에 마스킹합니다.</div>
                        {isPdf&&isMobileEnv()&&(
                          <div style={{padding:"10px 13px",background:"#FEF9C3",border:"1px solid #FDE68A",borderRadius:9,fontSize:15.5,color:"#92400E",lineHeight:1.7}}>💡 스마트폰에서는 PDF 글자 읽기가 제한될 수 있습니다. PDF 내용을 복사해 <strong>‘텍스트 붙여넣기’</strong>로 올리거나, 엑셀 파일로 올리면 더 안정적입니다.</div>
                        )}
                        <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                          <button type="button" disabled={stBusy[0]} onClick={function(){openPicker("any");}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17.5,opacity:stBusy[0]?0.6:1})}>파일 다시 선택</button>
                          <button type="button" disabled={!supported||stBusy[0]} onClick={startFromFile}
                            style={{flex:"1 1 200px",background:(!supported||stBusy[0])?"#CBD5E1":"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"12px 18px",fontSize:18.5,fontWeight:800,cursor:(!supported||stBusy[0])?"default":"pointer",fontFamily:FF}}>
                            {stBusy[0]?"읽는 중…":isPdf?"PDF에서 글자 읽기 →":"이 파일로 명부 정리하기 →"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {/* H: 파일 선택 로그(접이식) */}
                  <details style={{fontSize:15,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700,color:"#475569"}}>파일 선택 로그 보기</summary>
                    <div style={{marginTop:6,padding:"9px 12px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.8}}>
                      선택 버튼 클릭: {stPick[0].clicked?"예":"아니오"} · 선택기 복귀: {stPick[0].returned?"예":"아니오"}<br/>
                      파일명: {stPick[0].name||"—"} · MIME: {stPick[0].type||"—"} · 확장자: {stPick[0].ext||"—"} · 지원: {stPick[0].supported===null?"—":(stPick[0].supported?"예":"아니오")}<br/>
                      현재 단계: {stStep[0]}단계 · 마지막 오류: {stErr[0]?stErr[0].slice(0,60):"없음"}
                    </div>
                  </details>
                </React.Fragment>
              )}

              {stMode[0]==="paste"&&(
                <div style={{display:"grid",gap:10}}>
                  <div style={{fontSize:18,fontWeight:800,color:"#1E293B"}}>명부 내용을 직접 붙여넣기</div>
                  <div style={{fontSize:15,color:"#64748B",lineHeight:1.6}}>PDF에서 복사한 텍스트나 4대보험 명부 내용을 붙여넣으면, 직원 후보를 찾아 1차 진단합니다.</div>
                  <textarea value={stText[0]} onChange={function(e){stText[1](e.target.value);}} rows={9}
                    placeholder={"여기에 4대보험 가입자 명부 내용을 붙여넣어 주세요.\n예: 이름 / 주민번호 앞자리 / 자격취득일 / 사업장명 등"}
                    style={{width:"100%",boxSizing:"border-box",padding:"13px 15px",fontSize:18,lineHeight:1.7,borderRadius:10,border:"1.5px solid #E2E8F0",fontFamily:FF,resize:"vertical"}}/>
                  <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                    <button type="button" onClick={goManual} style={Object.assign({},btnS,{padding:"12px 16px",fontSize:17})}>직원 직접 입력</button>
                    <button type="button" onClick={textToCandidates} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>붙여넣은 내용으로 명부 정리하기 →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 2단계: 추출 내용 확인 ── */}
          {stStep[0]===2&&(
            <div style={{display:"grid",gap:11}}>
              <div style={{fontSize:23,fontWeight:800,color:"#1E293B"}}>PDF에서 읽은 내용을 확인해주세요</div>
              <div style={{fontSize:15,color:"#64748B",lineHeight:1.6}}>PDF 양식에 따라 글자가 일부 깨지거나 순서가 어긋날 수 있습니다. 아래 내용을 확인한 뒤, 필요하면 수정하고 다음 단계로 넘어가세요.</div>
              <textarea value={stText[0]} onChange={function(e){stText[1](e.target.value);}} rows={11}
                placeholder={"PDF에서 읽은 내용이 여기에 표시됩니다. 비어 있다면 PDF 내용을 복사해 직접 붙여넣어 주세요."}
                style={{width:"100%",boxSizing:"border-box",padding:"13px 15px",fontSize:18,lineHeight:1.7,borderRadius:10,border:"1.5px solid #E2E8F0",fontFamily:FF,resize:"vertical"}}/>
              <div style={{fontSize:14.5,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:9,padding:"9px 12px",lineHeight:1.6}}>
                텍스트가 거의 비어 있다면, 해당 PDF는 스캔 이미지일 가능성이 높습니다. 이 경우 엑셀 파일로 내려받아 올리거나, PDF 내용을 복사해 붙여넣어 주세요.
              </div>
              {/* 분석 로그(접이식) — 추출은 됐는데 후보가 안 잡히는지 진단 */}
              {(function(){
                var quickRrn=(stText[0].match(/\d{6}\s*-\s*[0-9*]/g)||[]).length;
                return(
                  <details style={{fontSize:14.5,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700}}>분석 로그 보기</summary>
                    <div style={{marginTop:6,padding:"8px 11px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.7}}>
                      읽은 글자 수: {stText[0].length}자 · 발견된 주민번호 패턴(원문): 약 {quickRrn}건
                      {stStats[0]&&(<div style={{marginTop:4}}>직전 인식 결과 — 정규화 후 글자 {stStats[0].normLen}자 · 주민번호 {stStats[0].rrnCount}건 · 날짜 {stStats[0].dateCount}개 · 직원 후보 {stStats[0].candCount}명</div>)}
                      {stStats[0]&&stStats[0].preview&&(<div style={{marginTop:4,color:"#94A3B8",wordBreak:"break-all"}}>정규화 미리보기(주민번호 마스킹): {stStats[0].preview}…</div>)}
                    </div>
                  </details>
                );
              })()}
              <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                <button type="button" onClick={function(){stErr[1]("");stStep[1](1);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 파일 다시 선택</button>
                <button type="button" onClick={goManual} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>직원 직접 입력</button>
                <button type="button" onClick={textToCandidates} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>이 내용으로 명부 정리하기 →</button>
              </div>
            </div>
          )}

          {/* ── 3단계: 명부 정리(직원 후보 확인/수정) ── */}
          {stStep[0]===3&&(function(){
            var cands=stCand[0];
            var notExcluded=cands.filter(function(c){return !c.excluded;});
            var needCheck=notExcluded.filter(function(c){return candNeedsCheck(c)&&!c.confirmed;});
            var confirmedCnt=notExcluded.filter(function(c){return c.confirmed;}).length;
            var excludedCnt=cands.length-notExcluded.length;
            var shown=stOnlyCheck[0]?cands.filter(function(c){return !c.excluded&&candNeedsCheck(c)&&!c.confirmed;}):cands;
            var cellS={padding:"8px",verticalAlign:"middle"};
            var smInp={width:"100%",boxSizing:"border-box",padding:"7px 9px",fontSize:17,borderRadius:7,border:"1px solid #E2E8F0",fontFamily:FF};
            return(
              <div style={{display:"grid",gap:12}}>
                <div style={{fontSize:23,fontWeight:800,color:"#1E293B"}}>직원 후보를 확인해주세요</div>
                <div style={{fontSize:17,color:"#64748B",lineHeight:1.65}}>자동으로 찾은 직원 정보입니다. 잘못 읽힌 부분은 수정하고, 빠진 직원은 추가한 뒤 진단을 시작하세요. 주민등록번호는 <strong>900101-1******</strong> 형태로만 표시됩니다.</div>
                {/* 요약 */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8}}>
                  {[["찾은 직원",notExcluded.length,"#1E293B"],["확인 완료",confirmedCnt,"#059669"],["확인 필요",needCheck.length,"#B45309"],["제외 예정",excludedCnt,"#94A3B8"]].map(function(k){return(
                    <div key={k[0]} style={{background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:10,padding:"9px 11px"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>{k[0]}</div><div style={{fontSize:20.5,fontWeight:800,color:k[2]}}>{k[1]}명</div></div>
                  );})}
                </div>
                {stStats[0]&&(
                  <details style={{fontSize:14.5,color:"#64748B"}}>
                    <summary style={{cursor:"pointer",fontWeight:700}}>분석 로그 보기</summary>
                    <div style={{marginTop:6,padding:"8px 11px",background:"#F8FAFC",border:"1px solid #EEF2F6",borderRadius:8,lineHeight:1.7}}>읽은 글자 {stStats[0].rawLen||stStats[0].textLen}자 · 정규화 후 {stStats[0].normLen}자 · 주민번호 {stStats[0].rrnCount}건 · 날짜 {stStats[0].dateCount}개 · 직원 후보 {stStats[0].candCount}명</div>
                  </details>
                )}
                <div style={{display:"flex",gap:9,flexWrap:"wrap",alignItems:"center"}}>
                  <button type="button" onClick={addCand} style={Object.assign({},btnS,{padding:"8px 14px",fontSize:15.5})}>+ 직원 직접 추가</button>
                  <button type="button" onClick={confirmAll} style={Object.assign({},btnS,{padding:"8px 14px",fontSize:15.5})}>전체 확인 완료</button>
                  <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:15.5,color:"#475569",cursor:"pointer",marginLeft:"auto"}}>
                    <input type="checkbox" checked={stOnlyCheck[0]} onChange={function(e){stOnlyCheck[1](e.target.checked);}}/> 확인 필요만 보기
                  </label>
                </div>
                {cands.length===0?(
                  <div style={{padding:"22px",textAlign:"center",fontSize:16,color:"#94A3B8",border:"1px dashed #E2E8F0",borderRadius:10}}>직원 후보가 없습니다. “+ 직원 직접 추가”로 직접 입력하거나, 이전 단계에서 내용을 보완해주세요.</div>
                ):(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:17,minWidth:920}}>
                      <thead><tr style={{background:"#F8FAFC",textAlign:"left",color:"#64748B"}}>
                        {["이름","주민(마스킹)","생년월일","성별","나이","입사일","4대보험(연금·건강·산재·고용)","구분","상태","관리"].map(function(h){return <th key={h} style={{padding:"8px",fontWeight:700,whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0",fontSize:17}}>{h}</th>;})}
                      </tr></thead>
                      <tbody>
                        {shown.map(function(c){
                          var age=PD.calcAge(c.birthDate,stBase[0]);
                          var need=candNeedsCheck(c);
                          return(
                            <tr key={c.id} style={{borderBottom:"1px solid #F1F5F9",opacity:c.excluded?0.5:1}}>
                              <td style={cellS}>
                                <input value={c.name||""} onChange={function(e){updateCand(c.id,{name:e.target.value});}} style={Object.assign({},smInp,{minWidth:84})} placeholder="이름"/>
                                {(function(){var miss=c.ins?[c.ins.np,c.ins.hi,c.ins.wc,c.ins.ei].filter(function(b){return !b;}).length:0;return (miss>=2&&c.rel==="none")?<div style={{fontSize:15.5,fontWeight:700,color:"#C2410C",marginTop:3,whiteSpace:"normal",lineHeight:1.45}}>⚠ 특수관계자·대표자·임원 여부 확인 필요</div>:null;})()}
                              </td>
                              <td style={Object.assign({},cellS,{fontFamily:"monospace",color:"#64748B",whiteSpace:"nowrap"})}>{c.rrnMasked||"—"}</td>
                              <td style={cellS}><input type="date" value={c.birthDate||""} onChange={function(e){updateCand(c.id,{birthDate:e.target.value});}} style={Object.assign({},smInp,{minWidth:130})}/></td>
                              <td style={cellS}>
                                <select value={c.gender||""} onChange={function(e){updateCand(c.id,{gender:e.target.value});}} style={Object.assign({},smInp,{minWidth:60})}>
                                  <option value="">-</option><option value="M">남</option><option value="F">여</option>
                                </select>
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap",color:"#475569"})}>{age!=null?age+"세":"—"}</td>
                              <td style={cellS}>
                                <input type="date" value={c.hireDate||""} onChange={function(e){updateCand(c.id,{hireDate:e.target.value});}} style={Object.assign({},smInp,{minWidth:130})}/>
                                {c.multiDates&&<div style={{fontSize:12.5,color:"#B45309",marginTop:2}}>취득일 후보 여러 개 · 확인</div>}
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                {[["np","연금","국민연금"],["hi","건강","건강보험"],["wc","산재","산재보험"],["ei","고용","고용보험"]].map(function(k){var on=!!(c.ins&&c.ins[k[0]]);return(
                                  <label key={k[0]} title={k[2]} style={{display:"inline-flex",alignItems:"center",gap:3,marginRight:9,fontSize:16,color:on?"#0F766E":"#94A3B8",cursor:"pointer"}}>
                                    <input type="checkbox" checked={on} onChange={function(e){updateIns(c.id,k[0],e.target.checked);}}/>{k[1]}
                                  </label>
                                );})}
                              </td>
                              <td style={cellS}>
                                <select value={c.rel||"none"} onChange={function(e){updateCand(c.id,{rel:e.target.value});}} style={Object.assign({},smInp,{minWidth:96,color:(c.rel&&c.rel!=="none")?"#B45309":"#475569"})} title="대표자/임원/특수관계자 여부">
                                  <option value="none">해당 없음</option><option value="ceo">대표자</option><option value="exec">임원</option><option value="special">특수관계자</option>
                                </select>
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                {c.confirmed?<span style={{fontSize:15.5,fontWeight:800,color:"#059669"}}>✓ 확인</span>:need?<span style={{fontSize:15.5,fontWeight:800,color:"#B45309"}}>확인 필요</span>:<span style={{fontSize:15.5,color:"#64748B"}}>—</span>}
                              </td>
                              <td style={Object.assign({},cellS,{whiteSpace:"nowrap"})}>
                                <button type="button" onClick={function(){updateCand(c.id,{confirmed:!c.confirmed});}} style={{marginRight:5,padding:"4px 8px",borderRadius:6,border:"1px solid "+(c.confirmed?"#A7F3D0":"#E2E8F0"),background:c.confirmed?"#ECFDF5":"#fff",color:c.confirmed?"#059669":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>확인</button>
                                <button type="button" onClick={function(){updateCand(c.id,{excluded:!c.excluded});}} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+(c.excluded?"#FECACA":"#E2E8F0"),background:c.excluded?"#FEF2F2":"#fff",color:c.excluded?"#DC2626":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>{c.excluded?"되돌리기":"제외"}</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
                  <button type="button" onClick={function(){stErr[1]("");stStep[1](1);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 처음으로</button>
                  <button type="button" onClick={runDiagnosis} style={{flex:"1 1 200px",background:"#0F766E",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:18,fontWeight:800,cursor:"pointer",fontFamily:FF}}>이 명부로 자동진단 시작 →</button>
                </div>
              </div>
            );
          })()}

          {stStep[0]===4&&stEmps[0]&&analysis&&(
            <div style={{display:"grid",gap:16}}>
              <div style={{padding:"11px 15px",background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:10,fontSize:17,color:"#0F766E",lineHeight:1.7}}>
                이 결과는 <strong>사용자가 확인한 명부</strong>를 기준으로 한 <strong>1차 검토</strong>입니다. 실제 신청 가능 여부와 세액공제 금액은 공식 요건과 세무 검토가 필요합니다.
              </div>
              {stMissing[0]>0&&(
                <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:15,color:"#92400E",lineHeight:1.6}}>
                  ⚠️ 일부 항목(이름·생년월일·입사일 등)이 확인되지 않은 직원이 <strong>{stMissing[0]}명</strong> 있습니다. 해당 항목은 “확인 필요”로 반영되며, 이전 단계(명부 정리)에서 보완하면 더 정확합니다.
                </div>
              )}
              {/* 명부 최신성 경고 (I) */}
              {stale&&stale.level!=="ok"&&(
                <div style={{padding:"11px 14px",background:stale.level==="high"?"#FEF2F2":"#FFFBEB",border:"1px solid "+(stale.level==="high"?"#FECACA":"#FDE68A"),borderRadius:10,fontSize:16,color:stale.level==="high"?"#991B1B":"#92400E",lineHeight:1.7}}>
                  🕒 이 명부는 <strong>발급일({stIssueDate[0]}) 기준</strong> 자료로, 분석 기준일({stBase[0]})까지 <strong>약 {stale.days}일</strong> 경과했습니다. 현재 재직자·4대보험 가입 상태가 달라졌을 수 있으니 최신 명부로 재검토하세요.
                  {stale.level==="high"&&<span> 발급일로부터 90일이 지난 경우 발급사실 확인 가능 기간도 지났을 수 있습니다.</span>}
                </div>
              )}
              {/* 상단 요약 — 핵심 3개만 크게 (Toss 스타일) */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                {[
                  {l:"총 직원",v:analysis.counts.totalEmp+"명",c:"#1E293B"},
                  {l:"청년 추정",v:analysis.counts.youthCount+"명",c:"#0F766E"},
                  {l:"1차 검토 후보",v:analysis.candidateSubsidyCount+"건",c:"#1D4ED8"},
                ].map(function(k){return(
                  <div key={k.l} style={{background:"#fff",border:"1px solid #EEF2F6",borderRadius:14,padding:"18px 14px",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                    <div style={{fontSize:15,color:"#94A3B8",fontWeight:700,marginBottom:7}}>{k.l}</div>
                    <div style={{fontSize:30,fontWeight:800,color:k.c,letterSpacing:"-0.5px",wordBreak:"keep-all"}}>{k.v}</div>
                  </div>
                );})}
              </div>
              {/* 확인 필요 요약 — 한 줄 컴팩트 스트립 */}
              {(analysis.eiCheckCount+analysis.wcCheckCount+analysis.relCheckCount)>0&&(
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",padding:"12px 15px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:12,fontSize:15,color:"#92400E",fontWeight:600}}>
                  <span style={{fontSize:16}}>⚠️ 확인 필요</span>
                  <span>고용보험 {analysis.eiCheckCount}명</span><span style={{color:"#FCD34D"}}>·</span>
                  <span>산재보험 {analysis.wcCheckCount}명</span><span style={{color:"#FCD34D"}}>·</span>
                  <span>특수관계자·임원 {analysis.relCheckCount}명</span>
                </div>
              )}

              {/* 기준일 + 다시 올리기 */}
              <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap"}}>
                <div>
                  <label style={labS}>나이 계산 기준일</label>
                  <input type="date" value={stBase[0]} onChange={function(e){stBase[1](e.target.value);}} style={Object.assign({},inpS,{width:"auto"})}/>
                </div>
                <div>
                  <label style={labS}>귀속연도</label>
                  <input type="number" value={stYear[0]} onChange={function(e){stYear[1](Number(e.target.value)||stYear[0]);}} style={Object.assign({},inpS,{width:110})}/>
                </div>
                <button onClick={reset} style={Object.assign({},btnS,{padding:"9px 14px",fontSize:15.5})}>↻ 다른 명부 올리기</button>
              </div>

              {/* 추가 입력 카드 (E: 전년/올해 구분 · F: 소재지) — Toss 스타일: 기본 접힘 */}
              <details style={{borderRadius:14,border:"1px solid #E2E8F0",background:"#F8FAFC",overflow:"hidden"}}>
                <summary style={{cursor:"pointer",padding:"15px 16px",fontSize:20.5,fontWeight:800,color:"#1E293B",listStyle:"none"}}>➕ 통합고용세액공제 입력 <span style={{fontSize:17,fontWeight:600,color:"#94A3B8"}}>(전년도·소재지 입력 → 펼치기)</span></summary>
              <div style={{background:"#F8FAFC",padding:"0 16px 18px"}}>

                {/* 소재지: 수도권/비수도권 세그먼트 (H) */}
                <div style={{marginBottom:14}}>
                  <label style={labS}>사업장 소재지</label>
                  <div style={{display:"inline-flex",border:"1.5px solid #E2E8F0",borderRadius:10,overflow:"hidden"}}>
                    {[["metro","수도권 (서울·경기·인천)"],["local","비수도권 / 지방"]].map(function(o){var on=stRegion[0]===o[0];return(
                      <button key={o[0]} type="button" onClick={function(){stRegion[1](o[0]);}} style={{padding:"10px 16px",fontSize:18,fontWeight:800,border:"none",background:on?"#0F766E":"#fff",color:on?"#fff":"#475569",cursor:"pointer",fontFamily:FF}}>{o[1]}</button>
                    );})}
                  </div>
                  <div style={{fontSize:15.5,color:"#64748B",marginTop:7,lineHeight:1.6}}>통합고용세액공제 예상 검토는 사업장 소재지에 따라 달라질 수 있습니다. 이번 단계에서는 <strong>수도권/비수도권</strong> 기준으로 1차 검토합니다. (경기도 시흥시는 수도권) <span style={{color:"#B45309"}}>금액 단가는 최신 법령 확인 필요·직접 수정 가능</span></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,marginBottom:14}}>
                  <div><label style={labS}>기업 구분</label>
                    <select value={stSize[0]} onChange={function(e){stSize[1](e.target.value);}} style={inpS}>
                      <option value="sme">중소기업</option><option value="mid">중견기업</option><option value="other">기타/확인 필요</option>
                    </select></div>
                  <div><label style={labS}>업종</label>
                    <select value={stIndustry[0]} onChange={function(e){stIndustry[1](e.target.value);}} style={inpS}>
                      <option value="normal">일반 업종</option><option value="excluded">소비성 서비스업 등 제외 가능성</option><option value="check">확인 필요</option>
                    </select></div>
                </div>

                {/* 전년도(블루) / 올해(그린) 구분 */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                  <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,padding:"13px 14px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1D4ED8",marginBottom:9}}>전년도 (직접 입력)</div>
                    <label style={labS}>전년도 평균 상시근로자 수 <span style={{color:"#94A3B8",fontWeight:500}}>(전체)</span></label>
                    <div style={{display:"flex",gap:6,marginBottom:9}}>
                      <input type="number" min="0" placeholder="숫자" value={stPrevTotal[0]==="unknown"?"":stPrevTotal[0]} disabled={stPrevTotal[0]==="unknown"} onChange={function(e){stPrevTotal[1](e.target.value);}} style={inpS}/>
                      <button onClick={function(){stPrevTotal[1](stPrevTotal[0]==="unknown"?"":"unknown");}} style={{flexShrink:0,padding:"0 11px",borderRadius:9,border:"1.5px solid "+(stPrevTotal[0]==="unknown"?"#1D4ED8":"#E2E8F0"),background:stPrevTotal[0]==="unknown"?"#1D4ED8":"#fff",color:stPrevTotal[0]==="unknown"?"#fff":"#64748B",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FF}}>모름</button>
                    </div>
                    <label style={labS}>전년도 청년 등 상시근로자 수</label>
                    <div style={{display:"flex",gap:6}}>
                      <input type="number" min="0" placeholder="숫자" value={stPrevYouth[0]==="unknown"?"":stPrevYouth[0]} disabled={stPrevYouth[0]==="unknown"} onChange={function(e){stPrevYouth[1](e.target.value);}} style={inpS}/>
                      <button onClick={function(){stPrevYouth[1](stPrevYouth[0]==="unknown"?"":"unknown");}} style={{flexShrink:0,padding:"0 11px",borderRadius:9,border:"1.5px solid "+(stPrevYouth[0]==="unknown"?"#1D4ED8":"#E2E8F0"),background:stPrevYouth[0]==="unknown"?"#1D4ED8":"#fff",color:stPrevYouth[0]==="unknown"?"#fff":"#64748B",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FF}}>모름</button>
                    </div>
                  </div>
                  <div style={{background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:10,padding:"13px 14px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#0F766E",marginBottom:9}}>올해 (명부 자동추정 · 수정 가능)</div>
                    <label style={labS}>올해 평균 상시근로자 수 <span style={{color:"#94A3B8",fontWeight:500}}>(전체)</span></label>
                    <input type="number" min="0" value={stCurTotal[0]} onChange={function(e){stCurTotal[1](e.target.value);}} style={Object.assign({},inpS,{marginBottom:9})}/>
                    <label style={labS}>올해 청년 등 상시근로자 수</label>
                    <input type="number" min="0" value={stCurYouth[0]} onChange={function(e){stCurYouth[1](e.target.value);}} style={inpS}/>
                  </div>
                </div>
                {/* 검증 경고 (D) */}
                {estimate.overYouth&&(
                  <div style={{marginTop:12,padding:"11px 13px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:9,fontSize:16,color:"#991B1B",fontWeight:700,lineHeight:1.7}}>
                    ⚠️ 청년 등 증가 인원({estimate.incYouth}명)이 전체 상시근로자 증가 인원({estimate.incTotal}명)보다 큽니다. 전년도 청년 수 또는 올해 상시근로자 수 입력값을 재확인하세요. (예상 공제액은 입력값 재확인 전까지 신뢰할 수 없습니다)
                  </div>
                )}
              </div>
              </details>

              {/* 탭 (G: 글자 확대 · L: 추가 확인자료) */}
              <div style={{display:"flex",gap:7,borderBottom:"2px solid #F1F5F9",flexWrap:"wrap"}}>
                {[{k:"emp",l:"직원별 진단"},{k:"subsidy",l:"지원금별 요약"},{k:"tax",l:"통합고용세액공제 예상"},{k:"total",l:"💰 총 혜택 요약"},{k:"docs",l:"추가 확인자료"}].map(function(t){var on=stTab[0]===t.k;return(
                  <button key={t.k} onClick={function(){stTab[1](t.k);}} style={{padding:"11px 16px",fontSize:20,fontWeight:800,border:"none",background:"none",color:on?"#0F766E":"#94A3B8",borderBottom:"2px solid "+(on?"#0F766E":"transparent"),marginBottom:-2,cursor:"pointer",fontFamily:FF}}>{t.l}</button>
                );})}
              </div>

              {/* 탭: 직원별 진단 */}
              {stTab[0]==="emp"&&(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:17.5}}>
                    <thead><tr style={{background:"#F8FAFC",textAlign:"left",color:"#64748B"}}>
                      {["직원명","주민(마스킹)","나이","성별","입사일","청년 추정","1차 검토 후보 / 확인 필요"].map(function(h){return <th key={h} style={{padding:"9px 10px",fontWeight:700,whiteSpace:"nowrap",borderBottom:"1px solid #E2E8F0",fontSize:17}}>{h}</th>;})}
                    </tr></thead>
                    <tbody>
                      {analysis.rows.map(function(r,idx){var e=r.emp,d=r.diag;
                        var flags=[];
                        if(d.eiNeedsCheck)flags.push("고용보험 확인 필요");
                        if(d.wcNeedsCheck)flags.push("산재보험 확인 필요");
                        if(d.onlyNpHi)flags.push("연금·건강만 가입 확인");
                        if(d.relCheck)flags.push("특수관계자·임원 여부 확인 필요");
                        return(
                        <tr key={idx} style={{borderBottom:"1px solid #F1F5F9",opacity:d.active?1:0.55}}>
                          <td style={{padding:"10px",fontWeight:700,color:"#1E293B",fontSize:19,minWidth:88}}>
                            {e.name}{!d.active&&<span style={{marginLeft:6,fontSize:14.5,color:"#94A3B8"}}>(상실 추정)</span>}
                            {flags.length>0&&<div style={{marginTop:3,fontSize:14.5,fontWeight:700,color:"#B45309",lineHeight:1.5,whiteSpace:"normal"}}>{flags.join(" · ")}</div>}
                          </td>
                          <td style={{padding:"10px",color:"#64748B",whiteSpace:"nowrap",fontFamily:"monospace",fontSize:17}}>{e.rrnMasked||"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",fontSize:18}}>{d.age!=null?d.age+"세":"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",fontSize:18}}>{e.gender==="M"?"남":e.gender==="F"?"여":"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap",color:"#475569",fontSize:17.5}}>{e.hireDate||"—"}</td>
                          <td style={{padding:"10px",whiteSpace:"nowrap"}}>{d.isYouth?<span style={{fontSize:15.5,fontWeight:800,color:"#0F766E"}}>청년 추정</span>:<span style={{color:"#CBD5E1"}}>—</span>}</td>
                          <td style={{padding:"10px"}}>
                            {d.candidates.length===0?<span style={{color:"#94A3B8",fontSize:17}}>현재 자료만으로 판단 불가</span>:(
                              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                                {d.candidates.map(function(c,ci){return(
                                  <span key={ci} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:999,background:(PD.LEVELS[c.level]||PD.LEVELS.unknown).bg,border:"1px solid "+(PD.LEVELS[c.level]||PD.LEVELS.unknown).bd}}>
                                    <span style={{fontSize:15.5,fontWeight:800,color:(PD.LEVELS[c.level]||PD.LEVELS.unknown).color}}>{PD.subsidyName(c.key)}</span>
                                  </span>
                                );})}
                              </div>
                            )}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 탭: 지원금별 요약 */}
              {stTab[0]==="subsidy"&&(
                <div style={{display:"grid",gap:10}}>
                  {analysis.subsidySummary.map(function(s){var cm=PD.CONFIDENCE_META[s.confidence]||PD.CONFIDENCE_META.more;return(
                    <div key={s.key} style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                      <div style={{flex:"1 1 260px",minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{fontSize:20.5,fontWeight:800,color:"#1E293B"}}>{s.name}</span>
                          <span style={{fontSize:14.5,fontWeight:800,padding:"2px 9px",borderRadius:999,background:cm.bg,color:cm.color,border:"1px solid "+cm.color+"33"}}>신뢰도: {cm.label}</span>
                        </div>
                        <div style={{fontSize:15.5,color:"#64748B",marginTop:5,lineHeight:1.55}}>사유: {s.confReason||s.note}</div>
                      </div>
                      <div style={{display:"flex",gap:16,flexShrink:0}}>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>후보</div><div style={{fontSize:23,fontWeight:800,color:"#1D4ED8"}}>{s.candidateCount}</div></div>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>확인 필요</div><div style={{fontSize:23,fontWeight:800,color:"#B45309"}}>{s.check}</div></div>
                        <div style={{textAlign:"center"}}><div style={{fontSize:14,color:"#94A3B8",fontWeight:700}}>추가자료</div><div style={{fontSize:23,fontWeight:800,color:"#64748B"}}>{s.more}</div></div>
                      </div>
                      <button type="button" onClick={function(e){e.preventDefault();e.stopPropagation();try{window.open(s.site,"_blank","noopener,noreferrer");}catch(err){void err;}}} style={{flexShrink:0,fontSize:15.5,fontWeight:700,color:"#0F766E",background:"#fff",border:"1px solid #99F6E4",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:FF}}>공식 안내 ↗</button>
                    </div>
                  );})}
                  <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:15.5,color:"#92400E",lineHeight:1.7}}>
                    이 결과는 4대보험 명부 기준 1차 검토입니다. 실제 신청 가능 여부는 공식 요건과 추가자료 확인이 필요합니다.
                  </div>
                  {/* 하단 큰 요약: 조건 충족 시 최대 예상 지원금 */}
                  <div style={{background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:14,padding:"18px 16px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#0F766E",marginBottom:6}}>조건 충족 시 최대 예상 지원금 총액</div>
                    <div style={{fontSize:38.5,fontWeight:800,color:"#0F766E",letterSpacing:"-0.5px"}}>{subsidyMax>0?PD.formatWon(subsidyMax):"검토 필요"}</div>
                    <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>최대 가능 추정 · 1차 (확정 아님)</div>
                  </div>
                </div>
              )}

              {/* 탭: 통합고용세액공제 예상 */}
              {stTab[0]==="tax"&&(
                <div style={{display:"grid",gap:13}}>
                  <div style={{padding:"11px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:16,color:"#991B1B",lineHeight:1.7}}>
                    ⚠️ 아래 금액은 <strong>확정 공제액이 아니라 입력값 기준 1차 추정</strong>입니다. 단가는 귀속연도별 <strong>법령표 확인이 필요</strong>하며 직접 수정할 수 있습니다. 실제 공제액은 <strong>세무대리인 검토와 최신 법령 확인</strong>이 필요합니다.
                  </div>
                  {estimate.overYouth&&(
                    <div style={{padding:"11px 14px",background:"#FFF7ED",border:"1px solid #FDBA74",borderRadius:10,fontSize:16,color:"#9A3412",fontWeight:700,lineHeight:1.7}}>
                      🔎 입력값 재확인 필요: 청년 등 증가({estimate.incYouth}명)가 전체 증가({estimate.incTotal}명)를 초과합니다. 입력값을 바로잡기 전까지 예상 공제액을 신뢰하지 마세요.
                    </div>
                  )}

                  {/* 1) 명부 기준 직원 분류 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>① 명부 기준 직원 분류</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                      {[["전체 직원",analysis.counts.totalEmp],["청년 등 추정",analysis.counts.youthCount],["일반 추정",analysis.counts.generalCount],["신규 입사 추정",analysis.counts.newHireCount]].map(function(k){return(
                        <div key={k[0]} style={{background:"#F8FAFC",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:14.5,color:"#94A3B8",fontWeight:700}}>{k[0]}</div><div style={{fontSize:21.5,fontWeight:800,color:"#1E293B"}}>{k[1]}명</div></div>
                      );})}
                    </div>
                  </div>

                  {/* 2) 예상 증가 인원 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>② 예상 증가 인원 <span style={{fontSize:14.5,color:"#94A3B8",fontWeight:600}}>(올해 − 전년)</span></div>
                    {!estimate.computable?(
                      <div style={{fontSize:15.5,color:"#B45309"}}>전년도 평균 상시근로자 수를 입력하면 증가 인원을 계산합니다. (현재 “모름” 또는 미입력)</div>
                    ):(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10}}>
                        {[["전체 증가",estimate.incTotal],["청년 등 증가",estimate.incYouth],["일반 증가",estimate.incNormal]].map(function(k){return(
                          <div key={k[0]} style={{background:"#F0FDFA",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:14.5,color:"#0F766E",fontWeight:700}}>{k[0]}</div><div style={{fontSize:21.5,fontWeight:800,color:"#0F766E"}}>{k[1]==null?"확인 필요":k[1]+"명"}</div></div>
                        );})}
                      </div>
                    )}
                  </div>

                  {/* 3) 단가 + 예상 세액공제 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:18.5,fontWeight:800,color:"#1E293B",marginBottom:4}}>③ 예상 세액공제 <span style={{fontSize:15,color:"#B45309",fontWeight:700}}>· 입력값 기준 1차 추정 · 법령표 확인 필요</span></div>
                    <div style={{fontSize:14.5,color:"#94A3B8",marginBottom:11}}>1인당 단가(만원)는 {stSize[0]==="sme"?"중소기업":stSize[0]==="mid"?"중견기업":"기타"}·{stRegion[0]==="metro"?"수도권":"지방"} 기본값입니다. 실제 귀속연도 법령표에 맞게 수정하세요.</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:13}}>
                      <div><label style={labS}>청년 등 1인당 단가(만원)</label><input type="number" min="0" value={stUnitY[0]} onChange={function(e){stUnitY[1](Number(e.target.value)||0);}} style={inpS}/></div>
                      <div><label style={labS}>일반 1인당 단가(만원)</label><input type="number" min="0" value={stUnitN[0]} onChange={function(e){stUnitN[1](Number(e.target.value)||0);}} style={inpS}/></div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
                      {[["청년 등 증가분",estimate.creditYouth],["일반 증가분",estimate.creditNormal],["총 예상 공제액",estimate.creditTotal]].map(function(k,ki){return(
                        <div key={k[0]} style={{background:ki===2?"#F5F3FF":"#F8FAFC",border:ki===2?"1px solid #DDD6FE":"1px solid #EEF2F6",borderRadius:10,padding:"12px 14px"}}>
                          <div style={{fontSize:15,color:"#94A3B8",fontWeight:700}}>{k[0]}</div>
                          <div style={{fontSize:ki===2?22:19,fontWeight:800,color:ki===2?"#7C3AED":"#1E293B"}}>{estimate.overYouth?"입력값 재확인":(k[1]==null?"검토 필요":PD.formatWon(k[1]))}</div>
                        </div>
                      );})}
                    </div>
                    <div style={{marginTop:10,fontSize:15.5,fontWeight:700,color:"#DC2626"}}>※ 확정 아님 / 입력값 기준 1차 추정 / 세무 검토 필요</div>
                  </div>

                  {/* 4) 확인 필요 체크리스트 */}
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"13px 15px"}}>
                    <div style={{fontSize:17,fontWeight:800,color:"#1E293B",marginBottom:9}}>④ 확인 필요 체크리스트</div>
                    <div style={{display:"grid",gap:6}}>
                      {PD.TAX_CHECKLIST.map(function(t){return(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#475569"}}><span>⬜</span><span>{t}</span></div>
                      );})}
                    </div>
                  </div>
                  {/* 하단 강조: 총 예상 공제액 재강조 */}
                  <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:14,padding:"18px 16px",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:"#7C3AED",marginBottom:6}}>총 예상 세액공제액</div>
                    <div style={{fontSize:38.5,fontWeight:800,color:"#7C3AED",letterSpacing:"-0.5px"}}>{estimate.overYouth?"입력값 재확인 필요":(estimate.computable&&estimate.creditTotal!=null?PD.formatWon(estimate.creditTotal):"전년도 인원 입력 후 산출")}</div>
                    <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>입력값 기준 1차 추정 · 확정 아님 / 세무 검토 필요</div>
                  </div>
                </div>
              )}

              {/* 탭: 총 혜택 요약 (영업용) */}
              {stTab[0]==="total"&&(
                <div style={{display:"grid",gap:16}}>
                  <div style={{fontSize:18,color:"#64748B",lineHeight:1.7,textAlign:"center"}}>조건이 모두 충족됐을 때 받을 수 있는 <strong>최대 예상 혜택</strong>을 한눈에 보여줍니다. (최대 가능 추정 · 1차)</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
                    <div style={{background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:"#0F766E",marginBottom:8}}>최대 예상 지원금</div>
                      <div style={{fontSize:36,fontWeight:800,color:"#0F766E",letterSpacing:"-0.5px"}}>{subsidyMax>0?PD.formatWon(subsidyMax):"검토 필요"}</div>
                      <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>1차 검토 후보 기준 최대 가능 추정</div>
                    </div>
                    <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:"#7C3AED",marginBottom:8}}>최대 예상 세액공제</div>
                      <div style={{fontSize:36,fontWeight:800,color:"#7C3AED",letterSpacing:"-0.5px"}}>{creditMax>0?PD.formatWon(creditMax):(estimate.overYouth?"입력값 재확인":"검토 필요")}</div>
                      <div style={{fontSize:15,color:"#94A3B8",marginTop:6}}>통합고용세액공제 입력값 기준 추정</div>
                    </div>
                  </div>
                  <div style={{background:"linear-gradient(90deg,#0F766E,#0EA5A0)",borderRadius:16,padding:"26px 18px",textAlign:"center",boxShadow:"0 4px 16px rgba(15,118,110,0.25)"}}>
                    <div style={{fontSize:20.5,fontWeight:800,color:"#CCFBF1",marginBottom:8}}>최대 예상 총 혜택</div>
                    <div style={{fontSize:50.5,fontWeight:800,color:"#fff",letterSpacing:"-1px",lineHeight:1.1,wordBreak:"keep-all"}}>{totalBenefit>0?PD.formatWon(totalBenefit):"추가 입력·검토 필요"}</div>
                    <div style={{fontSize:17,color:"#99F6E4",marginTop:10,fontWeight:600}}>지원금 + 세액공제 합산 (최대 가능 추정)</div>
                  </div>
                  <div style={{fontSize:15,color:"#94A3B8",textAlign:"center",lineHeight:1.7}}>실제 지원 가능 여부와 금액은 추가자료 및 요건 확인 후 달라질 수 있습니다. (확정 금액 아님)</div>
                </div>
              )}

              {/* 탭: 추가 확인자료 (L) */}
              {stTab[0]==="docs"&&(
                <div style={{display:"grid",gap:13}}>
                  <div style={{padding:"11px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10,fontSize:16,color:"#1D4ED8",lineHeight:1.7}}>
                    아래 자료를 확보하면 1차 검토 후보를 실제 신청 가능 여부로 좁힐 수 있습니다. 상담 시 대표님께 요청할 목록입니다.
                  </div>
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:19,fontWeight:800,color:"#1E293B",marginBottom:4}}>공통 추가 확인자료</div>
                    <div style={{fontSize:15.5,color:"#94A3B8",marginBottom:10}}>요건에 따라 필요할 수 있는 자료입니다(확정 필수서류 아님).</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:7}}>
                      {PD.EMP_DOC_CHECKLIST.map(function(t){return(
                        <div key={t} style={{display:"flex",alignItems:"center",gap:8,fontSize:17,color:"#475569"}}><span>⬜</span><span>{t}</span></div>
                      );})}
                    </div>
                  </div>
                  <div style={{border:"1px solid #EEF2F6",borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:19,fontWeight:800,color:"#1E293B",marginBottom:10}}>지원금별 확인자료 <span style={{fontSize:15,color:"#94A3B8",fontWeight:600}}>(요건에 따라 필요할 수 있음)</span></div>
                    <div style={{display:"grid",gap:10}}>
                      {analysis.subsidySummary.filter(function(s){return s.candidateCount>0||s.more>0;}).map(function(s){return(
                        <div key={s.key} style={{background:"#F8FAFC",borderRadius:10,padding:"11px 13px"}}>
                          <div style={{fontSize:17.5,fontWeight:800,color:"#1E293B",marginBottom:5}}>{s.name}</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                            {(s.docs||[]).map(function(dn){return <span key={dn} style={{fontSize:15,color:"#475569",background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"4px 9px"}}>📄 {dn}</span>;})}
                          </div>
                        </div>
                      );})}
                      {analysis.subsidySummary.filter(function(s){return s.candidateCount>0||s.more>0;}).length===0&&(
                        <div style={{fontSize:16,color:"#94A3B8"}}>표시할 후보가 없습니다. 명부 정리에서 직원 정보를 보완해 보세요.</div>
                      )}
                    </div>
                  </div>
                  {(analysis.eiCheckCount>0||analysis.wcCheckCount>0)&&(
                    <div style={{padding:"11px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:16,color:"#991B1B",lineHeight:1.7}}>
                      고용보험 확인 필요 {analysis.eiCheckCount}명 · 산재보험 확인 필요 {analysis.wcCheckCount}명. 고용·산재 미가입/확인 불가 직원은 <strong>대표자·임원·특수관계자 여부</strong>와 <strong>고용보험 피보험자격</strong>을 먼저 확인하세요.
                    </div>
                  )}
                </div>
              )}

              {/* CTA + 단계 이동(A) */}
              <div style={{borderTop:"1px solid #F1F5F9",paddingTop:14,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={function(){stStep[1](3);}} style={Object.assign({},btnS,{padding:"11px 16px",fontSize:17})}>← 명부 정리로 돌아가기</button>
                <button onClick={doCopy} style={Object.assign({},btnP,{background:stCopied[0]?"#059669":"#0F766E",padding:"12px 20px",fontSize:18.5})}>{stCopied[0]?"✓ 복사됨 (주민번호 미포함)":"📋 상담용 요약 복사"}</button>
                <button onClick={function(){toast("고객 보고서 반영·업체 임시저장·PDF 내보내기는 다음 단계로 준비 중입니다.","success");}} style={Object.assign({},btnS,{padding:"11px 18px",fontSize:17,color:"#94A3B8"})}>🗂️ 보고서 반영·저장·PDF (다음 단계)</button>
                <span style={{fontSize:14.5,color:"#94A3B8",marginLeft:"auto"}}>분석은 브라우저에서만 처리 · 저장되지 않음</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </React.Fragment>
  );
}

function Dashboard(props){
  var st1=useState("all"),st2=useState(false); var selectedCompanyId=st1[0];
  // ── 업체 목록 검색·정렬·필터 (컴팩트 리스트) ──────────────
  var stCoQ=useState(""),stCoSort=useState("name"),stCoFilter=useState("all");
  // 업체별 파생 지표를 한 번만 계산해 정렬/필터/렌더에서 재사용 (수십~수백 개 대비)
  var companyRows=useMemo(function(){
    return props.companies.map(function(c){
      var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      var rcv=props.employees.filter(function(e){return e.companyId===c.id;}).reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
      var upcoming=0;
      emps.forEach(function(e){var p=props.programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var d=getDday(addMo(e.startDate,r.month));if(d!==null&&d<=7)upcoming++;});});
      var yrs=companyYears(c);
      // 엑셀 가져오기 등에서 표시한 '확인 필요' 건수 (업체 reviewIssues + 직원 reviewIssues/지원금 미지정)
      var reviewCnt=Array.isArray(c.reviewIssues)?c.reviewIssues.length:(c.reviewNeeded?1:0);
      emps.forEach(function(e){
        var n=Array.isArray(e.reviewIssues)?e.reviewIssues.length:(e.reviewNeeded?1:0);
        if(n===0&&(!e.programId||!props.programs[e.programId]))n=1; // 지원금 미지정도 확인 대상
        reviewCnt+=n;
      });
      return{c:c,targetCount:emps.length,rcv:rcv,upcoming:upcoming,reviewCnt:reviewCnt,
        totalEmp:Number(c.empCount)||0,
        progShorts:companyProgramShorts(emps,props.programs),
        yearsNum:(typeof yrs==="number")?yrs:-1,
        yearsText:yrs===null?"업력 미입력":yrs==="invalid"?"업력 확인 필요":"업력 "+yrs+"년차",
        region:shortAddr(c.addr)};
    });
  },[props.companies,props.employees,props.programs]);
  var companyRowsView=useMemo(function(){
    var rows=companyRows;
    var q=stCoQ[0].trim().toLowerCase();
    if(q)rows=rows.filter(function(r){return String(r.c.name||"").toLowerCase().indexOf(q)>=0||String(r.c.bizNo||"").indexOf(q)>=0||String(r.c.ceoName||"").toLowerCase().indexOf(q)>=0;});
    var f=stCoFilter[0];
    if(f==="corp")rows=rows.filter(function(r){return r.c.corpType==="법인";});
    else if(f==="indiv")rows=rows.filter(function(r){return r.c.corpType==="개인";});
    else if(f==="upcoming")rows=rows.filter(function(r){return r.upcoming>0;});
    else if(f==="noprog")rows=rows.filter(function(r){return r.progShorts.length===0;});
    else if(f==="zero")rows=rows.filter(function(r){return r.targetCount===0;});
    else if(f==="sample")rows=rows.filter(function(r){return !!r.c.isSample;});
    var s=stCoSort[0];
    var out=rows.slice();
    function byName(a,b){return byCompanyName(a.c,b.c);}
    if(s==="targets")out.sort(function(a,b){return b.targetCount-a.targetCount||byName(a,b);});
    else if(s==="emps")out.sort(function(a,b){return b.totalEmp-a.totalEmp||byName(a,b);});
    else if(s==="received")out.sort(function(a,b){return b.rcv-a.rcv||byName(a,b);});
    else if(s==="upcoming")out.sort(function(a,b){return b.upcoming-a.upcoming||byName(a,b);});
    else if(s==="newest")out.sort(function(a,b){return String(b.c.createdAt||"").localeCompare(String(a.c.createdAt||""))||byName(a,b);});
    else if(s==="yearsDesc")out.sort(function(a,b){return b.yearsNum-a.yearsNum||byName(a,b);});
    else out.sort(byName);
    return out;
  },[companyRows,stCoQ[0],stCoSort[0],stCoFilter[0]]);
  // 보기 밀도 토글 제거 — PC는 항상 '넓게(가독성 우선)' 기준. 폰트 스케일은 CSS 변수로 처리.
  var fE=useMemo(function(){return st1[0]==="all"?props.employees:props.employees.filter(function(e){return e.companyId===st1[0];});},[props.employees,st1[0]]);
  var stats=useMemo(function(){var tE=0,tR=0,dT=0,dD=0,sc={};STS.forEach(function(s){sc[s.key]=0;});fE.forEach(function(e){if(sc[e.status]!==undefined)sc[e.status]++;var p=props.programs[e.programId];if(p)tE+=p.totalAmount||0;(e.rounds||[]).forEach(function(r){if(r.isPaid)tR+=r.received||0;});(e.employeeDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});(st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];})).forEach(function(c){(c.companyDocs||[]).forEach(function(d){dT++;if(d.done)dD++;});});return{tE:tE,tR:tR,pct:dT>0?Math.round(dD/dT*100):0,sc:sc};},[props.companies,fE,props.programs,st1[0]]);
  // 추세/요약 메트릭 + 업무 브리핑(지연·임박·서류·위험금액)
  var metrics=useMemo(function(){
    var now=new Date(); var curY=now.getFullYear(), curM=now.getMonth();
    var spark=[]; var monthsKeys=[];
    for(var k=5;k>=0;k--){var d=new Date(curY,curM-k,1);monthsKeys.push({y:d.getFullYear(),m:d.getMonth()});spark.push(0);}
    var thisMonthExpected=0, overdueAmount=0, overdueCount=0, next7=0, next7Count=0, next30=0, next30Count=0;
    var overdueList=[], next7List=[];
    function cName(cid){var c=props.companies.find(function(x){return x.id===cid;});return c?c.name:"";}
    fE.forEach(function(e){
      var p=props.programs[e.programId];
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid){ if(r.paidDate){var pd=new Date(r.paidDate);monthsKeys.forEach(function(mk,idx){if(pd.getFullYear()===mk.y&&pd.getMonth()===mk.m)spark[idx]+=r.received||0;});} return; }
        if(!e.startDate)return; var amt=r.expectedAmount||r.amount||0; var ed=addMo(e.startDate,r.month); var edd=new Date(ed); var dd=getDday(ed);
        if(edd.getFullYear()===curY&&edd.getMonth()===curM)thisMonthExpected+=amt;
        if(dd!==null&&dd<0){overdueAmount+=amt;overdueCount++;overdueList.push({empName:e.name,companyId:e.companyId,companyName:cName(e.companyId),programName:p?p.name:"",roundLabel:r.label,dd:dd,amount:amt});}
        else if(dd!==null&&dd<=7){next7+=amt;next7Count++;next7List.push({empName:e.name,companyId:e.companyId,companyName:cName(e.companyId),programName:p?p.name:"",roundLabel:r.label,dd:dd,amount:amt});}
        if(dd!==null&&dd>=0&&dd<=30){next30+=amt;next30Count++;}
      });
    });
    overdueList.sort(function(a,b){return a.dd-b.dd;});
    next7List.sort(function(a,b){return a.dd-b.dd;});
    var docMissingCount=0; var docCompSet={};
    fE.forEach(function(e){(e.employeeDocs||[]).forEach(function(d){if(!d.done){docMissingCount++;docCompSet[e.companyId]=1;}});});
    var compScope=st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];});
    compScope.forEach(function(c){(c.companyDocs||[]).forEach(function(d){if(!d.done){docMissingCount++;docCompSet[c.id]=1;}});});
    var lastIdx=spark.length-1; var thisR=spark[lastIdx]||0; var lastR=spark[lastIdx-1]||0;
    var trend=lastR>0?Math.round((thisR-lastR)/lastR*100):(thisR>0?100:null);
    return{spark:spark,thisMonthExpected:thisMonthExpected,overdueAmount:overdueAmount,overdueCount:overdueCount,next7:next7,next7Count:next7Count,next7List:next7List,next30:next30,next30Count:next30Count,trend:trend,thisMonthReceived:thisR,overdueList:overdueList,docMissingCount:docMissingCount,docMissingCompanies:Object.keys(docCompSet).length,riskAmount:overdueAmount+next7};
  },[fE,props.companies,props.programs,st1[0]]);

  // 수수료 요약 (업체별 commission 집계)
  var commSummary=useMemo(function(){
    var thisMonthFee=0,unbilled=0,unpaid=0,collected=0;
    var now=new Date(),cy=now.getFullYear(),cm=now.getMonth();
    (st1[0]==="all"?props.companies:props.companies.filter(function(c){return c.id===st1[0];})).forEach(function(c){
      var cc=c.commission||{}; var rate=cc.rate!=null?cc.rate:20; var ret=cc.retainer||0; var useS=cc.successFee!==false;
      var emps=props.employees.filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      var rcv=0,monthExp=0;
      emps.forEach(function(e){(e.rounds||[]).forEach(function(r){
        if(r.isPaid){rcv+=r.received||0;return;}
        if(!e.startDate)return; var ed=new Date(addMo(e.startDate,r.month));
        if(ed.getFullYear()===cy&&ed.getMonth()===cm)monthExp+=r.expectedAmount||r.amount||0;
      });});
      var billable=Math.round(ret+(useS?rcv*rate/100:0));
      thisMonthFee+=Math.round(monthExp*rate/100);
      if(cc.paid)collected+=billable; else if(cc.billed)unpaid+=billable; else if(billable>0)unbilled+=billable;
    });
    return{thisMonthFee:thisMonthFee,unbilled:unbilled,unpaid:unpaid,collected:collected};
  },[props.companies,props.employees,st1[0]]);
  var activeCount=fE.filter(function(e){return e.status!=="resigned";}).length;
  var cards=[
    {l:"관리 업체",v:st1[0]==="all"?props.companies.length:1,u:"개",i:"🏢",c:"#0F172A",extra:"progress",prog:null},
    {l:"지원 대상자",v:activeCount,u:"명",i:"👤",c:"#0F172A"},
    {l:"서류 완료율",v:stats.pct,u:"%",i:"📋",c:"#0F172A",bar:"#2563EB",extra:"bar"},
    {l:"누적 수령액",v:fManS(stats.tR),u:"원",i:"✅",c:"#059669",extra:"spark"},
    {l:"수령 예정액",v:fManS(stats.tE),u:"원",i:"💰",c:"#1D4ED8"}
  ];
  var starredCompanies=props.companies.filter(function(c){return(c.tags||[]).includes("star");});
  function handleExcelCopy(){var data=makeExcelData(props.companies,props.employees,props.programs);navigator.clipboard.writeText(data).then(function(){st2[1](true);setTimeout(function(){st2[1](false);},2000);toast("엑셀용 데이터가 복사되었습니다.","success");});}

  // ── 무료체험 요약 패널 (우측 보조 패널 · X로 닫기 · 브라우저별 유지) ──
  // TODO(확장): 무료체험 만료 임박(예: trialDaysLeft<=3) 시에는 dismissed 여부와
  // 무관하게 패널을 다시 노출하는 조건을 여기에 추가할 수 있음.
  var stTrialPanel=useState(function(){try{return localStorage.getItem("hrSubsidyPro_trialPanelDismissed")==="1";}catch(e){return false;}});
  var trialAsideRef=useRef(null);
  function dismissTrialPanel(){
    try{localStorage.setItem("hrSubsidyPro_trialPanelDismissed","1");}catch(e){}
    var el=trialAsideRef.current;
    if(el){ // 너비를 부드럽게 0으로 줄인 뒤 제거 → 본문이 자연스럽게 가운데로 복귀
      el.style.transition="width 0.25s ease, opacity 0.25s ease";
      el.style.overflow="hidden";
      el.style.width="0px";
      el.style.opacity="0";
      setTimeout(function(){stTrialPanel[1](true);},260);
    }else{stTrialPanel[1](true);}
  }
  // 관리자 계정은 SubsidyApp 에서 isTrial=false 로 내려오므로 여기서 자동 제외됨
  var showTrialPanel=props.mode!=="list"&&props.isTrial&&props.companies.length>0&&!stTrialPanel[0];
  var trialInfo=null;
  if(showTrialPanel){
    var tiActive=props.employees.filter(function(e){return e.status!=="resigned";}).length;
    var tiSched=0;props.employees.forEach(function(e){(e.rounds||[]).forEach(function(r){if(!r.isPaid&&e.startDate)tiSched++;});});
    trialInfo={comp:props.companies.length,emp:tiActive,expect:stats.tE,sched:tiSched};
  }

  return(<div className="fade-in" style={{display:"flex",gap:20,alignItems:"flex-start"}}>
    <div style={{flex:1,minWidth:0}}>
    {props.mode==="stats"&&(
      <StarterGuide
        onExcel={function(){props.setView&&props.setView("company");}}
        onPrograms={function(){props.setView&&props.setView("programs");}}
        onKanban={function(){props.setView&&props.setView("kanban");}}
        onReport={function(){if(props.companies.length>0)props.goCompany(props.companies[0].id);else if(props.setView)props.setView("company");}}
      />
    )}
    {props.mode!=="stats"&&<GlobalSearch employees={props.employees} companies={props.companies} goCompany={props.goCompany}/>}

    {/* 무료체험 요약 — 중간/모바일 화면용 한 줄 배지 (PC에서는 우측 패널로 표시) */}
    {showTrialPanel&&trialInfo&&(
      <div className="trial-inline" style={{display:"none",alignItems:"center",gap:8,flexWrap:"wrap",padding:"9px 12px",marginBottom:12,background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:10}}>
        <span style={{fontSize:12,fontWeight:800,color:"#0F766E",background:"#CCFBF1",borderRadius:999,padding:"2px 9px",whiteSpace:"nowrap"}}>🗓️ {accessPeriodLabel({role:props.accessRole,expires_at:props.accessExpiresAt},props.isAdmin).text}</span>
        <span style={{fontSize:12.5,color:"#115E59",fontWeight:600}}>업체 {trialInfo.comp} · 대상자 {trialInfo.emp} · 예상 {fMan(trialInfo.expect)} · 일정 {trialInfo.sched}건</span>
        <button onClick={props.onOpenBilling||function(){}} style={{marginLeft:"auto",background:"#0F766E",color:"#fff",border:"none",borderRadius:7,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"}}>요금제</button>
        <button onClick={dismissTrialPanel} title="닫기" style={{background:"none",border:"none",color:"#14B8A6",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
      </div>
    )}

    {/* ── 핵심 KPI 브리핑 (4-Card Executive View) ── */}
    {props.mode!=="list"&&props.companies.length>0&&(function(){
      var now=new Date();
      var dstr=now.getFullYear()+"."+(now.getMonth()+1)+"."+now.getDate();
      var hasOverdue=metrics.overdueCount>0;
      // 순서: 신청가능 → 지연 → 서류미완료 → 수령액 (대표가 5초 안에 파악하는 순서)
      var brief=[
        {icon:"💰",label:"이번 달 신청 가능",val:fMan(metrics.thisMonthExpected),sub:"30일 내 "+metrics.next30Count+"건 · "+fMan(metrics.next30),bg:"#1D4ED8",btn:"일정 확인",btnKind:"ghost",on:function(){props.setView&&props.setView("kanban");}},
        {icon:"🚨",label:"지연 신청",val:metrics.overdueCount+"건",sub:hasOverdue?fMan(metrics.overdueAmount)+" 기한 초과":"기한 내 모두 정상 ✓",bg:"#DC2626",badge:hasOverdue?"지연":null,btn:hasOverdue?"지금 처리":null,btnKind:"cta",on:function(){if(metrics.overdueList[0])props.goCompany(metrics.overdueList[0].companyId);}},
        {icon:"📁",label:"서류 미완료",val:metrics.docMissingCount+"건",sub:metrics.docMissingCount>0?metrics.docMissingCompanies+"개 업체 보완 필요":"모든 서류 완료 ✓",bg:"#334155",btn:metrics.docMissingCount>0?"서류 확인":null,btnKind:"ghost",on:function(){if(props.setView)props.setView("company");}},
        {icon:"✅",label:"이번 달 수령",val:fManS(metrics.thisMonthReceived),unit:"원",sub:metrics.trend!=null?(metrics.trend>=0?"▲":"▼")+" "+Math.abs(metrics.trend)+"% 전월 대비":"전월 비교 없음",bg:"#059669",spark:true}
      ];
      return(
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:27,fontWeight:800,color:"#0F172A",letterSpacing:"-0.6px"}}>이번 달 업무 현황</span>
              <span style={{fontSize:14.5,color:"#94A3B8",fontWeight:500}}>{dstr} 기준 · 한눈에 보는 핵심 지표</span>
            </div>
          </div>
          <div className="brief-grid">
            {brief.map(function(b,i){
              var btnCta={marginTop:12,alignSelf:"flex-start",background:"#fff",color:b.bg,border:"none",borderRadius:8,padding:"8px 16px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:FF};
              var btnGhost={marginTop:12,alignSelf:"flex-start",background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.35)",borderRadius:8,padding:"7px 14px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF};
              return(
              <div key={i} className="hover-card brief-card" style={{background:b.bg,border:"none",borderRadius:18,padding:"22px 24px",display:"flex",flexDirection:"column",minHeight:158,boxShadow:"0 6px 20px rgba(15,23,42,0.12)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <span className="brief-icon" style={{fontSize:19,flexShrink:0,width:36,height:36,borderRadius:11,background:"rgba(255,255,255,0.18)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{b.icon}</span>
                  <span className="brief-label" style={{fontSize:15.5,fontWeight:600,color:"rgba(255,255,255,0.92)",flex:1}}>{b.label}</span>
                  {b.badge&&<span style={{fontSize:11.5,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.22)",padding:"4px 11px",borderRadius:999}}>{b.badge}</span>}
                </div>
                <div className="brief-num" style={{fontSize:50,fontWeight:800,color:"#fff",letterSpacing:"-1.2px",lineHeight:1.02}}>
                  {b.val}{b.unit&&<span className="brief-num-unit" style={{fontSize:23,opacity:0.80,marginLeft:4}}>{b.unit}</span>}
                </div>
                <div className="brief-sub" style={{fontSize:14.5,color:"rgba(255,255,255,0.82)",marginTop:8,fontWeight:500,flex:1,lineHeight:1.45}}>{b.sub}</div>
                {b.spark&&<div className="brief-spark" style={{marginTop:8}}><Sparkline data={metrics.spark} width={120} height={22} color="rgba(255,255,255,0.75)"/></div>}
                {b.btn&&<button onClick={b.on} className="brief-btn" style={b.btnKind==="cta"?btnCta:btnGhost}>{b.btn} →</button>}
              </div>
            );})}
          </div>
        </div>
      );
    })()}

    {/* ── 즉시 확인 필요 (기한 경과) — 무료체험 요약은 우측 패널로 이동 ── */}
    {props.mode!=="list"&&metrics.overdueCount>0&&(function(){
      var overdueBlock=(
        <div style={{borderRadius:16,overflow:"hidden",background:"#fff",border:"1px solid #FCD9D9",borderLeft:"4px solid #DC2626",boxShadow:"0 2px 10px rgba(220,38,38,0.08)"}}>
          <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:"#FEF4F4",borderBottom:"1px solid #FCE4E4"}}>
            <span style={{fontSize:17}}>🚨</span>
            <span style={{fontSize:16,fontWeight:800,color:"#B91C1C"}}>즉시 확인 필요 — 기한 경과 {metrics.overdueCount}건</span>
            <span style={{marginLeft:"auto",fontSize:"var(--fs-badge)",fontWeight:800,color:"#fff",background:"#DC2626",borderRadius:999,padding:"4px 12px"}}>예상 {fMan(metrics.overdueAmount)} 위험</span>
          </div>
          <div style={{padding:"4px 8px"}}>
            {metrics.overdueList.slice(0,4).map(function(o,i){return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 10px",borderRadius:10,borderBottom:i<Math.min(3,metrics.overdueList.length-1)?"1px solid #F3F4F6":"none"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>{o.empName}</span>
                    <span style={{fontSize:"var(--fs-meta)",color:"#94A3B8"}}>{o.companyName}</span>
                  </div>
                  <div style={{fontSize:"var(--fs-meta)",color:"#64748B",marginTop:2}}>{o.programName} {o.roundLabel} · <strong style={{color:"#DC2626"}}>{Math.abs(o.dd)}일 지연</strong> · <strong style={{color:"#334155"}}>{fMan(o.amount)}</strong></div>
                </div>
                <button onClick={function(){props.goCompany(o.companyId);}} className="prog-tap" style={{flexShrink:0,background:"#DC2626",color:"#fff",border:"none",borderRadius:9,padding:"8px 15px",fontSize:"var(--fs-btn)",fontWeight:800,cursor:"pointer",fontFamily:FF}}>처리 →</button>
              </div>
            );})}
            {metrics.overdueList.length>4&&<div style={{textAlign:"center",padding:"9px 0",fontSize:"var(--fs-meta)",color:"#94A3B8"}}>외 {metrics.overdueList.length-4}건 더 — 진행 보드에서 전체 확인</div>}
          </div>
        </div>
      );
      return(
        <div className="dash-parallel" style={{marginBottom:18}}>
          {overdueBlock}
        </div>
      );
    })()}

    {/* accordion 첫 사용자 안내 (보조 문구 · 작게) */}
    {props.mode!=="list"&&props.companies.length>0&&(
      <div style={{textAlign:"right",fontSize:12,color:"#94A3B8",margin:"0 4px 6px"}}>각 항목을 클릭하면 상세 내용을 확인할 수 있습니다.</div>
    )}

    {props.mode!=="list"&&<DdayAlerts employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} settings={props.settings}/>}

    {props.mode!=="stats"&&starredCompanies.length>0&&(<Card style={{padding:"14px 18px",marginBottom:16}}><div style={{fontSize:18,fontWeight:700,marginBottom:8}}>⭐ 즐겨찾기</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{starredCompanies.map(function(c){return <button key={c.id} className="hover-lift" onClick={function(){props.goCompany(c.id);}} style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0",fontSize:17})}>{c.name}</button>;})}</div></Card>)}

    {props.mode!=="list"&&props.companies.length>0&&<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}><select style={Object.assign({},inp,{width:"auto",minWidth:180,fontSize:19,fontWeight:600})} value={st1[0]} onChange={function(e){st1[1](e.target.value);}}><option value="all">📊 전체 업체</option>{props.companies.map(function(c){return <option key={c.id} value={c.id}>🏢 {c.name}</option>;})}</select><button onClick={handleExcelCopy} className="hover-lift" style={Object.assign({},btnSm,{background:"#fff",color:"#475569",border:"1px solid #E2E8F0"})}>📋 엑셀용 데이터 복사</button>{st2[0]&&<span style={{fontSize:17,color:"#059669"}}>✅ 복사됨</span>}</div>}

    {/* [+] 보조 지표 — 기본 접힘 (클릭 시 펼침) */}
    {props.mode!=="list"&&props.companies.length>0&&(
      <DashGroup id="aux" icon="📊" title="보조 지표" summary={"지표 "+(cards.length+((props.tier&&props.tier.feat.commission)?4:0))+"개"}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
          {cards.map(function(c,i){return(
          <Card key={i} className="kpi-card" style={{padding:"16px 18px",border:"1px solid #F1F5F9"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600}}>{c.l}</span>
              <span style={{fontSize:16,width:30,height:30,borderRadius:8,background:"#F8FAFC",display:"flex",alignItems:"center",justifyContent:"center"}}>{c.i}</span>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
              <div><span style={{fontSize:28,fontWeight:800,color:c.c}}>{c.v}</span><span style={{fontSize:"var(--fs-label)",color:"#94A3B8",marginLeft:3}}>{c.u}</span></div>
              {c.extra==="spark"&&<Sparkline data={metrics.spark} width={60} height={22} color="#059669"/>}
            </div>
            {c.extra==="bar"&&<div style={{height:5,background:"#F1F5F9",borderRadius:3,overflow:"hidden",marginTop:10}}><div style={{height:"100%",width:c.v+"%",background:c.bar||"#2563EB",borderRadius:3,transition:"width 0.5s ease"}}/></div>}
          </Card>);})}
        </div>
        {props.tier&&props.tier.feat.commission&&(
          <div style={{marginTop:18}}>
            <div style={{fontSize:15,fontWeight:700,color:"#0F172A",marginBottom:10}}>🧾 수수료 현황</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
              {[
                {l:"이번 달 예상 수수료",v:fMan(commSummary.thisMonthFee),c:"#1D4ED8",accent:null},
                {l:"미청구 수수료",v:fMan(commSummary.unbilled),c:commSummary.unbilled>0?"#0F172A":"#94A3B8",accent:null},
                {l:"미입금 수수료",v:fMan(commSummary.unpaid),c:commSummary.unpaid>0?"#DC2626":"#94A3B8",accent:commSummary.unpaid>0?"#DC2626":null},
                {l:"누적 수수료",v:fMan(commSummary.collected),c:"#059669",accent:null}
              ].map(function(c,i){return(
                <div key={i} className="kpi-card" style={{background:"#F8FAFC",borderRadius:14,padding:"15px 16px",border:"1px solid #E5EAF0",borderLeft:c.accent?("3px solid "+c.accent):"1px solid #E5EAF0"}}>
                  <div style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600,marginBottom:6}}>{c.l}</div>
                  <div style={{fontSize:22,fontWeight:800,color:c.c}}>{c.v}</div>
                </div>
              );})}
            </div>
          </div>
        )}
      </DashGroup>
    )}

    {/* 업체 목록 (list 모드) */}
    {props.mode!=="stats"&&(props.companies.length===0?(
      <EmptyState icon="🏢" title="아직 등록된 업체가 없습니다" desc="첫 번째 거래처를 등록하고 직원·지원금·서류를 한 곳에서 관리해보세요. 등록 즉시 D-Day 알림과 수령 현황이 자동 집계됩니다." actionLabel="+ 첫 업체 등록하기" action={props.onAddCompany}/>
    ):(<Card style={{padding:0,marginBottom:16,border:"1px solid #E2E8F0",overflow:"hidden"}}>
      {/* 패널 헤더: 검색 · 정렬 · 필터 · 엑셀 (큰 리스트 박스 상단에 정돈) */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",padding:"15px 20px",borderBottom:"1px solid #EDF2F7",background:"#FAFBFC"}}>
        <input value={stCoQ[0]} onChange={function(e){stCoQ[1](e.target.value);}} placeholder="🔍 업체명·사업자번호·대표자 검색"
          style={Object.assign({},inp,{flex:"1 1 220px",minWidth:180,maxWidth:340,margin:0,fontSize:15,padding:"11px 14px"})}/>
        <select value={stCoSort[0]} onChange={function(e){stCoSort[1](e.target.value);}} style={Object.assign({},inp,{width:"auto",margin:0,fontSize:14.5,fontWeight:600,padding:"11px 12px"})}>
          <option value="name">정렬: 가나다순</option>
          <option value="targets">대상자 많은 순</option>
          <option value="emps">직원 수 많은 순</option>
          <option value="received">수령완료 높은 순</option>
          <option value="upcoming">임박 건 많은 순</option>
          <option value="newest">최신 등록순</option>
          <option value="yearsDesc">업력 높은 순</option>
        </select>
        <select value={stCoFilter[0]} onChange={function(e){stCoFilter[1](e.target.value);}} style={Object.assign({},inp,{width:"auto",margin:0,fontSize:14.5,fontWeight:600,padding:"11px 12px"})}>
          <option value="all">필터: 전체</option>
          <option value="corp">법인</option>
          <option value="indiv">개인</option>
          <option value="upcoming">임박 있음</option>
          <option value="noprog">지원금 미지정</option>
          <option value="zero">대상자 0명</option>
          {(props.companies||[]).some(function(c){return c.isSample;})?<option value="sample">샘플 데이터</option>:null}{/* [D-94] 샘플이 남아 있을 때만 */}
        </select>
        <ExcelImport companies={props.companies} employees={props.employees} programs={props.programs} io={props.excelImport}/>
        <PayrollDiagnosis/>
        <span style={{fontSize:12.5,color:"#94A3B8",fontWeight:600,marginLeft:"auto"}}>{companyRowsView.length}개 업체</span>
      </div>
      {companyRowsView.length===0&&<div style={{padding:"34px 0",textAlign:"center",fontSize:14.5,color:"#94A3B8"}}>조건에 맞는 업체가 없습니다.</div>}
      {companyRowsView.map(function(r,ci){var c=r.c;return(
      <div key={c.id} onClick={function(){props.goCompany(c.id);}}
        style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",padding:"15px 18px",cursor:"pointer",borderBottom:ci<companyRowsView.length-1?"1px solid #F1F5F9":"none",transition:"background 0.15s"}}
        onMouseEnter={function(e){e.currentTarget.style.background="#F8FAFC";}}
        onMouseLeave={function(e){e.currentTarget.style.background="transparent";}}>
        {/* 번호 (현재 정렬 순서 기준) */}
        <span style={{width:30,height:30,borderRadius:9,background:"#F1F5F9",color:"#64748B",fontWeight:800,fontSize:12,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{String(ci+1).padStart(2,"0")}</span>
        <div style={{flex:"1 1 340px",minWidth:240}}>
          {/* 1순위: 업체명 + 배지 */}
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <span style={{fontSize:17.5,fontWeight:700,color:"#1E293B",lineHeight:1.35}}>{c.name}</span>
            {(c.tags||[]).map(function(tid){var tag=TAGS.find(function(t){return t.id===tid;});if(!tag)return null;return <span key={tid} style={{fontSize:11.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:tag.bg,color:tag.color,whiteSpace:"nowrap"}}>{tag.label}</span>;})}
            {r.upcoming>0&&<span style={{fontSize:11.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FEE2E2",color:"#DC2626",whiteSpace:"nowrap"}}>🔔 {r.upcoming}건 임박</span>}
            {r.reviewCnt>0&&<span style={{fontSize:11.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FEF3C7",color:"#B45309",whiteSpace:"nowrap"}}>⚠️ 확인 필요 {r.reviewCnt}건</span>}
          </div>
          {/* 2순위: 사업자번호 · 법인구분 · 대표 · 지역 · 업력 */}
          <div style={{fontSize:13.5,color:"#64748B",marginTop:5,lineHeight:1.5}}>
            {[c.bizNo,c.corpType,c.ceoName?"대표 "+c.ceoName:null,r.region,r.yearsText].filter(Boolean).join(" · ")}
          </div>
          {/* 3순위: 직원 수 · 대상자 수 · 주요 지원금 */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:6}}>
            <span style={{fontSize:13.5,fontWeight:700,color:"#334155",whiteSpace:"nowrap"}}>{r.totalEmp>0?"직원 "+r.totalEmp+"명":"직원 수 미입력"}</span>
            <span style={{fontSize:13.5,fontWeight:700,color:r.targetCount>0?"#1D4ED8":"#94A3B8",whiteSpace:"nowrap"}}>대상자 {r.targetCount}명</span>
            {r.progShorts.length===0?(
              <span style={{fontSize:11.5,fontWeight:600,padding:"2px 9px",borderRadius:10,background:"#F1F5F9",color:"#94A3B8",whiteSpace:"nowrap"}}>지원금 미지정</span>
            ):(r.progShorts.length>=3?r.progShorts.slice(0,1):r.progShorts).map(function(pn){return(
              <span key={pn} style={{fontSize:11.5,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#EFF6FF",color:"#2563EB",whiteSpace:"nowrap"}}>{pn}</span>
            );})}
            {r.progShorts.length>=3&&<span style={{fontSize:11.5,fontWeight:600,color:"#64748B",whiteSpace:"nowrap"}}>외 {r.progShorts.length-1}개</span>}
          </div>
        </div>
        {/* 4순위(우측 고정): 수령완료 금액 */}
        <div style={{textAlign:"right",flexShrink:0,minWidth:100,marginLeft:"auto"}}>
          <div style={{fontSize:17.5,fontWeight:800,color:r.rcv>0?"#059669":"#94A3B8",lineHeight:1.2}}>{fMan(r.rcv)}</div>
          <div style={{fontSize:11.5,color:"#94A3B8",marginTop:2}}>수령완료</div>
        </div>
      </div>);})}
    </Card>))}

    {props.mode!=="stats"&&selectedCompanyId!=="all"&&(<div><PendingPaymentsList employees={props.employees} programs={props.programs} goCompany={props.goCompany} selectedCompanyId={selectedCompanyId}/></div>)}

    {props.mode!=="list"&&props.companies.length===0&&(
      <EmptyState icon="📊" title="대시보드가 곧 채워집니다" desc="업체와 직원을 등록하면 이곳에 이번 달 신청 가능 지원금, 월별 수령 추이, 신청 일정 캘린더가 자동으로 표시됩니다." actionLabel="+ 첫 업체 등록하기" action={props.onAddCompany}/>
    )}

    {/* [+] 월별 수령 캘린더 — 기본 접힘 */}
    {props.mode!=="list"&&props.companies.length>0&&(
      <DashGroup id="calendar" icon="📅" title="월별 수령 캘린더" summary={"이번 달 "+fMan(metrics.thisMonthExpected)+" 예정"}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}} className="grid-2-mobile"><div><MonthlyReport employees={props.employees}/><CompanyRanking companies={props.companies} employees={props.employees} goCompany={props.goCompany}/></div><div><CalendarView employees={props.employees} companies={props.companies} programs={props.programs} goCompany={props.goCompany} calendarMemos={props.calendarMemos} onSaveMemo={props.onSaveMemo}/></div></div>
      </DashGroup>
    )}

    {/* [+] 상태별 현황 및 지원금별 파이프라인 — 기본 접힘 */}
    {props.mode!=="list"&&props.companies.length>0&&(
      <DashGroup id="pipeline" icon="📋" title="상태별 현황 및 파이프라인"
        summary={(function(){var n=fE.filter(function(e){return e.status!=="resigned"&&e.status!=="completed";}).length;return "진행 중 "+n+"건"+(metrics.overdueCount>0?" · 지연 "+metrics.overdueCount+"건":"");})()}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0F172A",marginBottom:10}}>📋 상태별 현황</div>
          {STS.map(function(s){var cnt=stats.sc[s.key]||0;var total=fE.length||1;var done=s.key==="completed"||s.key==="approved";var barCol=done?"#059669":s.key==="resigned"?"#CBD5E1":"#94A3B8";return(<div key={s.key} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:16,color:"#475569"}}><span style={{display:"inline-block",width:8,height:8,borderRadius:4,background:barCol,marginRight:7}}/>{s.label}</span><span style={{fontSize:16,fontWeight:700,color:"#0F172A"}}>{cnt}명</span></div><div style={{height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:(cnt/total*100)+"%",background:barCol,borderRadius:3,transition:"width 0.5s ease"}}/></div></div>);})}
        </div>
        <ProgramPipeline employees={fE} programs={props.programs}/>
        {st1[0]==="all"&&props.companies.length>=2&&<CompanyRiskRanking companies={props.companies} employees={props.employees} goCompany={props.goCompany}/>}
      </DashGroup>
    )}
    </div>

    {/* ── 우측 무료체험 요약 패널 (PC 넓은 화면 전용 · X로 닫기) ── */}
    {showTrialPanel&&trialInfo&&(
      <aside ref={trialAsideRef} className="trial-aside" style={{width:230,flexShrink:0,position:"sticky",top:92}}>
        <div style={{background:"#fff",border:"1px solid #99F6E4",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 10px rgba(13,148,136,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"11px 13px",background:"#F0FDFA",borderBottom:"1px solid #CCFBF1"}}>
            <span style={{fontSize:12.5,fontWeight:800,color:"#0F766E",lineHeight:1.35}}>🗓️ {accessPeriodLabel({role:props.accessRole,expires_at:props.accessExpiresAt},props.isAdmin).text}</span>
            <button onClick={dismissTrialPanel} title="닫기" style={{marginLeft:"auto",background:"none",border:"none",color:"#14B8A6",fontSize:17,cursor:"pointer",padding:0,lineHeight:1}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"#F1F5F9"}}>
            {[["관리 업체",trialInfo.comp+"개"],["대상자",trialInfo.emp+"명"],["예상 지원금",fMan(trialInfo.expect)],["신청 일정",trialInfo.sched+"건"]].map(function(it,i){return(
              <div key={i} style={{background:"#fff",padding:"9px 12px"}}>
                <div style={{fontSize:11.5,color:"#64748B",fontWeight:600,marginBottom:2}}>{it[0]}</div>
                <div style={{fontSize:14.5,fontWeight:800,color:"#0F172A",wordBreak:"keep-all"}}>{it[1]}</div>
              </div>
            );})}
          </div>
          <div style={{padding:"10px 12px",borderTop:"1px solid #F1F5F9"}}>
            <button onClick={props.onOpenBilling||function(){}} style={{width:"100%",background:"#0F766E",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF}}>요금제 보기 →</button>
            <div style={{fontSize:11,color:"#94A3B8",textAlign:"center",marginTop:6}}>계속 이용하려면 구독이 필요합니다</div>
          </div>
        </div>
      </aside>
    )}
  </div>); }

// ── EmpCard ───────────────────────────────────────────────
// ── 진행상태 드롭다운: createPortal(body) 기반 floating menu ──
// 카드의 overflow:hidden / transform(page-enter) 영향 없이 화면 위에 떠서 잘리지 않는다.
function StatusDropdown(props){
  var stOpen=useState(false);
  var stPos=useState(null);
  var btnRef=useRef(null);
  var menuRef=useRef(null);
  var cur=STS.find(function(s){return s.key===props.value;})||STS[0];
  function recompute(){
    var el=btnRef.current; if(!el)return null;
    var r=el.getBoundingClientRect();
    var vh=window.innerHeight, vw=window.innerWidth;
    var width=Math.max(r.width,200);
    var menuH=Math.min(STS.length*42+34, Math.round(vh*0.6));
    var spaceBelow=vh-r.bottom;
    var openUp=spaceBelow<menuH+14; // 아래 공간 부족하면 위로 열기
    var left=r.left;
    if(left+width>vw-8) left=vw-8-width; // 우측 화면 밖 방지
    if(left<8) left=8;                   // 좌측 화면 밖 방지
    var p={left:left,width:width,openUp:openUp,maxH:menuH};
    if(openUp){p.bottom=vh-r.top+4;}else{p.top=r.bottom+4;}
    return p;
  }
  function open(e){ if(e){e.stopPropagation();} var p=recompute(); if(p){stPos[1](p);stOpen[1](true);} }
  function close(){ stOpen[1](false); }
  useEffect(function(){
    if(!stOpen[0])return;
    function onDoc(ev){ if(menuRef.current&&menuRef.current.contains(ev.target))return; if(btnRef.current&&btnRef.current.contains(ev.target))return; close(); }
    function onKey(ev){ if(ev.key==="Escape")close(); }
    function onMove(){ var p=recompute(); if(p)stPos[1](p); }
    document.addEventListener("mousedown",onDoc,true);
    document.addEventListener("keydown",onKey,true);
    window.addEventListener("resize",onMove,true);
    window.addEventListener("scroll",onMove,true);
    return function(){
      document.removeEventListener("mousedown",onDoc,true);
      document.removeEventListener("keydown",onKey,true);
      window.removeEventListener("resize",onMove,true);
      window.removeEventListener("scroll",onMove,true);
    };
  },[stOpen[0]]);
  var pos=stPos[0];
  return(
    <>
      <span ref={btnRef} onClick={open} title="클릭해서 상태 변경"
        style={{fontSize:"var(--fs-badge)",fontWeight:600,padding:"3px 10px",borderRadius:999,background:cur.bg,color:cur.color,whiteSpace:"nowrap",cursor:"pointer",border:"1px solid "+cur.color+"33",userSelect:"none"}}>
        {cur.label} ▾
      </span>
      {stOpen[0]&&pos&&createPortal(
        <div ref={menuRef} onClick={function(e){e.stopPropagation();}}
          style={Object.assign({position:"fixed",left:pos.left,width:pos.width,zIndex:900,background:"#fff",borderRadius:12,boxShadow:"0 12px 36px rgba(15,23,42,0.22)",border:"1px solid #E2E8F0",padding:6,maxHeight:pos.maxH,overflowY:"auto",WebkitOverflowScrolling:"touch"},pos.openUp?{bottom:pos.bottom}:{top:pos.top})}>
          <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",padding:"3px 8px 5px"}}>진행 상태 변경</div>
          {STS.map(function(s){var on=props.value===s.key;return(
            <div key={s.key} onClick={function(){props.onChange(s.key);close();}}
              style={{display:"flex",alignItems:"center",gap:7,padding:"9px 9px",borderRadius:8,cursor:"pointer",fontSize:"var(--fs-row)",background:on?s.bg:"transparent",color:on?s.color:"#334155",fontWeight:on?700:400}}
              onMouseEnter={function(e){if(!on)e.currentTarget.style.background="#F1F5F9";}}
              onMouseLeave={function(e){if(!on)e.currentTarget.style.background="transparent";}}>
              <span>{s.icon}</span><span>{s.label}</span>{on&&<span style={{marginLeft:"auto",fontSize:"var(--fs-badge)"}}>✓</span>}
            </div>
          );})}
        </div>,
        hrPortalRoot()
      )}
    </>
  );
}

function EmpCard(props){
  var emp=props.emp,programs=props.programs,company=props.company;
  var uploadFn=props.uploadFn,getUrlFn=props.getUrlFn;
  var st1=useState(false); // expanded
  var p=programs[emp.programId];
  var gp=p?GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"]:GROUP_COLORS["커스텀"];
  var st=STS.find(function(s){return s.key===emp.status;})||STS[0];
  var paidRounds=(emp.rounds||[]).filter(function(r){return r.isPaid;}).length;
  var totalRounds=(emp.rounds||[]).length;
  var totalPaid=(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);
  var nextRound=null;
  (emp.rounds||[]).some(function(r){if(!r.isPaid){var ed=emp.startDate?addMo(emp.startDate,r.month):null;if(ed){var dd=getDday(ed);nextRound={round:r,dday:dd,eligDate:ed};return true;}}return false;});
  var ageD=calcAgeDetailed(emp.birthDate,emp.startDate);
  var certDocs=(emp.certDocs||[]);
  var certDone=certDocs.filter(function(d){return d.done;}).length;
  return(
    <Card style={{marginBottom:8,overflow:"hidden",border:props.highlight?"2px solid #F59E0B":"1px solid #E2E8F0",position:"relative",boxShadow:props.highlight?"0 0 0 4px rgba(245,158,11,0.18)":undefined,transition:"box-shadow 0.4s,border-color 0.4s"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}} onClick={function(){st1[1](!st1[0]);}}>
        <div style={{width:34,height:34,borderRadius:17,background:"#F1F5F9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#475569",flexShrink:0,fontWeight:700}}>
          {emp.name.charAt(0)}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",marginBottom:2}}>
            <span style={{fontSize:"var(--fs-name)",fontWeight:700,color:"#1E293B"}}>{emp.name}</span>
            {/* 클릭 가능한 상태 배지 (portal floating menu — 카드 잘림 없음) */}
            <StatusDropdown value={emp.status} onChange={function(k){props.onPatch(emp.id,{status:k});}}/>
            {p&&<span style={{...neutralBadge()}}>{p.name}</span>}
            <YearBadge year={empProgYear(emp,programs)}/>
          </div>
          <div style={{fontSize:"var(--fs-meta)",color:"#64748B",display:"flex",gap:8,flexWrap:"wrap"}}>
            {emp.startDate&&<span>입사 {fD(emp.startDate)}</span>}
            {emp.status==="resigned"&&emp.resignDate&&<span style={{color:"#94A3B8"}}>🚪 퇴사 {fD(emp.resignDate)}</span>}
            {ageD&&<span>만{ageD.years}세</span>}
            {paidRounds>0&&<span style={{color:"#059669"}}>✅{paidRounds}/{totalRounds}회차</span>}
            {totalPaid>0&&<span style={{color:"#059669"}}>{fMan(totalPaid)}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
          {nextRound&&<DdayBadge dday={nextRound.dday}/>}
          <div style={{display:"flex",gap:4}}>
            <button style={Object.assign({},btnSm,{fontSize:"var(--fs-btn)",padding:"5px 11px"})} onClick={function(e){e.stopPropagation();props.onEdit(emp);}}>편집</button>
            <button style={Object.assign({},btnSm,{fontSize:"var(--fs-btn)",padding:"5px 11px",color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(e){e.stopPropagation();if(window.confirm("'"+emp.name+"' 직원을 삭제하시겠습니까?\n삭제된 직원은 기본 목록에서 숨겨지며, 회차와 서류 관리 내역도 함께 보이지 않습니다."))props.onDelete(emp.id);}}>삭제</button>
          </div>
        </div>
      </div>
      {st1[0]&&(
        <div style={{padding:"0 14px 14px"}}>
          {/* 회차 진행상황 */}
          {p&&(emp.rounds||[]).length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:"var(--fs-label)",fontWeight:600,marginBottom:6,color:"#475569"}}>📅 회차 현황</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {(emp.rounds||[]).map(function(r,ri){
                  var ed=emp.startDate?addMo(emp.startDate,r.month):null;
                  var dd=ed?getDday(ed):null;
                  return(
                    <button key={ri} onClick={function(){props.onRoundClick(emp,ri);}}
                      style={{padding:"6px 10px",borderRadius:8,fontSize:"var(--fs-badge)",cursor:"pointer",border:"1.5px solid "+(r.isPaid?"#6EE7B7":dd!==null&&dd<=7?"#FECACA":"#E2E8F0"),background:r.isPaid?"#D1FAE5":dd!==null&&dd<=7?"#FEF2F2":"#F8FAFC",color:r.isPaid?"#059669":dd!==null&&dd<=7?"#DC2626":"#475569",fontWeight:r.isPaid?700:500}}>
                      <div>{r.label}</div>
                      {ed&&<div style={{fontSize:"var(--fs-mini)",opacity:0.7}}>{fD(ed)}</div>}
                      {r.isPaid?<div style={{fontSize:"var(--fs-mini)",color:"#059669"}}>{fMan(r.received||0)}</div>:dd!==null?<div style={{fontSize:"var(--fs-mini)"}}>D-{dd}</div>:null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* 인증서류 */}
          {certDocs.length>0&&(
            <div style={{marginBottom:12}}>
              <div style={{fontSize:"var(--fs-label)",fontWeight:600,marginBottom:6,color:"#475569"}}>📋 인증서류 ({certDone}/{certDocs.length})</div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                {certDocs.map(function(d,di){return(
                  <div key={di} style={{padding:"4px 9px",borderRadius:4,fontSize:"var(--fs-badge)",background:d.done?"#D1FAE5":"#F1F5F9",color:d.done?"#059669":"#64748B",border:"1px solid "+(d.done?"#6EE7B7":"#E2E8F0"),cursor:"pointer"}} onClick={function(){props.onCertToggle(emp,di);}}>
                    {d.done?"✅":"○"} {d.label}
                  </div>
                );})}
              </div>
            </div>
          )}
          {/* 직원 서류 */}
          <DocSection title="직원 서류" docs={emp.employeeDocs||[]} disabled={false}
            progName={p?p.name:""} quickDocs={EMP_QUICK_DOCS}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onChange={function(ds){props.onPatch(emp.id,{employeeDocs:ds});}}
            onLog={function(txt,type){if(props.onLog&&company)props.onLog(company.id,emp.name+" "+txt,type);}}
          />
          {/* 급여/연락처 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
            <div><Label>연락처</Label><input style={inp} defaultValue={emp.phone||""} placeholder="010-" onBlur={function(e){props.onPatch(emp.id,{phone:e.target.value});}}/></div>
            <div><Label>이메일</Label><input style={inp} defaultValue={emp.email||""} placeholder="email" onBlur={function(e){props.onPatch(emp.id,{email:e.target.value});}}/></div>
            <div><Label>급여(원)</Label><input type="number" style={inp} min="0" defaultValue={emp.salary||""} placeholder="2200000" onBlur={function(e){props.onPatch(emp.id,{salary:clampMoney(e.target.value)});}}/></div>
          </div>
          {emp.salary&&emp.weeklyHours&&(function(){var wc=checkWage(emp.salary,emp.weeklyHours);return wc&&!wc.isAboveMin&&(<div style={{marginTop:6,padding:"6px 10px",borderRadius:6,background:"#FEE2E2",fontSize:"var(--fs-meta)",color:"#DC2626"}}>⚠️ 최저임금 미달 — 최소 {wc.minMonthly.toLocaleString()}원 필요</div>);})()||null}
          {/* 메모 */}
          <div style={{marginTop:8}}>
            <Label>메모</Label>
            <textarea style={Object.assign({},inp,{height:60,resize:"none",fontSize:12})} defaultValue={emp.memo||""} placeholder="메모..." onBlur={function(e){props.onPatch(emp.id,{memo:e.target.value});}}/>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── EmpModal (add/edit employee) ──────────────────────────
function EmpModal(props){
  var programs=props.programs,company=props.company;
  var init=props.emp||{};
  var CUR_YEAR=new Date().getFullYear();
  function defYear(pid){ return (programs[pid]||{}).year||CUR_YEAR; }
  var st={
    name:useState(init.name||""),
    programId:useState(init.programId||(programs["youth_jump"]&&programs["youth_jump"].enabled!==false?"youth_jump":Object.keys(programs).find(function(k){return programs[k].enabled!==false;})||Object.keys(programs)[0]||"")),
    programYear:useState(init.programYear||""),
    startDate:useState(init.startDate||""),
    birthDate:useState(init.birthDate||"2000-01-01"),
    gender:useState(init.gender||"male"),
    milSvc:useState(init.milSvc||0),
    status:useState(init.status||"preparing"),
    phone:useState(init.phone||""),
    email:useState(init.email||""),
    salary:useState(init.salary||""),
    weeklyHours:useState(init.weeklyHours||40),
    memo:useState(init.memo||""),
    bd:useState(init.birthDate||"2000-01-01"),
    gen:useState(init.gender||"male"),
    mil:useState(init.milSvc||0),
    ec:useState(init.eligConds||{}),
    xc:useState(init.exclConds||{}),
    hd:useState(init.startDate||""),
    replaceReason:useState(init.replaceReason||""),
    replaceHireDate:useState(init.replaceHireDate||""),
    replaceTargetName:useState(init.replaceTargetName||""),
    replaceStartDate:useState(init.replaceStartDate||""),
    replaceEndDate:useState(init.replaceEndDate||""),
    resignDate:useState(init.resignDate||"")
  };
  function save(){
    if(!st.name[0].trim()){toast("이름을 입력하세요","warn");return;}
    if(!st.programId[0]){toast("지원금을 선택하세요","warn");return;}
    if(!isValidEmail(st.email[0])){toast("이메일 형식을 확인하세요","warn");return;}
    var p=programs[st.programId[0]];
    var selYear=Number(st.programYear[0])||defYear(st.programId[0]);
    var info=getProgramInfo(company,st.programId[0],selYear);
    var quota=info?Number(info.quota||0):0;
    if(quota>0){
      var curCnt=(props.employees||[]).filter(function(e){
        return e.programId===st.programId[0]&&e.status!=="resigned"&&e.id!==init.id&&
               (Number(e.programYear)||defYear(e.programId))===selYear;
      }).length;
      if(curCnt+1>quota&&!window.confirm("지원한도를 초과할 수 있습니다. 운영기관 확인 후 저장하시겠습니까?"))return;
    }
    var rounds=init.rounds||(p?JSON.parse(JSON.stringify(p.rounds||[])).map(function(r){return Object.assign({},r,{isPaid:false,received:0});}):[]);
    var certDocs=init.certDocs||(p?(CERT_TYPES[st.programId[0]]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};}):[]);
    var empDocs=init.employeeDocs||(p?(p.employeeDocs||[]).map(function(d){return{id:uid(),label:typeof d==="string"?d:d.label||"",done:false,files:[]};}):[]);
    props.onSave({
      id:init.id||ruuid(),
      companyId:company.id,
      name:st.name[0].trim(),
      programId:st.programId[0],
      programYear:selYear,
      startDate:st.startDate[0],
      birthDate:st.bd[0]||st.birthDate[0],
      gender:st.gen[0]||st.gender[0],
      milSvc:st.mil[0]||st.milSvc[0],
      status:st.status[0],
      phone:st.phone[0],
      email:st.email[0],
      salary:clampMoney(st.salary[0]),
      weeklyHours:Number(st.weeklyHours[0])||40,
      memo:st.memo[0],
      eligConds:st.ec[0],
      exclConds:st.xc[0],
      resignDate:st.status[0]==="resigned"?st.resignDate[0]:"",
      replaceReason:st.replaceReason[0],
      replaceHireDate:st.replaceHireDate[0],
      replaceTargetName:st.replaceTargetName[0],
      replaceStartDate:st.replaceStartDate[0],
      replaceEndDate:st.replaceEndDate[0],
      totalExpected:p?p.totalAmount||0:0,
      rounds:rounds,
      certDocs:certDocs,
      employeeDocs:empDocs
    });
  }
  var selectedP=programs[st.programId[0]];
  return(
    <Modal open={props.open} onClose={props.onClose} title={(init.id?"직원 편집":"직원 추가")+" — "+company.name} width={600}>
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>이름 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}} placeholder="홍길동"/></div>
          <div><Label>진행 상태</Label>
            <select style={inp} value={st.status[0]} onChange={function(e){st.status[1](e.target.value);}}>
              {STS.map(function(s){return <option key={s.key} value={s.key}>{s.icon} {s.label}</option>;})}
            </select>
          </div>
        </div>
        {st.status[0]==="resigned"&&(
          <div style={{padding:"10px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,alignItems:"end"}}>
              <div><Label>퇴사일</Label><input type="date" style={inp} value={st.resignDate[0]} onChange={function(e){st.resignDate[1](e.target.value);}}/></div>
              <div style={{fontSize:11,color:"#B45309",lineHeight:1.5,paddingBottom:6}}>⚠️ 퇴사일에 따라 지원금 지급 가능 회차가 달라질 수 있습니다.</div>
            </div>
          </div>
        )}
        {st.programId[0]==="youth_jump"&&(
          <>
            <JuminInput onParsed={function(parsed){st.bd[1](parsed.birthDate);st.gen[1](parsed.gender);st.birthDate[1](parsed.birthDate);st.gender[1](parsed.gender);}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <div><Label>생년월일</Label><input type="date" style={inp} value={st.bd[0]||st.birthDate[0]} onChange={function(e){st.bd[1](e.target.value);st.birthDate[1](e.target.value);}}/></div>
              <div><Label>성별</Label>
                <div style={{display:"flex",gap:4}}>
                  {[["male","남"],["female","여"]].map(function(arr){var on=(st.gen[0]||st.gender[0])===arr[0];return(<button key={arr[0]} onClick={function(){st.gen[1](arr[0]);st.gender[1](arr[0]);}} style={Object.assign({},btnSm,{flex:1,background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0"})}>{arr[1]}</button>);})}
                </div>
              </div>
              {(st.gen[0]||st.gender[0])==="male"&&<div><Label>군복무(월)</Label><input type="number" style={inp} value={st.mil[0]||st.milSvc[0]||""} onChange={function(e){st.mil[1](Number(e.target.value));st.milSvc[1](Number(e.target.value));}} placeholder="18"/></div>}
            </div>
          </>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>입사일 *</Label><input type="date" style={inp} value={st.startDate[0]} onChange={function(e){st.startDate[1](e.target.value);st.hd[1](e.target.value);}}/></div>
          <div><Label>연락처</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](fmtPhone(e.target.value));}} inputMode="numeric" placeholder="010-0000-0000"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><Label>이메일</Label><input type="email" style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}} placeholder="name@email.com"/></div>
          <div><Label>월급여(원)</Label><input type="number" style={inp} value={st.salary[0]} onChange={function(e){st.salary[1](e.target.value);}} placeholder="2200000"/></div>
        </div>
        {(function(){var wc=checkWage(clampMoney(st.salary[0]),st.weeklyHours[0]);if(!wc||!st.salary[0])return null;if(wc.isAboveMin)return null;return(
          <div style={{padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8}}>
            <div style={{fontSize:13,fontWeight:700,color:"#DC2626",marginBottom:4}}>⚠️ 최저임금 미달 가능성</div>
            <div style={{fontSize:"var(--fs-sub)",color:"#475569",lineHeight:1.6}}>{st.programId[0]==="youth_jump"?"최저임금 미달 가능성이 있어 청년일자리도약장려금 진행이 어려울 수 있습니다. ":"최저임금 미달 가능성이 있습니다. "}월 환산 최저 {wc.minMonthly.toLocaleString()}원 이상이 필요합니다.</div>
            {props.onOpenWage&&<button style={Object.assign({},btnSm,{marginTop:6,fontSize:"var(--fs-btn)",background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE"})} onClick={function(){props.onClose&&props.onClose();props.onOpenWage();}}>🧮 급여 계산기로 확인하기</button>}
          </div>
        );})()}
        <div>
          <Label>지원금 *</Label>
          {(function(){
            var enabledProgs=Object.values(programs).filter(function(p){return p.enabled!==false;});
            if(enabledProgs.length===0){return(<div style={{marginTop:6,padding:"12px 14px",background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:8,fontSize:12,color:"#92400E"}}>⚠️ 활성화된 지원금이 없습니다. <strong>지원금 관리</strong> 메뉴에서 사용할 지원금을 켜주세요.</div>);}
            var GORD=["신규채용","재직자유지","육아","커스텀"];
            var GLBL={"신규채용":"신규 채용 지원","재직자유지":"재직자 유지·전환","육아":"육아·출산 관련","커스텀":"사용자 추가"};
            var grouped={};
            enabledProgs.forEach(function(p){var g=p.group||"커스텀";if(!grouped[g])grouped[g]=[];grouped[g].push(p);});
            return GORD.filter(function(g){return grouped[g]&&grouped[g].length>0;}).map(function(g){
              var gp=GROUP_COLORS[g]||GROUP_COLORS["커스텀"];
              return(
                <div key={g} style={{marginTop:10}}>
                  <div style={{fontSize:"var(--fs-label)",fontWeight:700,color:gp.dark,background:gp.light,borderRadius:5,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4,marginBottom:6}}>{gp.icon} {GLBL[g]||g}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {grouped[g].map(function(p){var on=st.programId[0]===p.id;return(
                      <button key={p.id} onClick={function(){st.programId[1](p.id);}}
                        style={{padding:"10px 12px",borderRadius:10,cursor:"pointer",textAlign:"left",border:"2px solid "+(on?gp.base:"#E2E8F0"),background:on?gp.badge:"#fff",color:on?gp.text:"#475569"}}>
                        <div style={{fontWeight:on?700:500,fontSize:"var(--fs-name)",lineHeight:1.35}}>{p.name}</div>
                        <div style={{fontSize:"var(--fs-sub)",color:on?gp.dark:"#94A3B8",marginTop:2}}>{fProgramAmt(p)}</div>
                      </button>
                    );})}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        {selectedP&&(function(){
          var defY=selectedP.year||CUR_YEAR;
          var years=[];for(var y=2020;y<=CUR_YEAR+1;y++)years.push(y);
          var selY=Number(st.programYear[0])||defY;
          var info=getProgramInfo(company,st.programId[0],selY);
          var quota=info?Number(info.quota||0):0;
          var curCnt=(props.employees||[]).filter(function(e){
            return e.programId===st.programId[0]&&e.status!=="resigned"&&e.id!==init.id&&
                   (Number(e.programYear)||defYear(e.programId))===selY;
          }).length;
          var willCnt=curCnt+1;
          var noInfo=!info||(quota===0&&!(info.agreementDate||info.applyDate));
          var overQ=quota>0&&willCnt>quota;
          var nearQ=!overQ&&quota>0&&willCnt>Math.floor(quota*0.8);
          var qBg=noInfo?"#F8FAFC":overQ?"#FEE2E2":nearQ?"#FEF3C7":"#D1FAE5";
          var qBorder=noInfo?"#E2E8F0":overQ?"#FECACA":nearQ?"#FDE68A":"#6EE7B7";
          var qColor=noInfo?"#94A3B8":overQ?"#DC2626":nearQ?"#D97706":"#059669";
          var applyD=info?info.applyDate||"":"";
          var inWin=null;
          if(applyD&&st.startDate[0]){var lo=addMo(applyD,-3),hi=addMo(applyD,3);inWin=st.startDate[0]>=lo&&st.startDate[0]<=hi;}
          return(<React.Fragment>
            <div><Label>지원 연도 <span style={{fontWeight:500,color:"#94A3B8"}}>· 직원별로 저장되어 목록·카드·보드에 표시됩니다</span></Label>
              <select style={Object.assign({},inp,{fontWeight:700})} value={selY} onChange={function(e){st.programYear[1](String(e.target.value));}}>
                {years.map(function(y){return <option key={y} value={y}>{y}년{y===defY?" (기본)":""}</option>;})}
              </select>
            </div>
            <div style={{padding:"12px 16px",background:qBg,border:"1px solid "+qBorder,borderRadius:10,fontSize:"var(--fs-sub)",lineHeight:1.6}}>
              {noInfo?(
                <span style={{color:qColor}}>ℹ️ 지원한도 미입력 — 업체 정보 편집 &gt; 지원금별 진행 정보에서 입력하세요</span>
              ):(
                <React.Fragment>
                  <div style={{fontWeight:700,color:qColor,marginBottom:3}}>👥 {quota>0?"지원한도: "+quota+"명 (현재 "+curCnt+"명 → 추가시 "+willCnt+"명)":(info.agreementDate?"협약 체결됨":"협약 미체결")}</div>
                  {quota>0&&overQ&&<div style={{color:qColor,fontSize:"var(--fs-sub)"}}>⚠️ 한도 초과 — 운영기관 확인 필요</div>}
                  {info.agreementDate&&<div style={{color:"#047857",fontSize:"var(--fs-sub)"}}>✅ 협약 체결: {fD(info.agreementDate)}</div>}
                  {!info.agreementDate&&<div style={{color:"#B45309",fontSize:"var(--fs-sub)"}}>⚠️ 협약 미체결 — 신청 전 협약 필요</div>}
                  {applyD&&<div style={{color:"#475569",fontSize:"var(--fs-sub)"}}>📋 사전신청일: {fD(applyD)}</div>}
                  {applyD&&st.startDate[0]&&inWin!==null&&<div style={{color:inWin?"#059669":"#DC2626",fontSize:"var(--fs-sub)",fontWeight:inWin?500:700}}>{inWin?"✅ 참여신청일 기준 전후 3개월 이내":"⚠️ 참여신청일 기준 전후 3개월 범위 벗어남 — 운영기관 확인"}</div>}
                </React.Fragment>
              )}
            </div>
            {selY!==defY&&<div style={{padding:"12px 16px",background:"#FEF9C3",border:"1px solid #FDE047",borderRadius:10,fontSize:"var(--fs-sub)",color:"#713F12",lineHeight:1.65}}><strong>⚠️ {selY}년 기준 안내</strong><br/>선택한 연도의 지원금 기준은 현재 시스템에 입력된 기준과 다를 수 있습니다. 실제 진행 전 반드시 해당 연도 공문과 운영기관 안내를 확인하세요. 미확인으로 발생한 불이익에 대해서는 책임지지 않습니다.</div>}
          </React.Fragment>);
        })()}
        {selectedP&&st.programId[0]==="replace_worker"&&(
          <div style={{padding:"10px 14px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8}}>
            <div style={{fontSize:12,fontWeight:700,color:"#065F46",marginBottom:8}}>📝 대체인력 기본 정보</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><Label>대체 사유</Label>
                <select style={inp} value={st.replaceReason[0]} onChange={function(e){st.replaceReason[1](e.target.value);}}>
                  <option value="">선택...</option>
                  <option value="육아휴직">육아휴직</option>
                  <option value="출산전후휴가">출산전후휴가</option>
                  <option value="육아기 근로시간 단축">육아기 근로시간 단축</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div><Label>대체인력 채용일</Label><input type="date" style={inp} value={st.replaceHireDate[0]} onChange={function(e){st.replaceHireDate[1](e.target.value);}}/></div>
              <div><Label>대체 대상 근로자명</Label><input style={inp} value={st.replaceTargetName[0]} onChange={function(e){st.replaceTargetName[1](e.target.value);}} placeholder="홍길동"/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><Label>대체 시작일</Label><input type="date" style={inp} value={st.replaceStartDate[0]} onChange={function(e){st.replaceStartDate[1](e.target.value);}}/></div>
                <div><Label>대체 종료일</Label><input type="date" style={inp} value={st.replaceEndDate[0]} onChange={function(e){st.replaceEndDate[1](e.target.value);}}/></div>
              </div>
            </div>
          </div>
        )}
        {selectedP&&(
          <div style={{padding:"10px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8}}>
            <div style={{fontSize:"var(--fs-label)",fontWeight:700,color:"#0284C7",marginBottom:6}}>📋 {selectedP.name} 사전 검토</div>
            <div style={{display:"grid",gap:3}}>{(PROGRAM_CHECKLISTS[st.programId[0]]||["신청 대상 사업장 여부 확인","대상 근로자 요건 확인","고용보험 가입 여부 확인","신청 기한 확인","중복 지원 제한 여부 확인","필수 서류 준비 여부 확인","운영기관 또는 공고문 기준 추가 확인 필요"]).map(function(item,i){return <div key={i} style={{fontSize:"var(--fs-sub)",color:"#475569",padding:"2px 0",display:"flex",gap:5,alignItems:"flex-start"}}><span style={{color:"#0284C7",flexShrink:0}}>☐</span><span>{item}</span></div>;})}</div>
            <div style={{fontSize:10,color:"#94A3B8",marginTop:6}}>※ 지원금 세부 요건은 연도별 공고와 운영기관 기준에 따라 달라질 수 있습니다. 본 체크리스트는 사전 검토용입니다.</div>
          </div>
        )}
        {selectedP&&st.programId[0]==="youth_jump"&&(st.bd[0]||st.birthDate[0])&&(
          <EligChk bd={st.bd[0]||st.birthDate[0]} gen={st.gen[0]||st.gender[0]} mil={st.mil[0]||st.milSvc[0]} ec={st.ec[0]} xc={st.xc[0]}
            hd={st.startDate[0]} setBd={function(v){st.bd[1](v);}} setGen={function(v){st.gen[1](v);}} setMil={function(v){st.mil[1](v);}} setEc={st.ec[1]} setXc={st.xc[1]}/>
        )}
        <div><Label>메모</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.memo[0]} onChange={function(e){st.memo[1](e.target.value);}}/></div>
        {/* 진행 상태 — 항상 보이는 단계 선택 (지원금명 클릭 없이 변경 가능) */}
        <div style={{padding:"13px 15px",background:"#F8FAFC",border:"1.5px solid #E2E8F0",borderRadius:12}}>
          <Label>진행 상태 <span style={{fontWeight:500,color:"#94A3B8"}}>· 현재 단계를 선택하세요</span></Label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {STS.map(function(s){var on=st.status[0]===s.key;return(
              <button key={s.key} type="button" onClick={function(){st.status[1](s.key);}}
                style={{padding:"9px 14px",borderRadius:9,cursor:"pointer",fontFamily:FF,fontSize:"var(--fs-btn)",fontWeight:on?700:500,background:on?s.bg:"#fff",color:on?s.color:"#64748B",border:on?"2px solid "+s.color:"1px solid #E2E8F0"}}>
                {s.icon} {s.label}{on?" ✓":""}
              </button>
            );})}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>직원 저장</button>
        </div>
      </div>
    </Modal>
  );
}

// ── RoundModal (mark round paid) ─────────────────────────
function RoundModal(props){
  var emp=props.emp,ri=props.roundIndex,programs=props.programs;
  if(!emp||ri===null)return null;
  var round=(emp.rounds||[])[ri]||{};
  var p=programs[emp.programId];
  var ed=emp.startDate?addMo(emp.startDate,round.month):null;
  var st1=useState(round.received||round.expectedAmount||0);
  var st2=useState(round.paidDate||new Date().toISOString().split("T")[0]);
  var st3=useState(round.note||"");
  function save(){
    var rounds=(emp.rounds||[]).slice();
    rounds[ri]=Object.assign({},rounds[ri],{isPaid:true,received:clampMoney(st1[0]),paidDate:st2[0],note:st3[0]});
    props.onSave(rounds);
  }
  function unmark(){
    var rounds=(emp.rounds||[]).slice();
    rounds[ri]=Object.assign({},rounds[ri],{isPaid:false,received:0,paidDate:null});
    props.onSave(rounds);
  }
  return(
    <Modal open={props.open} onClose={props.onClose} title={"💳 "+emp.name+" · "+round.label} width={420}>
      <div style={{display:"grid",gap:14}}>
        <div style={{padding:12,background:"#F8FAFC",borderRadius:8,fontSize:12}}>
          <div>{p&&p.name}</div>
          {ed&&<div>신청 가능일: <strong>{fD(ed)}</strong></div>}
          <div>예상금액: <strong>{fMan(round.expectedAmount||0)}</strong></div>
        </div>
        <div><Label>실제 수령액(원)</Label><input type="number" style={inp} value={st1[0]} onChange={function(e){st1[1](e.target.value);}}/></div>
        <div><Label>수령일</Label><input type="date" style={inp} value={st2[0]} onChange={function(e){st2[1](e.target.value);}}/></div>
        <div><Label>메모</Label><input style={inp} value={st3[0]} onChange={function(e){st3[1](e.target.value);}} placeholder="입금 메모..."/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          {round.isPaid&&<button style={Object.assign({},btnSm,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={unmark}>❌ 미수령으로</button>}
          <button style={btnS} onClick={props.onClose}>취소</button>
          <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>✅ 수령 확인</button>
        </div>
      </div>
    </Modal>
  );
}

// ── CompDet (company detail view) ─────────────────────────
function CompDet(props){
  var company=props.company,programs=props.programs,employees=props.employees;
  var uploadFn=props.uploadFn,getUrlFn=props.getUrlFn;
  var compEmps=employees.filter(function(e){return e.companyId===company.id;});
  var st1=useState(false); // add emp modal
  var st2=useState(null);  // edit emp
  var st3=useState(null);  // round modal emp
  var st4=useState(null);  // round modal index
  var st5=useState("all"); // status filter
  var st6=useState(false); // edit company modal
  var stTab=useState("overview"); // 개요/직원/서류/일지
  var stNote=useState("");  // 새 일지 입력
  var stNoteType=useState("전화"); // 일지 유형
  var stEditId=useState(null);  // 편집 중인 일지 id
  var stEditText=useState(""); // 편집 중인 내용
  var stViewMode=useState("card"); // card | table
  var stSelected=useState([]); // bulk-selected emp IDs
  var stHl=useState(null); // '처리하기'로 진입 시 하이라이트할 직원 id

  // 진행보드 등에서 '처리하기'로 넘어오면 해당 직원 편집 모달을 바로 연다
  useEffect(function(){
    if(!props.focusEmpId)return;
    var target=compEmps.find(function(e){return e.id===props.focusEmpId;});
    if(target){
      stTab[1]("employees");
      st2[1](target);
      stHl[1](target.id);
      setTimeout(function(){stHl[1](null);},2500);
    }
    props.onFocusConsumed&&props.onFocusConsumed();
  },[props.focusEmpId]);

  var notes=company.notes||[];
  function addNote(){
    var txt=stNote[0].trim(); if(!txt)return;
    var author=(props.profile&&props.profile.display_name)||"";
    var next=[{id:uid(),text:txt,at:new Date().toISOString(),author:author,type:stNoteType[0]}].concat(notes);
    props.onPatchCompany(company.id,{notes:next});
    stNote[1]("");
    toast("업무 일지가 기록되었습니다.","success");
  }
  function delNote(nid){ props.onPatchCompany(company.id,{notes:notes.filter(function(n){return n.id!==nid;})}); }
  function startEdit(n){ stEditId[1](n.id); stEditText[1](n.text); }
  function saveEdit(nid){
    var txt=stEditText[0].trim(); if(!txt)return;
    props.onPatchCompany(company.id,{notes:notes.map(function(n){return n.id===nid?Object.assign({},n,{text:txt,editedAt:new Date().toISOString()}):n;})});
    stEditId[1](null);
  }
  function cancelEdit(){ stEditId[1](null); stEditText[1](""); }

  var filteredEmps=compEmps.filter(function(e){
    if(st5[0]==="all")return true;
    return e.status===st5[0];
  });
  var activeCount=compEmps.filter(function(e){return e.status!=="resigned";}).length;
  var totalPaid=compEmps.reduce(function(s,e){return s+(e.rounds||[]).reduce(function(ss,r){return ss+(r.isPaid?r.received||0:0);},0);},0);
  var totalExp=compEmps.reduce(function(s,e){return s+(e.totalExpected||0);},0);

  // 업체 서류 완료율
  var compDocs=company.companyDocs||[];
  var docPct=compDocs.length>0?Math.round(compDocs.filter(function(d){return d.done;}).length/compDocs.length*100):0;

  // 이 업체 향후 신청 예정 회차
  var upcoming=useMemo(function(){var list=[];compEmps.forEach(function(e){if(e.status==="resigned")return;var p=programs[e.programId];if(!e.startDate||!p)return;(e.rounds||[]).forEach(function(r){if(r.isPaid)return;var ed=addMo(e.startDate,r.month);var dd=getDday(ed);list.push({empName:e.name,roundLabel:r.label,eligDate:ed,dday:dd,amount:r.expectedAmount||r.amount||0});});});return list.sort(function(a,b){return(a.dday===null?9999:a.dday)-(b.dday===null?9999:b.dday);}).slice(0,8);},[compEmps,programs]);

  // 업체 위험도 지표
  var risk=useMemo(function(){
    var overdue=0,overdueAmt=0,next7=0,docMiss=0;
    compEmps.forEach(function(e){
      if(e.status==="resigned")return;
      (e.rounds||[]).forEach(function(r){
        if(r.isPaid)return; var amt=r.expectedAmount||r.amount||0;
        if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0){overdue++;overdueAmt+=amt;}else if(dd<=7)next7++;}}
      });
      (e.employeeDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
    });
    (compDocs||[]).forEach(function(d){if(!d.done)docMiss++;});
    return{overdue:overdue,overdueAmt:overdueAmt,next7:next7,docMiss:docMiss};
  },[compEmps,compDocs]);

  function stLabel(k){var s=STS.find(function(x){return x.key===k;});return s?s.label:k;}
  function handleSaveEmp(empData){
    if(st2[0]){
      var prev=st2[0];
      props.onPatchEmployee(empData.id,empData);
      if(prev.status!==empData.status&&props.onLog)props.onLog(company.id,empData.name+" 상태가 '"+stLabel(prev.status)+"' → '"+stLabel(empData.status)+"'(으)로 변경됨","상태변경");
      toast("직원 정보가 저장되었습니다.","success");
    } else {
      props.onSaveEmployee(empData);
      if(props.onLog)props.onLog(company.id,empData.name+" 대상자 등록","상태변경");
      toast("직원이 등록되었습니다.","success");
    }
    st1[1](false);
    st2[1](null);
  }
  function handleRoundSave(rounds){
    if(st3[0]){
      var before=st3[0].rounds||[];
      var newlyPaid=rounds.filter(function(r,i){return r.isPaid&&!(before[i]&&before[i].isPaid);});
      props.onPatchEmployee(st3[0].id,{rounds:rounds});
      if(newlyPaid.length>0&&props.onLog)props.onLog(company.id,st3[0].name+" "+newlyPaid.map(function(r){return r.label;}).join(",")+" 지급 확인("+fMan(newlyPaid.reduce(function(s,r){return s+(r.received||0);},0))+")","지급확인");
      toast("회차 지급 상태가 저장되었습니다.","success");
    }
    st3[1](null);st4[1](null);
  }
  function handleBulkUpload(rows){
    rows.forEach(function(row){
      var p=programs[row.programId]||Object.values(programs)[0];
      if(!p)return;
      var rounds=(p.rounds||[]).map(function(r){return Object.assign({},r,{isPaid:false,received:0});});
      props.onSaveEmployee({
        id:ruuid(),companyId:company.id,name:row.name,programId:row.programId||p.id,
        startDate:row.startDate,birthDate:row.birthDate,gender:row.gender||"male",
        status:"preparing",phone:row.phone,email:row.email,
        totalExpected:p.totalAmount||0,rounds:rounds,
        certDocs:(CERT_TYPES[p.id]||[]).map(function(ct){return{id:uid(),label:ct,done:false,files:[]};})
      });
    });
  }

  var TABS=[{key:"overview",icon:"📋",label:"개요"},{key:"employees",icon:"👤",label:"직원 ("+compEmps.length+")"},{key:"docs",icon:"📁",label:"업체 서류"},{key:"commission",icon:"🧾",label:"수수료 정산"},{key:"notes",icon:"📝",label:"업무 일지"+(notes.length>0?" ("+notes.length+")":"")}];

  // 수수료 정산 상태 (company.commission JSONB)
  var comm=company.commission||{};
  var commRate=comm.rate!=null?comm.rate:20;
  var commRetainer=comm.retainer||0;
  var commUseSuccess=comm.successFee!==false; // 성공보수 적용 여부
  var commSuccessFee=commUseSuccess?totalPaid*commRate/100:0;
  var commExpected=Math.round(commRetainer+(commUseSuccess?totalExp*commRate/100:0));
  var commBillable=Math.round(commRetainer+commSuccessFee);
  var commReceivable=comm.paid?0:(comm.billed?commBillable:0);
  function patchComm(patch){ props.onPatchCompany(company.id,{commission:Object.assign({},comm,patch)}); }

  function renderEmpList(){
    var allIds=filteredEmps.map(function(e){return e.id;});
    var selSet=new Set(stSelected[0]);
    var allChecked=allIds.length>0&&allIds.every(function(id){return selSet.has(id);});
    function toggleSelect(id){var cur=stSelected[0].slice();var i=cur.indexOf(id);if(i>=0)cur.splice(i,1);else cur.push(id);stSelected[1](cur);}
    function toggleAll(){if(allChecked)stSelected[1]([]);else stSelected[1](allIds);}
    function bulkStatus(s){var n=stSelected[0].length;stSelected[0].forEach(function(id){props.onPatchEmployee(id,{status:s});});if(n>0&&props.onLog)props.onLog(company.id,n+"명 상태를 '"+stLabel(s)+"'(으)로 일괄 변경","상태변경");stSelected[1]([]);toast(n+"명 상태가 변경되었습니다.","success");}
    function bulkCopy(){var rows=filteredEmps.filter(function(e){return selSet.has(e.id);});var text=rows.map(function(e){var p=programs[e.programId];var s=STS.find(function(s){return s.key===e.status;})||STS[0];return[e.name,(s?s.label:""),(p?p.name:""),e.startDate||""].join("\t");}).join("\n");navigator.clipboard.writeText(text);}
    function getNextDday(emp){if(!emp.startDate)return null;var ddays=(emp.rounds||[]).filter(function(r){return!r.isPaid;}).map(function(r){return getDday(addMo(emp.startDate,r.month));}).filter(function(d){return d!==null&&d>=0;});return ddays.length?Math.min.apply(null,ddays):null;}
    function getRcv(emp){return(emp.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);}
    function getAge(emp){if(!emp.birthDate)return"-";var d=calcAgeDetailed(emp.birthDate,emp.startDate||new Date().toISOString().split("T")[0]);return d?d.years+"세":"-";}
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <h3 style={{margin:0,fontSize:20,fontWeight:700}}>👤 직원 ({compEmps.length}명)</h3>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{display:"flex",background:"#F1F5F9",borderRadius:8,padding:2}}>
              {[["card","🗃️ 카드"],["table","📋 표"]].map(function(arr){var on=stViewMode[0]===arr[0];return(
                <button key={arr[0]} onClick={function(){stViewMode[1](arr[0]);stSelected[1]([]);}}
                  style={{padding:"6px 13px",borderRadius:6,fontSize:"var(--fs-btn)",border:"none",cursor:"pointer",background:on?"#fff":"transparent",color:on?"#2563EB":"#64748B",fontWeight:on?700:400,boxShadow:on?"0 1px 4px rgba(0,0,0,0.08)":"none",fontFamily:FF}}>
                  {arr[1]}
                </button>
              );})}
            </div>
            <BulkUpload programs={programs} onUpload={handleBulkUpload}/>
            <button style={btnP} className="hover-lift" onClick={function(){st1[1](true);}}>+ 직원 추가</button>
          </div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          {[{key:"all",label:"전체 ("+compEmps.length+")"}].concat(STS.map(function(s){var cnt=compEmps.filter(function(e){return e.status===s.key;}).length;return{key:s.key,label:s.icon+" "+s.label+(cnt>0?" ("+cnt+")":""),cnt:cnt};})).map(function(f){return(
            <button key={f.key} onClick={function(){st5[1](f.key);stSelected[1]([]);}}
              style={Object.assign({},btnSm,{fontSize:"var(--fs-btn)",background:st5[0]===f.key?"#2563EB":"#fff",color:st5[0]===f.key?"#fff":"#475569",border:st5[0]===f.key?"none":"1px solid #E2E8F0"})}>
              {f.label}
            </button>
          );})}
        </div>
        {filteredEmps.length===0?(
          compEmps.length===0?
            <EmptyState icon="🧑‍💼" title="등록된 직원이 없습니다" desc="지원금 대상 직원을 등록하면 회차별 신청 일정과 수령 현황이 자동으로 관리됩니다. 엑셀로 여러 명을 한 번에 등록할 수도 있어요." actionLabel="+ 첫 직원 등록하기" action={function(){st1[1](true);}}/>
            :<Card style={{padding:36,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🔍</div><p style={{color:"#94A3B8",fontSize:17,margin:0}}>해당 상태의 직원이 없습니다.</p></Card>
        ):stViewMode[0]==="table"?(
          <Card style={{padding:0,overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-list)"}}>
              <thead>
                <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                  <th style={{padding:"10px 12px",textAlign:"center",width:36}}>
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} style={{cursor:"pointer",width:15,height:15}}/>
                  </th>
                  {["이름","상태","지원금","입사일","나이","수령액","잔여예상","D-Day",""].map(function(h,i){return(
                    <th key={i} style={{padding:"10px 12px",textAlign:"left",fontSize:"var(--fs-label)",fontWeight:700,color:"#475569",whiteSpace:"nowrap"}}>{h}</th>
                  );})}
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map(function(emp,idx){
                  var p=programs[emp.programId];
                  var s=STS.find(function(ss){return ss.key===emp.status;})||STS[0];
                  var rcv=getRcv(emp);
                  var rem=(emp.totalExpected||0)-rcv;
                  var dd=getNextDday(emp);
                  var isSel=selSet.has(emp.id);
                  return(
                    <tr key={emp.id} style={{borderBottom:"1px solid #F1F5F9",background:stHl[0]===emp.id?"#FEF9C3":isSel?"#EFF6FF":idx%2===0?"#fff":"#FAFBFC",transition:"background 0.4s"}}>
                      <td style={{padding:"10px 12px",textAlign:"center"}}>
                        <input type="checkbox" checked={isSel} onChange={function(){toggleSelect(emp.id);}} style={{cursor:"pointer",width:15,height:15}}/>
                      </td>
                      <td style={{padding:"11px 12px",fontWeight:700,color:"#1E293B",fontSize:"var(--fs-name)"}}>{emp.name}</td>
                      <td style={{padding:"11px 12px"}}>
                        <select value={emp.status} onChange={function(e){props.onPatchEmployee(emp.id,{status:e.target.value});}}
                          style={{padding:"5px 8px",borderRadius:6,border:"1px solid #E2E8F0",fontSize:"var(--fs-badge)",background:s.bg,color:s.color,cursor:"pointer",fontFamily:FF,fontWeight:600}}>
                          {STS.map(function(ss){return <option key={ss.key} value={ss.key}>{ss.icon+" "+ss.label}</option>;})}
                        </select>
                      </td>
                      <td style={{padding:"11px 12px",color:"#475569"}}>{p?p.name:"-"}{p&&<span style={{marginLeft:6,fontSize:"var(--fs-badge)",fontWeight:700,color:"#B45309",background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:999,padding:"1px 7px",whiteSpace:"nowrap"}}>{empProgYear(emp,programs)}년</span>}</td>
                      <td style={{padding:"11px 12px",color:"#64748B",fontSize:"var(--fs-meta)"}}>{emp.startDate?fD(emp.startDate):"-"}</td>
                      <td style={{padding:"11px 12px",color:"#64748B",fontSize:"var(--fs-meta)"}}>{getAge(emp)}</td>
                      <td style={{padding:"11px 12px",fontWeight:700,color:"#059669"}}>{fMan(rcv)}</td>
                      <td style={{padding:"11px 12px",color:"#2563EB"}}>{rem>0?fMan(rem):"—"}</td>
                      <td style={{padding:"11px 12px"}}>{dd!==null?<DdayBadge dday={dd}/>:<span style={{color:"#CBD5E1",fontSize:"var(--fs-meta)"}}>—</span>}</td>
                      <td style={{padding:"11px 8px",whiteSpace:"nowrap"}}>
                        <button onClick={function(){st2[1](emp);}} style={{background:"none",border:"none",color:"#64748B",cursor:"pointer",fontSize:17,padding:"2px 6px"}} title="편집">✏️</button>
                        <button onClick={function(){if(window.confirm("'"+emp.name+"' 직원을 삭제하시겠습니까?\n삭제된 직원은 기본 목록에서 숨겨지며, 회차와 서류 관리 내역도 함께 보이지 않습니다."))props.onDeleteEmployee(emp.id);}} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:17,padding:"2px 6px"}} title="삭제">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ):(
          filteredEmps.map(function(emp){return(
            <EmpCard key={emp.id} emp={emp} programs={programs} company={company}
              uploadFn={uploadFn} getUrlFn={getUrlFn} highlight={stHl[0]===emp.id}
              onEdit={function(e){st2[1](e);}}
              onDelete={props.onDeleteEmployee}
              onPatch={function(id,patch){props.onPatchEmployee(id,patch);}}
              onLog={props.onLog}
              onRoundClick={function(e,ri){st3[1](e);st4[1](ri);}}
              onCertToggle={function(e,di){
                var docs=(e.certDocs||[]).slice();
                docs[di]=Object.assign({},docs[di],{done:!docs[di].done});
                props.onPatchEmployee(e.id,{certDocs:docs});
              }}
            />
          );})
        )}
        {stSelected[0].length>0&&(
          <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",gap:12,padding:"14px 22px",background:"#1E293B",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.28)",zIndex:500,color:"#fff",fontFamily:FF,whiteSpace:"nowrap"}}>
            <span style={{fontSize:15,fontWeight:700}}>{stSelected[0].length}명 선택됨</span>
            <div style={{width:1,height:22,background:"rgba(255,255,255,0.2)"}}/>
            <span style={{fontSize:13,opacity:0.7}}>상태 변경:</span>
            <select onChange={function(e){if(e.target.value){bulkStatus(e.target.value);}e.target.value="";}} defaultValue=""
              style={{padding:"6px 10px",borderRadius:8,border:"none",fontSize:"var(--fs-btn)",background:"#334155",color:"#fff",cursor:"pointer",fontFamily:FF}}>
              <option value="" disabled>선택...</option>
              {STS.map(function(s){return <option key={s.key} value={s.key}>{s.icon+" "+s.label}</option>;})}
            </select>
            <button onClick={bulkCopy} style={{padding:"7px 14px",borderRadius:8,background:"#334155",border:"none",color:"#fff",cursor:"pointer",fontSize:"var(--fs-btn)",fontFamily:FF}}>📋 복사</button>
            <button onClick={function(){stSelected[1]([]);}} style={{padding:"7px 11px",borderRadius:8,background:"transparent",border:"1px solid rgba(255,255,255,0.25)",color:"#94A3B8",cursor:"pointer",fontSize:"var(--fs-btn)",fontFamily:FF}}>✕</button>
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="fade-in">
      {/* ── 엑셀 가져오기 '확인 필요' 안내 (reviewIssues 가 있을 때만) ── */}
      {(function(){
        var cIss=Array.isArray(company.reviewIssues)?company.reviewIssues:[];
        var flaggedEmps=compEmps.filter(function(e){return(Array.isArray(e.reviewIssues)&&e.reviewIssues.length>0)||e.reviewNeeded;});
        if(cIss.length===0&&!company.reviewNeeded&&flaggedEmps.length===0)return null;
        return(
          <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
              <span style={{fontSize:13.5,fontWeight:800,color:"#92400E"}}>⚠️ 엑셀 가져오기에서 확인이 필요한 항목이 있습니다.</span>
              <button onClick={function(){
                if(!window.confirm("확인 완료로 처리할까요? 이 업체와 소속 직원의 '확인 필요' 표시가 제거됩니다.\n(데이터 자체는 변경되지 않습니다)"))return;
                if(company.reviewNeeded||cIss.length>0)props.onPatchCompany(company.id,{reviewNeeded:false,reviewIssues:[]});
                flaggedEmps.forEach(function(e){props.onPatchEmployee(e.id,{reviewNeeded:false,reviewIssues:[]});});
                toast("확인 완료로 처리되었습니다.","success");
              }} style={{marginLeft:"auto",background:"#fff",border:"1px solid #FDE68A",color:"#92400E",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"}}>✓ 확인 완료 처리</button>
            </div>
            <ul style={{margin:0,paddingLeft:18,fontSize:12.5,color:"#78350F",lineHeight:1.8}}>
              {cIss.map(function(it,i){return <li key={"c"+i}>{it.message}{it.originalValue?": "+it.originalValue:""}</li>;})}
              {flaggedEmps.map(function(e){return(Array.isArray(e.reviewIssues)?e.reviewIssues:[]).map(function(it,i){return <li key={e.id+"-"+i}>{e.name} — {it.message}{it.originalValue?": "+it.originalValue:""}</li>;});})}
            </ul>
            <div style={{fontSize:11.5,color:"#A16207",marginTop:6}}>업체 정보 수정 또는 직원 탭에서 해당 값을 고친 뒤 ‘확인 완료 처리’를 눌러주세요.</div>
          </div>
        );
      })()}
      {/* ── 업체 핵심 정보 카드 (업체정보 + 액션 + KPI 통합) ── */}
      <Card style={{padding:"20px 22px",marginBottom:16,border:"1px solid #E2E8F0"}}>
        {/* 상단: 업체 정보 + 액션 버튼 */}
        <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:16,paddingBottom:16,borderBottom:"1px solid #F1F5F9"}}>
          <div style={{flex:1,minWidth:240}}>{/* [D-93] 0 → 240: 좁은 칸에서 업체명이 한 글자씩 찌그러지지 않고 버튼 줄이 아래로 내려간다 */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <h2 style={{margin:0,fontSize:28,fontWeight:800,color:"#1E293B"}}>{company.name}</h2>
              {(company.tags||[]).map(function(tid){var tag=TAGS.find(function(t){return t.id===tid;});if(!tag)return null;return <Badge key={tid} color={tag.color} bg={tag.bg}>{tag.label}</Badge>;})}
            </div>
            <div style={{fontSize:16,color:"#94A3B8",marginTop:4}}>{company.bizNo&&company.bizNo+" · "}{company.ceoName&&"대표 "+company.ceoName}</div>
            {(company.managerName||company.managerTitle||company.managerEmail)&&(
              <div style={{fontSize:"var(--fs-sub)",color:"#64748B",marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
                {(company.managerName||company.managerTitle)&&<span>👤 담당자 {company.managerName||""}{company.managerTitle?" "+company.managerTitle:""}</span>}
                {company.managerEmail&&<span style={{color:"#2563EB"}}>✉️ {company.managerEmail}</span>}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",minWidth:0,maxWidth:"100%"}}>{/* [D-94] flexShrink:0 → 좁은 폭에서 단추 줄이 줄바꿈되게 */}
            <AgencyReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
            <PDFReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
            <CommissionReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
            <button style={Object.assign({},btnSm,{background:"transparent",border:"1px solid #E2E8F0",color:"#64748B"})} className="prog-tap" onClick={function(){st6[1](true);}}>⚙️ 업체 정보 수정</button>
          </div>
        </div>
        {/* 중단: 핵심 KPI */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          {[
            {l:"지원 대상자",v:activeCount+"명",c:"#0F172A",accent:null},
            {l:"누적 수령액",v:fMan(totalPaid),c:"#059669",accent:null},
            {l:"예상 잔여액",v:fMan(totalExp-totalPaid),c:"#1D4ED8",accent:null},
            {l:"예상 수수료 ("+commRate+"%)",v:fMan(commExpected),c:"#1D4ED8",accent:null},
            {l:"서류 완료율",v:docPct+"%",c:docPct===100?"#059669":"#0F172A",accent:null,sub:risk.docMiss>0?"미제출 "+risk.docMiss+"건":"모두 완료"},
            {l:"지연 신청 건",v:risk.overdue+"건",c:risk.overdue>0?"#DC2626":"#0F172A",accent:risk.overdue>0?"#DC2626":null,sub:risk.overdue>0?fMan(risk.overdueAmt)+" 위험":"지연 없음"}
          ].map(function(c,i){return(
            <div key={i} className="hover-card" style={{padding:"15px 17px",borderRadius:13,background:"#fff",border:"1px solid #EEF1F5",borderLeft:c.accent?("3px solid "+c.accent):"1px solid #EEF1F5",boxShadow:"0 1px 2px rgba(15,23,42,0.04)"}}>
              <div style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600,marginBottom:7}}>{c.l}</div>
              <div style={{fontSize:26,fontWeight:800,color:c.c,letterSpacing:"-0.5px"}}>{c.v}</div>
              {c.sub&&<div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:4,fontWeight:500}}>{c.sub}</div>}
            </div>
          );})}
        </div>
      </Card>

      {/* 탭 바 */}
      {/* [D-94] 옆으로 밀어야 보이던 탭(“업무 일지 (1” 에서 잘림) → 줄바꿈해서 전부 보이게 */}
      <div style={{display:"flex",flexWrap:"wrap",gap:6,borderBottom:"2px solid #E2E8F0",marginBottom:20}}>
        {TABS.map(function(t){var on=stTab[0]===t.key;return(
          <button key={t.key} className="prog-tap" onClick={function(){stTab[1](t.key);}} style={{padding:"13px 22px",fontSize:18,fontWeight:on?800:600,color:on?"#2563EB":"#64748B",background:on?"#EFF6FF":"none",border:"none",borderRadius:"10px 10px 0 0",borderBottom:on?"3px solid #2563EB":"3px solid transparent",marginBottom:-2,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",flexShrink:0}}>
            {t.icon} {t.label}
          </button>
        );})}
      </div>

      {/* 탭 콘텐츠 */}
      {stTab[0]==="overview"&&(
        <div className="fade-in">
          {/* 위험도 요약 박스 (지연/임박/서류) — 개요 본문 상단으로 이동 */}
          {(risk.overdue>0||risk.next7>0||risk.docMiss>0)&&(
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",marginBottom:16,borderRadius:12,background:"#fff",border:"1px solid #E2E8F0",borderLeft:risk.overdue>0?"3px solid #DC2626":risk.next7>0?"3px solid #2563EB":"3px solid #CBD5E1"}}>
              <span style={{fontSize:22,flexShrink:0}}>{risk.overdue>0?"🚨":risk.next7>0?"⏰":"📁"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:800,color:risk.overdue>0?"#DC2626":"#0F172A"}}>
                  {risk.overdue>0?"지연 신청 "+risk.overdue+"건 — 예상 "+fMan(risk.overdueAmt)+"이 걸려 있습니다":risk.next7>0?"신청 임박 "+risk.next7+"건 — 곧 신청 가능합니다":"미제출 서류 "+risk.docMiss+"건 — 보완이 필요합니다"}
                </div>
                <div style={{fontSize:14,color:"#64748B",marginTop:3}}>
                  {[risk.overdue>0&&risk.next7>0?"7일 내 신청 "+risk.next7+"건":null,risk.docMiss>0?"미제출 서류 "+risk.docMiss+"건":null,"즉시 서류 확인 및 신청 여부를 점검하세요"].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={function(){stTab[1](risk.docMiss>0&&risk.overdue===0&&risk.next7===0?"docs":"employees");}} style={{flexShrink:0,background:risk.overdue>0?"#DC2626":"#2563EB",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}}>확인하기 →</button>
            </div>
          )}
          {/* 스마트 액션 카드: 즉각 조치 필요한 항목만 */}
          {(function(){
            var actions=[];
            compEmps.forEach(function(e){
              if(e.status==="resigned")return;
              var prog=programs[e.programId]; if(!e.startDate||!prog)return;
              (e.rounds||[]).forEach(function(r,ri){
                if(r.isPaid)return;
                var dd=getDday(addMo(e.startDate,r.month));
                if(dd!==null&&dd<=0)actions.push({level:"danger",icon:"🚨",emp:e.name,text:r.label+" 신청 기한 초과! 즉시 처리하세요",dd:dd,empId:e.id});
                else if(dd!==null&&dd<=3)actions.push({level:"warn",icon:"⚠️",emp:e.name,text:r.label+" "+formatDday(dd)+" — 곧 신청 가능",dd:dd,empId:e.id});
              });
            });
            if(actions.length===0)return null;
            actions.sort(function(a,b){return a.dd-b.dd;});
            return(
              <div style={{marginBottom:16,display:"grid",gap:8}}>
                {actions.slice(0,3).map(function(a,i){return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,background:"#fff",border:"1px solid #E2E8F0",borderLeft:a.level==="danger"?"3px solid #DC2626":"3px solid #CBD5E1"}}>
                    <span style={{fontSize:18,flexShrink:0}}>{a.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:"var(--fs-name)",fontWeight:700,color:"#1E293B"}}>{a.emp}</span>
                      <span style={{fontSize:"var(--fs-sub)",color:"#64748B",marginLeft:8}}>{a.text}</span>
                    </div>
                    <DdayBadge dday={a.dd}/>
                  </div>
                );})}
              </div>
            );
          })()}
          <Card style={{padding:22,marginBottom:16}}>
            <h3 style={{margin:"0 0 14px",fontSize:20,fontWeight:700}}>🔔 향후 신청 예정</h3>
            {upcoming.length===0?(
              <div style={{textAlign:"center",padding:"28px 0"}}><div style={{fontSize:36,marginBottom:8}}>🗓️</div><p style={{color:"#94A3B8",fontSize:16,margin:0}}>예정된 신청 건이 없습니다. 직원을 등록하면 회차 일정이 표시됩니다.</p></div>
            ):upcoming.map(function(u,i){return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",borderRadius:10,background:i%2===0?"#F8FAFC":"#fff",marginBottom:4}}>
                <div><span style={{fontSize:17,fontWeight:600,color:"#1E293B"}}>{u.empName}</span><span style={{fontSize:15,color:"#94A3B8",marginLeft:8}}>{u.roundLabel} · {fD(u.eligDate)}</span></div>
                <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:17,fontWeight:700,color:"#2563EB"}}>{fMan(u.amount)}</span><DdayBadge dday={u.dday}/></div>
              </div>
            );})}
          </Card>
          {(function(){
            var CUR_Y=new Date().getFullYear();
            // 진행 중인 지원금(직원 기준) + 등록된 programInfos를 연도별로 합쳐 행 구성
            var seen={};var rows=[];
            compEmps.forEach(function(e){if(e.status==="resigned")return;var p=programs[e.programId];if(!p)return;var y=empProgYear(e,programs);var key=p.id+"_"+y;if(seen[key])return;seen[key]=true;rows.push({p:p,year:y});});
            (company.programInfos||[]).forEach(function(pi){var p=programs[pi.programId];if(!p)return;var y=Number(pi.year)||CUR_Y;var key=p.id+"_"+y;if(seen[key])return;seen[key]=true;rows.push({p:p,year:y});});
            if(rows.length===0)return null;
            function partColors(s){return s==="신청 완료"?{bg:"#DBEAFE",fg:"#2563EB",bd:"#93C5FD"}:s==="협약 완료"?{bg:"#D1FAE5",fg:"#059669",bd:"#6EE7B7"}:s==="확인 필요"?{bg:"#FEF3C7",fg:"#B45309",bd:"#FDE68A"}:{bg:"#F1F5F9",fg:"#64748B",bd:"#CBD5E1"};}
            return(
              <Card style={{padding:22,marginBottom:16}}>
                <h3 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>🏛️ 관할·운영기관</h3>
                <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginBottom:12}}>운영기관·담당자 정보는 컨설턴트가 직접 확인해 입력·관리합니다.</div>
                <div style={{display:"grid",gap:10}}>
                  {rows.map(function(row){
                    var p=row.p,gp=GROUP_COLORS[p.group]||GROUP_COLORS["커스텀"];
                    var info=getProgramInfo(company,p.id,row.year)||{};
                    var part=info.participationStatus||(info.agreementDate?"협약 완료":"");
                    var pc=partColors(part);
                    var hasAgency=!!(info.agencyName||info.agencyManager||info.agencyPhone||info.agencyEmail);
                    var agencyMemo=info.agencyMemo||info.memo||"";
                    return(
                    <div key={p.id+"_"+row.year} style={{padding:"13px 15px",borderRadius:12,background:"#fff",border:"1px solid "+gp.light}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                        <span style={{fontSize:"var(--fs-name)",fontWeight:700,color:gp.dark}}>{gp.icon} {p.name} · {row.year}년</span>
                        <span style={{fontSize:"var(--fs-badge)",fontWeight:700,padding:"3px 11px",borderRadius:999,background:pc.bg,color:pc.fg,border:"1px solid "+pc.bd,whiteSpace:"nowrap"}}>사업참여신청: {part||"미입력"}</span>
                      </div>
                      <div style={{display:"grid",gap:3,fontSize:"var(--fs-sub)",lineHeight:1.6}}>
                        <div><span style={{color:"#94A3B8"}}>운영기관</span> <span style={{color:info.agencyName?"#1E293B":"#CBD5E1",fontWeight:info.agencyName?600:400}}>{info.agencyName||"미입력"}</span></div>
                        <div><span style={{color:"#94A3B8"}}>담당자</span> <span style={{color:info.agencyManager?"#1E293B":"#CBD5E1",fontWeight:info.agencyManager?600:400}}>{info.agencyManager?(info.agencyManager+(info.agencyManagerTitle?" "+info.agencyManagerTitle:"")):"미입력"}</span></div>
                        <div><span style={{color:"#94A3B8"}}>연락처</span> <span style={{color:info.agencyPhone?"#1E293B":"#CBD5E1",fontWeight:info.agencyPhone?600:400}}>{info.agencyPhone||"미입력"}</span></div>
                        <div><span style={{color:"#94A3B8"}}>이메일</span> <span style={{color:info.agencyEmail?"#1E293B":"#CBD5E1",fontWeight:info.agencyEmail?600:400}}>{info.agencyEmail||"미입력"}</span></div>
                        {agencyMemo&&<div><span style={{color:"#94A3B8"}}>메모</span> <span style={{color:"#475569"}}>{agencyMemo}</span></div>}
                      </div>
                      {part!=="협약 완료"&&(
                        <div style={{marginTop:8,padding:"7px 11px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,fontSize:"var(--fs-meta)",color:"#92400E",lineHeight:1.5}}>⚠️ 사업참여신청 또는 협약 상태에 따라 실제 신청 가능 여부가 달라질 수 있습니다.</div>
                      )}
                      {!hasAgency&&(
                        <button onClick={function(){st6[1](true);}} style={Object.assign({},btnSm,{marginTop:8,fontSize:"var(--fs-btn)",background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE"})}>📝 운영기관 정보 입력하기</button>
                      )}
                    </div>
                    );
                  })}
                </div>
                <div style={{marginTop:12,paddingTop:10,borderTop:"1px dashed #E2E8F0",fontSize:"var(--fs-meta)",color:"#94A3B8",lineHeight:1.6}}>참고: <a href="https://work24.go.kr" target="_blank" rel="noopener noreferrer" style={{color:"#64748B",textDecoration:"underline"}}>고용24(work24.go.kr)</a>에서 사업 공고 및 참여신청 여부를 확인하세요. (운영기관 정보와는 별개의 참고용 링크입니다)</div>
              </Card>
            );
          })()}
          <Card style={{padding:22,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700}}>📁 업체 서류 진행률</h3>
              <span style={docPct===100?successBadge():neutralBadge()}>{docPct}%</span>
            </div>
            <div style={{height:10,background:"#F1F5F9",borderRadius:5,overflow:"hidden",marginBottom:8}}><div style={{height:"100%",width:docPct+"%",background:docPct===100?"#059669":"#2563EB",borderRadius:5,transition:"width 0.5s ease"}}/></div>
            <button style={Object.assign({},btnSm,{fontSize:15})} onClick={function(){stTab[1]("docs");}}>서류 관리하기 →</button>
          </Card>
          {/* 업무 일지 미리보기 */}
          <Card style={{padding:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{margin:0,fontSize:20,fontWeight:700}}>📝 업무 일지</h3>
              <button style={Object.assign({},btnSm,{fontSize:14})} onClick={function(){stTab[1]("notes");}}>전체 보기 →</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              <select value={stNoteType[0]} onChange={function(e){stNoteType[1](e.target.value);}} style={{fontSize:14,padding:"9px 10px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#fff",color:"#475569",cursor:"pointer",fontFamily:FF,outline:"none"}}>
                {NOTE_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.icon} {t.id}</option>;})}
              </select>
              <input style={Object.assign({},inpKo,{flex:1,minWidth:140,fontSize:14,padding:"9px 12px"})} value={stNote[0]} onChange={function(e){stNote[1](e.target.value);}} placeholder="통화·제출·특이사항 기록…" onKeyDown={function(e){if(e.key==="Enter")addNote();}}/>
              <button style={Object.assign({},btnP,{padding:"9px 18px",fontSize:14})} onClick={addNote}>업무 기록</button>
            </div>
            {notes.length===0?(
              <div style={{textAlign:"center",padding:"20px 0"}}><div style={{fontSize:28,marginBottom:6}}>🗒️</div><p style={{color:"#94A3B8",fontSize:15,margin:0}}>첫 일지를 남겨보세요.</p></div>
            ):notes.slice(0,3).map(function(n){return(
              <div key={n.id} style={{padding:"10px 12px",borderRadius:8,background:"#F8FAFC",border:"1px solid #F1F5F9",marginBottom:6}}>
                <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginBottom:3,display:"flex",alignItems:"center",gap:6}}>{n.type&&<span style={{fontWeight:700,color:n.auto?"#64748B":"#2563EB"}}>{noteTypeMeta(n.type).icon} {n.type}{n.auto?"·자동":""}</span>}<span>{fDateTime(n.at)}{n.author&&" · "+n.author}</span></div>
                <div style={{fontSize:"var(--fs-sub)",color:"#1E293B",lineHeight:1.5}}>{n.text}</div>
              </div>
            );})}
            {notes.length>3&&<div style={{textAlign:"center",marginTop:8}}><button style={Object.assign({},btnSm,{fontSize:13})} onClick={function(){stTab[1]("notes");}}>일지 {notes.length-3}개 더 보기</button></div>}
          </Card>
        </div>
      )}

      {stTab[0]==="employees"&&<div className="fade-in">{renderEmpList()}</div>}

      {stTab[0]==="docs"&&(
        <div className="fade-in">
          <DocSection title="업체 서류" docs={company.companyDocs||[]} disabled={false}
            quickDocs={COMPANY_QUICK_DOCS} defaultDocs={COMPANY_DOC_DEFAULTS} payday={company.payday} contactName={company.managerName}
            uploadFn={uploadFn} getUrlFn={getUrlFn}
            onChange={function(ds){props.onPatchCompany(company.id,{companyDocs:ds});}}
            onLog={function(txt,type){props.onLog(company.id,txt,type);}}
          />
        </div>
      )}

      {stTab[0]==="commission"&&(
        <div className="fade-in">
          {!(props.tier&&props.tier.feat.commission)?(
            <Card style={{padding:"44px 32px",textAlign:"center",border:"1px solid #E2E8F0",background:"#F8FAFC"}}>
              <div style={{fontSize:46,marginBottom:14}}>🔒</div>
              <h3 style={{margin:"0 0 8px",fontSize:22,fontWeight:800,color:"#1D4ED8"}}>수수료 정산은 프로 플랜 전용입니다</h3>
              <p style={{margin:"0 0 22px",fontSize:15,color:"#475569",lineHeight:1.7}}>업체별 수수료율·착수금·청구/입금 상태·미수금을 한 곳에서 관리하고,<br/>정산서를 자동 생성해 고객에게 바로 보낼 수 있습니다.</p>
              <button style={Object.assign({},btnP,{padding:"14px 32px",fontSize:16})} onClick={props.onOpenBilling||function(){}}>프로 플랜으로 업그레이드 →</button>
            </Card>
          ):(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>
                {[
                  {l:"수령 완료액",v:fMan(totalPaid),c:"#2563EB",i:"✅"},
                  {l:"예상 총 수수료",v:fMan(commExpected),c:"#0D9488",i:"💰",sub:"착수금+전체 "+commRate+"%"},
                  {l:"청구 가능액",v:fMan(commBillable),c:"#059669",i:"🧾",sub:"수령액 기준 "+commRate+"%"},
                  {l:"미수금",v:fMan(commReceivable),c:commReceivable>0?"#DC2626":"#94A3B8",i:commReceivable>0?"⏳":"👍",sub:comm.paid?"입금 완료":comm.billed?"청구 후 미입금":"미청구"}
                ].map(function(c,i){return(
                  <Card key={i} className="kpi-card" style={{padding:"16px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600}}>{c.l}</span><span style={{fontSize:18}}>{c.i}</span></div>
                    <div style={{fontSize:23,fontWeight:800,color:c.c}}>{c.v}</div>
                    {c.sub&&<div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:3}}>{c.sub}</div>}
                  </Card>
                );})}
              </div>

              <Card style={{padding:22,marginBottom:16}}>
                <h3 style={{margin:"0 0 16px",fontSize:19,fontWeight:700}}>⚙️ 정산 설정</h3>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
                  <div><Label>수수료율 (%)</Label><input type="number" style={inp} value={commRate} min="0" max="100" step="0.5" onChange={function(e){patchComm({rate:clampRate(e.target.value)});}}/></div>
                  <div><Label>착수금 (원)</Label><input type="number" style={inp} value={commRetainer} min="0" onChange={function(e){patchComm({retainer:clampMoney(e.target.value)});}}/></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:16}}>
                  {[
                    {k:"successFee",label:"성공보수 적용",on:comm.successFee!==false},
                    {k:"billed",label:"청구 완료",on:!!comm.billed,type:"수수료청구"},
                    {k:"paid",label:"입금 완료",on:!!comm.paid,type:"수수료입금"},
                    {k:"taxInvoice",label:"세금계산서 발행",on:!!comm.taxInvoice}
                  ].map(function(t){return(
                    <button key={t.k} onClick={function(){var nv=!t.on;patchComm((function(){var o={};o[t.k]=nv;return o;})());if(t.type&&nv&&props.onLog)props.onLog(company.id,(t.k==="billed"?"수수료 청구 완료 ("+fMan(commBillable)+")":"수수료 입금 완료 ("+fMan(commBillable)+")"),t.type);toast(t.label+(nv?" 처리됨":" 해제됨"),nv?"success":"info");}}
                      style={{padding:"12px 14px",borderRadius:10,border:"1.5px solid "+(t.on?"#6EE7B7":"#E2E8F0"),background:t.on?"#ECFDF5":"#fff",color:t.on?"#047857":"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF,textAlign:"left"}}>
                      {t.on?"✅ ":"⬜ "}{t.label}
                    </button>
                  );})}
                </div>
                <div><Label>수수료 메모</Label><textarea style={Object.assign({},inpKo,{height:60,resize:"none",fontSize:14})} value={comm.memo||""} onChange={function(e){patchComm({memo:e.target.value});}} placeholder="계약 조건·청구 일정·특이사항 등"/></div>
              </Card>

              <Card style={{padding:22,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <h3 style={{margin:0,fontSize:19,fontWeight:700}}>👤 직원별 수수료 ({commRate}%)</h3>
                  <CommissionReport company={company} employees={compEmps} programs={programs} profile={props.profile} onLog={props.onLog}/>
                </div>
                {(function(){var paidEmps=compEmps.filter(function(e){return(e.rounds||[]).some(function(r){return r.isPaid;});});if(paidEmps.length===0)return <p style={{color:"#94A3B8",fontSize:15,textAlign:"center",padding:"16px 0",margin:0}}>아직 수령 완료된 직원이 없습니다. 회차 지급이 확정되면 수수료가 자동 집계됩니다.</p>;return(
                  <div style={{display:"grid",gap:6}}>{paidEmps.map(function(e){var rcv=(e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?r.received||0:0);},0);var f=Math.round(rcv*commRate/100);var pr=programs[e.programId];return(
                    <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderRadius:9,background:"#F8FAFC",border:"1px solid #F1F5F9"}}>
                      <div><span style={{fontSize:16,fontWeight:700,color:"#1E293B"}}>{e.name}</span><span style={{fontSize:13,color:"#94A3B8",marginLeft:8}}>{pr?pr.name:""}</span></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:13,color:"#64748B"}}>수령 {fMan(rcv)}</div><div style={{fontSize:16,fontWeight:800,color:"#059669"}}>수수료 {fMan(f)}</div></div>
                    </div>
                  );})}</div>
                );})()}
              </Card>
            </div>
          )}
        </div>
      )}

      {stTab[0]==="notes"&&(
        <div className="fade-in">
          <Card style={{padding:22}}>
            <h3 style={{margin:"0 0 16px",fontSize:20,fontWeight:700}}>📝 업무 일지</h3>
            {/* 새 일지 입력 */}
            <div style={{marginBottom:10,display:"flex",gap:6,flexWrap:"wrap"}}>
              {NOTE_TYPES.map(function(t){var on=stNoteType[0]===t.id;return(
                <button key={t.id} onClick={function(){stNoteType[1](t.id);}} style={{padding:"6px 12px",borderRadius:8,fontSize:13,fontWeight:on?700:500,cursor:"pointer",fontFamily:FF,border:on?"none":"1px solid #E2E8F0",background:on?"#2563EB":"#fff",color:on?"#fff":"#475569"}}>{t.icon} {t.id}</button>
              );})}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              <textarea style={Object.assign({},inpKo,{flex:1,height:68,resize:"none",fontSize:15})}
                value={stNote[0]} onChange={function(e){stNote[1](e.target.value);}}
                placeholder="진행 상황·통화 내용·제출 기록·특이사항 등을 남겨보세요 (Ctrl+Enter 로 기록)"
                onKeyDown={function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))addNote();}}/>
              <button style={Object.assign({},btnP,{padding:"0 20px",alignSelf:"stretch",fontSize:15})} onClick={addNote}>업무 기록</button>
            </div>
            {/* 일지 목록 */}
            {notes.length===0?(
              <div style={{textAlign:"center",padding:"36px 0"}}>
                <div style={{fontSize:36,marginBottom:10}}>🗒️</div>
                <p style={{color:"#94A3B8",fontSize:16,margin:0}}>아직 기록이 없습니다. 첫 일지를 남겨보세요.</p>
              </div>
            ):(
              <div style={{position:"relative",paddingLeft:22}}>
                <div style={{position:"absolute",left:7,top:6,bottom:6,width:2,background:"#E2E8F0"}}/>
                {notes.map(function(n){
                  var isEditing=stEditId[0]===n.id;
                  return(
                    <div key={n.id} style={{marginBottom:14,position:"relative"}}>
                      <div style={{position:"absolute",left:-19,top:14,width:10,height:10,borderRadius:5,background:n.auto?"#94A3B8":"#2563EB",border:"2px solid #fff",boxShadow:"0 0 0 2px "+(n.auto?"#E2E8F0":"#DBEAFE")}}/>
                      <div style={{background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0",padding:"12px 14px",marginLeft:4}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                          <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            {n.type&&<span style={{fontWeight:700,fontSize:"var(--fs-badge)",padding:"2px 8px",borderRadius:6,background:n.auto?"#F1F5F9":"#DBEAFE",color:n.auto?"#64748B":"#1D4ED8"}}>{noteTypeMeta(n.type).icon} {n.type}{n.auto?" · 자동":""}</span>}
                            <span>{fDateTime(n.at)}{n.author&&" · "+n.author}</span>
                            {n.editedAt&&<span style={{color:"#CBD5E1",fontSize:"var(--fs-meta)"}}>(수정됨)</span>}
                          </div>
                          {!isEditing&&(
                            <div style={{display:"flex",gap:4,flexShrink:0}}>
                              <button onClick={function(){startEdit(n);}}
                                style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:14,padding:"1px 5px",borderRadius:4,lineHeight:1}} title="편집">✏️</button>
                              <button onClick={function(){if(window.confirm("삭제하겠습니까?"))delNote(n.id);}}
                                style={{background:"none",border:"none",color:"#CBD5E1",cursor:"pointer",fontSize:14,padding:"1px 5px",borderRadius:4,lineHeight:1}} title="삭제">🗑️</button>
                            </div>
                          )}
                        </div>
                        {isEditing?(
                          <div>
                            <textarea style={Object.assign({},inp,{height:72,resize:"none",fontSize:15,marginBottom:8,borderColor:"#93C5FD"})}
                              value={stEditText[0]} onChange={function(e){stEditText[1](e.target.value);}}
                              autoFocus
                              onKeyDown={function(e){if(e.key==="Enter"&&(e.metaKey||e.ctrlKey))saveEdit(n.id);if(e.key==="Escape")cancelEdit();}}/>
                            <div style={{display:"flex",gap:6}}>
                              <button style={Object.assign({},btnP,{padding:"7px 18px",fontSize:14})} onClick={function(){saveEdit(n.id);}}>저장</button>
                              <button style={Object.assign({},btnS,{padding:"7px 14px",fontSize:14})} onClick={cancelEdit}>취소</button>
                            </div>
                          </div>
                        ):(
                          <div style={{fontSize:16,color:"#1E293B",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{n.text}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modals */}
      {(st1[0]||st2[0])&&(
        <EmpModal open={true} onClose={function(){st1[1](false);st2[1](null);}}
          emp={st2[0]} company={company} programs={programs} employees={compEmps} onSave={handleSaveEmp} onOpenWage={props.onOpenWage}/>
      )}
      <RoundModal open={!!st3[0]&&st4[0]!==null} onClose={function(){st3[1](null);st4[1](null);}}
        emp={st3[0]} roundIndex={st4[0]} programs={programs} onSave={handleRoundSave}/>
      {st6[0]&&<CompanyEditModal open={true} onClose={function(){st6[1](false);}} company={company} programs={programs}
        onSave={function(data){props.onPatchCompany(company.id,data);st6[1](false);toast("업체 정보가 저장되었습니다.","success");}}
        onDelete={props.onDeleteCompany?function(id){props.onDeleteCompany(id);st6[1](false);if(props.goBack)props.goBack();}:null}/>}
    </div>
  );
}

// ── getProgramInfo 헬퍼 ──────────────────────────────────
function getProgramInfo(company,programId,year){
  var infos=(company&&company.programInfos)||[];
  var match=infos.find(function(i){return i.programId===programId&&Number(i.year)===Number(year);});
  if(match)return match;
  if(programId==="youth_jump"){
    return{programId:programId,year:year,
           quota:Number((company&&company.youthQuota)||0),
           applyDate:(company&&company.youthApplyDate)||"",
           agreementDate:(company&&company.agreementDate)||"",
           payday:(company&&company.payday)||""};
  }
  return null;
}

// ── CompanyEditModal ──────────────────────────────────────
function CompanyEditModal(props){
  var c=props.company||{};
  var stAdv=useState(false);
  var stBizTypeCustom=useState(INDUSTRY_OPTIONS.indexOf(c.bizType||"")>=0?false:(c.bizType?true:false));
  var st={
    osId:useState(c.osId||props.presetOsId||""), // [D-93] 고객 운영 업체 id · [D-94] 업체에서 열었으면 골라 둔다
    name:useState(c.name||""),
    bizNo:useState(c.bizNo||""),
    ceoName:useState(c.ceoName||""),
    addr:useState(c.addr||""),
    phone:useState(c.phone||""),
    email:useState(c.email||""),
    managerName:useState(c.managerName||""),
    managerTitle:useState(c.managerTitle||""),
    managerEmail:useState(c.managerEmail||""),
    payday:useState(c.payday||""),
    empCount:useState(c.empCount||""),
    bizType:useState(c.bizType||""),
    corpType:useState(c.corpType||"개인"),
    establishedDate:useState(c.establishedDate||""),
    juPosition:useState(c.juPosition||""),
    sector:useState(c.sector||""),
    region:useState(c.region||"비수도권"),
    insuranceDate:useState(c.insuranceDate||""),
    youthQuota:useState(c.youthQuota||""),
    youthApplyDate:useState(c.youthApplyDate||""),
    agreementDate:useState(c.agreementDate||""),
    bizStatus:useState(c.bizStatus||"정상"),
    customStatus:useState(c.customStatus||""),
    statusMemo:useState(c.statusMemo||""),
    memo:useState(c.memo||""),
    tags:useState(c.tags||[]),
    programInfos:useState(c.programInfos||[])
  };
  var needsStatusMemo=["보류","중단","진행불가"].indexOf(st.bizStatus[0])>=0;
  var progs=props.programs||DEFAULT_PROGRAMS;
  function addProgramInfo(){
    var pid=Object.keys(progs)[0]||"youth_jump";
    var p=progs[pid]||{};
    st.programInfos[1](st.programInfos[0].concat([{id:uid(),programId:pid,programName:p.name||pid,year:p.year||new Date().getFullYear(),quota:"",applyDate:"",agreementDate:"",participationStatus:"미신청",agencyName:"",agencyManager:"",agencyManagerTitle:"",agencyPhone:"",agencyEmail:"",agencyMemo:"",memo:""}]));
  }
  function updateProgramInfo(idx,patch){
    var arr=st.programInfos[0].slice();arr[idx]=Object.assign({},arr[idx],patch);st.programInfos[1](arr);
  }
  function removeProgramInfo(idx){
    st.programInfos[1](st.programInfos[0].filter(function(_,i){return i!==idx;}));
  }
  // [D-93] 업체는 고객 운영에만 있다 — 새로 넣을 때는 고객 운영 업체를 고르고, 그 기록으로 칸을 채운다
  var isNew=!(props.company&&props.company.id);
  function pickOs(id){
    st.osId[1](id);
    var oc=(props.osClients||[]).find(function(x){return x.id===id;}); if(!oc)return;
    ["name","bizNo","ceoName","addr","phone","email","managerName","managerTitle","managerEmail","corpType","establishedDate","bizType","empCount","region"].forEach(function(k){if(oc[k]!==undefined&&oc[k]!=="")st[k][1](oc[k]);});
  }
  useEffect(function(){ if(isNew&&props.presetOsId)pickOs(props.presetOsId); },[]); // [D-94] 골라 둔 업체의 기록으로 칸 채우기
  function save(){
    if(isNew&&!st.osId[0]){toast("고객 운영 업체를 고르세요","warn");return;}
    if(!st.name[0].trim()){toast("업체명을 입력하세요","warn");return;}
    if(!isValidEmail(st.email[0])){toast("이메일 형식을 확인하세요","warn");return;}
    if(!isValidEmail(st.managerEmail[0])){toast("담당자 이메일 형식을 확인하세요","warn");return;}
    var badAgencyEmail=(st.programInfos[0]||[]).some(function(pi){return pi.agencyEmail&&!isValidEmail(pi.agencyEmail);});
    if(badAgencyEmail){toast("운영기관 담당자 이메일 형식을 확인하세요","warn");return;}
    var data={};
    Object.keys(st).forEach(function(k){data[k]=st[k][0];});
    data.name=data.name.trim();
    props.onSave(data);
  }
  function toggleTag(tid){
    var cur=st.tags[0].slice();
    var i=cur.indexOf(tid);
    if(i>=0)cur.splice(i,1);else cur.push(tid);
    st.tags[1](cur);
  }
  return(
    <Modal open={props.open} onClose={props.onClose} title="🏢 업체 정보" width={560}>
      <div style={{display:"grid",gap:12}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>업체명 *</Label>{isNew?(
            <select data-testid="emp-client-pick" aria-label="고객 운영 업체" style={inp} value={st.osId[0]} onChange={function(e){pickOs(e.target.value);}}>
              <option value="">고객 운영 업체 고르기…</option>
              {(props.osClients||[]).map(function(oc){return <option key={oc.id} value={oc.id} disabled={!!oc.taken}>{oc.name}{oc.taken?" (등록됨)":""}</option>;})}
            </select>
          ):(<input style={Object.assign({},inp,{background:"#F8FAFC",color:"#475569"})} value={st.name[0]} readOnly title="업체 이름은 고객 운영에서 고칩니다"/>)}
          {isNew&&<div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>업체는 고객 운영에만 있습니다. 여기서는 고용지원금으로 관리할 업체를 고릅니다.</div>}</div>
          <div><Label>사업자등록번호</Label><input style={inp} value={st.bizNo[0]} onChange={function(e){st.bizNo[1](fmtBizNo(e.target.value));}} placeholder="000-00-00000" inputMode="numeric"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>대표자</Label><input style={inp} value={st.ceoName[0]} onChange={function(e){st.ceoName[1](e.target.value);}}/></div>
          <div><Label>법인구분</Label>
            <select style={inp} value={st.corpType[0]} onChange={function(e){st.corpType[1](e.target.value);}}>
              {["개인","법인"].map(function(t){return <option key={t}>{t}</option>;})}
            </select>
          </div>
        </div>
        {st.corpType[0]==="법인"&&<div><Label>주식회사 표기 위치</Label>
          <div style={{display:"flex",gap:4}}>
            {[["앞","(주)ABC"],["뒤","ABC(주)"],["","없음"]].map(function(arr){var on=st.juPosition[0]===arr[0];return(
              <button key={arr[0]} onClick={function(){st.juPosition[1](arr[0]);}} style={Object.assign({},btnSm,{flex:1,fontSize:11,background:on?"#DBEAFE":"#fff",color:on?"#2563EB":"#64748B",border:on?"2px solid #93C5FD":"1px solid #E2E8F0"})}>{arr[1]}</button>
            );})}
          </div>
        </div>}
        <div>
          <Label>{st.corpType[0]==="법인"?"법인 설립일":"개업일"}</Label>
          <input type="date" style={inp} value={st.establishedDate[0]} onChange={function(e){st.establishedDate[1](e.target.value);}}/>
          <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>업체 목록의 업력(N년차) 표시에 사용됩니다. (선택 입력)</div>
        </div>
        <div>
          <Label>주소</Label>
          <input style={inp} value={st.addr[0]} onChange={function(e){st.addr[1](e.target.value);}} placeholder="협약서·서류 원본 우편 발송에 사용됩니다"/>
          <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>📮 협약서 체결·서류 원본 보관·우편 발송에 필요하므로 정확히 입력해 주세요.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Label>전화</Label><input style={inp} value={st.phone[0]} onChange={function(e){st.phone[1](fmtPhone(e.target.value));}} inputMode="numeric" placeholder="02-000-0000"/></div>
          <div><Label>대표 이메일</Label><input type="email" style={inp} value={st.email[0]} onChange={function(e){st.email[1](e.target.value);}} placeholder="name@company.com"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><Label>담당자명</Label><input style={inp} value={st.managerName[0]} onChange={function(e){st.managerName[1](e.target.value);}} placeholder="실무 담당자"/></div>
          <div><Label>담당자 직함</Label><input style={inp} value={st.managerTitle[0]} onChange={function(e){st.managerTitle[1](e.target.value);}} placeholder="과장·팀장 등"/></div>
          <div><Label>담당자 이메일</Label><input type="email" style={inp} value={st.managerEmail[0]} onChange={function(e){st.managerEmail[1](e.target.value);}} placeholder="manager@company.com"/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div><Label>상시근로자 수</Label><input type="number" style={inp} value={st.empCount[0]} onChange={function(e){st.empCount[1](e.target.value);}}/></div>
          <div>
            <Label>업종</Label>
            <select style={inp} value={stBizTypeCustom[0]?"기타/직접입력":(st.bizType[0]||"")} onChange={function(e){var v=e.target.value;if(v==="기타/직접입력"){stBizTypeCustom[1](true);st.bizType[1]("");}else{stBizTypeCustom[1](false);st.bizType[1](v);}}}>
              <option value="">선택...</option>
              {INDUSTRY_OPTIONS.map(function(o){return <option key={o} value={o}>{o}</option>;})}
            </select>
            {stBizTypeCustom[0]&&<input style={Object.assign({},inp,{marginTop:4,fontSize:12})} value={st.bizType[0]} onChange={function(e){st.bizType[1](e.target.value);}} placeholder="업종 직접 입력"/>}
          </div>
          <div><Label>지역</Label>
            <select style={inp} value={st.region[0]} onChange={function(e){st.region[1](e.target.value);}}>
              <option value="수도권">수도권 (서울·경기·인천)</option>
              <option value="비수도권">비수도권</option>
            </select>
          </div>
        </div>
        <div>
          <button type="button" onClick={function(){stAdv[1](!stAdv[0]);}} style={{background:"none",border:"none",color:"#64748B",fontSize:12,cursor:"pointer",padding:"6px 0",display:"flex",alignItems:"center",gap:4}}>
            <span style={{display:"inline-block",transition:"transform 0.15s",transform:stAdv[0]?"rotate(90deg)":"none"}}>▶</span> 고급 정보 (고용보험 성립일 · 분야/유형)
          </button>
          {stAdv[0]&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:6,padding:10,background:"#F8FAFC",borderRadius:8,border:"1px solid #E2E8F0"}}>
              <div><Label>고용보험 성립일</Label><input type="date" style={inp} value={st.insuranceDate[0]} onChange={function(e){st.insuranceDate[1](e.target.value);}}/></div>
              <div><Label>분야/유형</Label><input style={inp} value={st.sector[0]} onChange={function(e){st.sector[1](e.target.value);}}/></div>
            </div>
          )}
        </div>
        {/* 청년일자리도약장려금 진행 정보 */}
        <div style={{padding:"12px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#1D4ED8",marginBottom:10}}>⭐ 청년일자리도약장려금 진행 정보</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><Label>기업 지원한도 인원수</Label><input type="number" min="0" style={inp} value={st.youthQuota[0]} onChange={function(e){st.youthQuota[1](e.target.value);}} placeholder="예: 5"/></div>
            <div><Label>급여일 (매월)</Label><input type="number" min="1" max="31" style={inp} value={st.payday[0]} onChange={function(e){st.payday[1](e.target.value);}} placeholder="예: 25"/></div>
            <div><Label>참여신청일</Label><input type="date" style={inp} value={st.youthApplyDate[0]} onChange={function(e){st.youthApplyDate[1](e.target.value);}}/></div>
            <div><Label>협약일</Label><input type="date" style={inp} value={st.agreementDate[0]} onChange={function(e){st.agreementDate[1](e.target.value);}}/></div>
          </div>
          {!st.agreementDate[0]&&<div style={{fontSize:11,color:"#B45309",marginTop:8,padding:"6px 10px",background:"#FFFBEB",borderRadius:6,border:"1px solid #FDE68A"}}>⚠️ 협약 체결 전에는 실제 신청 진행이 제한될 수 있습니다.</div>}
        </div>
        {/* 지원금별 진행 정보 (programInfos) */}
        <div style={{padding:"14px 16px",background:"#F0F9FF",borderRadius:12,border:"1px solid #BAE6FD"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#0284C7"}}>📋 지원금별 진행 정보 (범용)</div>
            <button style={Object.assign({},btnSm,{fontSize:13,background:"#0284C7",color:"#fff",border:"none",padding:"5px 12px"})} onClick={addProgramInfo}>+ 추가</button>
          </div>
          {st.programInfos[0].length===0&&(
            <div style={{fontSize:12,color:"#64748B",padding:"6px 0",textAlign:"center"}}>추가 버튼을 눌러 지원금별 협약·한도 정보를 등록하세요 (청년도약 이외 지원금도 지원)</div>
          )}
          {st.programInfos[0].map(function(info,idx){
            return(
              <div key={info.id||idx} style={{background:"#fff",borderRadius:10,border:"1px solid #BAE6FD",padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8}}>
                  <select value={info.programId} onChange={function(e){var pid=e.target.value;var pp=progs[pid]||{};updateProgramInfo(idx,{programId:pid,programName:pp.name||pid,year:pp.year||new Date().getFullYear()});}}
                    style={Object.assign({},inp,{fontSize:13,padding:"8px 12px",flex:1})}>
                    {Object.values(progs).map(function(pp){return <option key={pp.id} value={pp.id}>{pp.name}</option>;})}
                  </select>
                  <button onClick={function(){removeProgramInfo(idx);}} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:18,padding:"4px 6px",flexShrink:0}} title="삭제">🗑️</button>
                </div>
                <div style={{marginBottom:8}}>
                  <Label>사업참여신청 여부</Label>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {["미신청","신청 완료","협약 완료","확인 필요"].map(function(s){
                      var on=(info.participationStatus||"미신청")===s;
                      var col=s==="신청 완료"?{bg:"#DBEAFE",fg:"#2563EB",bd:"#93C5FD"}:s==="협약 완료"?{bg:"#D1FAE5",fg:"#059669",bd:"#6EE7B7"}:s==="확인 필요"?{bg:"#FEF3C7",fg:"#B45309",bd:"#FDE68A"}:{bg:"#F1F5F9",fg:"#64748B",bd:"#CBD5E1"};
                      return(<button key={s} type="button" onClick={function(){updateProgramInfo(idx,{participationStatus:s});}} style={Object.assign({},btnSm,{fontSize:12,padding:"6px 11px",background:on?col.bg:"#fff",color:on?col.fg:"#64748B",border:on?"2px solid "+col.bd:"1px solid #E2E8F0",fontWeight:on?700:500})}>{s}</button>);
                    })}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><Label>적용 연도</Label><input type="number" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.year||""} onChange={function(e){updateProgramInfo(idx,{year:Number(e.target.value)||0});}} placeholder="2026"/></div>
                  <div><Label>지원한도 (인원)</Label><input type="number" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.quota||""} onChange={function(e){updateProgramInfo(idx,{quota:e.target.value});}} placeholder="3"/></div>
                  <div><Label>사전신청일</Label><input type="date" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.applyDate||""} onChange={function(e){updateProgramInfo(idx,{applyDate:e.target.value});}}/></div>
                  <div><Label>협약 체결일</Label><input type="date" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agreementDate||""} onChange={function(e){updateProgramInfo(idx,{agreementDate:e.target.value});}}/></div>
                  <div><Label>관할·운영기관명</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyName||""} onChange={function(e){updateProgramInfo(idx,{agencyName:e.target.value});}} placeholder="○○고용센터 / ○○상공회의소"/></div>
                  <div><Label>담당자명</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyManager||""} onChange={function(e){updateProgramInfo(idx,{agencyManager:e.target.value});}} placeholder="홍길동"/></div>
                  <div><Label>담당자 직함</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyManagerTitle||""} onChange={function(e){updateProgramInfo(idx,{agencyManagerTitle:e.target.value});}} placeholder="주무관"/></div>
                  <div><Label>담당자 연락처</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyPhone||""} onChange={function(e){updateProgramInfo(idx,{agencyPhone:fmtPhone(e.target.value)});}} inputMode="numeric" placeholder="02-000-0000"/></div>
                  <div><Label>담당자 이메일</Label><input type="email" style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyEmail||""} onChange={function(e){updateProgramInfo(idx,{agencyEmail:e.target.value});}} placeholder="sample@work.go.kr"/></div>
                  <div><Label>기관 메모</Label><input style={Object.assign({},inp,{fontSize:13,padding:"8px 12px"})} value={info.agencyMemo||info.memo||""} onChange={function(e){updateProgramInfo(idx,{agencyMemo:e.target.value});}} placeholder="협약서 원본 우편 발송 필요 등"/></div>
                </div>
              </div>
            );
          })}
          <div style={{fontSize:11,color:"#0369A1",marginTop:st.programInfos[0].length>0?8:0,lineHeight:1.5}}>💡 직원 등록 시 이 정보로 한도·협약 상태가 자동 표시됩니다. 청년도약은 위 개별 항목도 fallback으로 참조됩니다.</div>
        </div>
        {/* 업체 진행 상태 */}
        <div>
          <Label>업체 진행 상태</Label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {["정상","보류","중단","확인 필요","진행 불가","기타"].map(function(s){var on=st.bizStatus[0]===s;var danger=["보류","중단","진행 불가"].indexOf(s)>=0;return(
              <button key={s} onClick={function(){st.bizStatus[1](s);}} style={Object.assign({},btnSm,{fontSize:13,background:on?(danger?"#FEE2E2":s==="확인 필요"?"#FEF3C7":"#DBEAFE"):"#fff",color:on?(danger?"#DC2626":s==="확인 필요"?"#B45309":"#2563EB"):"#64748B",border:on?"2px solid "+(danger?"#FECACA":s==="확인 필요"?"#FDE68A":"#93C5FD"):"1px solid #E2E8F0"})}>{s}</button>
            );})}
          </div>
          {st.bizStatus[0]==="기타"&&<input style={Object.assign({},inp,{marginTop:6})} value={st.customStatus[0]} onChange={function(e){st.customStatus[1](e.target.value);}} placeholder="상태 직접 입력"/>}
          {needsStatusMemo&&<textarea style={Object.assign({},inp,{height:50,resize:"none",marginTop:6})} value={st.statusMemo[0]} onChange={function(e){st.statusMemo[1](e.target.value);}} placeholder="보류·중단·진행불가 사유를 입력하세요"/>}
        </div>
        <div>
          <Label>태그</Label>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}}>
            {TAGS.map(function(tag){var on=(st.tags[0]||[]).includes(tag.id);return(
              <button key={tag.id} onClick={function(){toggleTag(tag.id);}}
                style={{padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",background:on?tag.bg:"#fff",color:on?tag.color:"#64748B",border:on?"1.5px solid "+tag.color:"1px solid #E2E8F0",fontWeight:on?600:400}}>
                {tag.label}
              </button>
            );})}
          </div>
        </div>
        <div><Label>메모</Label><textarea style={Object.assign({},inp,{height:60,resize:"none"})} value={st.memo[0]} onChange={function(e){st.memo[1](e.target.value);}}/></div>
        <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
          <div>
            {props.onDelete&&props.company&&props.company.id&&(
              <button style={Object.assign({},btnS,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(){if(window.confirm("'"+(props.company.name||"")+"' 업체를 삭제하시겠습니까?\n해당 업체의 직원·서류·정산 내역이 기본 목록에서 함께 보이지 않게 됩니다."))props.onDelete(props.company.id);}}>🗑️ 업체 삭제</button>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={btnS} onClick={props.onClose}>취소</button>
            <button style={Object.assign({},btnP,{padding:"10px 28px"})} onClick={save}>업체 저장</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── ProgramsList ──────────────────────────────────────────
function ProgramsList(props){
  var programs=props.programs,onUpdate=props.onUpdate;
  var st1=useState(false); // modal open
  var st2=useState(null);  // edit target (null=신규 커스텀)
  var st={
    name:useState(""),
    group:useState("커스텀"),
    year:useState(2026),
    totalAmount:useState(""),
    desc:useState(""),
    note:useState(""),
    applyUrl:useState(""),
    rounds:useState([])  // [{month,label,amount}]
  };
  function openNew(){st2[1](null);st.name[1]("");st.group[1]("커스텀");st.year[1](2026);st.totalAmount[1]("");st.desc[1]("");st.note[1]("");st.applyUrl[1]("");st.rounds[1]([{month:6,label:"1회차",amount:0}]);st1[1](true);}
  function openEdit(p){st2[1](p);st.name[1](p.name||"");st.group[1](p.group||"커스텀");st.year[1](p.year||2026);st.totalAmount[1](p.totalAmount||"");st.desc[1](p.desc||"");st.note[1](p.note||"");st.applyUrl[1](p.applyUrl||"");st.rounds[1]((p.rounds||[]).map(function(r){return{month:r.month,label:r.label||"",amount:r.expectedAmount||r.amount||0};}));st1[1](true);}
  function setRound(i,field,val){var rs=st.rounds[0].slice();rs[i]=Object.assign({},rs[i],{[field]:val});st.rounds[1](rs);}
  function addRound(){st.rounds[1](st.rounds[0].concat([{month:12,label:(st.rounds[0].length+1)+"회차",amount:0}]));}
  function delRound(i){st.rounds[1](st.rounds[0].filter(function(_,idx){return idx!==i;}));}
  function autoTotal(){var sum=st.rounds[0].reduce(function(s,r){return s+(Number(r.amount)||0);},0);st.totalAmount[1](sum);}
  function save(){
    if(!st.name[0].trim()){toast("지원금명을 입력하세요","warn");return;}
    var existing=st2[0]||{};
    var rounds=st.rounds[0].map(function(r,i){var amt=Number(r.amount)||0;return Object.assign({},existing.rounds&&existing.rounds[i]?existing.rounds[i]:{},{month:Number(r.month)||0,label:r.label||((i+1)+"회차"),expectedAmount:amt,amount:amt});});
    var total=Number(st.totalAmount[0])||rounds.reduce(function(s,r){return s+r.amount;},0);
    var newP=Object.assign({},existing,{
      id:existing.id||("custom_"+uid()),
      name:st.name[0].trim(),
      group:existing.group||"커스텀",
      year:Number(st.year[0])||2026,
      totalAmount:total,
      desc:st.desc[0],
      note:st.note[0],
      applyUrl:st.applyUrl[0],
      color:existing.color||GROUP_COLORS[existing.group||"커스텀"].base,
      rounds:rounds,
      companyDocs:existing.companyDocs||[],
      employeeDocs:existing.employeeDocs||[]
    });
    var updated=Object.assign({},programs);
    updated[newP.id]=newP;
    onUpdate(updated);
    st1[1](false);st2[1](null);
  }
  function deleteCustom(pid){
    if(!window.confirm("이 지원금을 목록에서 삭제할까요?"))return;
    var updated=Object.assign({},programs);
    delete updated[pid];
    onUpdate(updated);
  }
  function resetBuiltins(){
    if(!window.confirm("기본 지원금을 처음 상태로 되돌립니다. (직접 추가한 커스텀은 유지) 진행할까요?"))return;
    var updated=Object.assign({},programs);
    Object.keys(DEFAULT_PROGRAMS).forEach(function(id){updated[id]=DEFAULT_PROGRAMS[id];});
    onUpdate(updated);
  }
  function toggleEnabled(pid){
    var updated=Object.assign({},programs);
    var p=updated[pid];
    updated[pid]=Object.assign({},p,{enabled:p.enabled===false?true:false});
    onUpdate(updated);
  }
  var enabledCount=Object.values(programs).filter(function(p){return p.enabled!==false;}).length;
  // 기본 지원금 전역 번호(1~15): 신규채용 → 재직자유지 → 육아 순서로 부여.
  // 커스텀 지원금은 C1, C2… 로 별도 번호.
  var progNumMap={},builtinSeq=0,customSeq=0;
  ["신규채용","재직자유지","육아","커스텀"].forEach(function(g){
    Object.values(programs).filter(function(p){return p.group===g;}).forEach(function(p){
      if(DEFAULT_PROGRAMS[p.id]){builtinSeq++;progNumMap[p.id]=String(builtinSeq);}
      else{customSeq++;progNumMap[p.id]="C"+customSeq;}
    });
  });
  return(
    <div className="fade-in">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
        <div style={{minWidth:0}}>
          <h2 style={{margin:"0 0 4px",fontSize:FS_PAGE_TITLE,fontWeight:800}}>⚙️ 지원금 관리</h2>
          <p style={{margin:0,fontSize:FS_BODY,color:"#64748B",lineHeight:1.6}}>활성화된 지원금 <strong style={{color:"#2563EB"}}>{enabledCount}개</strong>만 직원 추가 화면에 표시됩니다. ON/OFF로 노출을 제어하세요.</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={btnS} className="prog-tap" onClick={resetBuiltins}>↺ 기본값 복원</button>
          <button style={btnP} className="hover-lift prog-tap" onClick={openNew}>+ 커스텀 지원금 추가</button>
        </div>
      </div>
      <div style={{padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,marginBottom:14,fontSize:12,color:"#92400E"}}>
        ⭐ <strong>청년일자리도약장려금</strong>이 기본 추천 지원금입니다. 2026년에도 예산이 유지되며 청년 채용 기업의 신청 실적이 가장 높습니다.
      </div>
      <Notice>금액·회차·신청처는 매년 공고에 따라 바뀝니다. 카드의 <b>편집</b>으로 직접 수정하면 내 계정에 저장됩니다. 기본 지원금도 모두 수정 가능합니다.</Notice>
      <OfficialSites/>
      <BeginnerSubsidyGuide/>
      {["신규채용","재직자유지","육아","커스텀"].map(function(grp,gi){
        var items=Object.values(programs).filter(function(p){return p.group===grp;});
        if(!items.length)return null;
        var gp=GROUP_COLORS[grp]||GROUP_COLORS["커스텀"];
        var grpDesc={"신규채용":"새로 채용한 직원 기준으로 검토하는 지원금","재직자유지":"기존 직원을 계속 고용하거나 고용안정을 위한 지원금","육아":"육아휴직·대체인력·근로시간 단축 관련 지원금","커스텀":"직접 추가한 지원금"}[grp]||"";
        // 섹션 배경 — 토스식: 아주 연하지만 계열이 확실히 구분되는 톤
        // (신규채용=밝은 블루 / 재직자유지=밝은 퍼플 / 육아=밝은 그린)
        var tint={"신규채용":{bg:"#E9F2FF",border:"#C7DCFE",num:"#2563EB",numGrad:"linear-gradient(135deg,#3B82F6,#2563EB)"},
                  "재직자유지":{bg:"#F0EAFB",border:"#DBCEF3",num:"#7C3AED",numGrad:"linear-gradient(135deg,#A78BFA,#7C3AED)"},
                  "육아":{bg:"#E5F7ED",border:"#B6E9CA",num:"#059669",numGrad:"linear-gradient(135deg,#34D399,#059669)"},
                  "커스텀":{bg:"#F1F5F9",border:"#E2E8F0",num:"#64748B",numGrad:"linear-gradient(135deg,#94A3B8,#64748B)"}}[grp];
        var grpOn=items.filter(function(p){return p.enabled!==false;}).length;
        return(
          <div key={grp} className="prog-section" style={{"--si":gi,background:tint.bg,border:"1px solid "+tint.border,borderRadius:20,padding:"24px 24px 22px",marginBottom:18,boxShadow:"0 1px 2px rgba(15,23,42,0.03)"}}>
            {/* 섹션 헤더: 큰 제목(주 위계) + 설명(보조) — 카드 영역과 구분선으로 분리 */}
            <div style={{marginBottom:18,paddingBottom:16,borderBottom:"1px solid "+tint.border}}>
              <div style={{display:"flex",alignItems:"center",gap:13,flexWrap:"wrap"}}>
                <span style={{fontSize:34,fontWeight:900,color:gp.dark,letterSpacing:"-1.2px",lineHeight:1.12}}>{gp.icon} {grp}</span>
                <span style={{fontSize:13.5,fontWeight:700,padding:"6px 14px",borderRadius:999,background:"#fff",border:"1px solid "+tint.border,color:gp.text,whiteSpace:"nowrap"}}>{items.length}개 · ON {grpOn}</span>
              </div>
              <div style={{fontSize:14.5,color:"#64748B",marginTop:9,marginLeft:2,lineHeight:1.5}}>{grpDesc}</div>
            </div>
            {/* 지원금 카드 (개별 번호 1~15 · 여유 있는 반응형 그리드) */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:14}}>
              {items.map(function(p,idx){
                var isCustom=!DEFAULT_PROGRAMS[p.id];
                var isEnabled=p.enabled!==false;
                var isYouth=p.id==="youth_jump";
                var pNum=progNumMap[p.id]||"";
                var pill=function(color,bg){return{fontSize:12.5,fontWeight:700,padding:"4px 11px",borderRadius:11,background:bg,color:color,whiteSpace:"nowrap",display:"inline-block"};};
                return(
                  <div key={p.id} className="prog-card" style={{"--ci":idx,padding:"18px 20px",borderRadius:16,background:"#fff",border:"1px solid "+(isEnabled?tint.border:"#E8EDF3"),opacity:isEnabled?1:0.6,display:"flex",flexDirection:"column",gap:11,boxShadow:"0 1px 3px rgba(15,23,42,0.05)"}}>
                    {/* 위계 1·2: 번호 배지(토스식 pill) + 지원금명 */}
                    <div style={{display:"flex",alignItems:"flex-start",gap:11}}>
                      <span style={{width:32,height:32,borderRadius:10,background:isCustom?"#EEF2F6":tint.numGrad,color:isCustom?"#64748B":"#fff",fontWeight:800,fontSize:isCustom?11:14,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,boxShadow:isCustom?"none":"0 2px 5px rgba(15,23,42,0.16)"}}>{pNum}</span>
                      <span style={{fontSize:18.5,fontWeight:800,color:"#0F172A",wordBreak:"keep-all",lineHeight:1.35,letterSpacing:"-0.4px"}}>{p.name}</span>
                    </div>
                    {/* 위계 3: 연도 · 금액 · 추천 태그 */}
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                      {p.year&&<span style={pill("#475569","#F1F5F9")}>{p.year}년</span>}
                      {isYouth&&<span style={pill("#D97706","#FEF3C7")}>⭐ 추천</span>}
                      {isCustom&&<span style={pill(gp.text,gp.badge)}>커스텀</span>}
                      <span style={Object.assign({},pill(gp.dark,gp.light),{fontSize:14.5,fontWeight:800})}>{fMan(p.totalAmount||0)}</span>
                      {!isEnabled&&<span style={pill("#94A3B8","#F1F5F9")}>비활성</span>}
                    </div>
                    {/* 위계 4: 회차 · 지급시점 · 신청처 */}
                    <div style={{display:"flex",gap:15,fontSize:13.5,color:"#475569",flexWrap:"wrap",lineHeight:1.7}}>
                      <span>🔢 {(p.rounds||[]).length}회차</span>
                      <span>📅 {(p.rounds||[]).map(function(r){return r.month+"개월";}).join("/")}</span>
                      {p.applyUrl&&<span style={{color:"#2563EB"}}>📍 {p.applyUrl}</span>}
                    </div>
                    {p.desc&&<div style={{fontSize:13,color:"#94A3B8",lineHeight:1.6}}>{p.desc}</div>}
                    {/* 위계 5: ON/OFF · 편집 */}
                    <div style={{display:"flex",gap:7,alignItems:"center",marginTop:"auto",paddingTop:10,borderTop:"1px solid #F1F5F9"}}>
                      <button onClick={function(){toggleEnabled(p.id);}} className="prog-tap" style={{padding:"6px 14px",borderRadius:20,fontSize:FS_BADGE,fontWeight:700,cursor:"pointer",border:"none",background:isEnabled?"#D1FAE5":"#F1F5F9",color:isEnabled?"#059669":"#64748B",minWidth:46}}>
                        {isEnabled?"ON":"OFF"}
                      </button>
                      <button className="prog-tap" style={btnSm} onClick={function(){openEdit(p);}}>편집</button>
                      {isCustom&&<button className="prog-tap" style={Object.assign({},btnSm,{color:"#DC2626",border:"1px solid #FECACA"})} onClick={function(){deleteCustom(p.id);}}>삭제</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <Modal open={st1[0]} onClose={function(){st1[1](false);st2[1](null);}} title={(st2[0]?"지원금 편집":"커스텀 지원금 추가")} width={560}>
        <div style={{display:"grid",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
            <div><Label>지원금명 *</Label><input style={inp} value={st.name[0]} onChange={function(e){st.name[1](e.target.value);}}/></div>
            <div><Label>적용연도</Label><input type="number" min="2020" max="2030" style={inp} value={st.year[0]} onChange={function(e){st.year[1](e.target.value);}} placeholder="2026"/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><Label>총 지원금액(원)</Label><input type="number" style={inp} value={st.totalAmount[0]} onChange={function(e){st.totalAmount[1](e.target.value);}} placeholder="7200000"/></div>
            <div><Label>신청처/URL</Label><input style={inp} value={st.applyUrl[0]} onChange={function(e){st.applyUrl[1](e.target.value);}} placeholder="고용24(work24.go.kr)"/></div>
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <Label>회차별 지급 (입사 후 개월 · 금액)</Label>
              <button style={Object.assign({},btnSm,{fontSize:14})} onClick={autoTotal} title="회차 금액 합계를 총액에 반영">∑ 합계→총액</button>
            </div>
            <div style={{display:"grid",gap:8}}>
              {st.rounds[0].map(function(r,i){return(
                <div key={i} style={{display:"grid",gridTemplateColumns:"90px 1fr 130px 40px",gap:8,alignItems:"center"}}>
                  <input type="number" style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.month} onChange={function(e){setRound(i,"month",e.target.value);}} placeholder="개월"/>
                  <input style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.label} onChange={function(e){setRound(i,"label",e.target.value);}} placeholder={"라벨 (예: "+(i+1)+"차)"}/>
                  <input type="number" style={Object.assign({},inp,{fontSize:16,padding:"9px 10px"})} value={r.amount} onChange={function(e){setRound(i,"amount",e.target.value);}} placeholder="금액"/>
                  <button style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:18}} onClick={function(){delRound(i);}} title="회차 삭제">🗑️</button>
                </div>
              );})}
            </div>
            <button style={Object.assign({},btnSm,{fontSize:15,marginTop:8})} onClick={addRound}>+ 회차 추가</button>
          </div>
          <div><Label>한줄 설명</Label><input style={inp} value={st.desc[0]} onChange={function(e){st.desc[1](e.target.value);}} placeholder="목록 카드에 표시되는 짧은 설명"/></div>
          <div><Label>상세 안내 / 비고</Label><textarea style={Object.assign({},inp,{height:90,resize:"vertical",fontSize:17,lineHeight:1.6})} value={st.note[0]} onChange={function(e){st.note[1](e.target.value);}} placeholder="자격요건·예산·주의사항 등 (진단·상세에 표시)"/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={function(){st1[1](false);st2[1](null);}}>취소</button>
            <button style={Object.assign({},btnP,{padding:"12px 32px"})} onClick={save}>저장</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Main SubsidyApp export ────────────────────────────────
// ── 사이드바 네비 아이템 ──────────────────────────────────
// ── 재사용: 스파크라인 ────────────────────────────────────
function Sparkline(props){
  var data=props.data||[]; var w=props.width||72; var h=props.height||26; var color=props.color||"#2563EB";
  if(data.length<2||data.every(function(v){return v===0;})){return <svg width={w} height={h}><line x1="0" y1={h-2} x2={w} y2={h-2} stroke="#E2E8F0" strokeWidth="2" strokeLinecap="round"/></svg>;}
  var max=Math.max.apply(null,data)||1; var min=Math.min.apply(null,data);
  var range=max-min||1; var step=w/(data.length-1);
  var pts=data.map(function(v,i){var x=i*step; var y=h-2-((v-min)/range)*(h-6); return x.toFixed(1)+","+y.toFixed(1);});
  var lastX=(data.length-1)*step; var lastV=data[data.length-1]; var lastY=h-2-((lastV-min)/range)*(h-6);
  var areaPts="0,"+(h)+" "+pts.join(" ")+" "+lastX.toFixed(1)+","+h;
  var gid="spg"+Math.round(Math.random()*1e6);
  return(<svg width={w} height={h} style={{display:"block"}}>
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.22"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <polygon points={areaPts} fill={"url(#"+gid+")"}/>
    <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.6" fill={color}/>
  </svg>);
}

// ── 재사용: 트렌드 화살표 ─────────────────────────────────
function TrendChip(props){
  var pct=props.pct; if(pct===null||pct===undefined||!isFinite(pct))return null;
  var up=pct>0, flat=pct===0;
  var arrow=flat?"→":(up?"▲":"▼");
  // 진한 배경 카드 위에서는 흰색 반투명 칩으로 표시
  if(props.onDark){
    return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:14,fontWeight:700,color:"#fff",background:"rgba(255,255,255,0.20)",padding:"2px 8px",borderRadius:20}}>{arrow} {Math.abs(pct)}%</span>;
  }
  var color=flat?"#94A3B8":(up?"#059669":"#DC2626"); var bg=flat?"#F1F5F9":(up?"#ECFDF5":"#FEF2F2");
  return <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:14,fontWeight:700,color:color,background:bg,padding:"2px 8px",borderRadius:20}}>{arrow} {Math.abs(pct)}%</span>;
}

// ── 재사용: 알림 인박스 (벨) ──────────────────────────────
var PRIO_META=[{key:0,label:"긴급",color:"#DC2626",bg:"#FEF2F2"},{key:1,label:"주의",color:"#475569",bg:"#F1F5F9"},{key:2,label:"일반",color:"#2563EB",bg:"#EFF6FF"}];
function NotifBell(props){
  var ddayLimit=(props.settings&&props.settings.ddayAlert)||7;
  var st=useState(false); var open=st[0],setOpen=st[1];
  var feat=props.tier?props.tier.feat:{commission:true};
  var stDismiss=useState(function(){try{return JSON.parse(localStorage.getItem("subsidy_dismissed_alerts")||"[]");}catch(e){return [];}});
  function dismiss(id){ var nx=stDismiss[0].concat([id]); stDismiss[1](nx); try{localStorage.setItem("subsidy_dismissed_alerts",JSON.stringify(nx));}catch(e){} toast("알림을 처리 완료했습니다.","success"); }

  var alerts=useMemo(function(){
    var list=[];
    (props.companies||[]).forEach(function(c){
      var emps=(props.employees||[]).filter(function(e){return e.companyId===c.id&&e.status!=="resigned";});
      emps.forEach(function(emp){
        var program=(props.programs||{})[emp.programId];
        if(emp.startDate&&program){
          (emp.rounds||[]).forEach(function(r,ri){
            if(r.isPaid)return;
            var dd=getDday(addMo(emp.startDate,r.month)); if(dd===null)return;
            var amt=r.expectedAmount||r.amount||0;
            if(dd<0)list.push({id:emp.id+"-"+ri+"-od",type:"신청 기한 지연",prio:0,companyId:c.id,companyName:c.name,empName:emp.name,progName:program.name,text:r.label+" 신청 기한 "+Math.abs(dd)+"일 경과",amount:amt,dd:dd});
            else if(dd<=ddayLimit)list.push({id:emp.id+"-"+ri+"-due",type:"신청 가능일 도래",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program.name,text:r.label+" "+formatDday(dd)+" · 곧 신청 가능",amount:amt,dd:dd});
          });
        }
        if(emp.salary){var w=checkWage(emp.salary,emp.weeklyHours||40);if(w&&!w.isAboveMin)list.push({id:emp.id+"-mw",type:"최저임금 미달",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program?program.name:"",text:"환산 시급 "+w.hourlyWage.toLocaleString()+"원 — 최저임금 미달",amount:0,dd:null});else if(w&&!w.isAboveFloor)list.push({id:emp.id+"-fl",type:"월보수 기준 미달",prio:1,companyId:c.id,companyName:c.name,empName:emp.name,progName:program?program.name:"",text:"월보수 124만원 미만 — 지원금 제외 위험",amount:0,dd:null});}
      });
      var docMiss=0; emps.forEach(function(e){(e.employeeDocs||[]).forEach(function(d){if(!docIsDone(d))docMiss++;});}); (c.companyDocs||[]).forEach(function(d){if(!docIsDone(d))docMiss++;});
      if(docMiss>0)list.push({id:c.id+"-docs-"+docMiss,type:"서류 미제출",prio:2,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"미제출 서류 "+docMiss+"건 — 요청 필요",amount:0,dd:null});
      if(feat.commission){
        var cc=c.commission||{}; var rate=cc.rate!=null?cc.rate:20; var ret=cc.retainer||0;
        var rcv=0; emps.forEach(function(e){(e.rounds||[]).forEach(function(r){if(r.isPaid)rcv+=r.received||0;});});
        var billable=Math.round(ret+rcv*rate/100);
        if(billable>0&&!cc.billed)list.push({id:c.id+"-ub-"+billable,type:"수수료 미청구",prio:2,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"청구 가능 수수료 "+fMan(billable)+" 미청구",amount:billable,dd:null});
        else if(cc.billed&&!cc.paid)list.push({id:c.id+"-up-"+billable,type:"수수료 미입금",prio:1,companyId:c.id,companyName:c.name,empName:"",progName:"",text:"청구한 수수료 "+fMan(billable)+" 미입금",amount:billable,dd:null});
      }
    });
    return list.filter(function(a){return stDismiss[0].indexOf(a.id)<0;}).sort(function(a,b){return a.prio-b.prio||((a.dd===null?999:a.dd)-(b.dd===null?999:b.dd));});
  },[props.employees,props.companies,props.programs,ddayLimit,stDismiss[0],feat.commission]);

  var urgent=alerts.filter(function(a){return a.prio===0;}).length;
  function go(a){props.goCompany(a.companyId);setOpen(false);}

  return(<div style={{position:"relative"}}>
    <button onClick={function(){setOpen(!open);}} title="알림센터" style={{position:"relative",background:open?"#EFF6FF":"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,width:48,height:48,fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
      🔔
      {alerts.length>0&&<span style={{position:"absolute",top:-6,right:-6,minWidth:22,height:22,padding:"0 5px",borderRadius:11,background:urgent>0?"#DC2626":"#475569",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,0.2)"}}>{alerts.length>99?"99+":alerts.length}</span>}
    </button>
    {open&&<div onClick={function(){setOpen(false);}} style={{position:"fixed",inset:0,zIndex:300}}/>}
    {open&&(
      <div className="slide-in" style={{position:"absolute",right:0,top:58,width:400,maxWidth:"92vw",background:"#fff",borderRadius:14,boxShadow:"0 16px 48px rgba(15,23,42,0.20)",border:"1px solid #E2E8F0",zIndex:301,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #F1F5F9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:17,fontWeight:800,color:"#1E293B"}}>🔔 알림센터</span>
          <span style={urgent>0?dangerBadge():neutralBadge()}>{alerts.length}건</span>
        </div>
        <div style={{maxHeight:440,overflow:"auto"}}>
          {alerts.length===0?(
            <div style={{padding:"40px 20px",textAlign:"center"}}>
              <div style={{fontSize:38,marginBottom:8}}>✅</div>
              <div style={{fontSize:15,color:"#64748B"}}>처리할 알림이 없습니다.</div>
            </div>
          ):PRIO_META.map(function(pm){
            var group=alerts.filter(function(a){return a.prio===pm.key;});
            if(group.length===0)return null;
            return(<div key={pm.key}>
              <div style={{padding:"8px 18px",background:"#FAFBFC",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:8,height:8,borderRadius:4,background:pm.color,display:"inline-block"}}/>
                <span style={{fontSize:"var(--fs-label)",fontWeight:700,color:pm.color}}>{pm.label}</span>
                <span style={{fontSize:"var(--fs-meta)",color:"#94A3B8"}}>{group.length}건</span>
              </div>
              {group.map(function(a){return(
                <div key={a.id} style={{padding:"11px 18px",borderBottom:"1px solid #F8FAFC"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:"var(--fs-badge)",fontWeight:700,padding:"2px 8px",borderRadius:5,background:pm.bg,color:pm.color}}>{a.type}</span>
                    {a.dd!==null&&<DdayBadge dday={a.dd}/>}
                    {a.amount>0&&<span style={{fontSize:"var(--fs-sub)",fontWeight:700,color:"#2563EB",marginLeft:"auto"}}>{fMan(a.amount)}</span>}
                  </div>
                  <div style={{fontSize:"var(--fs-name)",fontWeight:600,color:"#1E293B"}}>{a.empName?a.empName+" · ":""}<span style={{color:"#64748B",fontWeight:400}}>{a.companyName}</span></div>
                  <div style={{fontSize:"var(--fs-meta)",color:"#64748B",marginTop:1}}>{a.progName?a.progName+" · ":""}{a.text}</div>
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={function(){go(a);}} style={{flex:1,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#1D4ED8",borderRadius:7,padding:"7px 0",fontSize:"var(--fs-btn)",fontWeight:700,cursor:"pointer",fontFamily:FF}}>바로가기</button>
                    <button onClick={function(){dismiss(a.id);}} style={{flex:1,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#64748B",borderRadius:7,padding:"7px 0",fontSize:"var(--fs-btn)",fontWeight:700,cursor:"pointer",fontFamily:FF}}>처리 완료</button>
                  </div>
                </div>
              );})}
            </div>);
          })}
        </div>
      </div>
    )}
  </div>);
}

// 샘플 데이터: startOff(입사 N개월 전)·ds(일 단위 보정)로 표현 → loadSampleData에서
// 실행 시점 기준 실제 날짜로 변환. 항상 "지연 3건·신청 임박 5건"이 살아있는 데모가 됨.
var SAMPLE_DATA = [
  {
    company:{isSample:true,name:"(주)미래정밀",bizNo:"301-81-90122",ceoName:"한도경",addr:"충북 청주시 흥덕구 오송읍 정밀로 22",region:"비수도권",corpType:"법인",establishedDate:"2016-04-12",bizType:"기계·정밀부품 제조업",empCount:31,phone:"043-905-3300",email:"hr@miraeprecision.co.kr",commission:{rate:20,retainer:300000,billed:true,paid:false,taxInvoice:false,successFee:true,memo:"착수금 30만 수령 · 성공보수 20% 청구분 입금 대기"},
      notes:[{id:"sn1",text:"장우진 고령자 계속고용 2분기 신청기한 임박. 재고용 근로계약서 사본만 받으면 신청 가능.",at:"2026-05-28T06:30:00.000Z",author:"담당 컨설턴트"}],
      companyDocs:[{id:"cd1a",label:"사업자등록증",done:true,files:[]},{id:"cd1b",label:"4대보험 가입자명부",done:true,files:[]},{id:"cd1c",label:"기업통장 사본",done:false,files:[]}]},
    employees:[
      {isSample:true,name:"장우진",birthDate:"1959-07-21",gender:"male",programId:"senior_continue",status:"inprogress",totalExpected:7200000,startOff:7,ds:-10,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:4,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별임금대장",done:true,files:[]},{label:"재고용 근로계약서",done:false,files:[]}]},
      {isSample:true,name:"김도현",birthDate:"2000-04-12",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:2,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]},{label:"최종학력확인서(졸업증명서)",done:true,files:[]}]},
      {isSample:true,name:"권지민",birthDate:"1996-11-05",gender:"female",programId:"youth_jump",status:"submitted",totalExpected:7200000,startOff:2,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"급여이체확인서류",done:false,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]},
      {isSample:true,name:"차은호",birthDate:"1962-02-18",gender:"male",programId:"senior_continue",status:"approved",totalExpected:7200000,startOff:4,ds:3,
        rounds:[{month:3,amount:900000,label:"1분기"},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별임금대장",done:true,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"한라식품(주)",bizNo:"617-81-23456",ceoName:"박성준",addr:"경남 김해시 주촌면 골든루트로 80",region:"비수도권",corpType:"법인",establishedDate:"2011-09-03",bizType:"식품 제조업",empCount:22,phone:"055-321-7700",email:"hr@hanlafood.co.kr",commission:{rate:20,billed:true,paid:false,taxInvoice:false,successFee:true,memo:"1차 수령분 성공보수 청구 · 입금 확인 필요"},
      notes:[{id:"sn2",text:"한소희 고용촉진장려금 심사중. 월별급여대장·이체증빙 보완하면 1회차 지급 예정.",at:"2026-05-22T08:10:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"박준혁",birthDate:"1999-03-15",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:5,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:true,files:[]},{label:"최종학력확인서(졸업증명서)",done:false,files:[]}]},
      {isSample:true,name:"한소희",birthDate:"1995-08-22",gender:"female",programId:"emp_promo",status:"reviewing",totalExpected:7200000,startOff:6,ds:6,
        rounds:[{month:6,amount:3600000,label:"1회차(6개월)"},{month:12,amount:3600000,label:"2회차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별급여대장",done:false,files:[]},{label:"급여이체증빙",done:false,files:[]},{label:"취업지원프로그램 이수증",done:true,files:[]}]},
      {isSample:true,name:"임재현",birthDate:"1960-10-05",gender:"male",programId:"senior_continue",status:"inprogress",totalExpected:7200000,startOff:5,ds:0,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:2,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별임금대장",done:true,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"(주)더좋은푸드",bizNo:"105-23-67891",ceoName:"오세라",addr:"서울 마포구 양화로 45, 2층",region:"수도권",corpType:"법인",establishedDate:"2019-06-18",bizType:"식품 도소매·외식",empCount:13,phone:"02-336-1180",email:"admin@thebetterfood.kr",commission:{rate:12,billed:true,paid:true,taxInvoice:true,successFee:true,memo:"성공보수 12% 계약 · 세금계산서 발행 완료 (정산 마감)"},
      notes:[{id:"sn3",text:"오하린 새일여성인턴 전 회차 수령 완료. 고객 보고서 출력 후 미팅자료로 공유 예정.",at:"2026-06-02T02:00:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"오하린",birthDate:"1989-09-25",gender:"female",programId:"saeil_women",status:"completed",totalExpected:4000000,startOff:18,ds:0,
        rounds:[{month:1,amount:800000,label:"인턴1개월",isPaid:true,paidOff:16,received:800000},{month:2,amount:800000,label:"인턴2개월",isPaid:true,paidOff:15,received:800000},{month:3,amount:800000,label:"인턴3개월",isPaid:true,paidOff:14,received:800000},{month:9,amount:800000,label:"고용유지1차",isPaid:true,paidOff:8,received:800000},{month:15,amount:800000,label:"고용유지2차",isPaid:true,paidOff:2,received:800000}],
        employeeDocs:[{label:"구직등록확인서",done:true,files:[]},{label:"근로계약서",done:true,files:[]},{label:"임금대장",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]}]},
      {isSample:true,name:"신예린",birthDate:"1992-12-11",gender:"female",programId:"saeil_women",status:"approved",totalExpected:4000000,startOff:9,ds:4,
        rounds:[{month:1,amount:800000,label:"인턴1개월",isPaid:true,paidOff:8,received:800000},{month:2,amount:800000,label:"인턴2개월",isPaid:true,paidOff:7,received:800000},{month:3,amount:800000,label:"인턴3개월",isPaid:true,paidOff:6,received:800000},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],
        employeeDocs:[{label:"구직등록확인서",done:true,files:[]},{label:"근로계약서",done:true,files:[]},{label:"임금대장",done:true,files:[]},{label:"급여이체확인서류",done:false,files:[]}]},
      {isSample:true,name:"유하늘",birthDate:"2001-06-03",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:7,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:1,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:true,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"해든디자인",bizNo:"214-09-55178",ceoName:"서지안(1997년생 청년대표)",addr:"서울 성동구 성수이로 66, 4층",region:"수도권",corpType:"개인",establishedDate:"2022-02-07",bizType:"디자인·브랜딩 스튜디오",empCount:4,phone:"02-462-7090",email:"studio@haedeun.kr",commission:{rate:15,billed:false,paid:false,successFee:true},
      notes:[{id:"sn7",text:"1997년생 청년 대표가 운영하는 4인 사업장. 5인 미만이라 새일여성인턴제·정규직 전환 등 주요 지원금 요건 제한 — 청년일자리도약 중심으로 관리 중.",at:"2026-05-20T04:00:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"최유진",birthDate:"2000-08-21",gender:"female",programId:"youth_jump",status:"submitted",totalExpected:7200000,startOff:4,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"급여이체확인서류",done:false,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"(주)해온테크",bizNo:"137-81-44820",ceoName:"노형석",addr:"충남 천안시 서북구 직산읍 4산단로 18",region:"비수도권",corpType:"법인",establishedDate:"2014-11-21",bizType:"전자부품 제조업",empCount:18,phone:"041-585-6600",email:"people@haeontech.co.kr",commission:{rate:20,retainer:300000,billed:false,paid:false,successFee:true},
      notes:[{id:"sn4",text:"조현우 2차(9개월) 신청 임박. 임금대장·이체확인서 수령 완료, 신청서 제출만 남음.",at:"2026-06-03T00:40:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"조현우",birthDate:"1998-11-02",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:1,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]},
      {isSample:true,name:"서민아",birthDate:"1993-07-08",gender:"female",programId:"regular_convert",status:"approved",totalExpected:7200000,startOff:4,ds:3,
        rounds:[{month:3,amount:1800000,label:"1차(3개월)",isPaid:true,paidOff:1,received:1800000},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],
        employeeDocs:[{label:"전환 전 근로계약서",done:true,files:[]},{label:"전환 후 근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]},
      {isSample:true,name:"강태양",birthDate:"1959-04-12",gender:"male",programId:"senior_continue",status:"inprogress",totalExpected:7200000,startOff:7,ds:-12,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:4,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"(주)다온정밀",bizNo:"506-81-77213",ceoName:"백건우",addr:"경북 구미시 산동읍 첨단기업1로 45",region:"비수도권",corpType:"법인",establishedDate:"2009-08-26",bizType:"자동차부품 정밀가공",empCount:37,phone:"054-462-8800",email:"hr@daonprecision.co.kr",commission:{rate:18,billed:true,paid:false,taxInvoice:false,successFee:true,memo:"성공보수 18% 청구 · 세금계산서 발행 대기"},
      notes:[{id:"sn5",text:"이서연 정규직전환 3차 지급 예정. 월별임금대장만 보완하면 신청 가능.",at:"2026-05-30T05:20:00.000Z",author:"담당 컨설턴트"}],
      companyDocs:[{id:"cd6a",label:"사업자등록증",done:true,files:[]},{id:"cd6b",label:"협약서",done:true,files:[]},{id:"cd6c",label:"고용보험 취득확인서",done:false,files:[]}]},
    employees:[
      {isSample:true,name:"김성훈",birthDate:"1961-01-27",gender:"male",programId:"senior_continue",status:"inprogress",totalExpected:7200000,startOff:6,ds:1,
        rounds:[{month:3,amount:900000,label:"1분기",isPaid:true,paidOff:3,received:900000},{month:6,amount:900000,label:"2분기"},{month:9,amount:900000,label:"3분기"},{month:12,amount:900000,label:"4분기"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별임금대장",done:true,files:[]}]},
      {isSample:true,name:"박지훈",birthDate:"1997-09-14",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:3,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:true,files:[]},{label:"최종학력확인서(졸업증명서)",done:true,files:[]}]},
      {isSample:true,name:"이서연",birthDate:"1996-08-22",gender:"female",programId:"regular_convert",status:"inprogress",totalExpected:7200000,startOff:7,ds:-8,
        rounds:[{month:3,amount:1800000,label:"1차(3개월)",isPaid:true,paidOff:4,received:1800000},{month:6,amount:1800000,label:"2차(6개월)",isPaid:true,paidOff:1,received:1800000},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],
        employeeDocs:[{label:"전환 전 근로계약서",done:true,files:[]},{label:"전환 후 근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]},
      {isSample:true,name:"정민재",birthDate:"1990-05-09",gender:"male",programId:"regular_convert",status:"submitted",totalExpected:7200000,startOff:3,ds:0,
        rounds:[{month:3,amount:1800000,label:"1차(3개월)"},{month:6,amount:1800000,label:"2차(6개월)"},{month:9,amount:1800000,label:"3차(9개월)"},{month:12,amount:1800000,label:"4차(12개월)"}],
        employeeDocs:[{label:"전환 전 근로계약서",done:true,files:[]},{label:"전환 후 근로계약서",done:true,files:[]},{label:"월별임금대장",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"(주)은성패키지",bizNo:"412-86-30157",ceoName:"조은성",addr:"경기 안산시 단원구 별망로 178",region:"수도권",corpType:"법인",establishedDate:"2018-03-15",bizType:"포장재 제조업",empCount:9,phone:"031-491-2020",email:"admin@eunseongpack.co.kr",commission:{rate:15,billed:false,paid:false,successFee:true},
      notes:[],companyDocs:[]},
    employees:[
      {isSample:true,name:"윤지우",birthDate:"1962-04-03",gender:"male",programId:"senior_intern",status:"inprogress",totalExpected:5500000,startOff:12,ds:0,
        rounds:[{month:3,amount:1200000,label:"1단계(3개월)",isPaid:true,paidOff:9,received:1200000},{month:9,amount:1500000,label:"2단계(6개월)",isPaid:true,paidOff:3,received:1500000},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"사전교육 이수증",done:true,files:[]},{label:"월별급여대장",done:true,files:[]}]},
      {isSample:true,name:"홍세라",birthDate:"2001-03-19",gender:"female",programId:"youth_jump",status:"submitted",totalExpected:7200000,startOff:2,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"급여이체확인서류",done:false,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"바른유통",bizNo:"220-15-88301",ceoName:"문바른",addr:"서울 송파구 충민로 66, 가든파이브툴",region:"수도권",corpType:"개인",establishedDate:"2023-05-10",bizType:"생활용품 도소매",empCount:6,phone:"02-449-3360",email:"barun@barundist.kr",
      notes:[],companyDocs:[]},
    employees:[
      {isSample:true,name:"오세훈",birthDate:"2002-02-14",gender:"male",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:8,ds:6,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:2,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"제이앤케어(주)",bizNo:"144-81-26694",ceoName:"정유라",addr:"서울 강서구 공항대로 217, 5층",region:"수도권",corpType:"법인",establishedDate:"2020-10-05",bizType:"방문요양·돌봄 서비스",empCount:16,phone:"02-2662-7140",email:"hr@jncare.co.kr",commission:{rate:15,billed:true,paid:true,taxInvoice:true,successFee:true,memo:"분기 정산 완료 · 세금계산서 발행"},
      notes:[{id:"sn6",text:"배수진 새일여성인턴 인턴 3개월 수령 완료. 고용유지 1차 신청 준비 중.",at:"2026-05-26T03:15:00.000Z",author:"담당 컨설턴트"}],companyDocs:[]},
    employees:[
      {isSample:true,name:"배수진",birthDate:"1988-06-17",gender:"female",programId:"saeil_women",status:"inprogress",totalExpected:4000000,startOff:6,ds:0,
        rounds:[{month:1,amount:800000,label:"인턴1개월",isPaid:true,paidOff:5,received:800000},{month:2,amount:800000,label:"인턴2개월",isPaid:true,paidOff:4,received:800000},{month:3,amount:800000,label:"인턴3개월",isPaid:true,paidOff:3,received:800000},{month:9,amount:800000,label:"고용유지1차"},{month:15,amount:800000,label:"고용유지2차"}],
        employeeDocs:[{label:"구직등록확인서",done:true,files:[]},{label:"근로계약서",done:true,files:[]},{label:"임금대장",done:true,files:[]},{label:"급여이체확인서류",done:false,files:[]}]},
      {isSample:true,name:"문수빈",birthDate:"2000-10-08",gender:"female",programId:"youth_jump",status:"inprogress",totalExpected:7200000,startOff:9,ds:4,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)",isPaid:true,paidOff:3,received:3600000},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:true,files:[]},{label:"급여이체확인서류",done:true,files:[]},{label:"개인정보동의서(근로자)",done:true,files:[]}]},
      {isSample:true,name:"남궁현",birthDate:"1963-12-22",gender:"male",programId:"senior_intern",status:"approved",totalExpected:5500000,startOff:3,ds:2,
        rounds:[{month:3,amount:1200000,label:"1단계(3개월)"},{month:9,amount:1500000,label:"2단계(6개월)"},{month:18,amount:900000,label:"3단계(18개월)"},{month:24,amount:900000,label:"3단계(24개월)"},{month:36,amount:1000000,label:"3단계(36개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"사전교육 이수증",done:true,files:[]},{label:"월별급여대장",done:false,files:[]}]}
    ]
  },
  {
    company:{isSample:true,name:"(주)지앤비물류",bizNo:"312-81-61905",ceoName:"구본승",addr:"충북 음성군 대소면 삼성로 412",region:"비수도권",corpType:"법인",establishedDate:"2017-12-01",bizType:"종합물류·운송",empCount:7,phone:"043-882-5500",email:"hr@gnblogis.co.kr",commission:{rate:20,billed:false,paid:false,successFee:true},
      notes:[],companyDocs:[]},
    employees:[
      {isSample:true,name:"정해성",birthDate:"1991-02-28",gender:"male",programId:"emp_promo",status:"inprogress",totalExpected:7200000,startOff:7,ds:3,
        rounds:[{month:6,amount:3600000,label:"1회차(6개월)",isPaid:true,paidOff:1,received:3600000},{month:12,amount:3600000,label:"2회차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"월별급여대장",done:true,files:[]},{label:"급여이체증빙",done:true,files:[]},{label:"취업지원프로그램 이수증",done:true,files:[]}]},
      {isSample:true,name:"송가은",birthDate:"1999-12-09",gender:"female",programId:"youth_jump",status:"preparing",totalExpected:7200000,startOff:1,ds:0,
        rounds:[{month:6,amount:3600000,label:"1차(6개월)"},{month:9,amount:1800000,label:"2차(9개월)"},{month:12,amount:1800000,label:"3차(12개월)"}],
        employeeDocs:[{label:"근로계약서",done:true,files:[]},{label:"임금대장(6개월)",done:false,files:[]},{label:"급여이체확인서류",done:false,files:[]}]}
    ]
  }
];

// ── 관리자 전용: 베타 피드백 리포트 화면 ──────────────────
function fbFmtDateTime(ds){if(!ds)return "";var d=new Date(ds);if(isNaN(d))return String(ds);var p=function(n){return n<10?"0"+n:""+n;};return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());}

function FbAnswerBlock(props){
  var v=props.value;
  if(v===undefined||v===null||(Array.isArray(v)&&v.length===0))return null;
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:FS_LABEL,fontWeight:700,color:"#475569",marginBottom:5}}>{props.label}</div>
      {Array.isArray(v)?(
        <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
          {v.map(function(item,i){return(
            <span key={i} style={{fontSize:FS_BADGE,fontWeight:600,padding:"4px 11px",borderRadius:20,background:"#EFF6FF",color:"#2563EB",whiteSpace:"normal"}}>{item}</span>
          );})}
        </div>
      ):(
        <div style={{fontSize:FS_BODY,color:"#1E293B",fontWeight:600}}>{String(v)}</div>
      )}
    </div>
  );
}

function FbCard(props){
  var r=props.row;
  var answers=r.answers||{};
  var score=fbScoreNum(answers);
  var scoreColor=score===null?"#94A3B8":score>=8?"#059669":score>=6?"#D97706":"#DC2626";
  return(
    <Card style={{padding:"18px 20px",marginBottom:14,border:"1px solid #E2E8F0"}} className="fade-in-up">
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:14,paddingBottom:12,borderBottom:"1px solid #F1F5F9"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>{r.user_email||"(이메일 없음)"}</div>
          <div style={{fontSize:"var(--fs-meta)",color:"#64748B",marginTop:3}}>
            {r.org_name?r.org_name+" · ":""}{fbFmtDateTime(r.created_at)}
          </div>
        </div>
        {score!==null&&(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:10,background:scoreColor+"14",border:"1px solid "+scoreColor+"40"}}>
            <span style={{fontSize:"var(--fs-dday)",fontWeight:800,color:scoreColor}}>완성도 {score}/10</span>
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"0 24px"}}>
        {FB_REPORT_ORDER.map(function(qid){
          return <FbAnswerBlock key={qid} label={FB_LABELS[qid]||qid} value={answers[qid]}/>;
        })}
      </div>
      {r.free_text&&(
        <div style={{marginTop:8,padding:"14px 16px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:12}}>
          <div style={{fontSize:FS_LABEL,fontWeight:700,color:"#0369A1",marginBottom:6}}>💬 자유 의견</div>
          <div style={{fontSize:FS_BODY,color:"#1E293B",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{r.free_text}</div>
        </div>
      )}
    </Card>
  );
}

// 무료체험 만료 사용자가 유료 기능을 시도할 때 표시하는 모달
function PlanRequiredModal(props){
  if(!props.open)return null;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.55)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:"36px 32px",maxWidth:460,width:"100%",boxShadow:"0 25px 60px rgba(0,0,0,0.25)",fontFamily:FF}}>
        <div style={{fontSize:48,textAlign:"center",marginBottom:12}}>🔒</div>
        <h2 style={{margin:"0 0 10px",fontSize:22,fontWeight:800,color:"#1E293B",textAlign:"center"}}>무료체험이 종료되었습니다</h2>
        <p style={{margin:"0 0 12px",fontSize:14,color:"#475569",lineHeight:1.8,textAlign:"center"}}>
          기존에 등록한 업체와 직원 정보는 그대로 보관됩니다.<br/>
          계속해서 업체 추가, 직원 관리, 서류 요청, 보고서 출력 기능을 이용하려면 유료 플랜을 선택해주세요.
        </p>
        <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:10,padding:"10px 14px",marginBottom:20,textAlign:"center"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#15803D"}}>✅ 데이터는 삭제되지 않습니다. 구독 후 이어서 사용할 수 있습니다.</span>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button style={{flex:1,padding:"12px 0",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#F8FAFC",color:"#475569",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:FF}} onClick={props.onClose}>나중에 하기</button>
          <button style={{flex:1,padding:"12px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FF}} onClick={function(){props.onClose&&props.onClose();if(props.onOpenBilling)props.onOpenBilling();}}>요금제 보기 →</button>
        </div>
      </div>
    </div>
  );
}

function AdminActivityView(props){
  var stRows=useState([]);
  var stLoading=useState(true);
  var stErr=useState(null);
  var allowed=isAdminEmail(props.userEmail);

  function load(){
    stLoading[1](true);stErr[1](null);
    supabase.from("user_activity").select("*").order("last_seen_at",{ascending:false}).then(function(res){
      if(res.error){
        console.warn("[AdminActivity] 조회 실패:",res.error.message);
        stErr[1](res.error);
      }else{
        stRows[1](res.data||[]);
      }
      stLoading[1](false);
    }).catch(function(e){
      stErr[1](e);stLoading[1](false);
    });
  }
  useEffect(function(){if(allowed)load();},[allowed]);

  if(!allowed){
    return(
      <Card style={{padding:"40px 28px",textAlign:"center",maxWidth:560}}>
        <div style={{fontSize:42,marginBottom:10}}>🔒</div>
        <h2 style={{margin:"0 0 8px",fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>접근 권한이 없습니다</h2>
        <p style={{margin:0,color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>이 화면은 관리자 전용입니다.</p>
      </Card>
    );
  }

  function actBadge(lastSeen){
    if(!lastSeen)return{label:"기록없음",bg:"#F1F5F9",color:"#94A3B8"};
    var diffMs=Date.now()-new Date(lastSeen).getTime();
    var days=diffMs/(1000*60*60*24);
    if(days<1)return{label:"오늘",bg:"#DCFCE7",color:"#15803D"};
    if(days<3)return{label:"3일 이내",bg:"#DBEAFE",color:"#1D4ED8"};
    if(days<7)return{label:"7일 이내",bg:"#FEF9C3",color:"#A16207"};
    if(days<14)return{label:"7일+",bg:"#F1F5F9",color:"#475569"};
    return{label:"14일+",bg:"#FEE2E2",color:"#DC2626"};
  }

  function fmtDate(iso){
    if(!iso)return"-";
    var d=new Date(iso);
    return d.getFullYear()+"."+(d.getMonth()+1).toString().padStart(2,"0")+"."+d.getDate().toString().padStart(2,"0")+" "+d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0");
  }

  var rows=stRows[0];
  return(
    <div style={{maxWidth:1100}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:8}}>
        <div>
          <h2 style={{margin:0,fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>📊 사용자 활동</h2>
          <p style={{margin:"4px 0 0",color:"#64748B",fontSize:FS_BODY}}>계정별 최근 접속 현황 (관리자 전용 · 5분 단위 갱신)</p>
        </div>
        <button style={Object.assign({},btnS,{padding:"9px 16px",fontSize:"var(--fs-btn)"})} onClick={load}>↻ 새로고침</button>
      </div>

      {stLoading[0]?(
        <Card style={{padding:40,textAlign:"center"}}><div className="skeleton" style={{height:18,width:"40%",margin:"0 auto 12px"}}/><div style={{color:"#94A3B8",fontSize:FS_BODY}}>불러오는 중…</div></Card>
      ):stErr[0]?(
        <Card style={{padding:"28px 24px",border:"1px solid #FECACA",background:"#FEF2F2"}}>
          <div style={{fontSize:"var(--fs-name)",fontWeight:800,color:"#DC2626",marginBottom:8}}>조회 권한 없음 (RLS)</div>
          <p style={{fontSize:FS_BODY,color:"#7F1D1D",lineHeight:1.7,margin:"0 0 12px"}}>
            <code>user_activity</code> SELECT 정책이 누락되어 있습니다. 아래 SQL을 Supabase SQL Editor에서 실행하세요.
          </p>
          <pre style={{background:"#1E293B",color:"#E2E8F0",padding:"14px 16px",borderRadius:10,fontSize:13,overflowX:"auto",lineHeight:1.6,margin:0}}>{
"-- 이미 migration 009에 포함되어 있는 경우 불필요합니다.\nCREATE POLICY \"ua_select_self_or_admin\" ON user_activity\n  FOR SELECT TO authenticated\n  USING (\n    user_id = auth.uid()\n    OR lower(auth.jwt() ->> 'email') = '<관리자 이메일>'\n  );"
          }</pre>
        </Card>
      ):rows.length===0?(
        <Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>📭</div><p style={{color:"#94A3B8",fontSize:FS_BODY,margin:0}}>아직 기록된 활동이 없습니다.</p></Card>
      ):(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"var(--fs-body)",background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
            <thead>
              <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                {["이메일","조직명","마지막 접속","마지막 액션","상태"].map(function(h){return(
                  <th key={h} style={{padding:"12px 16px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:13,whiteSpace:"nowrap"}}>{h}</th>
                );})}</tr>
            </thead>
            <tbody>
              {rows.map(function(r,i){
                var badge=actBadge(r.last_seen_at);
                return(
                  <tr key={r.user_id} style={{borderBottom:"1px solid #F1F5F9",background:i%2===0?"#fff":"#FAFAFA"}}>
                    <td style={{padding:"11px 16px",color:"#1E293B",fontWeight:500,wordBreak:"break-all"}}>{r.user_email||"-"}</td>
                    <td style={{padding:"11px 16px",color:"#475569",whiteSpace:"nowrap"}}>{r.org_name||"-"}</td>
                    <td style={{padding:"11px 16px",color:"#64748B",whiteSpace:"nowrap"}}>{fmtDate(r.last_seen_at)}</td>
                    <td style={{padding:"11px 16px",color:"#64748B",maxWidth:200}}><span style={{background:"#F1F5F9",borderRadius:6,padding:"2px 8px",fontSize:12,fontFamily:"monospace"}}>{r.last_active_action||"-"}</span></td>
                    <td style={{padding:"11px 16px"}}><span style={{background:badge.bg,color:badge.color,borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{badge.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{marginTop:10,fontSize:12,color:"#94A3B8"}}>총 {rows.length}명 · 로그인 후 앱 진입 시점 기준으로 기록됩니다.</p>
        </div>
      )}
    </div>
  );
}

function AdminFeedback(props){
  var stRows=useState([]);
  var stLoading=useState(true);
  var stErr=useState(null);
  var stFreeOnly=useState(false);
  var stLowOnly=useState(false);
  // 내부 2차 방어: 사이드바 버튼/뷰 가드를 우회해 들어와도 여기서 한 번 더 차단
  var allowed=isAdminEmail(props.userEmail);

  function load(){
    stLoading[1](true);stErr[1](null);
    supabase.from("feedback_responses").select("*").order("created_at",{ascending:false}).then(function(res){
      if(res.error){
        console.warn("[AdminFeedback] 조회 실패:",{message:res.error.message,details:res.error.details,hint:res.error.hint,code:res.error.code});
        stErr[1](res.error);
      }else{
        stRows[1](res.data||[]);
      }
      stLoading[1](false);
    }).catch(function(e){
      console.warn("[AdminFeedback] 조회 예외:",e&&e.message);
      stErr[1](e);stLoading[1](false);
    });
  }
  useEffect(function(){if(allowed)load();},[allowed]);

  if(!allowed){
    return(
      <Card style={{padding:"40px 28px",textAlign:"center",maxWidth:560}}>
        <div style={{fontSize:42,marginBottom:10}}>🔒</div>
        <h2 style={{margin:"0 0 8px",fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>접근 권한이 없습니다</h2>
        <p style={{margin:0,color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>이 화면은 관리자 전용입니다.</p>
      </Card>
    );
  }

  var rows=stRows[0];
  var filtered=rows.filter(function(r){
    if(stFreeOnly[0]&&!(r.free_text&&String(r.free_text).trim()))return false;
    if(stLowOnly[0]){var s=fbScoreNum(r.answers||{});if(s===null||s>=7)return false;}
    return true;
  });

  function downloadCsv(){
    var cols=["created_at","user_email","org_name"].concat(FB_REPORT_ORDER).concat(["free_text"]);
    var headers=["제출일시","제출자","조직명"].concat(FB_REPORT_ORDER.map(function(q){return FB_LABELS[q]||q;})).concat(["자유 의견"]);
    function esc(v){if(v===undefined||v===null)return "";var s=Array.isArray(v)?v.join(" | "):String(v);if(/[",\n]/.test(s))s='"'+s.replace(/"/g,'""')+'"';return s;}
    var lines=[headers.join(",")];
    filtered.forEach(function(r){
      var a=r.answers||{};
      var row=cols.map(function(c){
        if(c==="created_at")return esc(fbFmtDateTime(r.created_at));
        if(c==="user_email")return esc(r.user_email);
        if(c==="org_name")return esc(r.org_name);
        if(c==="free_text")return esc(r.free_text);
        return esc(a[c]);
      });
      lines.push(row.join(","));
    });
    var csv="﻿"+lines.join("\n"); // BOM → 엑셀 한글 깨짐 방지
    var blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;a.download="feedback_"+new Date().toISOString().slice(0,10)+".csv";
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var fBtn=function(on){return{padding:"8px 14px",borderRadius:9,fontSize:"var(--fs-btn)",fontWeight:on?700:500,cursor:"pointer",fontFamily:FF,border:on?"2px solid #2563EB":"1.5px solid #E2E8F0",background:on?"#EFF6FF":"#fff",color:on?"#2563EB":"#475569"};};

  return(
    <div style={{maxWidth:1100}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:8}}>
        <div>
          <h2 style={{margin:0,fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>📋 베타 피드백</h2>
          <p style={{margin:"4px 0 0",color:"#64748B",fontSize:FS_BODY}}>사용자가 제출한 설문 응답을 최신순으로 확인합니다. (관리자 전용)</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={Object.assign({},btnS,{padding:"9px 16px",fontSize:"var(--fs-btn)"})} onClick={load}>↻ 새로고침</button>
          <button style={Object.assign({},btnP,{padding:"9px 18px",fontSize:"var(--fs-btn)"})} onClick={downloadCsv} disabled={filtered.length===0}>⬇ CSV 다운로드</button>
        </div>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"14px 0 18px"}}>
        <button style={fBtn(stFreeOnly[0])} onClick={function(){stFreeOnly[1](!stFreeOnly[0]);}}>💬 자유 의견 있는 응답만</button>
        <button style={fBtn(stLowOnly[0])} onClick={function(){stLowOnly[1](!stLowOnly[0]);}}>⚠️ 점수 낮은 응답만 (7점 미만)</button>
        <span style={{fontSize:"var(--fs-meta)",color:"#94A3B8",alignSelf:"center"}}>{filtered.length} / {rows.length}건</span>
      </div>

      {stLoading[0]?(
        <Card style={{padding:40,textAlign:"center"}}><div className="skeleton" style={{height:18,width:"40%",margin:"0 auto 12px"}}/><div style={{color:"#94A3B8",fontSize:FS_BODY}}>피드백을 불러오는 중…</div></Card>
      ):stErr[0]?(
        <Card style={{padding:"28px 24px",border:"1px solid #FECACA",background:"#FEF2F2"}}>
          <div style={{fontSize:"var(--fs-name)",fontWeight:800,color:"#DC2626",marginBottom:8}}>조회 권한이 없습니다 (RLS)</div>
          <p style={{fontSize:FS_BODY,color:"#7F1D1D",lineHeight:1.7,margin:"0 0 12px"}}>
            현재 <code>feedback_responses</code> 테이블은 INSERT만 허용되고 SELECT 정책이 없어 앱에서 직접 조회가 막혀 있습니다.
            아래 SELECT 정책을 Supabase SQL Editor에서 실행하면 이 화면에서 응답을 볼 수 있습니다. (코드 임의 실행 안 함 — 직접 확인 후 적용하세요)
          </p>
          <pre style={{background:"#1E293B",color:"#E2E8F0",padding:"14px 16px",borderRadius:10,fontSize:13,overflowX:"auto",lineHeight:1.6,margin:0}}>{
"CREATE POLICY \"feedback_select_admin\"\n  ON feedback_responses\n  FOR SELECT\n  TO authenticated\n  USING (\n    lower(auth.jwt() ->> 'email') = '<관리자 이메일>'\n  );"
          }</pre>
          <p style={{fontSize:"var(--fs-meta)",color:"#94A3B8",margin:"12px 0 0"}}>적용 전까지는 Supabase Table Editor 또는 이메일 리포트로 확인할 수 있습니다. 오류 상세는 브라우저 콘솔(console)에 기록됩니다.</p>
        </Card>
      ):filtered.length===0?(
        <Card style={{padding:40,textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>📭</div><p style={{color:"#94A3B8",fontSize:FS_BODY,margin:0}}>{rows.length===0?"아직 제출된 피드백이 없습니다.":"필터 조건에 맞는 응답이 없습니다."}</p></Card>
      ):(
        filtered.map(function(r){return <FbCard key={r.id||r.created_at} row={r}/>;})
      )}
    </div>
  );
}

// ── 공식 사이트 바로가기 (신청·공고 확인은 공식 사이트, 고객사 관리는 이곳) ──
// URL은 기존 지원금 데이터에서 쓰던 공식 링크를 그대로 재사용한다.
var OFFICIAL_SITES = [
  {name:"고용24",          desc:"고용지원금 확인·신청·기업지원 통합 창구",  url:"https://www.work24.go.kr",  emoji:"🏛️", color:"#1D4ED8", bg:"#EFF6FF", bd:"#BFDBFE"},
  {name:"노사발전재단",      desc:"일터혁신·워라밸·재직자 유지 지원사업 확인", url:"https://www.nosa.or.kr",     emoji:"🤝", color:"#334155", bg:"#F1F5F9", bd:"#E2E8F0"},
  {name:"여성새로일하기센터", desc:"새일여성인턴제 등 경력단절여성 채용 지원",  url:"https://saeil.mogef.go.kr",  emoji:"👩‍💼", color:"#BE185D", bg:"#FDF2F8", bd:"#FBCFE8"},
  {name:"한국노인인력개발원", desc:"시니어 인턴십 등 고령자 채용 지원 확인",    url:"https://www.seniorro.or.kr", emoji:"🧓", color:"#B45309", bg:"#FFFBEB", bd:"#FDE68A"},
  {name:"장애인고용공단 e-신고", desc:"장애인 고용장려금 신고·확인",          url:"https://www.esingo.or.kr",   emoji:"♿", color:"#0E7490", bg:"#ECFEFF", bd:"#A5F3FC"},
];

// 외부 사이트는 항상 새 탭 + noopener noreferrer 로 연다.
function OfficialSites(props){
  var primary=OFFICIAL_SITES[0]; var rest=OFFICIAL_SITES.slice(1);
  return(
    <div style={{background:"#fff",border:"1px solid #E8EDF3",borderRadius:16,padding:"20px 22px",marginBottom:16,boxShadow:"0 1px 2px rgba(15,23,42,0.03)"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <span style={{fontSize:17.5,fontWeight:800,color:"#0F172A",letterSpacing:"-0.3px"}}>🔗 공식 사이트 바로가기</span>
        <span style={{fontSize:13,color:"#94A3B8"}}>신청·공고 확인은 공식 사이트, 고객사 관리는 이곳에서</span>
      </div>
      {/* 고용24 — 가장 먼저 눈에 띄는 대표 버튼 */}
      <a href={primary.url} target="_blank" rel="noopener noreferrer" className="prog-tap"
         style={{display:"flex",alignItems:"center",gap:13,padding:"15px 18px",borderRadius:13,background:"linear-gradient(135deg,#EFF6FF,#FFFFFF)",border:"1.5px solid #BFDBFE",textDecoration:"none",marginBottom:10}}>
        <span style={{fontSize:26,flexShrink:0,lineHeight:1}}>{primary.emoji}</span>
        <span style={{minWidth:0,flex:1}}>
          <span style={{display:"block",fontSize:17,fontWeight:800,color:primary.color,letterSpacing:"-0.3px"}}>{primary.name} ↗</span>
          <span style={{display:"block",fontSize:13,color:"#64748B",marginTop:2,lineHeight:1.4}}>{primary.desc}</span>
        </span>
        <span style={{flexShrink:0,fontSize:12.5,fontWeight:800,color:"#1D4ED8",background:"#DBEAFE",borderRadius:999,padding:"5px 12px",whiteSpace:"nowrap"}}>대표 창구</span>
      </a>
      {/* 나머지 공식 사이트 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
        {rest.map(function(s){
          return(
            <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="prog-tap"
               style={{display:"flex",alignItems:"center",gap:11,padding:"13px 15px",borderRadius:12,background:s.bg,border:"1px solid "+s.bd,textDecoration:"none"}}>
              <span style={{fontSize:21,flexShrink:0,lineHeight:1}}>{s.emoji}</span>
              <span style={{minWidth:0,flex:1}}>
                <span style={{display:"block",fontSize:14.5,fontWeight:800,color:s.color,letterSpacing:"-0.3px"}}>{s.name} ↗</span>
                <span style={{display:"block",fontSize:12,color:"#64748B",marginTop:2,lineHeight:1.4}}>{s.desc}</span>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── 대표 지원금 한눈에 보기 (초보자용 · 쉬운 설명) ──
var REP_SUBSIDIES = [
  {emoji:"⭐", name:"청년일자리도약장려금",     grp:"신규채용",  tag:"청년 채용",      one:"청년을 새로 채용한 기업이 가장 먼저 확인할 지원금", use:"신규 채용 상담 때 우선 검토"},
  {emoji:"🤝", name:"고용촉진장려금",         grp:"신규채용",  tag:"취약계층 채용",  one:"취업취약계층 채용 시 검토",                      use:"채용 전후 요건 확인 필요"},
  {emoji:"🧓", name:"고령자 계속고용 장려금",   grp:"재직자유지", tag:"정년 이후 고용", one:"고령 직원을 계속 고용할 때 검토",                 use:"제조업·현장직 고객사에 유용"},
  {emoji:"👵", name:"시니어 인턴십",          grp:"신규채용",  tag:"시니어 채용",    one:"고령 인력 채용 시 확인",                        use:"한국노인인력개발원 확인"},
  {emoji:"👩‍💼", name:"새일여성인턴제",        grp:"신규채용",  tag:"여성 채용",      one:"경력단절여성 채용 관련",                        use:"여성새로일하기센터 확인"},
  {emoji:"🤱", name:"육아휴직/대체인력",       grp:"육아",     tag:"육아·대체인력",  one:"육아휴직·대체인력·근로시간 단축 관련",            use:"인사노무 상담과 함께 활용"},
];

function BeginnerSubsidyGuide(){
  var stOpen=useState(true);
  var tintOf={"신규채용":{bg:"#F5F9FF",bd:"#DCEAFE",c:"#1D4ED8",pill:"#DBEAFE"},"재직자유지":{bg:"#F8F6FD",bd:"#E6DEF7",c:"#7C3AED",pill:"#EDE4FB"},"육아":{bg:"#F2FBF6",bd:"#CBF0DA",c:"#059669",pill:"#D1FAE5"}};
  return(
    <div style={{background:"#fff",border:"1px solid #E8EDF3",borderRadius:16,padding:"20px 22px",marginBottom:16,boxShadow:"0 1px 2px rgba(15,23,42,0.03)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:18.5,fontWeight:800,color:"#0F172A",letterSpacing:"-0.4px"}}>📚 대표 지원금 한눈에 보기</div>
          <div style={{fontSize:14.5,color:"#64748B",marginTop:6,lineHeight:1.55}}>이름만 봐선 감이 안 잡히죠. 어떤 상황에 쓰는지 쉽게 정리했어요.</div>
        </div>
        <button className="prog-tap" style={Object.assign({},btnSm,{flexShrink:0})} onClick={function(){stOpen[1](!stOpen[0]);}}>{stOpen[0]?"접기 ▲":"펼치기 ▼"}</button>
      </div>
      {stOpen[0]&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(290px,1fr))",gap:12,marginTop:16}}>
          {REP_SUBSIDIES.map(function(s,i){
            var t=tintOf[s.grp]||tintOf["신규채용"];
            return(
              <div key={i} className="prog-card" style={{"--ci":i,background:t.bg,border:"1px solid "+t.bd,borderRadius:14,padding:"16px 17px",display:"flex",flexDirection:"column",gap:9}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{fontSize:24,lineHeight:1,flexShrink:0}}>{s.emoji}</span>
                  <span style={{fontSize:16,fontWeight:800,color:"#0F172A",letterSpacing:"-0.3px",wordBreak:"keep-all",lineHeight:1.3}}>{s.name}</span>
                </div>
                <span style={{alignSelf:"flex-start",fontSize:12.5,fontWeight:700,color:t.c,background:t.pill,borderRadius:999,padding:"4px 12px",whiteSpace:"nowrap"}}>{s.tag}</span>
                <div style={{fontSize:14.5,color:"#334155",lineHeight:1.5,wordBreak:"keep-all"}}>{s.one}</div>
                <div style={{fontSize:13,color:"#64748B",lineHeight:1.5,paddingTop:8,borderTop:"1px dashed "+t.bd,wordBreak:"keep-all"}}>📍 활용: {s.use}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 초보 컨설턴트용 시작 가이드 (접기/숨기기 · localStorage) ──
// 첫 사용자가 "무엇부터, 왜 쓰는지"를 바로 이해하도록 돕는다.
function StarterGuide(props){
  var stHidden=useState(function(){return guideHidden("dashboard");});
  var stOpen=useState(true); // 기본 펼침 — 첫 화면에서 가장 먼저 보이게
  if(stHidden[0])return null;
  function hideForDay(){guideHideForDay("dashboard");stHidden[1](true);}
  var steps=[
    {n:1,emoji:"📊",title:"기존 엑셀 불러오기",desc:"기존에 관리하던 고객사·직원 엑셀을 올려 시작합니다.",cta:"기존 엑셀 불러오기",on:props.onExcel,tint:"#EFF6FF",bd:"#BFDBFE",c:"#1D4ED8"},
    {n:2,emoji:"🎯",title:"지원금 후보 확인",desc:"직원별로 검토 가능한 지원금을 한눈에 정리합니다.",cta:"지원금 관리 보기",on:props.onPrograms,tint:"#F0EAFB",bd:"#DBCEF3",c:"#7C3AED"},
    {n:3,emoji:"📅",title:"일정·서류 관리",desc:"신청 기한·지급월·필요한 서류를 놓치지 않게 관리합니다.",cta:"진행 보드 보기",on:props.onKanban,tint:"#FFF7ED",bd:"#FED7AA",c:"#C2410C"},
    {n:4,emoji:"📄",title:"고객 보고서로 상담",desc:"대표님에게 보여줄 상담 자료와 보고서를 만듭니다.",cta:"고객 보고서 보기",on:props.onReport,tint:"#E5F7ED",bd:"#B6E9CA",c:"#059669"},
  ];

  // ── 접힘: 크고 클릭하고 싶은 CTA 카드 ──
  if(!stOpen[0]){
    return(
      <div className="fade-in" style={{display:"flex",alignItems:"center",gap:16,background:"linear-gradient(135deg,#F4F9FF,#FFFFFF)",border:"1px solid #DCEAFE",borderRadius:16,padding:"20px 24px",marginBottom:22,boxShadow:"0 2px 10px rgba(37,99,235,0.06)"}}>
        <span style={{fontSize:34,flexShrink:0,lineHeight:1}}>👋</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:19,fontWeight:800,color:"#0F172A",letterSpacing:"-0.4px",lineHeight:1.3,wordBreak:"keep-all"}}>처음 오셨나요? 고용지원금 관리는 이렇게 시작하세요</div>
          <div style={{fontSize:14.5,color:"#64748B",marginTop:5,lineHeight:1.5,wordBreak:"keep-all"}}>기존 엑셀 불러오기부터 고객 보고서 활용까지 한 번에 안내해드립니다.</div>
        </div>
        <button className="prog-tap" onClick={function(){stOpen[1](true);}} style={{flexShrink:0,background:"#2563EB",color:"#fff",border:"none",borderRadius:11,padding:"13px 24px",fontSize:15.5,fontWeight:800,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.28)",whiteSpace:"nowrap"}}>가이드 보기 →</button>
      </div>
    );
  }

  // ── 펼침: 그림형 사용 흐름 타임라인 (크게) ──
  return(
    <div className="fade-in-up" style={{background:"linear-gradient(135deg,#F4F9FF,#FFFFFF)",border:"1px solid #DCEAFE",borderRadius:20,padding:"30px 30px 26px",marginBottom:24,boxShadow:"0 4px 18px rgba(37,99,235,0.08)"}}>
      {/* 헤더 + 접기/숨기기 */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:22}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontSize:32,fontWeight:900,color:"#0F172A",letterSpacing:"-0.9px",lineHeight:1.2}}>👋 고용지원금 Pro 사용 흐름</div>
          <div style={{fontSize:16,color:"#64748B",marginTop:9,lineHeight:1.6,wordBreak:"keep-all"}}>기존 엑셀을 불러오고, 지원금 후보를 확인한 뒤, 고객 보고서로 상담 자료를 만듭니다.</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button className="prog-tap" style={Object.assign({},btnSm,{padding:"9px 14px"})} onClick={function(){stOpen[1](false);}}>가이드 접기 ▲</button>
        </div>
      </div>
      {/* 4단계 흐름 — PC 가로 / 모바일 세로 타임라인 (단계 사이 화살표) */}
      <div className="guide-flow">
        {steps.map(function(s,i){
          return(
            <React.Fragment key={s.n}>
              <div className="guide-step prog-card" style={{"--ci":i,background:"#fff",border:"1px solid "+s.bd,borderRadius:14,padding:"18px 16px",display:"flex",flexDirection:"column",gap:9,boxShadow:"0 1px 3px rgba(15,23,42,0.05)"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{width:30,height:30,borderRadius:10,background:s.tint,color:s.c,fontWeight:800,fontSize:14,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid "+s.bd}}>{s.n}</span>
                  <span style={{fontSize:34,lineHeight:1}}>{s.emoji}</span>
                </div>
                <div style={{fontSize:18,fontWeight:800,color:"#0F172A",letterSpacing:"-0.4px",lineHeight:1.3,wordBreak:"keep-all"}}>{s.title}</div>
                <div style={{fontSize:15,color:"#475569",lineHeight:1.55,flex:1,wordBreak:"keep-all"}}>{s.desc}</div>
                {s.cta&&s.on&&<button className="prog-tap" onClick={s.on} style={{alignSelf:"stretch",textAlign:"center",background:s.tint,color:s.c,border:"1px solid "+s.bd,borderRadius:10,padding:"10px 12px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:FF,marginTop:2}}>{s.cta} →</button>}
              </div>
              {i<steps.length-1&&<div className="guide-arrow" aria-hidden="true">→</div>}
            </React.Fragment>
          );
        })}
      </div>
      {/* 하단 한 줄 핵심 문구 */}
      <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:12,padding:"15px 18px",marginTop:18}}>
        <div style={{fontSize:15,color:"#1E40AF",lineHeight:1.65,wordBreak:"keep-all"}}>💡 이 도구는 <strong>지원금 신청 사이트가 아니라</strong>, 컨설턴트가 <strong>고객사별 지원금 업무를 관리하고 상담 자료로 연결</strong>하는 운영 도구입니다.</div>
      </div>
      {/* 안내 영상 자리 + 하루 동안 다시 보지 않기 */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginTop:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}/>{/* [D-94] ‘3분 사용법 영상 준비 중’ 빈 자리는 뺐다 — 없는 영상을 약속하지 않는다 */}
        <button className="prog-tap" onClick={hideForDay} style={{background:"none",border:"none",color:"#94A3B8",fontSize:13.5,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",padding:"6px 4px"}}>하루 동안 다시 보지 않기</button>
      </div>
    </div>
  );
}

var SIDEBAR_NAV = [
  {key:"dashboard", icon:"📊", label:"대시보드",         hint:"오늘 할 일과 이번 달 지원금 현황"},
  {key:"company",   icon:"🏢", label:"업체 관리",         hint:"고객사와 직원 정보 관리"},
  {key:"kanban",    icon:"🗂️", label:"진행 보드",         hint:"신청 단계와 마감일 관리"},
  {key:"wage",      icon:"🧮", label:"급여 계산기",        hint:"급여·사업주 부담 비용 계산"},
  {key:"simulator", icon:"📈", label:"수령액 시뮬레이터",   hint:"예상 수령액·수수료 계산"},
  {key:"diagnosis", icon:"🎯", label:"채용 진단",         hint:"검토 가능한 지원금 빠르게 확인"},
  {key:"programs",  icon:"⚙️", label:"지원금 관리",        hint:"지원금 종류와 공식 사이트 관리"},
  {key:"settings",  icon:"🛠️", label:"설정",             hint:"글자 크기·화면 안내 다시 보기"},
];

// ── 설정 화면 (글자 크기 · 화면 안내 다시 보기) ──
function SettingsScreen(props){
  var stScale=useState(function(){try{return localStorage.getItem("hrSubsidyPro_fontScale")||"normal";}catch(e){return "normal";}});
  function setScale(v){try{localStorage.setItem("hrSubsidyPro_fontScale",v);}catch(e){}applyFontScale(v);stScale[1](v);toast("글자 크기를 변경했습니다.","success");}
  var scaleOpts=[{v:"normal",label:"기본",sample:"가"},{v:"large",label:"조금 크게",sample:"가"},{v:"xlarge",label:"크게",sample:"가"}];
  var guideItems=[["dashboard","대시보드"],["company","업체 관리"],["kanban","진행 보드"],["wage","급여 계산기"],["simulator","수령액 시뮬레이터"],["diagnosis","채용 진단"],["programs","지원금 관리"]];
  function resetOne(key,label){guideReset(key);toast(label+" 화면 안내를 다시 켰습니다. 해당 화면에서 확인하세요.","success");}
  function resetAll(){guideItems.forEach(function(g){guideReset(g[0]);});toast("모든 화면 안내를 다시 켰습니다.","success");}
  var card={background:"#fff",border:"1px solid #E8EDF3",borderRadius:16,padding:"22px 24px",marginBottom:18,boxShadow:"0 1px 3px rgba(15,23,42,0.04)"};


  // ── 데이터 백업 내보내기 (현재 화면 데이터 → JSON · 읽기 전용) ──
  function exportBackup(){
    try{
      var payload={exportedAt:new Date().toISOString(),app:"hrSubsidyPro",version:1,
        companies:props.companies||[],employees:props.employees||[],
        programs:props.programs||{},calendarMemos:props.calendarMemos||{}};
      var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
      var url=URL.createObjectURL(blob);
      var a=document.createElement("a");
      a.href=url; a.download="고용지원금Pro_백업_"+new Date().toISOString().slice(0,10)+".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},1000);
      toast("백업 파일을 내려받았습니다.","success");
    }catch(e){toast("백업 내보내기에 실패했습니다.","warn");}
  }

  // ── 로컬 화면 설정 초기화 (이 브라우저의 표시 설정만 · 업무 데이터는 보존) ──
  var stResetText=useState("");
  function resetLocalPrefs(){
    if(stResetText[0]!=="초기화"){toast("확인을 위해 '초기화'를 입력하세요.","warn");return;}
    try{
      var keys=[];
      for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("hrSubsidyPro_")===0)keys.push(k);}
      keys.forEach(function(k){localStorage.removeItem(k);});
    }catch(e){}
    applyFontScale("normal");
    toast("이 브라우저의 화면 설정을 초기화했습니다.","success");
    stResetText[1]("");
    setTimeout(function(){window.location.reload();},800);
  }
  return(
    <div className="fade-in">
      <div style={{marginBottom:18}}>
        <h2 style={{margin:"0 0 4px",fontSize:FS_PAGE_TITLE,fontWeight:800,letterSpacing:"-0.5px"}}>🛠️ 설정</h2>
        <p style={{margin:0,fontSize:FS_BODY,color:"#64748B"}}>글자 크기와 화면 안내를 내게 맞게 바꿀 수 있어요.</p>
      </div>

      {/* 전체 글자 크기 */}
      <div style={card}>
        <div style={{fontSize:18,fontWeight:800,color:"#0F172A",letterSpacing:"-0.3px"}}>전체 글자 크기</div>
        <div style={{fontSize:14,color:"#64748B",margin:"6px 0 16px",lineHeight:1.5}}>화면 전체의 글자 크기를 조절합니다. 눈이 편한 크기를 선택하세요.</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {scaleOpts.map(function(o){var on=stScale[0]===o.v;return(
            <button key={o.v} className="prog-tap" onClick={function(){setScale(o.v);}}
              style={{flex:"1 1 120px",minWidth:120,display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"16px 12px",borderRadius:13,cursor:"pointer",fontFamily:FF,
                background:on?"#EFF6FF":"#fff",border:on?"2px solid #2563EB":"1px solid #E2E8F0"}}>
              <span style={{fontSize:o.v==="normal"?20:o.v==="large"?25:30,fontWeight:800,color:on?"#1D4ED8":"#475569",lineHeight:1}}>{o.sample}</span>
              <span style={{fontSize:14.5,fontWeight:700,color:on?"#1D4ED8":"#475569"}}>{o.label}</span>
              {on&&<span style={{fontSize:12,fontWeight:700,color:"#2563EB"}}>✓ 사용 중</span>}
            </button>
          );})}
        </div>
      </div>

      {/* 화면 안내 다시 보기 */}
      <div style={card}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:18,fontWeight:800,color:"#0F172A",letterSpacing:"-0.3px"}}>화면 안내 다시 보기</div>
            <div style={{fontSize:14,color:"#64748B",marginTop:6,lineHeight:1.5}}>처음 보는 화면 설명을 다시 켤 수 있어요. (각 화면 상단 안내 카드)</div>
          </div>
          <button className="prog-tap" onClick={resetAll} style={{flexShrink:0,background:"#2563EB",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:14.5,fontWeight:800,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.25)"}}>모든 화면 안내 다시 켜기</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginTop:16}}>
          {guideItems.map(function(g){return(
            <div key={g[0]} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"13px 15px",borderRadius:12,background:"#F8FAFC",border:"1px solid #EEF1F5"}}>
              <span style={{fontSize:15,fontWeight:700,color:"#334155"}}>{g[1]}</span>
              <button className="prog-tap" onClick={function(){resetOne(g[0],g[1]);}} style={{flexShrink:0,background:"#fff",color:"#2563EB",border:"1px solid #BFDBFE",borderRadius:9,padding:"8px 14px",fontSize:13.5,fontWeight:700,cursor:"pointer",fontFamily:FF}}>다시 보기</button>
            </div>
          );})}
        </div>
      </div>

      {/* [D-93] 화면 잠금(PIN)은 옮기지 않았다 — 이 OS 는 비밀번호·PIN 을 저장하지 않는다 */}

      {/* 데이터 백업 · 보관 안내 */}
      <div style={card}>
        <div style={{fontSize:18,fontWeight:800,color:"#0F172A",letterSpacing:"-0.3px"}}>데이터 백업</div>
        <div style={{fontSize:14,color:"#64748B",margin:"6px 0 14px",lineHeight:1.6}}>현재 화면에 보이는 업체·직원·지원금·메모 데이터를 JSON 파일로 내려받아 보관할 수 있습니다.</div>
        <button className="prog-tap" style={btnP} onClick={exportBackup}>⬇️ 전체 데이터 백업 내보내기 (JSON)</button>
        <div style={{marginTop:14,padding:"13px 16px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:12,fontSize:13.5,color:"#92400E",lineHeight:1.7}}>
          <div style={{fontWeight:800,marginBottom:4}}>안전한 사용 안내</div>
          · <strong>주 1회 백업</strong>을 권장합니다.<br/>
          · <strong>공용 PC</strong> 사용 시 로그아웃에 주의하세요.<br/>
          · 실제 <strong>민감정보(주민번호 등) 입력은 최소화</strong>해 주세요.
        </div>
      </div>

      {/* 로컬 화면 설정 초기화 */}
      <div style={Object.assign({},card,{border:"1px solid #FECACA"})}>
        <div style={{fontSize:18,fontWeight:800,color:"#B91C1C",letterSpacing:"-0.3px"}}>이 브라우저 화면 설정 초기화</div>
        <div style={{fontSize:14,color:"#64748B",margin:"6px 0 14px",lineHeight:1.6}}>이 브라우저에 저장된 <strong>화면 설정(글자 크기·안내 표시)</strong>만 초기화합니다. <strong>업체·직원 등 업무 데이터는 모듈 기록에 보관되어 삭제되지 않습니다.</strong></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <input value={stResetText[0]} onChange={function(e){stResetText[1](e.target.value);}} style={Object.assign({},inp,{width:200})} placeholder="초기화 라고 입력"/>
          <button className="prog-tap" style={{background:stResetText[0]==="초기화"?"#DC2626":"#FCA5A5",color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:14.5,fontWeight:800,cursor:stResetText[0]==="초기화"?"pointer":"not-allowed",fontFamily:FF}} onClick={resetLocalPrefs}>화면 설정 초기화</button>
        </div>
      </div>

      {/* 데이터 보관 방식 안내 (정확한 표기) */}
      <div style={{fontSize:12.5,color:"#94A3B8",textAlign:"center",lineHeight:1.6,marginBottom:8}}>
        업무 데이터(업체·직원 등)는 이 OS 의 모듈 기록에 보관됩니다. 화면 설정(글자 크기·안내)만 이 브라우저에 저장됩니다.
      </div>
    </div>
  );
}

// ── 메뉴별 화면 안내 (프롤로그) — 처음 쓰는 컨설턴트용 ──
var SCREEN_GUIDES = {
  dashboard:{icon:"📊",title:"대시보드",desc:"오늘 확인해야 할 지원금 업무와 이번 달 예상 수령액을 한눈에 보는 곳입니다.",
    can:["이번 달 신청 가능 금액 확인","지연·임박 업무 확인","오늘 처리할 일 확인"],
    result:"어떤 고객사부터 챙겨야 하는지 바로 알 수 있습니다.",
    ctas:[{label:"진행 보드 보기",act:"kanban",primary:true},{label:"업체 관리 보기",act:"company"}]},
  company:{icon:"🏢",title:"업체 관리",desc:"고객사와 직원 정보를 등록하고, 지원금 검토의 기준이 되는 정보를 관리하는 곳입니다.",
    can:["고객사 등록 · 기존 엑셀 불러오기","직원 정보 관리","업체별 지원금 현황 확인"],
    result:"고객사별로 어떤 지원금을 검토할 수 있는지 정리할 수 있습니다.",
    ctas:[{label:"업체 추가",act:"addCompany",primary:true},{label:"진행 보드 보기",act:"kanban"}]},
  kanban:{icon:"🗂️",title:"진행 보드",desc:"지원금별 신청 단계와 마감일을 관리하는 업무 보드입니다.",
    can:["지연 업무 · 신청 임박 건 확인","서류 미완료 건 확인","지급 예정 건 관리"],
    result:"신청 기한을 놓치지 않고, 오늘 처리할 업무를 바로 확인할 수 있습니다.",
    ctas:[{label:"업체 관리로 이동",act:"company",primary:true}]},
  wage:{icon:"🧮",title:"급여 계산기",desc:"직원 급여와 사업주 부담 비용을 계산해 상담 자료로 활용하는 곳입니다.",
    can:["급여 기준 비용 계산","4대보험·사업주 부담액 확인","채용 상담 비용 설명 자료로 활용"],
    result:"대표님에게 채용 비용과 지원금 효과를 더 쉽게 설명할 수 있습니다.",
    ctas:[{label:"수령액 시뮬레이터",act:"simulator",primary:true},{label:"채용 진단",act:"diagnosis"}]},
  simulator:{icon:"📈",title:"수령액 시뮬레이터",desc:"고객사가 받을 수 있는 예상 지원금과 컨설팅 수수료를 계산하는 곳입니다.",
    can:["예상 수령액 계산","수수료 계산","상담 전 제안 금액 확인"],
    result:"대표님에게 '얼마를 받을 수 있는지'를 숫자로 보여줄 수 있습니다.",
    ctas:[{label:"채용 진단",act:"diagnosis",primary:true},{label:"급여 계산기",act:"wage"}]},
  diagnosis:{icon:"🎯",title:"채용 진단",desc:"신규 채용 예정 고객사가 어떤 지원금을 검토할 수 있는지 빠르게 확인하는 곳입니다.",
    can:["채용 조건 확인","지원금 후보 확인","상담 전 사전 진단"],
    result:"채용 상담 전에 검토 가능한 지원금을 빠르게 좁힐 수 있습니다.",
    ctas:[{label:"지원금 관리 보기",act:"programs",primary:true},{label:"업체 관리",act:"company"}]},
  programs:{icon:"⚙️",title:"지원금 관리",desc:"고용지원금 종류와 공식 사이트, 운영 기준을 관리하는 곳입니다.",
    can:["15개 지원금 확인 · ON/OFF 관리","공식 사이트 바로가기","지원금별 지급 조건 확인"],
    result:"지원금 정보를 매번 검색하지 않고, 한곳에서 확인할 수 있습니다.",
    ctas:[{label:"고용24 열기",act:"gov24",primary:true},{label:"대시보드",act:"dashboard"}]},
};

// 재사용 화면 안내 카드 (접기/펼치기 + 하루 동안 숨김 + 영상 자리)
function ScreenGuide(props){
  var key=props.viewKey; var g=SCREEN_GUIDES[key];
  var stHidden=useState(function(){return guideHidden(key);});
  var stOpen=useState(true);
  if(!g||stHidden[0])return null;
  function hideForDay(){guideHideForDay(key);stHidden[1](true);}
  function runCta(act){
    if(act==="gov24"){try{window.open("https://www.work24.go.kr","_blank","noopener,noreferrer");}catch(e){}return;}
    if(act==="addCompany"){props.onAddCompany&&props.onAddCompany();return;}
    props.onNavigate&&props.onNavigate(act);
  }
  // 접힘: 한 줄 바
  if(!stOpen[0]){
    return(
      <div className="fade-in" style={{display:"flex",alignItems:"center",gap:11,background:"#fff",border:"1px solid #E8EDF3",borderRadius:12,padding:"12px 16px",marginBottom:16,boxShadow:"0 1px 2px rgba(15,23,42,0.03)"}}>
        <span style={{fontSize:20,flexShrink:0}}>{g.icon}</span>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:14.5,fontWeight:800,color:"#0F172A"}}>{g.title} 안내</span>
          <span style={{fontSize:13,color:"#94A3B8",marginLeft:8}} className="hide-mobile">{g.desc}</span>
        </div>
        <button className="prog-tap" style={Object.assign({},btnSm,{flexShrink:0})} onClick={function(){stOpen[1](true);}}>안내 펼치기 ▾</button>
      </div>
    );
  }
  // 펼침: 안내 카드 (크게)
  return(
    <div className="fade-in-up" style={{background:"#fff",border:"1px solid #E0EBFB",borderRadius:20,padding:"28px 30px",marginBottom:22,boxShadow:"0 4px 18px rgba(37,99,235,0.07)"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,minWidth:0}}>
          <span style={{fontSize:42,lineHeight:1,flexShrink:0}}>{g.icon}</span>
          <div style={{minWidth:0}}>
            <div style={{fontSize:27,fontWeight:900,color:"#0F172A",letterSpacing:"-0.6px",lineHeight:1.2}}>{g.title}</div>
            <div style={{fontSize:16,color:"#64748B",marginTop:6,lineHeight:1.55,wordBreak:"keep-all"}}>{g.desc}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <button className="prog-tap" style={Object.assign({},btnSm,{padding:"9px 14px"})} onClick={function(){stOpen[1](false);}}>안내 접기 ▴</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14,marginTop:22}}>
        {/* 이 화면에서 할 수 있는 것 */}
        <div style={{background:"#F5F9FF",border:"1px solid #DCEAFE",borderRadius:15,padding:"18px 20px"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#1D4ED8",marginBottom:12}}>✅ 이 화면에서 할 수 있는 것</div>
          {g.can.map(function(c,i){return(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:i<g.can.length-1?9:0}}>
              <span style={{color:"#2563EB",fontWeight:800,flexShrink:0,fontSize:16}}>·</span>
              <span style={{fontSize:15.5,color:"#334155",lineHeight:1.5,wordBreak:"keep-all"}}>{c}</span>
            </div>
          );})}
        </div>
        {/* 얻는 결과 + 영상 자리 */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:15,padding:"18px 20px",flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:"#166534",marginBottom:9}}>🎯 이 화면을 쓰면</div>
            <div style={{fontSize:16,color:"#15803D",lineHeight:1.55,fontWeight:600,wordBreak:"keep-all"}}>{g.result}</div>
          </div>
          {/* [D-94] ‘3분 사용법 영상 준비 중’ 빈 자리는 뺐다 */}
        </div>
      </div>
      {/* CTA + 하루 동안 다시 보지 않기 */}
      <div style={{display:"flex",gap:9,marginTop:18,flexWrap:"wrap",alignItems:"center"}}>
        {(g.ctas||[]).map(function(c,i){return(
          <button key={i} className="prog-tap" onClick={function(){runCta(c.act);}}
            style={c.primary?{background:"#2563EB",color:"#fff",border:"none",borderRadius:11,padding:"13px 24px",fontSize:15.5,fontWeight:800,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.25)"}
                            :{background:"#fff",color:"#475569",border:"1px solid #E2E8F0",borderRadius:11,padding:"13px 22px",fontSize:15.5,fontWeight:700,cursor:"pointer",fontFamily:FF}}>{c.label} →</button>
        );})}
        <button className="prog-tap" onClick={hideForDay} style={{marginLeft:"auto",background:"none",border:"none",color:"#94A3B8",fontSize:13.5,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap",padding:"6px 4px"}}>하루 동안 다시 보지 않기</button>
      </div>
    </div>
  );
}

// ── Cmd+K 글로벌 검색 팔레트 ─────────────────────────────
function CmdKSearch(props){
  var open=props.open; var onClose=props.onClose;
  var companies=props.companies||[]; var employees=props.employees||[];
  var programs=props.programs||{}; var goCompany=props.goCompany;
  var setView=props.setView;

  var stQ=useState(""); var q=stQ[0]; var setQ=stQ[1];
  var stSel=useState(0); var sel=stSel[0]; var setSel=stSel[1];
  var inputRef=useRef();

  useEffect(function(){
    if(open){ setQ(""); setSel(0); setTimeout(function(){ inputRef.current&&inputRef.current.focus(); },30); }
  },[open]);

  var results=useMemo(function(){
    var list=[];
    var qn=q.trim().toLowerCase();
    if(!qn) return list;
    companies.forEach(function(c){
      if((c.name||"").toLowerCase().indexOf(qn)>=0||
         (c.bizNo||"").replace(/-/g,"").indexOf(qn.replace(/-/g,""))>=0){
        list.push({type:"company",id:c.id,title:c.name,sub:c.bizNo||"",icon:"🏢"});
      }
    });
    employees.forEach(function(e){
      if((e.name||"").toLowerCase().indexOf(qn)>=0||
         (e.phone||"").replace(/-/g,"").indexOf(qn.replace(/-/g,""))>=0){
        var c=companies.find(function(x){return x.id===e.companyId;});
        list.push({type:"employee",id:e.companyId,empId:e.id,title:e.name,sub:c?c.name:"",icon:"👤"});
      }
    });
    Object.values(programs).forEach(function(p){
      if((p.name||"").toLowerCase().indexOf(qn)>=0){
        list.push({type:"program",id:"programs",title:p.name,sub:p.group||"",icon:"📋"});
      }
    });
    return list.slice(0,12);
  },[q,companies,employees,programs]);

  useEffect(function(){ setSel(0); },[results]);

  function activate(r){
    if(!r) return;
    if(r.type==="company"||r.type==="employee"){ goCompany(r.id); }
    else if(r.type==="program"){ setView("programs"); }
    onClose();
  }

  function onKey(e){
    if(e.key==="ArrowDown"){ e.preventDefault(); setSel(function(s){return Math.min(s+1,results.length-1);}); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); setSel(function(s){return Math.max(s-1,0);}); }
    else if(e.key==="Enter"){ e.preventDefault(); activate(results[sel]); }
    else if(e.key==="Escape"){ onClose(); }
  }

  if(!open) return null;

  var TYPE_LABEL={company:"업체",employee:"직원",program:"지원금"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"80px 16px 16px"}} onClick={onClose}>
      <div style={{background:"#fff",borderRadius:18,width:"100%",maxWidth:560,boxShadow:"0 20px 60px rgba(15,23,42,0.3)",overflow:"hidden"}} onClick={function(e){e.stopPropagation();}}>
        {/* 검색 입력 */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:"1px solid #F1F5F9"}}>
          <span style={{fontSize:20,color:"#94A3B8",flexShrink:0}}>🔍</span>
          <input ref={inputRef} value={q} onChange={function(e){setQ(e.target.value);}} onKeyDown={onKey}
            placeholder="업체명, 직원명, 지원금명으로 검색…"
            style={{flex:1,border:"none",outline:"none",fontSize:17,fontFamily:FF,color:"#1E293B",background:"transparent"}}/>
          <kbd style={{fontSize:13,color:"#94A3B8",background:"#F1F5F9",border:"1px solid #E2E8F0",borderRadius:5,padding:"2px 7px",flexShrink:0}}>ESC</kbd>
        </div>
        {/* 결과 목록 */}
        <div style={{maxHeight:360,overflowY:"auto",padding:q?"8px 0":"0"}}>
          {q&&results.length===0&&(
            <div style={{padding:"28px 20px",textAlign:"center",fontSize:16,color:"#94A3B8"}}>검색 결과가 없습니다</div>
          )}
          {!q&&(
            <div style={{padding:"24px 20px",textAlign:"center",fontSize:16,color:"#94A3B8",lineHeight:1.8}}>
              <div style={{fontSize:28,marginBottom:8}}>⌘</div>
              업체명, 직원명, 지원금명을 입력하세요<br/>
              <span style={{fontSize:14}}>↑↓ 선택 · Enter 이동 · ESC 닫기</span>
            </div>
          )}
          {results.map(function(r,i){
            var active=i===sel;
            return(
              <div key={r.type+"-"+(r.empId||r.id)+"-"+i}
                style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",cursor:"pointer",background:active?"#EFF6FF":"transparent",transition:"background 0.1s"}}
                onMouseEnter={function(){setSel(i);}}
                onClick={function(){activate(r);}}>
                <span style={{fontSize:22,flexShrink:0}}>{r.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:600,color:active?"#2563EB":"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                  {r.sub&&<div style={{fontSize:14,color:"#94A3B8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>}
                </div>
                <span style={{fontSize:13,color:active?"#2563EB":"#CBD5E1",background:active?"#DBEAFE":"#F8FAFC",border:"1px solid "+(active?"#BFDBFE":"#E2E8F0"),borderRadius:5,padding:"2px 8px",flexShrink:0,fontWeight:500}}>{TYPE_LABEL[r.type]}</span>
                {active&&<span style={{fontSize:14,color:"#93C5FD",flexShrink:0}}>↵</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Board: 진행 상태별 파이프라인 보드 ────────────
function KanbanBoard(props){
  var employees=props.employees||[]; var companies=props.companies||[];
  var programs=props.programs||{}; var onPatch=props.onPatchEmployee||function(){};
  var goCompany=props.goCompany||function(){};
  var onProcess=props.onProcess||function(cid){goCompany(cid);};

  var stFilter=useState("all");
  var stDrag=useState(null);   // 드래그 중인 직원 id
  var stOver=useState(null);   // 드래그 오버 중인 컬럼 key
  var stMenu=useState(null);   // 이동 메뉴 열린 직원 id
  var stExp=useState({});      // 카드 펼침 상태 (id→true)
  var stColExp=useState({});   // 컬럼별 "더 보기" 펼침 상태 (colKey→true, 컬럼별 독립)
  function toggleExp(id){ var m=Object.assign({},stExp[0]); m[id]=!m[id]; stExp[1](m); }

  // 메뉴 바깥 클릭 시 닫기
  useEffect(function(){
    function close(){ stMenu[1](null); }
    if(stMenu[0]){ document.addEventListener("click",close); return function(){ document.removeEventListener("click",close); }; }
  },[stMenu[0]]);

  function normStatus(s){ return STS.find(function(x){return x.key===s;})?s:"preparing"; }
  function empRemaining(e){ return (e.rounds||[]).reduce(function(s,r){return s+(r.isPaid?0:(r.expectedAmount||r.amount||0));},0); }
  function empNextDday(e){ var dd=null; (e.rounds||[]).some(function(r){ if(!r.isPaid&&e.startDate){ dd=getDday(addMo(e.startDate,r.month)); return true; } return false; }); return dd; }
  // 카드 노출 우선순위: 0 지연 → 1 임박(D-7 이내) → 2 서류 미완료 → 3 일반
  // 컬럼이 접힌 상태에서 숨겨지는 카드는 상대적으로 덜 급한 카드가 되도록 정렬에 사용.
  function empUrgency(e){
    var dd=empNextDday(e);
    if(dd!==null&&dd<0)return 0;
    if(dd!==null&&dd<=7)return 1;
    var docs=e.employeeDocs||[]; var done=docs.filter(function(d){return d.done;}).length;
    if(docs.length>0&&done<docs.length)return 2;
    return 3;
  }
  function byUrgency(a,b){
    var ua=empUrgency(a),ub=empUrgency(b);
    if(ua!==ub)return ua-ub;
    var da=empNextDday(a),db=empNextDday(b);
    if(da===null&&db===null)return 0;
    if(da===null)return 1;
    if(db===null)return -1;
    return da-db;
  }

  var visEmps=useMemo(function(){
    return stFilter[0]==="all"?employees:employees.filter(function(e){return e.companyId===stFilter[0];});
  },[employees,stFilter[0]]);

  function colEmps(key){ return visEmps.filter(function(e){return normStatus(e.status)===key;}); }
  function move(empId,newStatus){
    var e=employees.find(function(x){return x.id===empId;});
    if(e&&normStatus(e.status)===newStatus){ stMenu[1](null); return; }
    onPatch(empId,{status:newStatus});
    var sl=(STS.find(function(s){return s.key===newStatus;})||{}).label||newStatus;
    if(e&&props.onLog)props.onLog(e.companyId,e.name+" 상태 → '"+sl+"'","상태변경");
    stMenu[1](null);
    toast("'"+sl+"'(으)로 상태가 변경되었습니다.","success");
  }

  // 파이프라인 요약
  var activeEmps=visEmps.filter(function(e){return e.status!=="resigned";});
  var pipelineValue=activeEmps.reduce(function(s,e){return s+empRemaining(e);},0);
  var completedCount=colEmps("completed").length;
  var convRate=activeEmps.length>0?Math.round(completedCount/activeEmps.length*100):0;
  var overdueCount=0,overdueAmt=0,next7Count=0;
  activeEmps.forEach(function(e){(e.rounds||[]).forEach(function(r){if(r.isPaid)return;if(e.startDate){var dd=getDday(addMo(e.startDate,r.month));if(dd!==null){if(dd<0){overdueCount++;overdueAmt+=r.expectedAmount||r.amount||0;}else if(dd<=7)next7Count++;}}});});

  function card(e){
    var p=programs[e.programId];
    var company=companies.find(function(c){return c.id===e.companyId;});
    var paid=(e.rounds||[]).filter(function(r){return r.isPaid;}).length;
    var total=(e.rounds||[]).length;
    var menuOpen=stMenu[0]===e.id;
    var dragging=stDrag[0]===e.id;
    var expanded=!!stExp[0][e.id];
    var kc=kcol(normStatus(e.status));
    var nextRound=null;
    (e.rounds||[]).some(function(r){if(!r.isPaid&&e.startDate){nextRound={label:r.label,amount:r.expectedAmount||r.amount||0,dd:getDday(addMo(e.startDate,r.month))};return true;}return false;});
    var remaining=empRemaining(e);
    var docs=e.employeeDocs||[]; var docDone=docs.filter(function(d){return d.done;}).length; var docTotal=docs.length;
    var ndd=nextRound?nextRound.dd:null;
    var ddBadge=ndd===null?null:ndd<0?{kind:"danger",t:"D+"+Math.abs(ndd)+" 지연"}:ndd<=7?{kind:"primary",t:ndd===0?"D-Day":"D-"+ndd}:{kind:"neutral",t:"D-"+ndd};
    var overdue=ndd!==null&&ndd<0;
    return(
      <div key={e.id} draggable
        onDragStart={function(ev){stDrag[1](e.id);ev.dataTransfer.effectAllowed="move";ev.dataTransfer.setData("text/plain",e.id);}}
        onDragEnd={function(){stDrag[1](null);stOver[1](null);}}
        onClick={function(){toggleExp(e.id);}}
        className="hover-card"
        title={expanded?"클릭하면 접힙니다":"클릭하면 상세가 펼쳐집니다"}
        style={{background:overdue?"#FFF5F5":kc.soft,borderRadius:13,border:"1px solid "+(overdue?"#FECACA":kc.border),borderLeft:"4px solid "+(overdue?"#DC2626":kc.main),padding:"13px 14px",marginBottom:9,cursor:"grab",boxShadow:dragging?"0 12px 28px rgba(37,99,235,0.22)":"0 1px 2px rgba(15,23,42,0.04)",opacity:dragging?0.45:1,position:"relative",transition:"box-shadow 0.15s,opacity 0.15s,transform 0.1s",transform:dragging?"scale(1.03)":undefined}}>
        {/* 기본 노출: 이름 · 회사 · 지원금/연도 */}
        <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
          <div style={{width:30,height:30,borderRadius:15,background:"#fff",border:"1px solid "+kc.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:kc.main,fontWeight:700,flexShrink:0}}>{(e.name||"?").charAt(0)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"var(--fs-name)",fontWeight:800,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
            <div onClick={function(ev){ev.stopPropagation();goCompany(e.companyId);}} title="업체 상세 보기" style={{fontSize:"var(--fs-sub)",color:"#2563EB",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer"}}>🏢 {company?company.name:""}</div>
          </div>
          <button onClick={function(ev){ev.stopPropagation();stMenu[1](menuOpen?null:e.id);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#94A3B8",padding:"0 2px",flexShrink:0,lineHeight:1}} title="상태 이동">⋮</button>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>
          {p&&<span style={{...neutralBadge(),maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block",verticalAlign:"bottom"}} title={p.name}>{p.name}</span>}
          <YearBadge year={empProgYear(e,programs)}/>
          {!expanded&&ddBadge&&<span style={ddBadge.kind==="danger"?dangerBadge():ddBadge.kind==="primary"?primaryBadge():neutralBadge()}>{ddBadge.t}</span>}
        </div>
        {/* 처리하기: 직원 수정 화면으로 바로 이동 (상세 펼침 안내는 tooltip + 최소 문구) */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:7}}>
          <span style={{fontSize:11.5,color:"#94A3B8"}}>{expanded?"접기 ▴":"상세 ▾"}</span>
          <button onClick={function(ev){ev.stopPropagation();onProcess(e.companyId,e.id);}}
            style={{background:kc.main,color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:"var(--fs-btn)",fontWeight:700,cursor:"pointer",fontFamily:FF,flexShrink:0,whiteSpace:"nowrap"}}
            title="이 직원의 처리 화면으로 이동">처리하기 →</button>
        </div>
        {/* 펼침: 상세 정보 */}
        {expanded&&(
          <React.Fragment>
            {nextRound&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:9,padding:"7px 10px",borderRadius:9,background:"#fff",border:"1px solid "+kc.border}}>
                <span style={{fontSize:"var(--fs-sub)",fontWeight:700,color:"#0F172A"}}>{nextRound.label} {fMan(nextRound.amount)}</span>
                {ddBadge&&<span style={ddBadge.kind==="danger"?dangerBadge():ddBadge.kind==="primary"?primaryBadge():neutralBadge()}>{ddBadge.t}</span>}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,fontSize:"var(--fs-sub)",color:"#475569",fontWeight:500,flexWrap:"wrap"}}>
              <span>잔여 <strong style={{color:"#0F172A"}}>{fMan(remaining)}</strong></span>
              {docTotal>0&&<span>서류 <strong style={{color:docDone===docTotal?"#059669":"#64748B"}}>{docDone}/{docTotal}</strong></span>}
              {total>0&&<span style={{marginLeft:"auto",color:paid>0?"#059669":"#94A3B8"}}>{paid}/{total}회차</span>}
            </div>
          </React.Fragment>
        )}
        {menuOpen&&(
          <div style={{position:"absolute",right:8,top:38,zIndex:30,background:"#fff",borderRadius:10,boxShadow:"0 10px 28px rgba(15,23,42,0.20)",border:"1px solid #E2E8F0",padding:6,width:168}} onClick={function(ev){ev.stopPropagation();}}>
            <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",padding:"4px 8px"}}>상태 이동</div>
            {STS.map(function(s){ var on=normStatus(e.status)===s.key; return(
              <div key={s.key} onClick={function(){move(e.id,s.key);}} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 8px",borderRadius:7,cursor:"pointer",fontSize:"var(--fs-sub)",background:on?s.bg:"transparent",color:on?s.color:"#475569",fontWeight:on?700:500}}>
                <span>{s.icon}</span><span>{s.label}</span>{on&&<span style={{marginLeft:"auto",fontSize:"var(--fs-badge)"}}>✓</span>}
              </div>
            );})}
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="fade-in">
      {/* 파이프라인 요약 + 필터 */}
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"stretch"}}>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 200px",border:"1px solid #E2E8F0",borderLeft:"3px solid #2563EB"}}>
          <div style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600,marginBottom:4}}>파이프라인 잔여 가치</div>
          <div style={{fontSize:28,fontWeight:800,letterSpacing:"-0.5px",color:"#1D4ED8"}}>{fMan(pipelineValue)}</div>
          <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:4}}>진행 중 미수령 예정액 합계</div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 140px",border:"1px solid #E2E8F0"}}>
          <div style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600,marginBottom:4}}>진행 중 대상자</div>
          <div style={{fontSize:28,fontWeight:800,color:"#0F172A"}}>{activeEmps.length}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>명</span></div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 140px",border:"1px solid #E2E8F0"}}>
          <div style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600,marginBottom:4}}>완료 전환율</div>
          <div style={{fontSize:28,fontWeight:800,color:"#059669"}}>{convRate}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>%</span></div>
          <div style={{height:6,background:"#F1F5F9",borderRadius:3,overflow:"hidden",marginTop:8}}><div style={{height:"100%",width:convRate+"%",background:"#059669",borderRadius:3,transition:"width 0.5s ease"}}/></div>
        </Card>
        <Card className="kpi-card" style={{padding:"16px 20px",flex:"1 1 150px",border:"1px solid #E2E8F0",borderLeft:overdueCount>0?"3px solid #DC2626":"1px solid #E2E8F0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:"var(--fs-label)",color:"#64748B",fontWeight:600}}>지연 신청</span>{overdueCount>0&&<span style={{...dangerBadge()}}>지연</span>}</div>
          <div style={{fontSize:28,fontWeight:800,color:overdueCount>0?"#DC2626":"#0F172A"}}>{overdueCount}<span style={{fontSize:15,color:"#94A3B8",marginLeft:3}}>건</span></div>
          <div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:4}}>{overdueCount>0?fMan(overdueAmt)+" 위험":"지연 없음"}{next7Count>0?" · 임박 "+next7Count:""}</div>
        </Card>
      </div>

      {/* 보드 헤더: 안내 문구(확대) + 업체 필터(본문 상단으로 이동·확대) */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap",minWidth:0}}>
          <span style={{fontSize:"clamp(20px,4vw,24px)",fontWeight:800,color:"#0F172A",whiteSpace:"nowrap",letterSpacing:"-0.5px"}}>🗂️ 단계별 진행 보드</span>
          <span style={{fontSize:"var(--fs-sub)",color:"#64748B",fontWeight:500}}>지원금 신청 일정과 처리 상태를 한눈에 관리합니다.</span>
        </div>
        {companies.length>0&&(
          <select style={Object.assign({},inp,{width:"auto",minWidth:200,fontSize:"var(--fs-list)",fontWeight:700,flexShrink:0})} value={stFilter[0]} onChange={function(e){stFilter[1](e.target.value);}}>
            <option value="all">🗂️ 전체 업체 기준</option>
            {companies.map(function(c){return <option key={c.id} value={c.id}>🏢 {c.name}</option>;})}
          </select>
        )}
      </div>

      {activeEmps.length===0&&colEmps("resigned").length===0?(
        <EmptyState icon="🗂️" title="보드에 표시할 직원이 없습니다" desc="직원을 등록하면 준비중 → 서류접수 → 심사중 → 승인 → 지급중 → 완료 단계로 카드가 표시됩니다. 카드를 드래그해 진행 상태를 옮길 수 있어요." />
      ):(
        <div>
          <div className="kanban-grid">
          {STS.filter(function(s){return s.key!=="resigned";}).map(function(col){
            var es=colEmps(col.key);
            var colExp=es.reduce(function(s,e){return s+empRemaining(e);},0);
            var isOver=stOver[0]===col.key;
            var kc=kcol(col.key);
            // 지연 → 임박 → 서류 → 일반 순으로 정렬해 기본 3장에 급한 카드를 먼저 노출
            var sorted=es.slice().sort(byUrgency);
            var COL_LIMIT=3;
            var colOpen=!!stColExp[0][col.key];
            var shownEs=colOpen?sorted:sorted.slice(0,COL_LIMIT);
            var hiddenCount=Math.max(0,sorted.length-COL_LIMIT);
            var colOverdue=sorted.filter(function(e){return empUrgency(e)===0;}).length;
            var summaryParts=[];
            if(colExp>0)summaryParts.push("잔여 "+fMan(colExp));
            if(colOverdue>0)summaryParts.push("지연 "+colOverdue+"건");
            if(!colOpen&&hiddenCount>0)summaryParts.push("숨김 "+hiddenCount+"명");
            return(
              <div key={col.key} className="kanban-col"
                onDragOver={function(ev){ev.preventDefault();if(stOver[0]!==col.key)stOver[1](col.key);}}
                onDragLeave={function(ev){ if(!ev.currentTarget.contains(ev.relatedTarget))stOver[1](null); }}
                onDrop={function(ev){ev.preventDefault();if(stDrag[0])move(stDrag[0],col.key);stDrag[1](null);stOver[1](null);}}
                style={{background:isOver?kc.soft:"#FBFCFE",borderRadius:14,border:isOver?"2px dashed "+kc.main:"1px solid #E8EEF4",padding:"10px",minHeight:150,transition:"background 0.18s,border-color 0.18s,transform 0.15s",transform:isOver?"scale(1.01)":"scale(1)",boxShadow:isOver?"0 4px 18px rgba(15,23,42,0.10)":"none"}}>
                {/* 단계 헤더: 메인 컬러 채움 + 흰 글자 */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:9,padding:"11px 13px",borderRadius:11,background:kc.main,boxShadow:"0 2px 6px "+kc.soft}}>
                  <span style={{fontSize:"var(--fs-list)",fontWeight:800,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:"-0.3px"}}>{col.icon} {col.label}</span>
                  <span style={{fontSize:"var(--fs-badge)",fontWeight:800,color:"#fff",background:"rgba(255,255,255,0.30)",borderRadius:999,padding:"2px 10px",flexShrink:0,minWidth:26,textAlign:"center"}}>{es.length}</span>
                </div>
                {summaryParts.length>0&&<div style={{fontSize:"var(--fs-meta)",color:colOverdue>0?"#B91C1C":"#94A3B8",padding:"0 2px 9px",fontWeight:600}}>{summaryParts.join(" · ")}</div>}
                {es.length===0?(
                  <div style={{textAlign:"center",padding:"26px 8px",fontSize:"var(--fs-sub)",color:isOver?kc.main:"#94A3B8",fontWeight:isOver?700:500,borderRadius:10,border:isOver?"2px dashed "+kc.main:"1.5px dashed #E2E8F0",background:isOver?kc.soft:"#fff",transition:"all 0.15s"}}>{isOver?"⬇ 여기에 놓기":"현재 항목 없음"}</div>
                ):(
                  <React.Fragment>
                    {shownEs.map(card)}
                    {es.length>COL_LIMIT&&(
                      <button onClick={function(){var m=Object.assign({},stColExp[0]);m[col.key]=!colOpen;stColExp[1](m);}}
                        style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1.5px dashed "+kc.border,background:"#fff",color:kc.main,fontSize:"var(--fs-btn)",fontWeight:700,cursor:"pointer",fontFamily:FF}}>
                        {colOpen?"접기 ▴":"+ "+hiddenCount+"명 더 보기"}
                      </button>
                    )}
                  </React.Fragment>
                )}
              </div>
            );
          })}
          </div>
          {colEmps("resigned").length>0&&<div style={{fontSize:"var(--fs-meta)",color:"#94A3B8",marginTop:10}}>🚪 퇴사 {colEmps("resigned").length}명은 보드에서 제외됩니다 (직원 탭에서 확인 가능)</div>}
        </div>
      )}
      <Notice>카드를 드래그하거나 ⋮ 버튼으로 진행 상태를 변경하세요. 변경 즉시 모든 화면·팀원에게 실시간 반영됩니다.</Notice>
    </div>
  );
}

function ProductTour(props){
  var STEPS=[
    {title:"👋 환영합니다!",desc:"고용지원금 Pro는 정부 고용지원금 신청·관리를 위한 전문 플랫폼입니다. 1분 안에 핵심 기능을 안내해드릴게요.",target:null},
    {title:"🗂️ 메뉴 탐색",desc:"왼쪽 사이드바에서 모든 기능에 접근하세요. 대시보드, 업체 관리, 진행 보드, 급여 계산기까지 한 곳에 있습니다.",target:"[data-tour='sidebar']",side:"right"},
    {title:"🏢 업체 등록",desc:"'+ 업체 추가' 버튼으로 관리할 업체를 먼저 등록하세요. 업체마다 직원과 지원금이 독립적으로 관리됩니다.",target:"[data-tour='add-company']",side:"bottom"},
    {title:"🗂️ 진행 보드",desc:"지원금 진행 단계를 칸반 보드로 한눈에 확인하세요. 카드를 드래그해서 준비중→서류접수→심사중→완료로 이동할 수 있어요.",target:"[data-tour='nav-kanban']",side:"right"},
    {title:"🎯 채용 진단",desc:"채용 조건(나이·고용형태·지역 등)을 입력하면 신청 가능한 지원금을 자동으로 진단해줍니다. 처음이라면 여기서 시작하세요!",target:"[data-tour='nav-diagnosis']",side:"right"},
    {title:"🧮 급여 계산기",desc:"직원 실수령액·사업주 부담금·최저임금 판정을 한 번에 계산합니다. 보수 설정 전 꼭 확인하세요.",target:"[data-tour='nav-wage']",side:"right"},
    {title:"🚀 이제 시작해볼까요?",desc:"업체 관리 메뉴에서 첫 업체를 등록하고 직원을 추가해보세요. 사이드바 하단 '투어' 버튼으로 언제든 다시 안내받을 수 있어요.",target:null},
  ];

  var stStep=useState(0); var step=stStep[0]; var setStep=stStep[1];
  var stRect=useState(null); var rect=stRect[0];

  useEffect(function(){
    if(!props.open) return;
    var s=STEPS[step];
    if(!s.target){stRect[1](null);return;}
    function measure(){
      var el=document.querySelector(s.target);
      if(el){var r=el.getBoundingClientRect();stRect[1]({top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height});}
      else stRect[1](null);
    }
    measure();
    window.addEventListener("resize",measure);
    return function(){window.removeEventListener("resize",measure);};
  },[step,props.open]);

  useEffect(function(){if(props.open)setStep(0);},[props.open]);

  if(!props.open) return null;

  var PAD=14; var TW=360;
  var vw=window.innerWidth; var vh=window.innerHeight;
  var cur=STEPS[step];
  var isLast=step===STEPS.length-1;

  function next(){if(isLast)props.onClose();else setStep(function(s){return s+1;});}
  function prev(){setStep(function(s){return s-1;});}

  // 1단계(index 0)·마지막 단계는 무조건 중앙 모달 — anchor/rect 계산을 절대 타지 않는다
  var centered=!cur.target;
  var tStyle={position:"fixed",width:TW,background:"#fff",borderRadius:20,padding:"28px 30px",boxShadow:"0 24px 64px rgba(15,23,42,0.35), 0 0 0 1px rgba(0,0,0,0.06)",zIndex:4010,fontFamily:FF,boxSizing:"border-box"};
  if(centered||!rect){
    // 화면 정중앙 고정 모달 (transform 기반 중앙 정렬 — fade-in(불투명도만) 사용해 translate 덮어쓰기 방지)
    Object.assign(tStyle,{top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"min(360px, calc(100vw - 40px))",maxWidth:"calc(100vw - 40px)",maxHeight:"calc(100dvh - 80px)",overflowY:"auto",padding:"clamp(22px,5vw,28px)"});
  } else {
    var side=cur.side||"right"; var gap=18;
    if(side==="right"){
      var tl=rect.right+gap; if(tl+TW>vw-10)tl=rect.left-TW-gap;
      tStyle.left=Math.max(10,tl)+"px"; tStyle.top=Math.max(10,Math.min(rect.top-8,vh-340))+"px";
    } else {
      var tl2=Math.min(rect.left,vw-TW-10); if(tl2<10)tl2=10;
      var tt2=rect.bottom+gap; if(tt2+300>vh)tt2=rect.top-300-gap;
      tStyle.left=tl2+"px"; tStyle.top=Math.max(10,tt2)+"px";
    }
  }

  return createPortal(
    <div style={{position:"fixed",inset:0,zIndex:4000}} onClick={function(e){e.stopPropagation();}}>
      {(centered||!rect)&&<div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.72)",zIndex:4000}}/>}
      {!centered&&rect&&<div style={{position:"fixed",top:rect.top-PAD,left:rect.left-PAD,width:rect.width+PAD*2,height:rect.height+PAD*2,borderRadius:16,boxShadow:"0 0 0 9999px rgba(15,23,42,0.68)",border:"2px solid rgba(99,102,241,0.7)",zIndex:4005,pointerEvents:"none",transition:"all 0.25s ease"}}/>}
      <div style={tStyle} className={(centered||!rect)?"fade-in":"fade-in-up"}>
        <div style={{display:"flex",gap:5,marginBottom:22,alignItems:"center"}}>
          {STEPS.map(function(_,i){return(
            <div key={i} style={{height:6,width:i===step?20:6,borderRadius:3,background:i===step?"#2563EB":i<step?"#93C5FD":"#E2E8F0",transition:"all 0.3s ease"}}/>
          );})}
          <span style={{marginLeft:"auto",fontSize:13,color:"#94A3B8",fontWeight:500}}>{step+1} / {STEPS.length}</span>
        </div>
        <h3 style={{margin:"0 0 12px",fontSize:22,fontWeight:800,color:"#0F172A",lineHeight:1.3}}>{cur.title}</h3>
        <p style={{margin:"0 0 28px",fontSize:15,color:"#475569",lineHeight:1.75}}>{cur.desc}</p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={props.onClose} style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:14,fontFamily:FF,padding:0}}>건너뛰기</button>
          <div style={{display:"flex",gap:10}}>
            {step>0&&<button onClick={prev} style={{background:"#F1F5F9",border:"none",color:"#475569",cursor:"pointer",fontSize:15,fontWeight:600,borderRadius:10,padding:"10px 20px",fontFamily:FF}}>← 이전</button>}
            <button onClick={next} style={{background:"linear-gradient(135deg,#1D4ED8,#2563EB)",color:"#fff",border:"none",borderRadius:10,padding:"10px 26px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:FF,boxShadow:"0 4px 14px rgba(37,99,235,0.4)"}}>
              {isLast?"🚀 시작하기":"다음 →"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    hrPortalRoot()
  );
}

// ── 베타 피드백 설문 ──────────────────────────────────────
// localStorage 키는 계정별(userId>userEmail>orgId>anon)로 분리한다.
// → 다른 계정으로 로그인하면 그 계정 고유의 제출/닫기 기록만 본다.
var FB_PREFIX="hrSubsidyPro_feedback";
var FB_INTERVAL_MS=7*24*60*60*1000; // 7일
function fbScopeId(scope){return (scope===null||scope===undefined||scope==="")?"anon":String(scope);}
function fbKeys(scope){var s=fbScopeId(scope);return {sub:FB_PREFIX+"_lastSubmittedAt_"+s,dis:FB_PREFIX+"_lastDismissedAt_"+s,backup:FB_PREFIX+"_backup_"+s};}
function fbGetTime(key){try{var v=localStorage.getItem(key);return v?new Date(v).getTime():0;}catch(e){return 0;}}
function fbLastSubmitted(scope){return fbGetTime(fbKeys(scope).sub);}
function fbLastInteraction(scope){var k=fbKeys(scope);return Math.max(fbGetTime(k.sub)||0,fbGetTime(k.dis)||0);}
// glow 노출 여부: 마지막 상호작용(제출/닫기) 후 7일 경과 시 다시 반짝임. 기록 없으면 반짝임.
function fbIsDue(scope){var last=fbLastInteraction(scope);if(!last)return true;return(Date.now()-last)>=FB_INTERVAL_MS;}
// 버튼 숨김 여부: '제출 성공' 후 7일 이내만 숨긴다. 닫기(나중에)는 숨기지 않는다.
function fbIsHidden(scope){var sub=fbLastSubmitted(scope);if(!sub)return false;return(Date.now()-sub)<FB_INTERVAL_MS;}
function fbMarkSubmitted(scope){try{localStorage.setItem(fbKeys(scope).sub,new Date().toISOString());}catch(e){}}
function fbDismiss(scope){try{localStorage.setItem(fbKeys(scope).dis,new Date().toISOString());}catch(e){}}
function fbBackup(scope,resp){try{var k=fbKeys(scope).backup;var raw=localStorage.getItem(k);var arr=raw?JSON.parse(raw):[];if(!Array.isArray(arr))arr=[];arr.push(resp);localStorage.setItem(k,JSON.stringify(arr));}catch(e){}}

var FEEDBACK_QUESTIONS=[
  {id:"q1",type:"single",q:"전체적으로 이 프로그램을 써본 첫인상은 어떠셨나요?",options:["매우 좋다","괜찮다","보통이다","아직은 복잡하다","실제로 쓰기 어렵다"]},
  {id:"q2",type:"single",q:"엑셀로 관리하던 방식과 비교했을 때 어떤가요?",options:["엑셀보다 훨씬 편하다","엑셀보다 조금 편하다","비슷하다","아직은 엑셀이 더 편하다","판단하기 어렵다"]},
  {id:"q3",type:"multi",q:"가장 유용하다고 느낀 기능은 무엇인가요? (복수 선택)",options:["대시보드 요약","업체 관리","직원 관리","지원금별 진행보드","청년일자리도약장려금 체크리스트","서류 요청 문구 복사","고객 보고서","수수료 정산","수령액 시뮬레이터","급여 계산기","온보딩/사용법 안내","아직 잘 모르겠다"]},
  {id:"q4",type:"multi",q:"가장 불편하거나 헷갈렸던 부분은 무엇인가요? (복수 선택)",options:["처음 사용 방법을 모르겠다","업체 등록이 어렵다","직원 추가/수정이 어렵다","지원금 선택이 헷갈린다","지원연도 선택이 헷갈린다","진행상태 변경이 어렵다","서류 관리가 어렵다","고객 보고서가 아쉽다","화면 글자가 작거나 복잡하다","모바일 사용이 불편하다","속도가 느리다","특별히 불편한 점은 없었다"]},
  {id:"q5",type:"multi",q:"실제 업무에서 가장 자주 쓸 것 같은 기능은 무엇인가요? (복수 선택)",options:["신규 업체 등록","직원별 지원금 가능성 검토","청년일자리도약장려금 관리","서류 요청/미제출 관리","진행상태 관리","수령액/수수료 계산","고객 보고서 출력/공유","업무일지 기록","대시보드 확인","아직 모르겠다"]},
  {id:"q6",type:"single",q:"고객사 미팅이나 영업자료로 활용할 수 있을 것 같나요?",options:["바로 활용 가능할 것 같다","조금만 다듬으면 활용 가능하다","아직은 내부 관리용에 가깝다","영업자료로 쓰기엔 부족하다","잘 모르겠다"]},
  {id:"q7",type:"multi",q:"고객 보고서에서 더 보강되면 좋을 내용은 무엇인가요? (복수 선택)",options:["받을 수 있는 지원금 요약","놓치면 손해 보는 금액","미제출 서류 목록","신청기한 임박 건","향후 30일 액션 플랜","대표님께 요청할 사항","예상 수령액","컨설턴트 코멘트 입력란","PDF 저장/출력","카톡/문자 공유용 요약 문구","현재로도 충분하다"]},
  {id:"q8",type:"single",q:"실제로 계속 사용한다면 적정 월 이용료는 어느 정도라고 느끼시나요?",options:["무료가 아니면 어렵다","월 3만 원대","월 5만 원대","월 7만 원대","월 10만 원대","월 15만 원 이상도 가능","아직 판단하기 어렵다"]},
  {id:"q9",type:"multi",q:"돈을 내고 사용한다면 가장 중요한 기준은 무엇인가요? (복수 선택)",options:["엑셀보다 확실히 편해야 한다","고객 보고서가 좋아야 한다","데이터가 절대 사라지면 안 된다","직원/업체 등록이 쉬워야 한다","지원금 요건이 정확해야 한다","모바일에서도 잘 돼야 한다","수수료 정산이 정확해야 한다","고객사에 보여줘도 전문적으로 보여야 한다","업데이트가 계속되어야 한다","문의/지원이 빨라야 한다"]},
  {id:"q10",type:"single",q:"현재 프로그램의 완성도를 10점 만점으로 평가하면?",options:["10점","9점","8점","7점","6점","5점 이하"]},
  {id:"q11",type:"multi",q:"개선이 가장 시급한 부분은 무엇인가요? (복수 선택)",options:["화면 디자인/가독성","사용 방법 안내","업체/직원 등록 흐름","지원금 요건 체크","서류 요청/관리","고객 보고서","진행보드","수수료 정산","모바일 화면","속도/버그","결제/요금제","기타"]}
];

// q1~q11 → 운영자가 읽기 좋은 짧은 라벨
var FB_LABELS={
  q1:"전체 첫인상", q2:"엑셀 대비 평가", q3:"유용한 기능", q4:"불편한 부분",
  q5:"자주 쓸 기능", q6:"영업자료 활용 가능성", q7:"보고서 보강 희망",
  q8:"적정 월 이용료", q9:"유료 사용 중요 기준", q10:"완성도 점수", q11:"개선 시급 항목"
};
// 리포트 표시 순서 (단일선택 핵심지표 먼저 → 복수선택 상세)
var FB_REPORT_ORDER=["q1","q2","q6","q8","q10","q3","q4","q5","q7","q9","q11"];
// 관리자 전용 화면 노출 대상 (총괄 관리자 1명만). 이 배열에 없는 계정은 메뉴 자체가 보이지 않음.
var ADMIN_EMAILS=[]; // [D-93] 원본 관리자 이메일은 옮기지 않는다 — 이 OS 에는 원본 관리자 화면이 없다
// 반드시 로그인한 Supabase Auth user.email 기준으로만 판별.
// 이메일이 비어있거나(로딩 중·미존재) 매칭 안 되면 false.
function isAdminEmail(email){
  if(!email)return false;
  return ADMIN_EMAILS.indexOf(String(email).trim().toLowerCase())>=0;
}
// q10("8점") → 숫자 8 추출 (점수 낮은 응답 필터용)
function fbScoreNum(answers){var v=answers&&answers.q10;if(!v)return null;var m=String(v).match(/\d+/);return m?parseInt(m[0],10):null;}

function FeedbackModal(props){
  var stA=useState({});   // {qid: string | string[]}
  var stTxt=useState(""); // 자유 의견
  var stDone=useState(false);
  var stSaved=useState(false); // 서버 저장 성공 여부
  var stSubmitting=useState(false);
  var answers=stA[0];
  function pickSingle(qid,opt){var m=Object.assign({},answers);m[qid]=opt;stA[1](m);}
  function toggleMulti(qid,opt){var m=Object.assign({},answers);var arr=(m[qid]||[]).slice();var i=arr.indexOf(opt);if(i>=0)arr.splice(i,1);else arr.push(opt);m[qid]=arr;stA[1](m);}
  function reset(){stA[1]({});stTxt[1]("");stDone[1](false);stSaved[1](false);stSubmitting[1](false);}
  async function submit(){
    stSubmitting[1](true);
    var now=new Date().toISOString();
    var dbRow={org_id:props.orgId||null,user_id:props.userId||null,user_email:props.userEmail||"",org_name:props.orgName||"",answers:answers,free_text:stTxt[0]||null,page_path:window.location.pathname,user_agent:navigator.userAgent,app_version:"1.0-beta",created_at:now};
    var saved=false;
    try{
      var result=await supabase.from("feedback_responses").insert(dbRow);
      if(result.error)throw result.error;
      saved=true;
      // 관리자 이메일 알림. 저장은 이미 성공 → 이 호출이 실패해도 사용자는 "성공" 처리.
      // (Edge Function 미배포 / Resend Secrets 미설정이면 메일이 안 오는 것이 정상이며, 원인은 콘솔에 기록됨)
      supabase.functions.invoke("notify-feedback",{body:{row:dbRow,savedAt:now}}).then(function(res){
        if(res&&res.error){
          console.warn("[notify-feedback failed]",{message:res.error.message,details:res.error.details,hint:res.error.hint,code:res.error.code});
        }else if(res&&res.data&&res.data.ok===false){
          // 함수는 떴지만 환경변수 미설정 등으로 메일 미발송
          console.warn("[notify-feedback] 이메일 미발송 (Edge Function 응답):",res.data);
        }else{
          console.log("[notify-feedback] 알림 요청 완료:",res&&res.data);
        }
      }).catch(function(err){
        console.warn("[notify-feedback failed]",{message:err&&err.message,details:err&&err.details,hint:err&&err.hint,code:err&&err.code});
      });
    }catch(e){
      console.warn("[Feedback submit failed]",{message:e&&e.message,details:e&&e.details,hint:e&&e.hint,code:e&&e.code});
      fbBackup(props.scope, Object.assign({},dbRow,{savedAt:now}));
    }
    stSubmitting[1](false);
    stSaved[1](saved);
    stDone[1](true);
    // 제출 성공한 경우에만 7일 숨김 타이머 기록 (실패 시 버튼 유지 → 재전송 가능)
    if(saved)fbMarkSubmitted(props.scope);
    props.onSubmitted&&props.onSubmitted(saved);
  }
  function close(){
    // 제출 완료 화면이 아닌 상태에서 닫으면 '나중에' = dismiss(glow만 7일 중지, 버튼은 유지)
    if(!stDone[0]){fbDismiss(props.scope);props.onDismiss&&props.onDismiss();}
    reset();
    props.onClose&&props.onClose();
  }
  var answeredCount=FEEDBACK_QUESTIONS.filter(function(q){var v=answers[q.id];return q.type==="multi"?(v&&v.length>0):!!v;}).length;
  return(
    <Modal open={props.open} onClose={close} title="💬 베타 사용 피드백" width={620}>
      {stDone[0]?(
        stSaved[0]?(
        <div style={{textAlign:"center",padding:"24px 8px"}}>
          <div style={{fontSize:52,marginBottom:14}}>🙏</div>
          <h3 style={{margin:"0 0 10px",fontSize:20,fontWeight:800,color:"#1E293B"}}>피드백이 정상적으로 저장되었습니다.</h3>
          <p style={{margin:"0 0 20px",fontSize:15,color:"#64748B",lineHeight:1.7}}>소중한 의견 감사합니다. 남겨주신 내용은 다음 업데이트에 반영하겠습니다.</p>
          <button style={Object.assign({},btnP,{padding:"12px 40px",fontSize:15})} onClick={close}>닫기</button>
        </div>
        ):(
        <div style={{textAlign:"center",padding:"24px 8px"}}>
          <div style={{fontSize:52,marginBottom:14}}>📦</div>
          <h3 style={{margin:"0 0 10px",fontSize:20,fontWeight:800,color:"#1E293B"}}>임시 저장되었습니다.</h3>
          <p style={{margin:"0 0 16px",fontSize:14,color:"#D97706",lineHeight:1.6,padding:"12px 16px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10}}>피드백이 서버에 저장되지 않아 이 브라우저에 임시 저장되었습니다. 관리자에게 알려주세요. (작성하신 내용은 사라지지 않았습니다)</p>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button style={btnS} onClick={close}>닫기</button>
            <button style={Object.assign({},btnP,{padding:"12px 32px",fontSize:15,opacity:stSubmitting[0]?0.65:1,cursor:stSubmitting[0]?"not-allowed":"pointer"})} onClick={function(){stDone[1](false);submit();}} disabled={stSubmitting[0]}>{stSubmitting[0]?"재전송 중…":"다시 제출하기"}</button>
          </div>
        </div>
        )
      ):(
        <div>
          <p style={{margin:"0 0 18px",fontSize:14,color:"#475569",lineHeight:1.7,padding:"12px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10}}>실제 컨설턴트 업무에 더 잘 맞는 프로그램으로 만들기 위해 의견을 받고 있습니다. 편하게 선택해 주세요. <span style={{color:"#94A3B8"}}>(약 3분 · 모두 선택사항)</span></p>
          <div style={{display:"grid",gap:18}}>
            {FEEDBACK_QUESTIONS.map(function(q,qi){
              var v=answers[q.id];
              return(
                <div key={q.id}>
                  <div style={{fontSize:15,fontWeight:700,color:"#1E293B",marginBottom:9,lineHeight:1.5}}>
                    <span style={{color:"#2563EB"}}>Q{qi+1}.</span> {q.q}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                    {q.options.map(function(opt){
                      var on=q.type==="multi"?((v||[]).indexOf(opt)>=0):(v===opt);
                      return(
                        <button key={opt} type="button" onClick={function(){q.type==="multi"?toggleMulti(q.id,opt):pickSingle(q.id,opt);}}
                          style={{padding:"9px 14px",borderRadius:9,cursor:"pointer",fontFamily:FF,fontSize:14,fontWeight:on?700:500,textAlign:"left",background:on?"#2563EB":"#fff",color:on?"#fff":"#475569",border:on?"2px solid #2563EB":"1.5px solid #E2E8F0",transition:"all 0.12s"}}>
                          {q.type==="multi"?(on?"☑ ":"☐ "):(on?"● ":"○ ")}{opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#1E293B",marginBottom:9,lineHeight:1.5}}><span style={{color:"#2563EB"}}>Q12.</span> 자유 의견</div>
              <textarea style={Object.assign({},inp,{height:110,resize:"vertical",lineHeight:1.6})} value={stTxt[0]} onChange={function(e){stTxt[1](e.target.value);}} placeholder="쓰면서 불편했던 점, 좋았던 점, 실제 업무에 쓰기 위해 꼭 필요한 기능을 편하게 적어주세요."/>
            </div>
          </div>
          {/* 하단 sticky 제출 영역 */}
          <div style={{position:"sticky",bottom:"-1px",marginTop:18,paddingTop:14,background:"linear-gradient(to bottom,rgba(255,255,255,0),#fff 22%)",display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"#94A3B8"}}>{answeredCount}/{FEEDBACK_QUESTIONS.length}개 문항 응답</span>
            <div style={{display:"flex",gap:8}}>
              <button style={btnS} onClick={close}>나중에</button>
              <button style={Object.assign({},btnP,{padding:"11px 30px",opacity:stSubmitting[0]?0.65:1,cursor:stSubmitting[0]?"not-allowed":"pointer"})} onClick={submit} disabled={stSubmitting[0]}>{stSubmitting[0]?"제출 중…":"제출하기"}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function SubsidyApp(props){
  var companies=props.companies||[];
  var employees=props.employees||[];
  var rawProgs=props.programs;
  var programs=useMemo(function(){var raw=rawProgs||DEFAULT_PROGRAMS;var out={};Object.keys(raw).forEach(function(k){var p=raw[k];out[k]=p.enabled!==undefined?p:Object.assign({},p,{enabled:!!PROGRAM_ENABLED_DEFAULTS[k]});});return out;},[rawProgs]);
  var calendarMemos=props.calendarMemos||{};
  var profile=props.profile||{};
  var orgName=props.orgName||"";
  var uploadFn=props.uploadFn;
  var getUrlFn=props.getUrlFn;
  var onSaveCompany=props.onSaveCompany||function(){};
  var onPatchCompany=props.onPatchCompany||function(){};
  var onDeleteCompany=props.onDeleteCompany||function(){};
  var onSaveEmployee=props.onSaveEmployee||function(){};
  var onPatchEmployee=props.onPatchEmployee||function(){};
  var onDeleteEmployee=props.onDeleteEmployee||function(){};
  // 샘플 전용 bulk 작업 (useData.addCompaniesBulk / addEmployeesBulk / deleteSampleRows)
  var onBulkSaveCompanies=props.onBulkSaveCompanies||function(){return Promise.reject(new Error("bulk 저장 미지원"));};
  var onBulkSaveEmployees=props.onBulkSaveEmployees||function(){return Promise.reject(new Error("bulk 저장 미지원"));};
  var onDeleteSampleRows=props.onDeleteSampleRows||function(){return Promise.reject(new Error("bulk 삭제 미지원"));};
  var onSavePrograms=props.onSavePrograms||function(){};
  var onSaveMemo=props.onSaveMemo||function(){};
  var onSignOut=props.onSignOut||function(){};
  var onUpdateProfile=props.onUpdateProfile||function(){};

  // [D-93] 화면·업체는 OS 주소가 정한다 (/tools/employment/<화면>?cid=업체) — 바꾸면 주소가 바뀐다
  var stView=[props.view||"dashboard",function(v){if(props.onNav)props.onNav({view:v});}];
  var stCmdK=useState(false);
  var stCompany=[props.companyId||null,function(id){if(props.onNav)props.onNav({company:id});}];
  // [D-93] 원본의 history pushState/popstate 는 뺐다 — 뒤로가기는 OS 주소(라우터)가 맡는다
  // 저장된 전체 글자 크기 설정 적용 (새로고침 후에도 유지)
  useEffect(function(){ try{applyFontScale(localStorage.getItem("hrSubsidyPro_fontScale"));}catch(e){} },[]);
  var stFocusEmp=useState(null); // 진행보드 등에서 '처리하기'로 넘어온 직원 id
  var stAddComp=useState(false);
  // [D-94] 업체 상세에서 열었는데 아직 고용지원금 업체가 아니면 — 그 업체를 골라 둔 채 '업체 추가' 창을 연다
  useEffect(function(){ if(props.openAddFor){ stAddComp[1](true); } },[props.openAddFor]);
  var stProfileOpen=useState(false);
  var stMobileNav=useState(false);
  var stFbOpen=useState(false); // 피드백 설문 모달
  // 계정별 스코프: userId > userEmail > orgId > anon
  var fbScope=props.userId||props.userEmail||props.orgId||"anon";
  var stFbGlow=useState(function(){return fbIsDue(fbScope);}); // 7일 주기 반짝임
  var stFbHidden=useState(function(){return fbIsHidden(fbScope);}); // 제출 성공 후 7일간 버튼 숨김
  // 계정 전환(스코프 변경) 시 그 계정 기준으로 노출/반짝임 재평가
  useEffect(function(){stFbGlow[1](fbIsDue(fbScope));stFbHidden[1](fbIsHidden(fbScope));},[fbScope]);
  function openFeedback(){stFbOpen[1](true);stFbGlow[1](false);}
  // 관리자 판별: 오직 로그인한 Supabase Auth user.email(props.userEmail) 기준.
  // profile.display_name·org_name·localStorage·초대/테스트 데이터로 판별하지 않음.
  // 이메일이 로딩 중이거나 없으면 isAdmin=false.
  var isAdmin=isAdminEmail(props.userEmail);
  // 관리자 또는 유료(active)/무료체험(trialing) 상태 → 모든 기능 사용 가능.
  // canceled/past_due/null 등 → 읽기 전용 모드.
  var canUseFeatures=isAdmin||props.subStatus==="active"||props.subStatus==="trialing";
  var stPaywall=useState(false);
  // 기능 가드: 사용 불가 시 paywall 모달을 열고 false 반환
  function requirePlan(){if(canUseFeatures)return true;stPaywall[1](true);return false;}
  // 콜백 래퍼: 사용 불가 시 paywall 모달을 열고 원래 fn 은 호출하지 않음
  function gated(fn){if(canUseFeatures)return fn;return function(){stPaywall[1](true);};}
  var stTour=useState(false); // [D-93] 첫 방문 자동 투어는 끈다 (OS 안에서는 원본 사이드바가 없다)
  function startTour(){stTour[1](true);}
  function endTour(){try{localStorage.setItem("subsidy_tour_done","1");}catch(e){}stTour[1](false);}

  // 샘플 불러오기/삭제 진행 중 여부 — 버튼 비활성화 및 중복 실행 방지
  var stSampleBusy=useState(false);
  var sampleBusy=stSampleBusy[0];

  async function loadSampleData(){
    if(stSampleBusy[0])return;
    // startOff(개월)·ds(일) → 실행 시점 기준 실제 날짜로 변환 (데모 긴박감 항상 유지)
    function rel(monthsAgo,dayShift){var d=new Date();d.setMonth(d.getMonth()-(monthsAgo||0));if(dayShift)d.setDate(d.getDate()+dayShift);return d.toISOString().split("T")[0];}
    function wait(ms){return new Promise(function(res){setTimeout(res,ms);});}
    // bulk insert 1회(원자적)를 최대 3회 재시도. 중복 키(이미 저장됨)는 성공으로 간주.
    async function tryBulk(fn){
      var lastErr=null;
      for(var a=0;a<3;a++){
        try{ await fn(); return null; }
        catch(e){
          if(e&&(e.code==="23505"||String(e.message||"").indexOf("duplicate key")>=0))return null;
          lastErr=e; if(a<2)await wait(500*(a+1));
        }
      }
      return lastErr||new Error("insert 실패");
    }
    stSampleBusy[1](true);
    try{
      // 1) payload 일괄 구성 — 회사 id(cId)를 먼저 확정해 직원 payload 에 주입
      var comps=[],empsAll=[];
      SAMPLE_DATA.forEach(function(item){
        var cId=ruuid();
        comps.push(Object.assign({},item.company,{id:cId,createdAt:new Date().toISOString()}));
        item.employees.forEach(function(emp){
          var startDate=rel(emp.startOff,emp.ds);
          var rounds=(emp.rounds||[]).map(function(r){
            var nr=Object.assign({},r,{id:uid()});
            if(r.isPaid){nr.paidDate=rel(r.paidOff,0);nr.received=r.received||r.amount;}
            delete nr.paidOff;
            return nr;
          });
          var empDocs=(emp.employeeDocs||[]).map(function(d){return Object.assign({},d,{id:uid()});});
          var clean=Object.assign({},emp); delete clean.startOff; delete clean.ds;
          empsAll.push(Object.assign(clean,{id:ruuid(),companyId:cId,startDate:startDate,rounds:rounds,employeeDocs:empDocs}));
        });
      });
      // 2) 사전 검증: 대상자 0명 샘플 업체가 있으면 시작하지 않음
      var zero=comps.filter(function(cc){return empsAll.filter(function(e){return e.companyId===cc.id;}).length===0;});
      if(zero.length>0){
        toast("샘플 데이터 오류: 대상자 0명 업체 — "+zero.map(function(z){return z.name;}).join(", "),"error");
        return;
      }
      // 3) 회사 10개 bulk INSERT 가 커밋된 뒤 직원 bulk INSERT (FK 안전 · 왕복 2회)
      var cErr=await tryBulk(function(){return onBulkSaveCompanies(comps);});
      if(cErr){
        console.error("[샘플] 업체 bulk insert 실패:",cErr);
        toast("샘플 업체 저장 실패: "+(cErr.message||"오류")+" — 다시 시도해주세요.","error");
        return;
      }
      var eErr=await tryBulk(function(){return onBulkSaveEmployees(empsAll);});
      if(eErr){
        console.error("[샘플] 대상자 bulk insert 실패:",eErr);
        toast("샘플 대상자 저장 실패: "+(eErr.message||"오류")+" — 샘플 삭제 후 다시 시도해주세요.","error");
        return;
      }
      // 4) bulk INSERT 는 원자적 — 성공이면 전 행 저장 완료. 업체별 인원 로그만 남김.
      comps.forEach(function(cc){
        console.log("[샘플] "+cc.name+": 대상자 "+empsAll.filter(function(e){return e.companyId===cc.id;}).length+"명 저장");
      });
      console.log("[샘플] 불러오기 완료: 업체 "+comps.length+"개 · 대상자 "+empsAll.length+"명");
      toast("샘플 데이터 "+comps.length+"개 업체, "+empsAll.length+"명 대상자 불러오기 완료","success");
    }finally{
      stSampleBusy[1](false);
    }
  }

  async function deleteSampleData(){
    if(stSampleBusy[0])return;
    var sampleEmps=employees.filter(function(e){return e.isSample;});
    var sampleComps=companies.filter(function(c){return c.isSample;});
    if(sampleComps.length===0&&sampleEmps.length===0){toast("삭제할 샘플 데이터가 없습니다.","info");return;}
    if(!window.confirm("샘플 데이터(고객사 "+sampleComps.length+"개·대상자 "+sampleEmps.length+"명)만 삭제합니다.\n직접 등록하신 실제 고객 데이터는 삭제되지 않습니다.\n\n진행할까요?"))return;
    stSampleBusy[1](true);
    // isSample=true 인 행의 id 만 모아 일괄 삭제(왕복 2회) — 실제 고객 데이터는 절대 건드리지 않음
    try{
      await onDeleteSampleRows(sampleEmps.map(function(e){return e.id;}),sampleComps.map(function(c){return c.id;}));
      toast("샘플 데이터가 삭제되었습니다.","success");
    }catch(e){
      console.error("[샘플] 삭제 실패:",e);
      toast("샘플 삭제 중 오류: "+(e.message||"오류")+" — 다시 시도해주세요.","error");
    }finally{
      stSampleBusy[1](false);
    }
  }

  var hasSample=companies.some(function(c){return c.isSample;});

  function goCompany(id){stCompany[1](id);stView[1]("company");}
  function goCompanyEmp(companyId,empId){stFocusEmp[1](empId);stCompany[1](companyId);stView[1]("company");}
  function goBack(){
    // [D-93] 직전 화면으로 — OS 주소 기록으로 돌아간다
    if(props.onBack){ props.onBack(); return; }
    stView[1]("dashboard");stCompany[1](null);
  }
  // 업무 일지 자동 기록 (companyId, 내용, 유형)
  function logToCompany(companyId,text,type){
    var c=companies.find(function(x){return x.id===companyId;}); if(!c)return;
    var entry={id:uid(),text:text,at:new Date().toISOString(),author:(profile.display_name||""),type:type||"기타",auto:true};
    onPatchCompany(companyId,{notes:[entry].concat(c.notes||[])});
  }
  var isTrial=props.subStatus==="trialing";
  var tier=planTier(props.plan,isTrial);

  useEffect(function(){
    function handler(e){
      // [D-94] Ctrl/⌘+K 는 OS 전체 검색이 맡는다 — 원본 검색창까지 같이 열리던 것을 뺐다(원본 검색은 머리줄 🔍 검색 단추로)
      if(e.key==="Escape"){ stMobileNav[1](false); }
    }
    window.addEventListener("keydown",handler);
    return function(){ window.removeEventListener("keydown",handler); };
  },[]);

  // 모바일 메뉴 열림 시 body 스크롤 잠금
  useEffect(function(){
    if(typeof document==="undefined")return;
    if(stMobileNav[0])document.body.classList.add("no-scroll");
    else document.body.classList.remove("no-scroll");
    return function(){document.body.classList.remove("no-scroll");};
  },[stMobileNav[0]]);

  var selectedCompany=stCompany[0]?companies.find(function(c){return c.id===stCompany[0];})||null:null;
  var stPN=useState(profile.display_name||"");
  var stPT=useState(profile.title||"");
  var stDDA=useState((profile.settings&&profile.settings.ddayAlert)||7);
  function saveProfile(){onUpdateProfile({display_name:stPN[0],title:stPT[0],settings:Object.assign({},profile.settings||{},{ddayAlert:stDDA[0]})});stProfileOpen[1](false);}

  // 현재 활성 탭
  var activeKey=stView[0]==="company"?"company":stView[0];

  // 사이드바 스타일
  var SB={
    wrap:{width:270,minHeight:"100vh",background:"#1E293B",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,fontFamily:FF},
    brand:{padding:"20px 22px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)"},
    brandTitle:{fontSize:25,fontWeight:800,color:"#fff",letterSpacing:"-0.3px"},
    brandSub:{fontSize:18,color:"#64748B",marginTop:4},
    nav:{flex:1,padding:"6px 0",overflowY:"auto"},
    item:function(active){return{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",margin:"2px 10px",borderRadius:11,fontSize:18,fontWeight:active?700:500,color:active?"#fff":"#94A3B8",background:active?"linear-gradient(90deg,rgba(59,130,246,0.30),rgba(59,130,246,0.18))":"transparent",boxShadow:active?"inset 3px 0 0 #60A5FA, 0 2px 10px rgba(37,99,235,0.18)":"none",cursor:"pointer",transition:"all 0.15s",userSelect:"none",boxSizing:"border-box"};},
    icon:{fontSize:22,width:28,textAlign:"center",flexShrink:0},
    bottom:{padding:"12px 18px 16px",borderTop:"1px solid rgba(255,255,255,0.08)"},
    user:{display:"flex",alignItems:"center",gap:11,marginBottom:10,cursor:"pointer"},
    avatar:{width:40,height:40,borderRadius:20,background:"#334155",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#fff",fontWeight:700,flexShrink:0},
    userName:{fontSize:16,fontWeight:700,color:"#E2E8F0",lineHeight:1.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
    userRole:{fontSize:12.5,color:"#94A3B8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
    actions:{display:"flex",gap:8},
    actionBtn:function(c){return{flex:1,padding:"11px 0",fontSize:14,fontWeight:600,borderRadius:9,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:c||"#94A3B8",cursor:"pointer",textAlign:"center",fontFamily:FF};},
  };

  function NavItem(p){
    return(
      <div data-tour={p.tourId} className="sb-item" style={SB.item(p.active)} onClick={p.onClick} title={p.hint||p.label}
        onMouseEnter={function(e){if(!p.active)e.currentTarget.style.background="rgba(255,255,255,0.08)";}}
        onMouseLeave={function(e){if(!p.active)e.currentTarget.style.background="transparent";}}>
        <span style={SB.icon} className="sb-icon">{p.icon}</span>
        <span>{p.label}</span>
        {p.active&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:3,background:"#60A5FA",flexShrink:0,boxShadow:"0 0 8px #60A5FA"}}/>}
      </div>
    );
  }

  var trialDays=props.trialDaysLeft;

  return(
    <div className="hr-app" data-testid="emp-orig" style={{background:"#F1F5F9",fontFamily:FF,display:"flex"}}>

      {/* 모바일 백드롭 */}
      <div className={"app-backdrop"+(stMobileNav[0]?"":" hidden")} onClick={function(){stMobileNav[1](false);}}/>

      {/* ── 사이드바 ── */}
      <div className={"app-sidebar"+(stMobileNav[0]?" open":"")} style={SB.wrap} data-tour="sidebar">
        {/* 브랜드 */}
        <div style={SB.brand} className="sb-brand">
          <div style={SB.brandTitle} className="sb-brand-title">🏛 고용지원금 Pro</div>
          <div className="sb-brand-sub" style={{fontSize:13,color:"#64748B",marginTop:6,lineHeight:1.45,fontWeight:500}}>컨설턴트를 위한 고용지원금 운영관리 시스템</div>
          {orgName&&<div className="sb-org" style={{fontSize:14,color:"#93C5FD",marginTop:8,fontWeight:600}}>{orgName}</div>}
          {isAdmin?(
            <div className="sb-trial" style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.35)"}}>
              <span style={{fontSize:16}}>🛡️</span>
              <span style={{fontSize:17,color:"#FCD34D",fontWeight:700}}>관리자 계정</span>
            </div>
          ):(function(){
            // 이용 가능 기간 단일 기준 = user_product_access.expires_at
            var ap=accessPeriodLabel({role:props.accessRole,expires_at:props.accessExpiresAt},isAdmin);
            var col=ap.tone==="expired"?"#FCA5A5":ap.tone==="soon"?"#FCD34D":ap.tone==="warn"?"#FCD34D":"#93C5FD";
            var bg=ap.tone==="expired"?"rgba(220,38,38,0.18)":ap.tone==="warn"?"rgba(251,191,36,0.15)":"rgba(59,130,246,0.15)";
            var bd=ap.tone==="expired"?"rgba(220,38,38,0.35)":ap.tone==="warn"?"rgba(251,191,36,0.3)":"rgba(59,130,246,0.3)";
            return(<div className="sb-trial" style={{marginTop:10,display:"inline-flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,background:bg,border:"1px solid "+bd}}>
              <span style={{fontSize:15}}>🗓️</span>
              <span style={{fontSize:14.5,color:col,fontWeight:600,lineHeight:1.35}}>{ap.text}</span>
            </div>);
          })()}
        </div>

        {/* 네비 */}
        <div style={SB.nav}>
          {SIDEBAR_NAV.map(function(n){
            return(
              <NavItem key={n.key} icon={n.icon} label={n.label} hint={n.hint} active={activeKey===n.key}
                tourId={"nav-"+n.key}
                onClick={function(){stView[1](n.key);stCompany[1](null);stMobileNav[1](false);trackActivity({userId:props.userId,userEmail:props.userEmail,orgId:props.orgId,orgName:orgName},"nav."+n.key);}}
              />
            );
          })}

          {/* 다른 SaaS 바로가기 — 설정 바로 아래, 좌측 메뉴의 연장선 */}
          <div className="sb-osnav" style={{margin:"10px 10px 0",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
            <div style={{fontSize:11.5,fontWeight:700,color:"#64748B",letterSpacing:"0.3px",margin:"0 4px 4px"}}>다른 SaaS 바로가기</div>
            {[
              {href:"https://labcare-rnd-os.vercel.app",icon:"🧪",label:"기업부설연구소 OS"},
              {href:"https://corp-sales-os.vercel.app",icon:"🏢",label:"법인컨설팅 OS"},
            ].map(function(o){return(
              <a key={o.href} href={o.href} target="_blank" rel="noopener noreferrer" className="sb-osbtn"
                 style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",margin:"2px 0",borderRadius:11,color:"#94A3B8",textDecoration:"none",fontSize:18,fontWeight:500,boxSizing:"border-box",transition:"all 0.15s"}}
                 onMouseEnter={function(e){e.currentTarget.style.background="rgba(255,255,255,0.08)";e.currentTarget.style.color="#E2E8F0";}}
                 onMouseLeave={function(e){e.currentTarget.style.background="transparent";e.currentTarget.style.color="#94A3B8";}}>
                <span style={SB.icon}>{o.icon}</span><span style={{flex:1}}>{o.label}</span><span style={{opacity:0.5,fontSize:13}}>↗</span>
              </a>
            );})}
          </div>
        </div>

        {/* 하단: 보조/관리자 버튼 → 내 계정 순서로 정리 */}
        <div style={SB.bottom} className="sb-bottom">
          {/* 1) 보조 · 관리자 버튼 */}
          <div>
            {!isAdmin&&!stFbHidden[0]&&(<button className={"sb-feedback"+(stFbGlow[0]?" fb-glow":"")} style={{width:"100%",marginBottom:8,padding:"10px",borderRadius:9,border:"1px solid rgba(96,165,250,0.35)",background:"rgba(59,130,246,0.12)",color:"#BFDBFE",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={function(){openFeedback();stMobileNav[1](false);}}>
              <div style={{fontSize:14,fontWeight:700}}>💬 피드백 남기기</div>
              <div style={{fontSize:11,color:"#93A8C9",fontWeight:400,marginTop:2,lineHeight:1.4}}>더 좋은 프로그램으로 만들기 위해 의견을 들려주세요.</div>
            </button>)}
            {!isAdmin&&(<button className="sb-tourbtn" style={{width:"100%",padding:"10px",fontSize:14,fontWeight:600,borderRadius:9,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",color:"#86EFAC",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={startTour}>📖 사용법 안내 (투어)</button>)}
            {isAdmin&&(<button className="sb-adminbtn" style={{width:"100%",marginBottom:8,padding:"10px",fontSize:14,fontWeight:600,borderRadius:9,border:"1px solid "+(stView[0]==="adminFeedback"?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.12)"),background:stView[0]==="adminFeedback"?"rgba(251,191,36,0.18)":"rgba(255,255,255,0.06)",color:"#FCD34D",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={function(){stView[1]("adminFeedback");stCompany[1](null);stMobileNav[1](false);}}>📋 베타 피드백 (관리자)</button>)}
            {isAdmin&&(<button className="sb-adminbtn" style={{width:"100%",padding:"10px",fontSize:14,fontWeight:600,borderRadius:9,border:"1px solid "+(stView[0]==="adminActivity"?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.12)"),background:stView[0]==="adminActivity"?"rgba(251,191,36,0.18)":"rgba(255,255,255,0.06)",color:"#FCD34D",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={function(){stView[1]("adminActivity");stCompany[1](null);stMobileNav[1](false);}}>📊 사용자 활동 (관리자)</button>)}
            {isAdmin&&(<button className="sb-adminbtn" style={{width:"100%",marginTop:8,padding:"10px",fontSize:14,fontWeight:600,borderRadius:9,border:"1px solid rgba(251,191,36,0.12)",background:"rgba(255,255,255,0.06)",color:"#FCD34D",cursor:"pointer",fontFamily:FF,textAlign:"center"}} onClick={function(){window.location.href="/admin/access";}}>🛡️ 접근 권한 관리 (관리자)</button>)}
          </div>

          {/* 2) 내 계정 — 이름/조직/요금제/구독/로그아웃만 간결하게 */}
          <div style={{paddingTop:14,marginTop:14,borderTop:"1px solid rgba(255,255,255,0.10)"}}>
            <div style={SB.user} className="sb-user" onClick={function(){stProfileOpen[1](true);}} title="프로필 설정">
              <div style={SB.avatar} className="sb-avatar">{(profile.display_name||"?").charAt(0)}</div>
              <div style={{minWidth:0,flex:1}}>
                <div style={SB.userName} className="sb-username">{profile.display_name||"사용자"}</div>
                <div style={SB.userRole} className="sb-userrole">{isAdmin?"총괄 관리자":(profile.title||"담당자")}{orgName?" · "+orgName:""}</div>
              </div>
              {isAdmin&&<span style={{flexShrink:0,fontSize:11,fontWeight:700,color:"#FCD34D",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:999,padding:"3px 9px"}}>관리자</span>}
            </div>
            {!isAdmin&&(
              <div className="sb-trialrow" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <span style={{fontSize:13,color:"#CBD5E1",fontWeight:600}}>{isTrial?"무료체험 · 프로 전체 이용":tier.label}</span>
                {!isTrial&&tier.key!=="pro"&&tier.key!=="team"&&<button onClick={props.onOpenBilling||function(){}} style={{fontSize:12,fontWeight:700,color:"#BFDBFE",background:"rgba(37,99,235,0.25)",border:"none",borderRadius:6,padding:"3px 9px",cursor:"pointer",fontFamily:FF}}>업그레이드 →</button>}
              </div>
            )}
            <div style={SB.actions} className="sb-actions">
              <button style={SB.actionBtn("#93C5FD")} className="sb-actionbtn" onClick={props.onOpenBilling||function(){}} title="구독 관리">구독</button>
              <button style={SB.actionBtn("#FCA5A5")} className="sb-actionbtn" onClick={onSignOut}>로그아웃</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 영역 ── */}
      <div className="app-content" style={{marginLeft:0,flex:1,minWidth:0,display:"flex",flexDirection:"column"}}>
        {/* 상단 헤더바 */}
        <div className="app-header" style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"0 40px",height:76,display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:1,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
            <button className="app-hamburger" onClick={function(){stMobileNav[1](true);}} title="메뉴" style={{display:"none",alignItems:"center",justifyContent:"center",width:44,height:44,borderRadius:10,border:"1px solid #E2E8F0",background:"#F8FAFC",fontSize:22,cursor:"pointer",flexShrink:0}}>☰</button>
            {stView[0]==="company"&&selectedCompany?(
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <button onClick={function(){stCompany[1](null);stView[1]("companies");}} title="업체 목록으로" className="prog-tap" style={{display:"inline-flex",alignItems:"center",gap:5,background:"#F1F5F9",border:"1px solid #E2E8F0",color:"#475569",cursor:"pointer",fontSize:14.5,fontWeight:700,padding:"8px 14px",borderRadius:10,whiteSpace:"nowrap",fontFamily:FF}}>← 업체 목록</button>
                <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                  <span style={{fontSize:14.5,color:"#94A3B8",fontWeight:600,whiteSpace:"nowrap"}} className="hide-mobile">업체 관리</span>
                  <span style={{color:"#CBD5E1",fontSize:16}} className="hide-mobile">›</span>
                  <span style={{fontSize:24,fontWeight:800,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.4px"}}>{selectedCompany.name}</span>
                </div>
              </div>
            ):(
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                {/* [D-94] 목차 화면의 ‘← 이전’ 은 뺐다 — OS 목차·브라우저 뒤로 가기와 겹쳤다. 업체 상세에서는 ‘← 업체 목록’ 으로 남긴다 */}
                <span className="app-title" style={{fontSize:27,fontWeight:800,color:"#0F172A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:"-0.5px"}}>
                  {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).icon}&nbsp;
                  {(SIDEBAR_NAV.find(function(n){return n.key===activeKey;})||{label:"대시보드"}).label}
                </span>
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <button onClick={function(){stCmdK[1](true);}} title="업체·직원 검색"
              style={{display:"flex",alignItems:"center",gap:7,padding:"9px 16px",borderRadius:10,border:"1.5px solid #E2E8F0",background:"#F8FAFC",color:"#64748B",fontSize:15,cursor:"pointer",fontFamily:FF,whiteSpace:"nowrap"}}>
              <span>🔍</span>
              <span className="hide-mobile">검색</span>
              
            </button>
            <NotifBell employees={employees} companies={companies} programs={programs} goCompany={goCompany} settings={profile.settings||{}} tier={tier}/>
            {(stView[0]==="dashboard"||stView[0]==="company")&&!selectedCompany&&(
              <button style={btnP} className="hover-lift add-co-btn" data-tour="add-company" data-testid="emp-add-company" onClick={function(){if(!requirePlan())return;stAddComp[1](true);}}>+<span className="hide-mobile"> 업체 추가</span></button>
            )}
          </div>
        </div>

        {/* 샘플 데이터 배너 */}
        {hasSample&&(
          <div style={{background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",padding:"9px 48px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{...neutralBadge(),flexShrink:0}}>샘플</span>
            <div style={{flex:1,minWidth:200}}>
              <span style={{fontSize:13.5,color:"#64748B"}}>지금 보이는 건 둘러보기용 <strong style={{color:"#475569"}}>가상 데이터</strong>예요. 언제든 삭제할 수 있습니다.</span>
            </div>
            <button disabled={sampleBusy} onClick={function(){if(!requirePlan())return;deleteSampleData();}} style={{background:"#fff",color:sampleBusy?"#94A3B8":"#DC2626",border:"1px solid "+(sampleBusy?"#E2E8F0":"#FECACA"),borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:sampleBusy?"default":"pointer",fontFamily:FF,flexShrink:0,whiteSpace:"nowrap",opacity:sampleBusy?0.7:1}}>{sampleBusy?"처리 중…":"샘플 데이터 삭제"}</button>
          </div>
        )}

        {/* 무료체험 만료 읽기 전용 배너 */}
        {!canUseFeatures&&(
          <div style={{background:"#FFFBEB",borderBottom:"1px solid #FDE68A",padding:"10px 48px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:16,flexShrink:0}}>⏸</span>
            <div style={{flex:1,minWidth:200}}>
              <span style={{fontSize:13,color:"#92400E",fontWeight:600}}>무료체험이 종료되어 읽기 전용 모드로 이용 중입니다.</span>
              <span style={{fontSize:13,color:"#A16207",marginLeft:8}}>기존 데이터는 안전하게 보관됩니다.</span>
            </div>
            <button onClick={props.onOpenBilling||function(){}} style={{background:"#D97706",color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FF,flexShrink:0,whiteSpace:"nowrap"}}>요금제 보기 →</button>
          </div>
        )}

        {/* 페이지 콘텐츠 */}
        <div className="app-page" style={{flex:1,padding:"32px 48px",width:"100%",maxWidth:1440,margin:"0 auto",boxSizing:"border-box"}}>

          <div key={stView[0]+(stCompany[0]||"")} className="page-enter">

          {/* 메뉴별 화면 안내 (대시보드는 StarterGuide가 담당 · 업체 상세 제외) */}
          {stView[0]!=="dashboard"&&!selectedCompany&&SCREEN_GUIDES[stView[0]]&&(
            <ScreenGuide key={"guide-"+stView[0]} viewKey={stView[0]}
              onNavigate={function(v){stView[1](v);stCompany[1](null);}}
              onAddCompany={function(){if(!requirePlan())return;stAddComp[1](true);}}
            />
          )}

          {companies.length===0&&(
            <div data-testid="emp-empty" style={{background:"#F8FAFC",border:"2px dashed #BFDBFE",borderRadius:20,padding:"36px 28px",marginBottom:32,textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:12}}>🏢</div>
              <h3 style={{margin:"0 0 10px",fontSize:22,fontWeight:800,color:"#0F172A"}}>고용지원금으로 관리할 업체를 고르세요</h3>
              <p style={{margin:"0 0 22px",fontSize:15,color:"#475569",lineHeight:1.8}}>업체는 고객 운영에만 있습니다. 여기서는 그 가운데 고용지원금을 진행할 업체를 고릅니다.<br/>고른 업체에 직원을 넣으면 회차·서류·수수료·보고서가 원본 그대로 이어집니다.</p>
              <button onClick={function(){if(!requirePlan())return;stAddComp[1](true);}} style={{background:"#2563EB",color:"#fff",border:"none",borderRadius:12,padding:"13px 32px",fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:FF,boxShadow:"0 2px 8px rgba(37,99,235,0.20)"}}>+ 업체 고르기</button>
            </div>
          )}

          {stView[0]==="dashboard"&&(
            <Dashboard
              companies={companies} employees={employees} programs={programs}
              calendarMemos={calendarMemos} onSaveMemo={onSaveMemo}
              goCompany={goCompany} settings={profile.settings||{}}
              onAddCompany={function(){if(!requirePlan())return;stAddComp[1](true);}}
              setView={function(v){stView[1](v);stCompany[1](null);}}
              tier={tier} isTrial={isAdmin?false:isTrial} trialDaysLeft={isAdmin?null:trialDays} onOpenBilling={props.onOpenBilling}
              isAdmin={isAdmin} accessExpiresAt={props.accessExpiresAt} accessRole={props.accessRole}
              mode="stats"
            />
          )}

          {stView[0]==="company"&&!selectedCompany&&(
            <Dashboard
              companies={companies} employees={employees} programs={programs}
              calendarMemos={calendarMemos} onSaveMemo={onSaveMemo}
              goCompany={goCompany} settings={profile.settings||{}}
              onAddCompany={function(){if(!requirePlan())return;stAddComp[1](true);}}
              setView={function(v){stView[1](v);stCompany[1](null);}}
              excelImport={{onBulkCompanies:onBulkSaveCompanies,onBulkEmployees:onBulkSaveEmployees,onSaveEmployee:onSaveEmployee,onDeleteRows:onDeleteSampleRows,requirePlan:requirePlan}}
              mode="list"
            />
          )}

          {stView[0]==="company"&&selectedCompany&&(
            <CompDet
              company={selectedCompany} programs={programs} employees={employees}
              uploadFn={uploadFn?function(f){return uploadFn(selectedCompany.id,null,f);}:undefined} getUrlFn={getUrlFn} profile={profile} tier={tier}
              goBack={goBack}
              focusEmpId={stFocusEmp[0]} onFocusConsumed={function(){stFocusEmp[1](null);}}
              onSaveEmployee={gated(onSaveEmployee)}
              onPatchEmployee={gated(onPatchEmployee)}
              onDeleteEmployee={gated(onDeleteEmployee)}
              onPatchCompany={gated(onPatchCompany)}
              onDeleteCompany={gated(onDeleteCompany)}
              onLog={logToCompany}
              onOpenBilling={props.onOpenBilling}
              onOpenWage={function(){stView[1]("wage");stCompany[1](null);}}
            />
          )}

          {stView[0]==="kanban"&&(
            <KanbanBoard
              employees={employees} companies={companies} programs={programs}
              onPatchEmployee={gated(onPatchEmployee)} goCompany={goCompany} onProcess={goCompanyEmp} onLog={logToCompany}
            />
          )}

          {stView[0]==="wage"&&(
            <div style={{maxWidth:980}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>최저임금·월보수 하한선을 자동 판정합니다. 지원금 요건을 가르는 핵심 기준이니 보수 설정 전 꼭 확인하세요.</p>
              <WageCalc/>
            </div>
          )}

          {stView[0]==="simulator"&&(
            <div style={{maxWidth:980}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>채용 인원과 입사일만 넣으면 월별 현금흐름까지 자동 계산됩니다. 결과는 고객 상담 문구로 바로 복사할 수 있어요.</p>
              <Simulator programs={programs}/>
            </div>
          )}

          {stView[0]==="diagnosis"&&(
            <div style={{maxWidth:900}}>
              <p style={{margin:"0 0 16px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}><strong style={{color:"#1E293B"}}>채용 전 30초 진단</strong> — 채용 후 알면 늦는 고용지원금을 미리 확인하세요.</p>
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",padding:"14px 16px",marginBottom:16,background:"#F0FDFA",border:"1px solid #99F6E4",borderRadius:14}}>
                <div style={{flex:"1 1 280px",minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:"#0F766E"}}>이미 채용된 직원이 있다면? 4대보험 명부로 한 번에 진단</div>
                  <div style={{fontSize:12.5,color:"#475569",marginTop:3,lineHeight:1.5}}>가입자 명부를 올리면 지원금 후보와 세액공제 가능성을 자동으로 분류합니다. (1차 검토 · 저장되지 않음)</div>
                </div>
                <PayrollDiagnosis compact/>
              </div>
              <HiringDiagnosis programs={programs}/>
            </div>
          )}

          {stView[0]==="programs"&&(
            <ProgramsList programs={programs} onUpdate={onSavePrograms}/>
          )}

          {stView[0]==="settings"&&(
            <SettingsScreen companies={companies} employees={employees} programs={programs} calendarMemos={calendarMemos}/>
          )}

          {stView[0]==="adminFeedback"&&(
            isAdmin?(
              <AdminFeedback userEmail={props.userEmail}/>
            ):(
              <Card style={{padding:"40px 28px",textAlign:"center",maxWidth:560}}>
                <div style={{fontSize:42,marginBottom:10}}>🔒</div>
                <h2 style={{margin:"0 0 8px",fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>접근 권한이 없습니다</h2>
                <p style={{margin:"0 0 20px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>이 화면은 관리자 전용입니다.</p>
                <button style={Object.assign({},btnP,{padding:"10px 22px",fontSize:"var(--fs-btn)"})} onClick={function(){stView[1]("dashboard");}}>대시보드로 돌아가기</button>
              </Card>
            )
          )}

          {stView[0]==="adminActivity"&&(
            isAdmin?(
              <AdminActivityView userEmail={props.userEmail}/>
            ):(
              <Card style={{padding:"40px 28px",textAlign:"center",maxWidth:560}}>
                <div style={{fontSize:42,marginBottom:10}}>🔒</div>
                <h2 style={{margin:"0 0 8px",fontSize:"var(--fs-name)",fontWeight:800,color:"#1E293B"}}>접근 권한이 없습니다</h2>
                <p style={{margin:"0 0 20px",color:"#64748B",fontSize:FS_BODY,lineHeight:1.6}}>이 화면은 관리자 전용입니다.</p>
                <button style={Object.assign({},btnP,{padding:"10px 22px",fontSize:"var(--fs-btn)"})} onClick={function(){stView[1]("dashboard");}}>대시보드로 돌아가기</button>
              </Card>
            )
          )}

          </div>
        </div>
      </div>

      {/* Add Company Modal */}
      {stAddComp[0]&&(
        <CompanyEditModal open={true} onClose={function(){stAddComp[1](false);if(props.onOpenAddDone)props.onOpenAddDone();}} company={null} programs={programs} osClients={props.osClients} presetOsId={props.openAddFor}
          onSave={function(data){
            var prog=Object.values(DEFAULT_PROGRAMS)[0];
            var defaultDocs=COMPANY_DEFAULT_DOCS.reduce(function(acc,cat){return acc.concat(cat.docs.map(function(d){return{id:uid(),label:d,done:false,files:[]};}));},[]);
            var newComp=Object.assign({id:data.osId||ruuid(),createdAt:new Date().toISOString(),companyDocs:defaultDocs},data);
            onSaveCompany(newComp);
            stAddComp[1](false); if(props.onOpenAddDone)props.onOpenAddDone();
            goCompany(newComp.id);
            toast("업체가 등록되었습니다.","success");
          }}
        />
      )}

      {/* Cmd+K 검색 팔레트 */}
      <CmdKSearch
        open={stCmdK[0]}
        onClose={function(){stCmdK[1](false);}}
        companies={companies}
        employees={employees}
        programs={programs}
        goCompany={goCompany}
        setView={function(v){stView[1](v);stCompany[1](null);}}
      />

      {/* Profile Modal */}
      <Modal open={stProfileOpen[0]} onClose={function(){stProfileOpen[1](false);}} title="👤 프로필 설정" width={420}>
        <div style={{display:"grid",gap:16}}>
          <div><Label>이름/담당자명</Label><input style={inp} value={stPN[0]} onChange={function(e){stPN[1](e.target.value);}} placeholder="홍길동"/></div>
          <div><Label>직함</Label><input style={inp} value={stPT[0]} onChange={function(e){stPT[1](e.target.value);}} placeholder="공인노무사 / 팀장 ..."/></div>
          <div><Label>D-Day 알림 기준 (일)</Label><input type="number" style={inp} value={stDDA[0]} onChange={function(e){stDDA[1](Number(e.target.value));}} min={1} max={30}/></div>
          <div style={{padding:"13px 15px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#334155",marginBottom:8,display:"flex",alignItems:"center",gap:6}}><span>🔒</span>데이터 보호 안내</div>
            <ul style={{margin:0,paddingLeft:18,fontSize:12.5,color:"#475569",lineHeight:1.7}}>
              <li>고객사·직원 정보는 계정(조직)별로 분리되어 저장됩니다.</li>
              <li>민감정보 보호를 위해 주민등록번호 전체는 저장하지 않으며, 생년월일·성별만 보관합니다.</li>
              <li>서류 파일은 비공개 저장소에 보관되어 권한 있는 사용자만 임시 링크로 열람합니다.</li>
            </ul>
          </div>
          <div style={{padding:"13px 15px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10}}>
            <div style={{fontSize:13,fontWeight:700,color:"#92400E",marginBottom:6,display:"flex",alignItems:"center",gap:6}}><span>⚠️</span>계정 공유 안내</div>
            <p style={{margin:0,fontSize:12.5,color:"#78350F",lineHeight:1.7}}>고객사·직원 정보 보호를 위해 계정은 1인 1계정 사용을 권장합니다. 팀원이 있으시면 초대 기능으로 별도 계정을 만들어 주세요.</p>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
            <span/>{/* [D-93] 비밀번호는 OS 로그인이 맡는다 */}
            <div style={{display:"flex",gap:8}}>
              <button style={btnS} onClick={function(){stProfileOpen[1](false);}}>취소</button>
              <button style={Object.assign({},btnP,{padding:"11px 32px"})} onClick={saveProfile}>저장</button>
            </div>
          </div>
        </div>
      </Modal>
      {/* 베타 피드백 설문 */}
      <FeedbackModal
        open={stFbOpen[0]}
        scope={fbScope}
        userEmail={props.userEmail||(profile&&profile.email)||""}
        orgName={orgName}
        orgId={props.orgId||null}
        userId={props.userId||null}
        onClose={function(){stFbOpen[1](false);}}
        onSubmitted={function(saved){stFbGlow[1](false);if(saved)stFbHidden[1](true);}}
        onDismiss={function(){stFbGlow[1](false);}}
      />
      <ProductTour open={stTour[0]} onClose={endTour}/>
      <PlanRequiredModal open={stPaywall[0]} onClose={function(){stPaywall[1](false);}} onOpenBilling={props.onOpenBilling}/>
      <ToastHost/>
    </div>
  );
}
