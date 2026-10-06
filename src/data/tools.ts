/**
 * Tool registry — the single source of truth for every tool page.
 * Routing, the sitemap, navigation, tool cards, related links and structured
 * data are all derived from this list.
 */

export type ToolId =
  | 'word-counter'
  | 'character-counter'
  | 'case-converter'
  | 'text-cleaner'
  | 'remove-duplicate-lines'
  | 'sort-lines'
  | 'find-and-replace'
  | 'text-diff'
  | 'url-slug-generator'
  | 'lorem-ipsum-generator'
  | 'text-repeater'
  | 'ai-text-rewriter';

export type ToolGroup = 'popular' | 'utility' | 'ai';

export interface Faq {
  q: string;
  a: string;
}

export interface Tool {
  slug: ToolId;
  group: ToolGroup;
  /** Short name for cards and navigation. */
  name: string;
  /** One-line card description. */
  blurb: string;
  h1: string;
  /** <title>, ≤ 60 characters. */
  title: string;
  /** Meta description, ≤ 155 characters. */
  description: string;
  /** Sentence under the H1. */
  intro: string;
  /** Text never leaves the browser. False only for AI tools. */
  local: boolean;
  howTo: string[];
  faqs: Faq[];
  related: ToolId[];
}

const LOCAL_FAQ: Faq = {
  q: 'Is my text uploaded anywhere?',
  a: 'No. This tool runs entirely in your browser. Your text is never sent to our server or stored, and it disappears when you close the page.',
};

