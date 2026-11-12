import { Section } from './controls';
import { t } from '../../i18n';

export function HelpPanel() {
  return (
    <>
      <Section title={t('Getting started')}>
        <ol className="help-list">
          <li><b>{t('Model, model, model.')}</b> {t("Use the app yourself while you talk: tap “want” and “more” as you say them. People learn AAC the way babies learn speech, by seeing it used for months before they're expected to use it. Use Find word (🔍) to show where words live.")}</li>
          <li><b>{t("Don't test, don't require.")}</b> {t('Avoid “show me ___” drills or making the person “use their words” to get things. Offer the device, wait, and respond to any attempt.')}</li>
          <li><b>{t('Always available.')}</b> {t('Keep the device within reach all day, at meals, in the car and outside. It is their voice, so never take it away as a punishment.')}</li>
          <li><b>{t('Babbling is learning.')}</b> {t('Tapping lots of buttons, repeating words or “stimming” on the device is exploration. Respond to it.')}</li>
          <li><b>{t('Honour “no” and “stop”.')}</b> {t('When the person uses protest words, respond to them. They are in the quick bar on every board.')}</li>
          <li><b>{t("Grow, don't rearrange.")}</b> {t('Start with many words hidden and reveal them over time. Moving words breaks muscle memory.')}</li>
          <li><b>{t('Scripts are language.')}</b> {t('For gestalt language processors, save meaningful phrases and scripts in')} <b>{t('Phrases')}</b>.</li>
        </ol>
      </Section>
      <Section title={t('How to…')}>
        <dl className="howto">
          <dt>{t('Edit a button')}</dt><dd>Grown-ups → Boards → Edit (or the ✎ Edit button at the bottom while unlocked). Tap any button to change its word, picture, colour, voice or what it does.</dd>
          <dt>{t('Add a word')}</dt><dd>In edit mode, tap an empty square (+). Type the word and a matching picture is suggested. Use “Photo” for real pictures of people, places and favourite things.</dd>
          <dt>{t('Move a button')}</dt><dd>{t('In edit mode, tap the button → Move → tap where it should go. The two buttons swap places.')}</dd>
          <dt>{t('Hide a word for now')}</dt><dd>{t('Edit the button → “Hide from the user for now”. It keeps its place. Turn on Babble mode to show everything temporarily.')}</dd>
          <dt>{t('Make a new folder')}</dt><dd>{t('Edit an empty square → “Opens folder” → “New empty folder”. Then tap the folder and add words.')}</dd>
          <dt>{t('Word forms')}</dt><dd>Long-press a word (or tap a word in the message bar) to choose go → went / going / goes. Plurals and “-er/-est” work too.</dd>
          <dt>{t('Record a family voice')}</dt><dd>{t('Edit a button or phrase → Record voice. That clip plays instead of the computer voice.')}</dd>
          <dt>{t('Hide or show words quickly')}</dt><dd>{t('In edit mode, tap “Show/Hide”, then tap words to mask or reveal them. “Reveal 5 more” grows the board step by step.')}</dd>
          <dt>{t('Model without skewing data')}</dt><dd>{t('When usage insights or learning are on, a “Model” button appears in the bottom bar. Turn it on while you demonstrate.')}</dd>
          <dt>{t('Fix how a word sounds')}</dt><dd>{t('Voice → Pronunciations. For example, “Siobhan” → “shi-vawn”.')}</dd>
          <dt>{t('Forgot the PIN?')}</dt><dd>{t('On the PIN screen tap “Forgot PIN?”, hold for 10 seconds and type the sentence shown. Only the PIN is removed.')}</dd>
          <dt>{t('Start small')}</dt><dd>Boards &amp; words → “Starter words only” hides all but key words on Home (they keep their places). Reveal more over time by editing a hidden button and unticking “Hide”.</dd>
          <dt>{t('Print paper boards')}</dt><dd>{t('Boards & words → Print boards. Keep a laminated copy for the bath, the pool or a flat battery.')}</dd>
          <dt>{t('Share a message as text')}</dt><dd>{t('Tap the share icon in the message bar to send what was typed by text or email, or to copy it.')}</dd>
          <dt>{t('Undo a mistake')}</dt><dd>{t('In edit mode press Undo. For bigger mistakes, use Backup → Automatic snapshots.')}</dd>
          <dt>{t('Move to a new device')}</dt><dd>{t('Backup → Save backup file, then on the new device: Backup → Restore from file.')}</dd>
          <dt>{t('Use a switch')}</dt><dd>{t('Access → Switch scanning. Bluetooth switches that send Space/Enter work. Hold the 🔒 button to leave.')}</dd>
        </dl>
      </Section>
      <Section title={t('About Caleb')}>
        <p>{t('Caleb is a free, open-source AAC app made for autistic people and their families. No ads, no subscriptions, no accounts. Everything stays on this device.')}</p>
        <p className="muted small">
          Pictograms: ARASAAC (arasaac.org). Author: Sergio Palao. Origin: ARASAAC, Government of Aragón (Spain). License: CC BY-NC-SA 4.0.
          Font: Atkinson Hyperlegible, Braille Institute (SIL OFL). App code: GNU AGPL-3.0-or-later. Source code: github.com/edrock200/caleb
        </p>
        <p className="muted small">Version {__APP_VERSION__}</p>
      </Section>
    </>
  );
}
