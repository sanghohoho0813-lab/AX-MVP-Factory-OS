import { createContext, useContext } from 'react'
import type { TutorialVideo } from '../../config/tutorialVideos'

export interface TutorialContextValue {
  /** 안내 영상 창 열기(머리줄 단추) */
  open: (part?: TutorialVideo['key']) => void
}

export const TutorialContext = createContext<TutorialContextValue | null>(null)

export function useTutorial(): TutorialContextValue | null {
  return useContext(TutorialContext)
}
