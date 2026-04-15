'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { getReport } from '@/lib/data';
import type { Report } from '@/lib/types';

// Minimal markdown renderer — handles bold, headers, tables, and links
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold mt-5 mb-2" style="color:var(--sky)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-6 mb-2" style="color:var(--blue)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mt-4 mb-3" style="color:var(--mauve)">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em style="color:var(--subtext)">$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--blue)" class="hover:underline">$1</a>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr style="border-color:var(--surface0);margin:1rem 0"/>')
    // Code blocks
    .replace(/```[\s\S]*?```/g, match => {
      const code = match.replace(/^```\w*\n?/, '').replace(/```$/, '');
      return `<pre class="rounded p-3 my-3 overflow-x-auto text-xs" style="background:var(--mantle);color:var(--text)">${code}</pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded text-xs" style="background:var(--surface0);color:var(--yellow)">$1</code>');

  // Tables
  html = html.replace(/(\|.+\|\n)+/g, match => {
    const rows = match.trim().split('\n');
    let tableHtml = '<div class="overflow-x-auto my-4"><table class="w-full text-xs border-collapse">';
    let inHeader = true;
    for (const row of rows) {
      if (row.match(/^\|[\s\-:|]+\|$/)) {
        inHeader = false;
        continue;
      }
      const cells = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
      if (inHeader) {
        tableHtml += '<thead><tr>' +
          cells.map(c => `<th class="px-3 py-2 text-left border-b" style="color:var(--sky);border-color:var(--surface0)">${c.trim()}</th>`).join('') +
          '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr class="border-b hover:bg-[var(--surface0)] transition-colors" style="border-color:var(--surface0)">' +
          cells.map(c => `<td class="px-3 py-2" style="color:var(--subtext)">${c.trim()}</td>`).join('') +
          '</tr>';
      }
    }
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  // Unordered lists
  html = html.replace(/(^- .+$\n?)+/gm, match => {
    const items = match.trim().split('\n').map(l => l.replace(/^- /, ''));
    return '<ul class="list-disc pl-5 my-2 space-y-1">' +
      items.map(i => `<li style="color:var(--subtext)">${i}</li>`).join('') +
      '</ul>';
  });

  // Paragraphs (double newline → paragraph break)
  html = html
    .split(/\n{2,}/)
    .map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<')) return p; // already HTML
      return `<p class="my-2 leading-relaxed" style="color:var(--subtext)">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n');

  return html;
}

export default function ReportPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getReport(number)
      .then(r => {
        if (!r) setNotFound(true);
        else setReport(r);
      })
      .finally(() => setLoading(false));
  }, [number]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--base)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b sticky top-0 z-10"
        style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm transition-colors hover:text-[var(--blue)]"
            style={{ color: 'var(--subtext)' }}
          >
            ← Pipeline
          </Link>
          {report && (
            <span className="text-sm" style={{ color: 'var(--overlay0)' }}>
              Report #{report.report_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {report?.comp && (
            <span className="text-xs" style={{ color: 'var(--yellow)' }}>{report.comp}</span>
          )}
          {report?.remote && (
            <span className="text-xs" style={{ color: 'var(--subtext)' }}>{report.remote}</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--subtext)' }}>
          Loading…
        </div>
      ) : notFound ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p style={{ color: 'var(--subtext)' }}>Report not found.</p>
          <Link href="/" style={{ color: 'var(--blue)' }}>← Back to pipeline</Link>
        </div>
      ) : report ? (
        <>
          {/* Quick facts strip */}
          {(report.archetype || report.tldr) && (
            <div
              className="px-6 py-3 border-b text-sm space-y-1"
              style={{ backgroundColor: 'var(--mantle)', borderColor: 'var(--surface0)' }}
            >
              {report.archetype && (
                <div>
                  <span className="font-bold" style={{ color: 'var(--sky)' }}>Archetype: </span>
                  <span style={{ color: 'var(--text)' }}>{report.archetype}</span>
                </div>
              )}
              {report.tldr && (
                <div>
                  <span className="font-bold" style={{ color: 'var(--sky)' }}>TL;DR: </span>
                  <span style={{ color: 'var(--subtext)' }}>{report.tldr}</span>
                </div>
              )}
            </div>
          )}

          {/* Report content */}
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content) }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
