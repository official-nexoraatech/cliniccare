import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, Save } from 'lucide-react';
import type { WhatsAppTemplateKey, WhatsAppTemplateValues } from '@clinic-care/shared-types';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/auth-store';
import { hasPermission } from '@/lib/permissions';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WHATSAPP_VARIABLE_LABELS,
  WHATSAPP_VARIABLE_SAMPLES,
  renderWhatsAppTemplate,
} from '@/lib/whatsappTemplates';
import { useWhatsAppTemplateMutations, useWhatsAppTemplatesQuery } from '@/hooks/useWhatsAppTemplates';
import { CardGridSkeleton } from '@/components/Skeleton';

const PILL_CLASS = 'mx-0.5 inline-block select-none rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800';

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function templateToHtml(template: string): string {
  const parts: string[] = [];
  let lastIndex = 0;
  const pattern = /\{\{(\w+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template))) {
    parts.push(escapeHtml(template.slice(lastIndex, match.index)));
    const variable = match[1];
    parts.push(`<span contenteditable="false" data-var="${variable}" class="${PILL_CLASS}">${escapeHtml(WHATSAPP_VARIABLE_LABELS[variable] ?? variable)}</span>`);
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeHtml(template.slice(lastIndex)));
  return parts.join('');
}

function nodeToTemplate(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLElement) {
    if (node.dataset.var) return `{{${node.dataset.var}}}`;
    return Array.from(node.childNodes).map(nodeToTemplate).join('');
  }
  return '';
}

function htmlToTemplate(container: HTMLElement): string {
  return Array.from(container.childNodes).map(nodeToTemplate).join('');
}

interface TemplateEditorProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  editorRef: (el: HTMLDivElement | null) => void;
}

function TemplateEditor({ value, disabled, onChange, editorRef }: TemplateEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastSyncedValue = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && value !== lastSyncedValue.current) {
      el.innerHTML = templateToHtml(value);
      lastSyncedValue.current = value;
    }
  }, [value]);

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const next = htmlToTemplate(el);
    lastSyncedValue.current = next;
    onChange(next);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      document.execCommand('insertText', false, '\n');
      handleInput();
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    handleInput();
  };

  return (
    <div
      ref={(el) => {
        ref.current = el;
        editorRef(el);
      }}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      className={cn(
        'mt-3 min-h-28 w-full whitespace-pre-wrap rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]',
        disabled && 'bg-gray-50 text-gray-500',
      )}
    />
  );
}

export function WhatsAppMessagesPage() {
  const currentUser = useAuthStore((state) => state.user);
  const canEdit = hasPermission(currentUser, 'clinic:edit');
  const { data, isLoading } = useWhatsAppTemplatesQuery();
  const { update } = useWhatsAppTemplateMutations();
  const [drafts, setDrafts] = useState<WhatsAppTemplateValues>(DEFAULT_WHATSAPP_TEMPLATES);
  const editorRefs = useRef<Partial<Record<WhatsAppTemplateKey, HTMLDivElement | null>>>({});

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

  const insertVariable = (key: WhatsAppTemplateKey, variable: string) => {
    const el = editorRefs.current[key];
    if (!el) return;
    el.focus();

    const pill = document.createElement('span');
    pill.setAttribute('contenteditable', 'false');
    pill.dataset.var = variable;
    pill.className = PILL_CLASS;
    pill.textContent = WHATSAPP_VARIABLE_LABELS[variable] ?? variable;

    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)
        ? selection.getRangeAt(0)
        : (() => {
            const fallback = document.createRange();
            fallback.selectNodeContents(el);
            fallback.collapse(false);
            return fallback;
          })();

    range.deleteContents();
    range.insertNode(pill);
    range.setStartAfter(pill);
    range.setEndAfter(pill);
    selection?.removeAllRanges();
    selection?.addRange(range);

    setDrafts((prev) => ({ ...prev, [key]: htmlToTemplate(el) }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-navy)]">
            <MessageCircle className="h-5 w-5 text-green-600" />
            WhatsApp Messages
          </h1>
          <p className="text-sm text-gray-500">
            Write what patients receive on WhatsApp. Click a placeholder below the message to drop it in — it turns
            into the real value automatically when the message is sent.
          </p>
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

              <TemplateEditor
                value={drafts[definition.key] ?? ''}
                disabled={!canEdit}
                onChange={(next) => setDrafts((current) => ({ ...current, [definition.key]: next }))}
                editorRef={(el) => {
                  editorRefs.current[definition.key] = el;
                }}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Insert:</span>
                {definition.variables.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => insertVariable(definition.key, variable)}
                    className={cn(
                      'rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700',
                      canEdit && 'hover:bg-green-100',
                    )}
                  >
                    {WHATSAPP_VARIABLE_LABELS[variable] ?? variable}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#dcf8c6] px-3 py-2 text-sm leading-6 text-gray-800 shadow-sm">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">Preview</p>
                  {renderWhatsAppTemplate(drafts[definition.key], definition.key, WHATSAPP_VARIABLE_SAMPLES)}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
