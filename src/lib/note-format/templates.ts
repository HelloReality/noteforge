// NoteForge — document templates (pre-built .note.html starters).
// Each template is a complete .note.html string that users can import with one
// click. Templates are designed to showcase common note structures.

export interface NoteTemplate {
  id: string
  name: string
  description: string
  category: 'study' | 'meeting' | 'reference' | 'tutorial'
  icon: string
  filename: string
  html: string
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank note',
    description: 'A single empty page with a title — the minimal starting point.',
    category: 'reference',
    icon: '📄',
    filename: 'blank.note.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="note-format" content="visual-notes/1">
<title>Untitled Note</title>
<style>
  .note-page { font-family: 'Inter', sans-serif; color: #1f2933; padding: 48px; box-sizing: border-box; }
  .note-title { font-size: 32px; font-weight: 700; color: #0e7490; margin: 0 0 16px; }
</style>
</head>
<body>
<note-document data-title="Untitled Note" data-version="1">
  <note-page data-page="1" data-width="900" data-height="1270" data-background="#ffffff">
    <note-title data-align="left">Untitled Note</note-title>
    <note-paragraph>Start writing here…</note-paragraph>
  </note-page>
</note-document>
</body>
</html>`,
  },
  {
    id: 'study-guide',
    name: 'Study guide',
    description: 'Q&A format with numbered questions, callouts for tips, and a definitions section.',
    category: 'study',
    icon: '📚',
    filename: 'study-guide.note.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="note-format" content="visual-notes/1">
<title>Study Guide</title>
<style>
  .note-page { font-family: 'Kalam', 'Comic Sans MS', cursive; color: #1f2933; padding: 44px; box-sizing: border-box; }
  .note-title { font-family: 'Caveat', cursive; font-size: 40px; color: #0e7490; margin: 0 0 12px; }
  .q-card { border: 2px solid #0e7490; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px; background: #ffffff; }
  .hl { background: #fef08a; border-radius: 4px; padding: 0 4px; }
  .kw { color: #b45309; font-weight: 700; }
  .note-callout--tip { background: #ecfdf5; border-color: #10b981; }
</style>
</head>
<body>
<note-document data-title="Study Guide" data-version="1">
  <note-page data-page="1" data-width="900" data-height="1270" data-background="#fdfbf3">
    <note-title data-align="center">📘 Study Guide</note-title>
    <note-question number="1" class="q-card">
      <note-heading level="2">Define <span class="hl">key concept</span></note-heading>
      <note-paragraph>Write your answer here. Use <span class="kw">highlighted</span> keywords for emphasis.</note-paragraph>
      <note-callout type="tip" title="Remember">Add a memorable tip here.</note-callout>
    </note-question>
    <note-definition term="Key term">Clear, concise definition of the term.</note-definition>
  </note-page>
</note-document>
</body>
</html>`,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, attendees, action items with check-lists, and a decisions callout.',
    category: 'meeting',
    icon: '🗓️',
    filename: 'meeting-notes.note.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="note-format" content="visual-notes/1">
<title>Meeting Notes</title>
<style>
  .note-page { font-family: 'Inter', sans-serif; color: #1f2933; padding: 44px; box-sizing: border-box; }
  .note-title { font-size: 32px; font-weight: 700; color: #1e293b; margin: 0 0 8px; }
  .note-callout--info { background: #eff6ff; border-color: #3b82f6; }
  .note-callout--warning { background: #fffbeb; border-color: #f59e0b; }
</style>
</head>
<body>
<note-document data-title="Meeting Notes" data-version="1">
  <note-page data-page="1" data-width="900" data-height="1270" data-background="#ffffff">
    <note-title data-align="left">🗓️ Meeting Notes</note-title>
    <note-paragraph><strong>Date:</strong> <em>Click to edit</em> · <strong>Attendees:</strong> <em>Click to edit</em></note-paragraph>
    <note-heading level="2">Agenda</note-heading>
    <note-list type="numbered" start="1">
      <note-item>Review previous action items</note-item>
      <note-item>Discuss new topics</note-item>
      <note-item>Plan next steps</note-item>
    </note-list>
    <note-heading level="2">Action items</note-heading>
    <note-list type="check">
      <note-item data-checked="false">Follow up with stakeholder</note-item>
      <note-item data-checked="false">Send meeting summary</note-item>
      <note-item data-checked="false">Schedule follow-up</note-item>
    </note-list>
    <note-callout type="warning" title="Decisions">Record key decisions made during the meeting.</note-callout>
  </note-page>
</note-document>
</body>
</html>`,
  },
  {
    id: 'quick-reference',
    name: 'Quick reference',
    description: 'A cheat-sheet layout with a comparison table, code snippets, and a definition list.',
    category: 'reference',
    icon: '🔖',
    filename: 'quick-reference.note.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="note-format" content="visual-notes/1">
<title>Quick Reference</title>
<style>
  .note-page { font-family: 'Inter', sans-serif; color: #1f2933; padding: 44px; box-sizing: border-box; }
  .note-title { font-size: 32px; font-weight: 700; color: #0e7490; margin: 0 0 16px; }
  .note-page table { border-collapse: collapse; width: 100%; font-size: 14px; margin: 10px 0; }
  .note-page th { background: #0e7490; color: #fff; padding: 8px 10px; text-align: left; }
  .note-page td { border: 1px solid #cbd5e1; padding: 8px 10px; background: #fff; }
  pre { background: #0f172a; color: #e2e8f0; padding: 14px 16px; border-radius: 10px; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
  code { font-family: 'JetBrains Mono', monospace; background: #f1f5f9; border-radius: 4px; padding: 1px 5px; font-size: .92em; }
</style>
</head>
<body>
<note-document data-title="Quick Reference" data-version="1">
  <note-page data-page="1" data-width="900" data-height="1270" data-background="#ffffff">
    <note-title data-align="left">🔖 Quick Reference</note-title>
    <note-heading level="2">Comparison</note-heading>
    <note-table data-caption="At a glance">
      <table>
        <thead><tr><th>Feature</th><th>Option A</th><th>Option B</th></tr></thead>
        <tbody>
          <tr><td>Speed</td><td>Fast</td><td>Slower</td></tr>
          <tr><td>Cost</td><td>Low</td><td>Higher</td></tr>
        </tbody>
      </table>
    </note-table>
    <note-heading level="2">Code example</note-heading>
    <note-code language="bash">
# Example command
echo "Hello, world!"
    </note-code>
    <note-definition term="Key term">Short definition for quick lookup.</note-definition>
  </note-page>
</note-document>
</body>
</html>`,
  },
  {
    id: 'tutorial',
    name: 'Tutorial',
    description: 'A step-by-step tutorial with numbered steps, a diagram placeholder, and a summary callout.',
    category: 'tutorial',
    icon: '🎓',
    filename: 'tutorial.note.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="note-format" content="visual-notes/1">
<title>Tutorial</title>
<style>
  .note-page { font-family: 'Inter', sans-serif; color: #1f2933; padding: 44px; box-sizing: border-box; }
  .note-title { font-size: 36px; font-weight: 700; color: #7c3aed; margin: 0 0 16px; }
  .note-callout--info { background: #f5f3ff; border-color: #7c3aed; }
  pre { background: #1e1b4b; color: #e0e7ff; padding: 14px 16px; border-radius: 10px; font-family: monospace; font-size: 13px; }
</style>
</head>
<body>
<note-document data-title="Tutorial" data-version="1">
  <note-page data-page="1" data-width="900" data-height="1270" data-background="#faf5ff">
    <note-title data-align="center">🎓 Tutorial Title</note-title>
    <note-paragraph data-align="center">A brief introduction to what this tutorial covers.</note-paragraph>
    <note-heading level="2">Steps</note-heading>
    <note-list type="numbered" start="1">
      <note-item><strong>Step 1</strong> — First action to take</note-item>
      <note-item><strong>Step 2</strong> — Second action to take</note-item>
      <note-item><strong>Step 3</strong> — Third action to take</note-item>
    </note-list>
    <note-heading level="3">Example</note-heading>
    <note-code language="text">
# Replace with your example
    </note-code>
    <note-callout type="info" title="Summary">Recap what was learned and suggest next steps.</note-callout>
  </note-page>
</note-document>
</body>
</html>`,
  },
]

export const TEMPLATE_CATEGORIES: { id: NoteTemplate['category']; label: string; icon: string }[] = [
  { id: 'study', label: 'Study', icon: '📚' },
  { id: 'meeting', label: 'Meeting', icon: '🗓️' },
  { id: 'reference', label: 'Reference', icon: '🔖' },
  { id: 'tutorial', label: 'Tutorial', icon: '🎓' },
]
