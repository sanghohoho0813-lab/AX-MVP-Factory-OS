// qa:modconflict 전용 진입점 — 실제 moduleData.ts 그대로(연결만 로컬 PostgREST)
export { listRows, saveRow, saveRowChecked, deleteRow, OVERWRITTEN_SUFFIX, listOverwritten, restoreOverwritten, readModuleRow } from '../../src/services/moduleData'
// D-550 덮인 판 보기 모양
export { diffSummary, kindLabel } from '../../src/services/overwrittenView'
// D-538 고정 id 두 곳 — 실제 저장 함수 그대로
export { __resetJudgeSkill, saveJudgeSkill, syncJudgeSkill } from '../../src/services/aiAssist/judgeSkill'
export { loadWeekRef, saveWeekRef, weekRefId, mondayOf, THREADS_MODULE, WEEK_BUCKET } from '../../src/services/marketing/threads'
export { workspaceRowId } from '../../src/services/workspaceRowId'
