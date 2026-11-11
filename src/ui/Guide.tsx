import { STATUS_LABELS } from '../job/types';
import { useSession } from '../store/session';
import { IconBack } from './icons';
import { STATUS_ICON } from './ItemCard';

export function Guide() {
  const { go, data } = useSession();
  return (
    <main className="page page-narrow guide">
      <button className="btn" onClick={() => go(data ? 'workspace' : 'home')}>
        <IconBack size={18} /> Back
      </button>
      <h1 style={{ marginTop: 16 }}>User guide</h1>

      <h2>1. Your work is not stored on this website</h2>
      <div className="notice">
        <div>
          For data security, the checklist only lives in this browser tab while you work. <b>Refreshing the page (F5), closing the tab or closing the browser erases
          everything you have not saved.</b> The browser will ask before leaving, but do not rely on it.
          <br />
          <b>Press Save often.</b> The top bar shows when you last saved. It turns amber after 10 minutes and red after 20 minutes of unsaved work.
        </div>
      </div>

      <h2>2. Doing a checklist (detailer)</h2>
      <ol>
        <li>On the home page, choose the builder. Enter the Job No and address, the house type, and answer the job questions (step-down, raked walls, stairs…).</li>
        <li>A double-storey house has two checklists: one for the Ground Floor and one for the First Floor. Start the second one with “Copy from a .chck file”.</li>
        <li>Work through the 9 stages on the left, in order. Each item has status buttons, boxes for values, and a note.</li>
        <li>The red box on an item is the <b>builder rule</b>. Values marked “Suggested” are only suggestions — enter the sizes designed for this job and press “Use this” only if they match.</li>
        <li>“Common mistakes from client feedback” shows real problems the client found on past jobs.</li>
        <li>Press <b>Save</b>. The first time, choose where to save the <b>.chck</b> file. After that, Save updates the same file (Chrome and Edge). In other browsers, each Save downloads a new copy.</li>
      </ol>

      <h2>3. Statuses</h2>
      <ul>
        {(['done', 'na', 'confirm', 'blocked', 'not-started'] as const).map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <li key={s}>
              <Icon size={16} /> <b>{STATUS_LABELS[s]}</b> —{' '}
              {
                {
                  done: 'checked and finished.',
                  na: 'does not apply to this job.',
                  confirm: 'information is missing or unclear — write in the note what must be confirmed and with whom. The app never applies unclear values by itself.',
                  blocked: 'cannot continue until something is fixed or answered.',
                  'not-started': 'not checked yet.',
                }[s]
              }
            </li>
          );
        })}
      </ul>

      <h2>4. Which file to use at each stage</h2>
      <h3>Stage 1 — Work in progress (detailer)</h3>
      <p>Save the <b>.chck</b> file to keep your progress. Open it again from the home page to continue editing.</p>
      <h3 style={{ marginTop: 14 }}>Stage 2 — Review (2nd / 3rd checker)</h3>
      <ul>
        <li>The detailer opens <b>Summary</b> and presses <b>Send for review</b>. This saves a new “Review” .chck file to give to the checker.</li>
        <li>The checker opens that file and chooses “I am the checker”. The detailer’s inputs are locked. The checker adds <b>flags</b> (must be fixed), <b>comments</b> and <b>photos</b>, then saves.</li>
        <li>The checker can download a <b>Draft PDF</b> at any time to review offline or print and mark up by hand.</li>
        <li>The detailer opens the review file, chooses “I am the detailer”, fixes each flag, writes a reply and saves it back to the checker.</li>
        <li>When no flags are open, the checker presses <b>Sign off</b>.</li>
      </ul>
      <h3 style={{ marginTop: 14 }}>Stage 3 — Final report (client)</h3>
      <p>
        After sign-off, <b>Final PDF</b> on the Summary page makes the read-only report for the client. It is only available when every item is Done or N/A, no flags
        are open and the required checks are signed off.
      </p>

      <h2>5. If something looks wrong</h2>
      <ul>
        <li>“This file was changed outside the app” — the .chck file was edited by another program. Check the inputs carefully before continuing.</li>
        <li>“Checklist rules were updated” — the rules changed since the file was saved. New items appear as Not started.</li>
      </ul>
    </main>
  );
}
