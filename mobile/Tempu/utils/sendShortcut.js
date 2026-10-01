// Ctrl+Enter (⌘+Enter on a Mac) sends from a message box, like most chat apps.
// Only a hardware keyboard reports the modifier, so this matters on the web
// build and on phones with a keyboard attached; touch keyboards are unaffected.
//
//   <TextInput onKeyPress={sendShortcut(sendReply)} … />
export function sendShortcut(onSend) {
  return (e) => {
    const ne = e?.nativeEvent || {};
    const key = ne.key || e?.key;
    if (key !== 'Enter') return;
    if (!(ne.ctrlKey || ne.metaKey || e?.ctrlKey || e?.metaKey)) return;
    e.preventDefault?.(); // keep the newline out of a multiline box
    onSend();
  };
}
