import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { blobToDataURL, downloadBlob } from './util';

/**
 * Save a file for the user. In browsers it downloads; inside the Android app
 * it writes to the app's Documents folder and opens the share sheet so the
 * parent can send it to Drive, email, etc.
 */
export async function saveFile(name: string, blob: Blob): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, name);
    return 'Downloaded ' + name;
  }
  const dataUrl = await blobToDataURL(blob);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const res = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Documents, recursive: true })
    .catch(() => Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache, recursive: true }));
  try {
    await Share.share({ title: name, files: [res.uri], dialogTitle: 'Save or send backup' });
  } catch { /* user cancelled share sheet */ }
  return 'Saved ' + name;
}

/** Open a file picker and resolve with the chosen file. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
