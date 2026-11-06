// qa:clientconflict 전용 진입점 — 실제 clientOpsService.ts 그대로(연결만 로컬 PostgREST)
export { listClients, createClient, saveClient, resolveClientConflict, onClientSaveNews, ClientSaveConflictError, __forgetClientSnapshots, normalizeClientOps } from '../../src/services/clientOpsService'
export { mergeClientEdits, applyMine } from '../../src/services/clientMerge'
