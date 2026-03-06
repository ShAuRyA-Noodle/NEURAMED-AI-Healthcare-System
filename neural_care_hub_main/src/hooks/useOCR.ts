import { useMutation } from '@tanstack/react-query';
import { analyzeReport } from '@/api/ocr';

export const useOCRAnalysis = () =>
  useMutation({
    mutationFn: analyzeReport,
  });