export const tools: Tool[] = [
  {
    slug: 'word-counter',
    group: 'popular',
    name: 'Word Counter',
    blurb: 'Words, characters, sentences and reading time, live.',
    h1: 'Word counter',
    title: 'Word Counter — Count Words & Characters Online | Texty',
    description:
      'Count words, characters, sentences and paragraphs as you type. See reading time, speaking time and your most used words. Free, private, no sign-up.',
    intro: 'Paste or type your text. The counts update as you write, and nothing leaves your browser.',
    local: true,
    howTo: [
      'Paste your text into the box, or start typing.',
      'Read the word, character, sentence and paragraph counts below the box. They update instantly.',
      'Check reading and speaking time to see how long your text takes to get through.',
      'Open “Most used words” to spot repetition. Hide common words like “the” to see the ones that matter.',
    ],
    faqs: [
      {
        q: 'How does Texty count words?',
        a: 'A word is any run of letters or numbers. Contractions such as “don’t”, hyphenated words such as “well-known”, email addresses and decimal numbers each count as one word. Punctuation on its own is not a word. In Chinese and Japanese, each character counts as a word, which is the usual convention.',
      },
      {
        q: 'How is reading time calculated?',
        a: 'Reading time assumes 238 words per minute, the average silent reading speed for adults reading non-fiction. Speaking time assumes 150 words per minute, a comfortable pace for a presentation or speech.',
      },
      {
        q: 'Do emoji and accented letters count as one character?',
        a: 'Yes. Texty counts characters the way you see them, so “é” and a thumbs-up emoji with a skin tone each count as one character, even though computers store them as several pieces.',
      },
      {
        q: 'Why might my count differ from Microsoft Word or Google Docs?',
        a: 'Every tool has slightly different rules for things like hyphens, numbers, URLs and em dashes. Differences are usually a few words in a long document. If you need to meet an exact limit, check with the tool your teacher, editor or platform uses.',
      },
      LOCAL_FAQ,
    ],
    related: ['character-counter', 'text-cleaner', 'case-converter', 'ai-text-rewriter'],
  },
  {
    slug: 'character-counter',
    group: 'popular',
    name: 'Character Counter',
    blurb: 'Count characters and check SMS and post limits.',
    h1: 'Character counter',
    title: 'Character Counter — Count Characters With & Without Spaces | Texty',
    description:
      'Count characters with and without spaces, plus letters, numbers and punctuation. Check SMS segments and common limits for posts and meta descriptions.',
    intro: 'See exactly how many characters you have, and how your text fits common limits.',
    local: true,
    howTo: [
      'Paste or type your text into the box.',
      'Read the character count with and without spaces, plus letters, numbers and punctuation.',
      'Check the limits list to see whether your text fits an SMS, a post or a meta description.',
      'Trim your text until the limits you care about show that it fits.',
    ],
    faqs: [
      {
        q: 'Are spaces counted as characters?',
        a: 'In the main count, yes, along with line breaks. Most platforms count spaces too. Texty also shows the count without spaces, which some forms and assignments ask for.',
      },
      {
        q: 'How many characters fit in one SMS?',
        a: 'A standard text message holds 160 characters from the basic GSM alphabet. If your message contains an emoji or a character outside that alphabet, the whole message switches to Unicode and holds 70. Longer messages are split into parts of 153 (or 67 for Unicode) characters. A few symbols, such as € and [, count as two.',
      },
      {
        q: 'Where do the post and meta description limits come from?',
        a: 'They are the published limits for each platform, or widely used guidelines in the case of search result titles and descriptions, which are cut by pixel width rather than a fixed count. Platforms change their limits from time to time, so we show the date we last checked them.',
      },
      LOCAL_FAQ,
    ],
    related: ['word-counter', 'text-cleaner', 'url-slug-generator', 'find-and-replace'],
  },
  {
    slug: 'case-converter',
    group: 'popular',
    name: 'Case Converter',
    blurb: 'UPPERCASE, lowercase, Title Case, camelCase and more.',
    h1: 'Case converter',
    title: 'Case Converter — Uppercase, Lowercase, Title Case & More | Texty',
    description:
      'Convert text to uppercase, lowercase, sentence case or title case, or to camelCase, snake_case and kebab-case for code. Instant, free and private.',
    intro: 'Pick a case and your text changes instantly. Copy it or download it as a text file.',
    local: true,
    howTo: [
      'Paste or type your text into the box.',
      'Choose a case: UPPERCASE, lowercase, Sentence case, Title Case, or one of the programming cases.',
      'The converted text appears straight away. Switch cases as often as you like; your original stays as it was.',
      'Copy the result or download it as a .txt file.',
    ],
    faqs: [
      {
        q: 'What is the difference between sentence case and title case?',
        a: 'Sentence case capitalises only the first word of each sentence (and the word “I”), like normal writing. Title Case capitalises the main words, as in a book or headline title, and leaves short words such as “of”, “and” and “the” in lowercase unless they come first or last.',
      },
      {
        q: 'Will title case change acronyms like NASA?',
        a: 'No. Words that are already all capitals, such as NASA or HTML, are kept as they are. Names with unusual capitals, such as iPhone, may need a quick manual fix.',
      },
      {
        q: 'How do camelCase, snake_case and kebab-case work here?',
        a: 'Texty splits your text into words, including words joined in existing camelCase, then joins them with the chosen style. Each line is converted separately, so you can paste a list of names and convert them all at once.',
      },
      LOCAL_FAQ,
    ],
    related: ['text-cleaner', 'url-slug-generator', 'find-and-replace', 'word-counter'],
  },
  {
    slug: 'text-cleaner',
    group: 'popular',
    name: 'Text Cleaner',
    blurb: 'Fix extra spaces, blank lines and copy-paste junk.',
    h1: 'Text cleaner',
    title: 'Text Cleaner — Remove Extra Spaces & Blank Lines | Texty',
    description:
      'Clean messy text: remove extra spaces, blank lines, hidden characters and copy-paste formatting junk. Choose exactly what to fix and preview it first.',
    intro: 'Choose what to fix and preview the result before you use it. Nothing changes that you did not switch on.',
    local: true,
    howTo: [
      'Paste the messy text into the box.',
      'Switch on the fixes you want, such as removing extra spaces or blank lines.',
      'Check the preview and the summary of what changed.',
      'Copy the cleaned text, or select “Use cleaned text” to replace what is in the box.',
    ],
    faqs: [
      {
        q: 'What are “hidden characters”?',
        a: 'Text copied from PDFs, websites, chat apps and word processors often carries invisible characters: zero-width spaces, non-breaking spaces, soft hyphens and direction marks. They can break searches, spreadsheets and code. The hidden characters option removes them, and turns odd spaces into normal ones.',
      },
      {
        q: 'Will it change my quotes and apostrophes?',
        a: 'Only if you turn on “Straighten quotes”, which changes curly quotes to straight ones. It is off by default because curly quotes are usually what you want in writing.',
      },
      {
        q: 'Can I keep my indentation?',
        a: 'Yes. Turn off “Trim each line” and indentation at the start of lines is left alone. Extra spaces are only collapsed between words.',
      },
      LOCAL_FAQ,
    ],
    related: ['remove-duplicate-lines', 'find-and-replace', 'case-converter', 'word-counter'],
  },
  {
    slug: 'remove-duplicate-lines',
    group: 'utility',
    name: 'Remove Duplicate Lines',
    blurb: 'Keep one copy of each line in a list.',
    h1: 'Remove duplicate lines',
    title: 'Remove Duplicate Lines — Delete Duplicates From a List | Texty',
    description:
      'Remove duplicate lines from any list. Keep the first or last copy, ignore case or spacing, and keep your original order. Fast, free and private.',
    intro: 'Paste a list with one item per line. Duplicates are removed as you type.',
    local: true,
    howTo: [
      'Paste your list into the box, one item per line.',
      'Choose whether to keep the first or last copy of each duplicate.',
      'Decide whether “Apple” and “apple” count as the same line, and whether surrounding spaces matter.',
      'Check the before and after line counts, then copy or download the result.',
    ],
    faqs: [
      {
        q: 'Does it keep my original order?',
        a: 'Yes, by default. Each line stays where it first appeared (or last appeared, if you choose to keep the last copy). Turn off “Keep original order” to sort the result alphabetically instead.',
      },
      {
        q: 'What does “Ignore surrounding spaces” do?',
        a: 'It treats “apple” and “ apple ” as the same line, and trims the spaces from the lines it keeps. This catches duplicates that differ only by stray spaces from copying and pasting.',
      },
      {
        q: 'How long can my list be?',
        a: 'Hundreds of thousands of lines work comfortably in a modern browser. Very long lists may take a moment, and the page tells you when your text is unusually large.',
      },
      LOCAL_FAQ,
    ],
    related: ['sort-lines', 'text-cleaner', 'find-and-replace', 'text-diff'],
  },
  {
    slug: 'sort-lines',
    group: 'utility',
    name: 'Sort Lines',
    blurb: 'Alphabetical, numeric, by length, reversed or shuffled.',
    h1: 'Sort lines',
    title: 'Sort Lines — Sort Text Alphabetically or by Number | Texty',
    description:
      'Sort lines of text A to Z, Z to A, by number, by length, in reverse, or shuffle them. Handles numbers naturally, so item 2 comes before item 10.',
    intro: 'Paste a list with one item per line and choose how to sort it.',
    local: true,
    howTo: [
      'Paste your lines into the box.',
      'Choose a sort: alphabetical, numeric, by length, reverse order or shuffle.',
      'Choose what happens to blank lines: remove them, move them to the end, or sort them with everything else.',
      'Copy or download the sorted list.',
    ],
    faqs: [
      {
        q: 'Why does “item 2” come before “item 10”?',
        a: 'Texty sorts naturally, comparing numbers inside text by their value. A plain character-by-character sort would put “item 10” first because “1” comes before “2”.',
      },
      {
        q: 'How does numeric sorting handle lines without numbers?',
        a: 'Lines are sorted by the first number they contain, including negatives, decimals and numbers with thousands separators. Lines without a number go to the end, in their original order.',
      },
      {
        q: 'Is the shuffle truly random?',
        a: 'Yes. Shuffle uses your browser’s cryptographic random number generator, so every order is equally likely. Select “Shuffle again” for a new order.',
      },
      LOCAL_FAQ,
    ],
    related: ['remove-duplicate-lines', 'text-cleaner', 'case-converter', 'text-diff'],
  },
  {
    slug: 'find-and-replace',
    group: 'utility',
    name: 'Find & Replace',
    blurb: 'Search and replace text, with optional regex.',
    h1: 'Find and replace',
    title: 'Find and Replace Text Online — With Regex Support | Texty',
    description:
      'Find and replace text online. Match case or whole words, replace the first match or all of them, and use regular expressions when you need them.',
    intro: 'Type what to find and what to replace it with. You will see how many matches there are before you replace anything.',
    local: true,
    howTo: [
      'Paste your text into the box.',
      'Type the text to find and what to replace it with. The match count updates as you type.',
      'Turn on “Match case” or “Whole words only” to narrow the search.',
      'Select “Replace all” or “Replace first”, then copy or download the result.',
    ],
    faqs: [
      {
        q: 'What is regex mode?',
        a: 'Regex mode treats your search as a regular expression, a pattern language for matching text. For example, \\d+ matches any number. In the replacement you can use $1, $2 and so on to insert captured groups, and \\n for a new line. Leave it off to search for your text exactly as typed.',
      },
      {
        q: 'What happens if my regular expression has a mistake?',
        a: 'Texty explains what looks wrong, such as an unclosed bracket, and does not change your text. Patterns that would take too long to run are stopped automatically, so the page never freezes.',
      },
      {
        q: 'Can I undo a replacement?',
        a: 'Your original text stays in the box. The result appears separately, so you can adjust the search and try again without losing anything.',
      },
      LOCAL_FAQ,
    ],
    related: ['text-cleaner', 'case-converter', 'remove-duplicate-lines', 'text-diff'],
  },
  {
    slug: 'text-diff',
    group: 'utility',
    name: 'Text Diff',
    blurb: 'Compare two texts and see what changed.',
    h1: 'Compare text',
    title: 'Text Compare — Find the Difference Between Two Texts | Texty',
    description:
      'Compare two versions of a text and see every line added, removed or changed, with the changed words highlighted. Works privately in your browser.',
    intro: 'Paste the original on one side and the new version on the other, then compare.',
    local: true,
    howTo: [
      'Paste the original text into “Original”.',
      'Paste the new version into “Changed”.',
      'Select “Compare”. Added, removed and changed lines are marked with +, − and ~, and changed words are highlighted.',
      'Use the options to ignore differences in spacing or capital letters, then copy the comparison if you need it.',
    ],
    faqs: [
      {
        q: 'How are changes shown?',
        a: 'Lines only in the changed text are marked with + and shown in green. Lines only in the original are marked with − and shown in red. Lines that were edited are marked with ~, with the removed words struck through and the added words underlined, so the difference is clear without relying on colour.',
      },
      {
        q: 'Can it ignore whitespace or capitalisation?',
        a: 'Yes. Turn on “Ignore spacing” to treat runs of spaces and tabs as the same, and “Ignore case” to treat capital and small letters as the same.',
      },
      {
        q: 'How large can the texts be?',
        a: 'Up to 50,000 lines on each side. If two very large texts are almost completely different, Texty shows them as removed and added rather than spending a long time finding small matches.',
      },
      LOCAL_FAQ,
    ],
    related: ['find-and-replace', 'remove-duplicate-lines', 'text-cleaner', 'word-counter'],
  },
  {
    slug: 'url-slug-generator',
    group: 'utility',
    name: 'URL Slug Generator',
    blurb: 'Turn titles into clean, SEO-friendly URLs.',
    h1: 'URL slug generator',
    title: 'URL Slug Generator — Turn Titles Into SEO-Friendly URLs | Texty',
    description:
      'Turn any title into a clean URL slug. Removes punctuation, converts accents and handles any language. One slug per line, with - or _ separators.',
    intro: 'Type a title and get a clean URL slug. Paste several titles, one per line, to make several slugs at once.',
    local: true,
    howTo: [
      'Type or paste a title. For several slugs, put one title on each line.',
      'Your slug appears instantly: lowercase, with punctuation removed and spaces turned into hyphens.',
      'Switch to underscores, keep capitals, limit the length, or keep only plain A–Z letters if you need to.',
      'Copy the slug.',
    ],
    faqs: [
      {
        q: 'What is a URL slug?',
        a: 'A slug is the readable part at the end of a web address, such as “how-to-start-a-small-business” in example.com/blog/how-to-start-a-small-business. Clear slugs help people and search engines understand what a page is about.',
      },
      {
        q: 'How are accented and non-English letters handled?',
        a: 'Accents are removed, so “crème brûlée” becomes “creme-brulee”, and letters such as ß and æ become “ss” and “ae”. Other scripts, like Cyrillic or Chinese, are kept, because modern browsers and search engines support them. Turn on “Plain A–Z only” if your system needs ASCII.',
      },
      {
        q: 'Should I use hyphens or underscores?',
        a: 'Hyphens are the usual choice for web pages, and Google recommends them as word separators. Underscores are common in file names and some programming contexts.',
      },
      LOCAL_FAQ,
    ],
    related: ['case-converter', 'character-counter', 'text-cleaner', 'find-and-replace'],
  },
  {
    slug: 'lorem-ipsum-generator',
    group: 'utility',
    name: 'Lorem Ipsum Generator',
    blurb: 'Placeholder words, sentences or paragraphs.',
    h1: 'Lorem ipsum generator',
    title: 'Lorem Ipsum Generator — Placeholder Text | Texty',
    description:
      'Generate lorem ipsum placeholder text by words, sentences or paragraphs. Start with “Lorem ipsum dolor sit amet” and get HTML paragraphs if you like.',
    intro: 'Choose how much placeholder text you need and copy it.',
    local: true,
    howTo: [
      'Choose words, sentences or paragraphs.',
      'Set how many you need.',
      'Choose whether to start with the classic “Lorem ipsum dolor sit amet” and whether to wrap paragraphs in HTML <p> tags.',
      'Select “Generate”, then copy or download the text.',
    ],
    faqs: [
      {
        q: 'What is lorem ipsum?',
        a: 'Lorem ipsum is scrambled Latin used as placeholder text in design and publishing since the 1500s. It looks like real text but does not distract readers with meaning, so people focus on the layout.',
      },
      {
        q: 'Is it the same every time?',
        a: 'No. Texty builds new sentences from a classic lorem ipsum vocabulary each time you generate, so you can fill several areas without obvious repetition.',
      },
      {
        q: 'How much can I generate?',
        a: 'Up to 10,000 words, 1,000 sentences or 200 paragraphs at a time.',
      },
      LOCAL_FAQ,
    ],
    related: ['text-repeater', 'word-counter', 'character-counter', 'case-converter'],
  },
  {
    slug: 'text-repeater',
    group: 'utility',
    name: 'Text Repeater',
    blurb: 'Repeat text any number of times.',
    h1: 'Text repeater',
    title: 'Text Repeater — Repeat Text Multiple Times | Texty',
    description:
      'Repeat any text or emoji as many times as you need, separated by new lines, spaces, commas or your own separator. See the output size before you generate.',
    intro: 'Type your text, choose how many times to repeat it, and copy the result.',
    local: true,
    howTo: [
      'Type or paste the text to repeat.',
      'Set how many times to repeat it.',
      'Choose a separator: new line, space, comma, nothing, or your own.',
      'Check the output size, select “Repeat text”, then copy or download.',
    ],
    faqs: [
      {
        q: 'Is there a limit?',
        a: 'You can repeat text up to 100,000 times, with a total output of up to 10 million characters. That keeps your browser responsive. Very large results need an extra click to confirm.',
      },
      {
        q: 'Can I use a line break in a custom separator?',
        a: 'Yes. Type \\n for a new line or \\t for a tab in the custom separator box.',
      },
      LOCAL_FAQ,
    ],
    related: ['lorem-ipsum-generator', 'character-counter', 'word-counter', 'sort-lines'],
  },
  {
    slug: 'ai-text-rewriter',
    group: 'ai',
    name: 'AI Text Rewriter',
    blurb: 'Rewrite, shorten, simplify or change the tone.',
    h1: 'AI text rewriter',
    title: 'AI Text Rewriter — Rewrite, Shorten or Simplify Text | Texty',
    description:
      'Rewrite text with AI. Make it shorter, longer, simpler, more professional or more casual, or give your own instruction. Free to try, no sign-up.',
    intro: 'Paste your text, choose how to rewrite it, and compare the result with your original.',
    local: false,
    howTo: [
      'Paste the text you want to rewrite, up to 6,000 characters.',
      'Choose an action, such as “Make shorter” or “Make professional”.',
      'Optionally add your own instruction, such as “Make this sound more confident”.',
      'Select “Rewrite” and compare the original with the result. Rewrite again for a different version, then copy the one you like.',
    ],
    faqs: [
      {
        q: 'Where does my text go?',
        a: 'To rewrite your text, we send it to our AI provider, Anthropic, which processes it and returns the result. Texty does not store your text or the result, and does not use it for anything else. By default, Anthropic does not use data sent through its API to train its models. All our other tools run entirely in your browser.',
      },
      {
        q: 'Is it free?',
        a: 'Yes. You get a generous number of free rewrites each day, with no account. We may add paid options with higher limits in future.',
      },
      {
        q: 'Will the rewrite keep my meaning?',
        a: 'It is instructed to keep your meaning, facts, names and numbers, and to write in the same language as your text. AI can still make mistakes, so read the result before you use it, especially for anything important.',
      },
      {
        q: 'Can I use it to translate?',
        a: 'The rewriter keeps your text in its original language. If you add an instruction asking for another language, it will follow it.',
      },
    ],
    related: ['word-counter', 'text-cleaner', 'case-converter', 'text-diff'],
  },
];

export const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

export const GROUPS: { id: ToolGroup; name: string; intro: string }[] = [
  { id: 'popular', name: 'Popular', intro: 'The tools people reach for most.' },
  { id: 'utility', name: 'Text utilities', intro: 'Lists, comparisons, URLs and placeholder text.' },
  { id: 'ai', name: 'AI tools', intro: 'Rewriting that sends your text to an AI model, clearly marked.' },
];

export const byGroup = (g: ToolGroup) => tools.filter((t) => t.group === g);
