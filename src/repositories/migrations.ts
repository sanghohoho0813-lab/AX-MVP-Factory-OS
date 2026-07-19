import {
  BACKUP_KEY_PREFIX,
  SCHEMA_VERSION,
  STORAGE_KEYS,
  hasKey,
  readRaw,
  readSchemaVersion,
  writeJson,
  writeRaw,
  writeSchemaVersion,
} from '../storage/localStore'
import { seedCoreData } from './seed'
import {
  ALL_SEED_QUESTIONS,
  SEED_MODULES,
  SEED_TEMPLATES,
} from '../data/seed/surveySeed'

interface Migration {
  version: number
  describe: string
  migrate: () => void
}

/**
 * v2 마이그레이션 — 질문·모듈·템플릿 시드.
 * 이미 설문 데이터가 있으면 덮어쓰지 않는다.
 */
function seedSurveyData(): void {
  if (!hasKey(STORAGE_KEYS.questions)) {
    writeJson(STORAGE_KEYS.questions, ALL_SEED_QUESTIONS)
  }
  if (!hasKey(STORAGE_KEYS.surveyModules)) {
    writeJson(STORAGE_KEYS.surveyModules, SEED_MODULES)
  }
  if (!hasKey(STORAGE_KEYS.surveyTemplates)) {
    writeJson(STORAGE_KEYS.surveyTemplates, SEED_TEMPLATES)
  }
  if (!hasKey(STORAGE_KEYS.surveyBlueprints)) {
    writeJson(STORAGE_KEYS.surveyBlueprints, [])
  }
}

/** 순차 적용 마이그레이션 목록 (버전 오름차순) */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    describe: '고객사·프로젝트·활동 이력 시드',
    migrate: seedCoreData,
  },
  {
    version: 2,
    describe: '진단 질문·모듈·템플릿 시드',
    migrate: seedSurveyData,
  },
]

/** 마이그레이션 전 기존 도메인 키의 안전한 백업본을 만든다 */
function backupBeforeMigration(targetVersion: number): void {
  const keysToBackup = [
    STORAGE_KEYS.organizations,
    STORAGE_KEYS.projects,
    STORAGE_KEYS.activities,
  ]
  for (const key of keysToBackup) {
    const raw = readRaw(key)
    if (raw === null) continue
    const backupKey = `${BACKUP_KEY_PREFIX}.before_schema_${targetVersion}.${key}`
    if (!hasKey(backupKey)) {
      try {
        writeRaw(backupKey, raw)
      } catch {
        // 백업 실패는 마이그레이션을 막지 않는다
      }
    }
  }
}

/**
 * 저장 스키마를 현재 버전까지 순차적으로 마이그레이션한다.
 * - 기존 데이터는 절대 초기화하지 않는다.
 * - 중간 마이그레이션이 실패해도 이미 적용된 것은 유지된다.
 * - 버전을 건너뛴 상태에서도 필요한 마이그레이션만 순차 적용된다.
 */
export function runMigrations(): void {
  const current = readSchemaVersion() ?? 0

  if (current >= SCHEMA_VERSION) return

  // 기존 데이터가 있는 상태(current >= 1)에서 상향 마이그레이션 시 백업
  if (current >= 1) {
    backupBeforeMigration(SCHEMA_VERSION)
  }

  for (const migration of MIGRATIONS) {
    if (current >= migration.version) continue
    try {
      migration.migrate()
      writeSchemaVersion(migration.version)
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          `[migration] v${migration.version}(${migration.describe}) 적용 중 문제가 발생했습니다.`,
          error instanceof Error ? error.message : error,
        )
      }
      // 실패 시 이후 마이그레이션을 중단하되 기존 데이터는 보존한다
      return
    }
  }
}
