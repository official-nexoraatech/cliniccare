import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdateWhatsAppTemplatesRequest, WhatsAppTemplatesResponse } from '@clinic-care/shared-types';
import { api } from '@/lib/api';

const WHATSAPP_TEMPLATES_KEY = ['whatsapp-templates'] as const;

export function useWhatsAppTemplatesQuery() {
  return useQuery({
    queryKey: WHATSAPP_TEMPLATES_KEY,
    queryFn: async () => {
      const { data } = await api.get<WhatsAppTemplatesResponse>('/whatsapp-templates');
      return data;
    },
  });
}

export function useWhatsAppTemplateMutations() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: async (payload: UpdateWhatsAppTemplatesRequest) => {
      const { data } = await api.patch<WhatsAppTemplatesResponse>('/whatsapp-templates', payload);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WHATSAPP_TEMPLATES_KEY }),
  });

  return { update };
}
