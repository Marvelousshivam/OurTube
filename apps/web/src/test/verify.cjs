// Test LRC Parser standalone
function parseLrc(lrcText) {
  const lines = [];
  const rawLines = lrcText.split('\n');
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length === 0) continue;

    const text = trimmed.replace(timeRegex, '').trim();

    for (const match of matches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalSeconds = minutes * 60 + seconds + fraction;

      lines.push({
        time: totalSeconds,
        text: text || '♪'
      });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

const sampleLrc = `
[00:12.50] Look into my eyes
[00:15.80] You will see
[00:18.25] What you mean to me
[00:22.00] Search your heart
`;

const parsed = parseLrc(sampleLrc);
console.log('--- LRC Parser Verification ---');
console.log(`Parsed ${parsed.length} lines`);
if (parsed.length !== 4) {
  throw new Error(`Expected 4 lines, got ${parsed.length}`);
}
if (Math.abs(parsed[0].time - 12.5) > 0.01 || parsed[0].text !== 'Look into my eyes') {
  throw new Error(`Line 1 incorrect: time=${parsed[0].time}, text="${parsed[0].text}"`);
}
console.log('✓ LRC Parser verified successfully!');

// Test 2: Material Color Utilities Theme generation
const mcu = require('@material/material-color-utilities');
const argb = mcu.argbFromHex('#1E88E5');
const theme = mcu.themeFromSourceColor(argb);
console.log('--- Material 3 Theming Verification ---');
console.log('Primary Dark Hex:', mcu.hexFromArgb(theme.schemes.dark.primary));
console.log('Surface Container Dark Hex:', mcu.hexFromArgb(theme.schemes.dark.surfaceContainer));
if (!theme.schemes.dark.primary) {
  throw new Error('Theme primary color missing');
}
console.log('✓ Material Color Utilities theme generation verified successfully!');
