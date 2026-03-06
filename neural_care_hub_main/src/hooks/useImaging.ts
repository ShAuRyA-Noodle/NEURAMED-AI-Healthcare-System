import { useMutation } from '@tanstack/react-query';
import { analyzeImage } from '@/api/imaging';

export const useImagingAnalysis = () =>
  useMutation({
    mutationFn: analyzeImage,
  });
