import { Section } from './controls';

export function HelpPanel() {
  return (
    <>
      <Section title="Getting started">
        <ol className="help-list">
          <li><b>Model, model, model.</b> Use the app yourself while you talk: tap “want” and “more” as you say them. People learn AAC the way babies learn speech, by seeing it used for months before they're expected to use it. Use <b>Find word</b> (🔍) to show where words live.</li>
          <li><b>Don't test, don't require.</b> Avoid “show me ___” drills or making the person “use their words” to get things. Offer the device, wait, and respond to any attempt.</li>
          <li><b>Always available.</b> Keep the device within reach all day, at meals, in the car and outside. It is their voice, so never take it away as a punishment.</li>
          <li><b>Babbling is learning.</b> Tapping lots of buttons, repeating words or “stimming” on the device is exploration. Respond to it.</li>
          <li><b>Honour “no” and “stop”.</b> When the person uses protest words, respond to them. They are in the quick bar on every board.</li>
          <li><b>Grow, don't rearrange.</b> Start with many words hidden and reveal them over time. Moving words breaks muscle memory.</li>
          <li><b>Scripts are language.</b> For gestalt language processors, save meaningful phrases and scripts in <b>Phrases</b>.</li>
        </ol>
      </Section>
      <Section title="How to…">
        <dl className="howto">
          <dt>Edit a button</dt><dd>Grown-ups → Boards → Edit (or the ✎ Edit button at the bottom while unlocked). Tap any button to change its word, picture, colour, voice or what it does.</dd>
          <dt>Add a word</dt><dd>In edit mode, tap an empty square (+). Type the word and a matching picture is suggested. Use “Photo” for real pictures of people, places and favourite things.</dd>
          <dt>Move a button</dt><dd>In edit mode, tap the button → Move → tap where it should go. The two buttons swap places.</dd>
          <dt>Hide a word for now</dt><dd>Edit the button → “Hide from the user for now”. It keeps its place. Turn on Babble mode to show everything temporarily.</dd>
          <dt>Make a new folder</dt><dd>Edit an empty square → “Opens folder” → “New empty folder”. Then tap the folder and add words.</dd>
          <dt>Word forms</dt><dd>Long-press a word (or tap a word in the message bar) to choose go → went / going / goes. Plurals and “-er/-est” work too.</dd>
          <dt>Record a family voice</dt><dd>Edit a button or phrase → Record voice. That clip plays instead of the computer voice.</dd>
          <dt>Undo a mistake</dt><dd>In edit mode press Undo. For bigger mistakes, use Backup → Automatic snapshots.</dd>
          <dt>Move to a new device</dt><dd>Backup → Save backup file, then on the new device: Backup → Restore from file.</dd>
          <dt>Use a switch</dt><dd>Access → Switch scanning. Bluetooth switches that send Space/Enter work. Hold the 🔒 button to leave.</dd>
        </dl>
      </Section>
      <Section title="About Caleb">
        <p>Caleb is a free, open-source AAC app made for autistic people and their families. No ads, no subscriptions, no accounts. Everything stays on this device.</p>
        <p className="muted small">
          Pictograms: ARASAAC (arasaac.org). Author: Sergio Palao. Origin: ARASAAC, Government of Aragón (Spain). License: CC BY-NC-SA 4.0.
          Font: Atkinson Hyperlegible, Braille Institute (SIL OFL). App code: MIT License.
        </p>
        <p className="muted small">Version {__APP_VERSION__}</p>
      </Section>
    </>
  );
}
