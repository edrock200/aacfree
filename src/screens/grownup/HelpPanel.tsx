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
          <dt>{t('Edit a button')}</dt><dd>{t('Settings → Boards → Edit (or the ✎ Edit button at the bottom while unlocked). Tap any button to change its word, picture, colour, voice or what it does.')}</dd>
          <dt>{t('Add a word')}</dt><dd>{t('In edit mode, tap an empty square (+). Type the word and a matching picture is suggested. Use “Photo” for real pictures of people, places and favourite things.')}</dd>
          <dt>{t('Move a button')}</dt><dd>{t('In edit mode, tap the button → Move → tap where it should go. The two buttons swap places.')}</dd>
          <dt>{t('Hide a word for now')}</dt><dd>{t('Edit the button → “Hide from the user for now”. It keeps its place. Turn on Babble mode to show everything temporarily.')}</dd>
          <dt>{t('Make a new folder')}</dt><dd>{t('Edit an empty square → “Opens folder” → “New empty folder”. Then tap the folder and add words.')}</dd>
          <dt>{t('Word forms')}</dt><dd>{t('Long-press a word (or tap a word in the message bar) to choose go → went / going / goes. Plurals and “-er/-est” work too.')}</dd>
          <dt>{t('Edit phrases, schedules or About me')}</dt><dd>{t('Boards & words → “Edit phrases”, “Edit schedules” or “Edit About me” takes you there with editing on. Or, while Settings are unlocked, tap the Edit button on that screen. A plain tap on a phrase always speaks it, even when unlocked.')}</dd>
          <dt>{t('Editing unlocked')}</dt><dd>{t('While Settings are unlocked, a bar at the top says “Editing unlocked”. Tap Lock there when you are done. Caleb also locks itself after 5 minutes without settings or editing activity; talking does not keep it unlocked.')}</dd>
          <dt>{t('Stop speaking, volume and speed')}</dt><dd>{t("While a message is being spoken, the Speak button becomes Stop. Tools → My voice lets the person pick Quiet, Normal or Loud, change the speed, or turn on “Show, don't speak” so messages appear in big letters. None of this is locked.")}</dd>
          <dt>{t('Recent sentences and privacy')}</dt><dd>{t('Phrases → Recent: the person can delete a sentence, clear them all, or turn on “Private for now” so nothing new is kept or logged. Insights → Recent sentences sets how long they are kept.')}</dd>
          <dt>{t('Hide a tool')}</dt><dd>{t('Display → Tools shown. Turn off the tools the person does not use, including About me and Get attention.')}</dd>
          <dt>{t('Record a family voice')}</dt><dd>{t('Edit a button or phrase → Record voice. That clip plays instead of the computer voice.')}</dd>
          <dt>{t('Hide or show words quickly')}</dt><dd>{t('In edit mode, tap “Show/Hide”, then tap words to mask or reveal them. “Reveal 5 more” grows the board step by step.')}</dd>
          <dt>{t('Model without skewing data')}</dt><dd>{t('When usage insights or learning are on, a “Model” button appears in the bottom bar. Turn it on while you demonstrate.')}</dd>
          <dt>{t('Fix how a word sounds')}</dt><dd>{t('Voice → Pronunciations. For example, “Siobhan” → “shi-vawn”.')}</dd>
          <dt>{t('Forgot the PIN?')}</dt><dd>{t('On the PIN screen tap “Forgot PIN?”, hold for 10 seconds and type the sentence shown. Only the PIN is removed.')}</dd>
          <dt>{t('Start small')}</dt><dd>{t('Boards & words → “Starter words only” hides all but key words on Home (they keep their places). Reveal more over time by editing a hidden button and unticking “Hide”.')}</dd>
          <dt>{t('Print paper boards')}</dt><dd>{t('Boards & words → Print boards. Keep a laminated copy for the bath, the pool or a flat battery.')}</dd>
          <dt>{t('Share a message as text')}</dt><dd>{t('Tap the share icon in the message bar to send what was typed by text or email, or to copy it.')}</dd>
          <dt>{t("Change language")}</dt><dd>{t("Display → Language. Choose English, Español, Français or Português for the board words, word forms, the keyboard and the voice. Every button stays in its place. You can use a different app language, and you can show a second language on each button.")}</dd>
          <dt>{t("Use eye gaze or a head pointer")}</dt><dd>{t("Access → Eye gaze & head pointer. Use “Dwell” with a mouse, head-mouse or hardware eye tracker, or let Caleb use the front camera. Rest the pointer on a button to select it.")}</dd>
          <dt>{t("Keep two devices in step")}</dt><dd>{t("Backup → Sync between devices. Send makes a passcode-locked file; Receive it on the other device. The newest version of each profile wins.")}</dd>
          <dt>{t("Never lose the boards")}</dt><dd>{t("Backup → Automatic backup saves dated files daily, weekly or monthly (Android: Documents/Caleb) and keeps as many copies as you choose. On Android, “Add a cloud copy” also keeps one in Google Drive, OneDrive or Dropbox. Turn on “Lock backups with a passcode” to encrypt them.")}</dd>
          <dt>{t('Undo a mistake')}</dt><dd>{t('In edit mode press Undo. For bigger mistakes, use Backup → Automatic snapshots.')}</dd>
          <dt>{t('Move to a new device')}</dt><dd>{t('Backup → Save backup file. On the new device, tap “I have a backup” on the first screen, or use Backup → Restore from file.')}</dd>
          <dt>{t('Use a switch')}</dt><dd>{t('Access → Switch scanning. Bluetooth switches that send Space/Enter work. Hold the 🔒 button to leave.')}</dd>
        </dl>
      </Section>
      <Section title={t('About Caleb')}>
        <p>{t('Caleb is a free, open-source AAC app made for autistic people and their families. No ads, no subscriptions, no accounts. Everything stays on this device.')}</p>
        <p className="muted small">
          {t('Pictograms: ARASAAC (arasaac.org). Author: Sergio Palao. Origin: ARASAAC, Government of Aragón (Spain). License: CC BY-NC-SA 4.0.')}{' '}
          {t('Font: Atkinson Hyperlegible, Braille Institute (SIL OFL). App code: GNU AGPL-3.0-or-later. Source code: github.com/edrock200/caleb')}
        </p>
        <p className="muted small">{t('Version {v}', { v: __APP_VERSION__ })}</p>
      </Section>
    </>
  );
}
