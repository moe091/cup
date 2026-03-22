export type ChatTextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'unicodeEmoji'; value: string }
  | { kind: 'customEmojiToken'; value: string; name: string; id: string };

const customEmojiTokenRegex = /<:([a-zA-Z0-9_-]{1,64}):([a-zA-Z0-9_-]{1,128})>/g;
const keycapRegex = /[#*0-9]\uFE0F?\u20E3/u;
const regionalIndicatorRegex = /\p{Regional_Indicator}/u;
const extendedPictographicRegex = /\p{Extended_Pictographic}/u;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function isUnicodeEmojiGrapheme(grapheme: string): boolean {
  return (
    keycapRegex.test(grapheme) ||
    regionalIndicatorRegex.test(grapheme) ||
    extendedPictographicRegex.test(grapheme)
  );
}

function segmentTextGraphemes(text: string): string[] {
  if (!text) {
    return [];
  }

  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), (item) => item.segment);
  }

  return Array.from(text);
}

function splitTextByUnicodeEmoji(text: string): ChatTextSegment[] {
  const graphemes = segmentTextGraphemes(text);
  if (graphemes.length === 0) {
    return [];
  }

  const result: ChatTextSegment[] = [];
  let textBuffer = '';

  const flushTextBuffer = () => {
    if (!textBuffer) {
      return;
    }

    result.push({ kind: 'text', value: textBuffer });
    textBuffer = '';
  };

  for (const grapheme of graphemes) {
    if (isUnicodeEmojiGrapheme(grapheme)) {
      flushTextBuffer();
      result.push({ kind: 'unicodeEmoji', value: grapheme });
    } else {
      textBuffer += grapheme;
    }
  }

  flushTextBuffer();
  return result;
}

export function parseChatTextSegments(messageBody: string): ChatTextSegment[] {
  if (!messageBody) {
    return [];
  }

  const segments: ChatTextSegment[] = [];
  let currentIndex = 0;
  customEmojiTokenRegex.lastIndex = 0;
  let match = customEmojiTokenRegex.exec(messageBody);

  while (match) {
    const [token, tokenName, tokenId] = match;
    const matchIndex = match.index;

    if (matchIndex > currentIndex) {
      const precedingText = messageBody.slice(currentIndex, matchIndex);
      segments.push(...splitTextByUnicodeEmoji(precedingText));
    }

    segments.push({
      kind: 'customEmojiToken',
      value: token,
      name: tokenName,
      id: tokenId,
    });

    currentIndex = matchIndex + token.length;
    match = customEmojiTokenRegex.exec(messageBody);
  }

  if (currentIndex < messageBody.length) {
    const trailingText = messageBody.slice(currentIndex);
    segments.push(...splitTextByUnicodeEmoji(trailingText));
  }

  return segments;
}

export function extractCustomEmojiIds(messageBody: string): string[] {
  const segments = parseChatTextSegments(messageBody);
  const ids = new Set<string>();

  for (const segment of segments) {
    if (segment.kind === 'customEmojiToken') {
      ids.add(segment.id);
    }
  }

  return Array.from(ids);
}
