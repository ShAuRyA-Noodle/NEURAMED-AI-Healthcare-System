import { useMutation } from '@tanstack/react-query';
import { diagnoseSpeech } from '@/api/voice';

export const useVoiceDiagnosis = () =>
  useMutation({
    mutationFn: diagnoseSpeech,
  });
