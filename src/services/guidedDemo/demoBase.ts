/**
 * 샘플 체험을 열 수 있는지만 가볍게 본다 (D-102).
 *
 * 예전에는 모든 화면을 감싸는 틀(DemoTourProvider)이 guidedDemoService 를 바로 불러와,
 * 작업실 서비스(검증·선정·MVP 설계·웹사이트·산출물 — 약 200KB)가 첫 화면 파일에 함께 실렸다.
 * 이 파일은 저장소 두 개만 보고, 무거운 준비 코드는 '샘플 체험' 을 누를 때 불러온다.
 */
import { organizationRepository, projectRepository } from '../../repositories'
import { DEMO_ORG_ID, DEMO_PROJECT_ID } from './demoDataset'

export function isGuidedDemoBaseReady(): boolean {
  return Boolean(organizationRepository.getById(DEMO_ORG_ID) && projectRepository.getById(DEMO_PROJECT_ID))
}
