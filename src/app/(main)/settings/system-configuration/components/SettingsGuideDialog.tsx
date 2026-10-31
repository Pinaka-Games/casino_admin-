"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SECTION_DEFINITIONS,
  sectionId,
  type SectionDefinition,
} from "@/config/system-config-sections";
import { SETTING_GUIDE, type SettingGuide } from "@/config/system-config-guide";

/**
 * The whole System Configuration guide in one place: every section, every
 * setting, and for each one what it is, what changing it does, what it costs,
 * and a worked example.
 *
 * This replaced the per-field info dialog. That dialog could only ever show one
 * setting at a time, which is the wrong shape for settings that only make sense
 * in pairs — Withdraw Enabled and Redeem Enabled gate the same request, and the
 * daily redeem limit means two different things depending on its scope. Reading
 * them side by side is the point.
 *
 * Content lives in `system-config-guide.ts`. A setting with no entry there still
 * appears, falling back to the legacy `help` block on the field schema, so a
 * newly added setting is never silently missing from the guide.
 */
export default function SettingsGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => buildGuide(query), [query]);
  const total = useMemo(
    () => sections.reduce((sum, s) => sum + s.entries.length, 0),
    [sections],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-[#1B212B] border-[#2C323D] text-white sm:max-w-4xl max-h-[88vh] flex! flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="shrink-0 border-b border-[#2C323D] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-white">
                System Settings Guide
              </DialogTitle>
              <DialogDescription className="text-gray-400 text-sm">
                What each setting is, what changing it does, and what it affects.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close guide"
              className="shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-[#242B35] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative mt-3">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings — name, effect or path"
              className="bg-[#242B35] border-[#2C323D] pl-9 text-white placeholder:text-gray-500"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {total === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              Nothing matches “{query}”.
            </p>
          ) : (
            <div className="space-y-7">
              {sections.map((section) => (
                <section key={section.id}>
                  <h3 className="sticky top-0 z-10 -mx-5 mb-3 bg-[#1B212B] px-5 pt-4 pb-2 text-sm font-semibold uppercase tracking-wide text-purple-300">
                    {section.title}
                  </h3>

                  <div className="space-y-3">
                    {section.entries.map((entry) => (
                      <article
                        key={entry.path}
                        className="rounded-lg border border-[#2C323D] bg-[#191D24] p-4"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white">
                            {entry.label}
                          </h4>
                          <code className="font-mono text-[11px] text-gray-500">
                            {entry.path}
                          </code>
                        </div>

                        <dl className="mt-2 space-y-1.5 text-sm leading-relaxed">
                          <GuideRow term="What it is" text={entry.guide.what} />
                          <GuideRow term="What it does" text={entry.guide.does} />
                          <GuideRow
                            term="Impact"
                            text={entry.guide.impact}
                            accent="text-amber-200/90"
                          />
                          <GuideRow
                            term="Example"
                            text={entry.guide.example}
                            accent="text-gray-300 italic"
                          />
                        </dl>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#2C323D] px-5 py-3 text-xs text-gray-500">
          {total} setting{total === 1 ? "" : "s"} documented. Values are saved
          per card — the Save button on a card only writes that card&apos;s
          section.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuideRow({
  term,
  text,
  accent,
}: {
  term: string;
  text: string;
  accent?: string;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{term}</dt>
      <dd className={accent ?? "text-gray-300"}>{text}</dd>
    </div>
  );
}

type GuideEntry = {
  path: string;
  label: string;
  guide: SettingGuide;
};

type GuideSection = {
  id: string;
  title: string;
  entries: GuideEntry[];
};

/**
 * Turn the editor's own section schema into guide sections, so the guide is
 * always in the same order as the page and can never list a setting the page
 * does not render.
 */
function buildGuide(query: string): GuideSection[] {
  const needle = query.trim().toLowerCase();

  return SECTION_DEFINITIONS.map((section: SectionDefinition) => {
    const entries = section.fields
      .map<GuideEntry>((field) => ({
        path: field.path,
        label: field.label,
        guide: SETTING_GUIDE[field.path] ?? fallbackGuide(field),
      }))
      .filter((entry) => {
        if (!needle) return true;
        return [
          entry.label,
          entry.path,
          section.title,
          entry.guide.what,
          entry.guide.does,
          entry.guide.impact,
          entry.guide.example,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });

    return { id: sectionId(section), title: section.title, entries };
  }).filter((section) => section.entries.length > 0);
}

/**
 * A setting with no hand-written entry yet. The legacy `help` block on the
 * field schema carries most of the same information, so it is reused rather
 * than showing an empty card — and the gap is stated plainly instead of being
 * papered over.
 */
function fallbackGuide(field: {
  label: string;
  help?: { summary: string; details?: string[]; caution?: string };
}): SettingGuide {
  const help = "help" in field ? field.help : undefined;

  return {
    what: help?.summary ?? `${field.label}. No guide entry written yet.`,
    does:
      help?.details?.join(" ") ??
      "Not yet documented — check with whoever owns this feature before changing it.",
    impact:
      help?.caution ??
      "Impact not yet documented. Treat as unknown and change it on a staging environment first.",
    example: "No example written yet.",
  };
}
