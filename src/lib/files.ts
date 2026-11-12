import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToDataURL, downloadBlob } from './util';
import { t } from '../i18n';

/**
 * Save a file for the user. In browsers it downloads; inside the Android app
 * it writes to the app's Documents folder and opens the share sheet so the
 * parent can send it to Drive, email, etc.
 */
export async function saveFile(name: string, blob: Blob): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, name);
    return t('Downloaded {name}', { name });
  }
  // Write in chunks so a large backup (lots of photos) doesn't exhaust memory crossing the bridge.
  const CHUNK = 3 * 1024 * 1024; // bytes; multiple of 3 so each base64 piece stands alone
  const write = async (directory: Directory) => {
    let first = true;
    let uri = '';
    for (let off = 0; off < Math.max(1, blob.size); off += CHUNK) {
      const part = await blobToDataURL(blob.slice(off, off + CHUNK));
      const data = part.slice(part.indexOf(',') + 1);
      if (first) uri = (await Filesystem.writeFile({ path: name, data, directory, recursive: true })).uri;
      else await Filesystem.appendFile({ path: name, data, directory });
      first = false;
    }
    return { uri };
  };
  const res = await write(Directory.Documents).catch(() => write(Directory.Cache));
  try {
    await Share.share({ title: name, files: [res.uri], dialogTitle: t('Save or send backup') });
  } catch { /* user cancelled share sheet */ }
  return t('Saved {name}', { name });
}

/** Open a file picker and resolve with the chosen file. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Android's picker greys out unknown extensions (.obz/.obf/.json often report
    // application/octet-stream), so accept anything there and validate the content.
    input.accept = Capacitor.isNativePlatform() ? '*/*' : accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
