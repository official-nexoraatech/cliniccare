import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, RotateCcw, Save } from 'lucide-react';
import type { WhatsAppTemplateKey, WhatsAppTemplateValues } from '@clinic-care/shared-types';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { DEFAULT_WHATSAPP_TEMPLATES } from '@/lib/whatsappTemplates';
import { useWhatsAppTemplateMutations, useWhatsAppTemplatesQuery } from '@/hooks/useWhatsAppTemplates';
import { CardGridSkeleton } from '@/components/Skeleton';

export function WhatsAppMessagesPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'clinic:edit');
  const { data, isLoading } = useWhatsAppTemplatesQuery();
  const { update } = useWhatsAppTemplateMutations();
  const [drafts, setDrafts] = useState<WhatsAppTemplateValues>(DEFAULT_WHATSAPP_TEMPLATES);

  useEffect(() => {
    if (data?.templates) setDrafts(data.templates);
  }, [data?.templates]);

  const dirty = useMemo(
    () => Boolean(data?.templates && Object.keys(drafts).some((key) => drafts[key as WhatsAppTemplateKey] !== data.templates[key as WhatsAppTemplateKey])),
    [data?.templates, drafts],
  );

  const save = async () => {
    try {
      await update.mutateAsync({ templates: drafts });
      toast.success('WhatsApp messages saved');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save WhatsApp messages.'));
    }
  };

  const resetOne = (key: WhatsAppTemplateKey) => {
    setDrafts((current) => ({ ...current, [key]: DEFAULT_WHATSAPP_TEMPLATES[key] }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-navy)]">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Messages
          </h1>
          <p className="text-sm text-gray-500">Edit the message text used by WhatsApp buttons across the clinic app.</p>
        </div>
        {canEdit && (
          <button
            onClick={save}
            disabled={!dirty || update.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {update.isPending ? 'Saving...' : 'Save Messages'}
          </button>
        )}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : (
        <div className="flex flex-col gap-3">
          {(data?.definitions ?? []).map((definition) => (
            <section key={definition.key} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-navy)]">{definition.label}</h2>
                  <p className="text-xs text-gray-500">{definition.description}</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => resetOne(definition.key)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                )}
              </div>

              <textarea
                value={drafts[definition.key] ?? ''}
                disabled={!canEdit}
                onChange={(event) => setDrafts((current) => ({ ...current, [definition.key]: event.target.value }))}
                className={cn(
                  'mt-3 min-h-28 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
                  !canEdit && 'bg-gray-50 text-gray-500',
                )}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {definition.variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() =>
                      canEdit &&
                      setDrafts((current) => ({
                        ...current,
                        [definition.key]: `${current[definition.key] ?? ''}{{${variable}}}`,
                      }))
                    }
                    className={cn(
                      'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700',
                      canEdit && 'hover:bg-green-100',
                    )}
                  >
                    {`{{${variable}}}`}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
