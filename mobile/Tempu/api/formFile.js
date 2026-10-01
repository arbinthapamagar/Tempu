import { Platform } from 'react-native';

// Adds a picked file to a multipart FormData.
//
// React Native's fetch understands a { uri, name, type } object and streams the
// file from disk. A browser does not: it stringifies the object to
// "[object Object]", so the server got no file at all ("Document file is
// required"). On web the picker hands back a blob:/data: URL, so read it into a
// real Blob first.
export async function appendFile(form, field, { uri, name, type }) {
  if (Platform.OS !== 'web') {
    form.append(field, { uri, name, type });
    return;
  }
  const blob = await (await fetch(uri)).blob();
  form.append(field, blob, name);
}
