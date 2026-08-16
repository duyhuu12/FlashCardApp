import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

const correctSound = require('../../assets/images/voice/duolingo-correct.mp3');
const wrongSound = require('../../assets/images/voice/duolingo-wrong.mp3');
const completedSound = require('../../assets/images/voice/duolingo-completed-lesson.mp3');

export function useAnswerFeedback() {
  const correctPlayer = useAudioPlayer(correctSound);
  const wrongPlayer = useAudioPlayer(wrongSound);
  const completedPlayer = useAudioPlayer(completedSound);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const replay = useCallback((player: typeof correctPlayer) => {
    player.seekTo(0)
      .then(() => player.play())
      // Không chặn phiên học nếu thiết bị tạm thời không phát được âm thanh.
      .catch(() => undefined);
  }, []);

  const playAnswerFeedback = useCallback((correct: boolean) => {
    Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);
    replay(correct ? correctPlayer : wrongPlayer);
  }, [correctPlayer, replay, wrongPlayer]);

  const playCompletionFeedback = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    replay(completedPlayer);
  }, [completedPlayer, replay]);

  return { playAnswerFeedback, playCompletionFeedback };
}
