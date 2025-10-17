/**
 * Sanitize text by removing or replacing special characters that may cause display issues
 * @param {string} text - Text to sanitize
 * @returns {string} Cleaned text
 */
function sanitizeText(text) {
  if (!text || typeof text !== "string") return text;

  return (
    text
      // CONVERT all apostrophe variants to regular ASCII apostrophe (')
      // This handles ANY unicode apostrophe variant by converting them
      .replace(/[''`‛‚ʹʻʼʽ′‵ʾʿ]/g, "'") // Convert all apostrophe variants to regular '
      .replace(/[\u2018\u2019]/g, "'") // Convert left/right single quotes to regular '
      .replace(/[\u0060\u00B4\u02B9-\u02C1]/g, "'") // Convert grave, acute, modifier letters to '
      .replace(/[\u2032-\u2037]/g, "'") // Convert prime marks to '

      // Keep regular quotes but clean them
      .replace(/[""‟„]/g, '"') // Smart double quotes to regular quotes
      .replace(/[«»‹›]/g, '"') // French quotes to regular quotes

      // Replace accented characters with their basic equivalents
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ýÿ]/g, "y")
      .replace(/[ñ]/g, "n")
      .replace(/[ç]/g, "c")
      .replace(/[ß]/g, "ss")
      .replace(/[æ]/g, "ae")
      .replace(/[œ]/g, "oe")

      // Capital versions
      .replace(/[ÀÁÂÃÄÅ]/g, "A")
      .replace(/[ÈÉÊË]/g, "E")
      .replace(/[ÌÍÎÏ]/g, "I")
      .replace(/[ÒÓÔÕÖ]/g, "O")
      .replace(/[ÙÚÛÜ]/g, "U")
      .replace(/[Ý]/g, "Y")
      .replace(/[Ñ]/g, "N")
      .replace(/[Ç]/g, "C")
      .replace(/[Æ]/g, "AE")
      .replace(/[Œ]/g, "OE")

      // Remove other problematic characters
      .replace(/[—–]/g, "-") // Em dash and en dash to regular dash
      .replace(/[…]/g, "...") // Ellipsis to three dots
      .replace(/[°]/g, " deg") // Degree symbol
      .replace(/[™®©]/g, "") // Remove trademark, registered, copyright symbols
      .replace(/[\u00A0]/g, " ") // Non-breaking space to regular space
      .replace(/[\u2000-\u200F\u2028-\u202F\u205F\u3000]/g, " ") // Various unicode spaces

      // Clean up multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Calculate display duration based on character count
 * Formula: Base time + time per character
 * @param {number} characterCount - Total characters in the screen
 * @returns {number} Duration in seconds
 */
function calculateDisplayDuration(characterCount) {
  const baseTime = 2; // Minimum 2 seconds for any screen
  const timePerCharacter = 0.1; // 100ms per character
  const maxTime = 10; // Maximum 10 seconds per screen

  const calculatedTime = baseTime + characterCount * timePerCharacter;
  return Math.min(Math.max(calculatedTime, baseTime), maxTime);
}

/**
 * Convert a screen array to a screen object with metadata
 * @param {string[]} screenArray - Array of 4 strings representing the screen
 * @returns {object} Screen object with content and metadata
 */
function createScreenObject(screenArray) {
  // Ensure all screen lines are sanitized
  const content = screenArray.map((line) => sanitizeText(line || ""));
  const totalCharacters = content.join("").length;
  const displayDuration = calculateDisplayDuration(totalCharacters);

  return {
    c: content,
    s: Math.round(displayDuration)
  };
}

// Generic function to format any array of strings into screens
export function formatStringsToScreens(
  strings,
  maxCharacters = null,
  maxStrings = null
) {
  if (!strings || strings.length === 0) {
    return [createScreenObject(["", "", "", ""])];
  }

  // Sanitize all strings first to remove special characters
  const sanitizedStrings = strings.map((str) => sanitizeText(str));

  // Limit the number of strings to process if specified
  const stringsToProcess = maxStrings
    ? sanitizedStrings.slice(0, maxStrings)
    : sanitizedStrings;

  if (!maxCharacters) {
    // No character limit, return strings as single-line screens
    return stringsToProcess.map((str) =>
      createScreenObject([str || "", "", "", ""])
    );
  }

  // Convert each string into screen objects
  const allScreens = [];

  for (const str of stringsToProcess) {
    if (!str) {
      allScreens.push(createScreenObject(["", "", "", ""]));
      continue;
    }

    const stringScreens = createScreensForString(str, maxCharacters);
    // Convert each screen array to screen object
    allScreens.push(
      ...stringScreens.map((screenArray) => createScreenObject(screenArray))
    );
  }

  return allScreens;
}

// Revolutionary approach: Reserve space for decorative elements UPFRONT, never truncate content
function createScreensForString(inputString, maxCharacters) {
  if (!inputString || !maxCharacters) return [["", "", "", ""]];

  // Get all words from the string
  const cleanText = inputString.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const originalWords = cleanText.split(" ").filter((word) => word.trim());

  // Create a working copy for processing (may be modified for word splitting)
  const allWords = [...originalWords];

  if (allWords.length === 0) return [["", "", "", ""]];

  // PHASE 1: Build screens with conservative space allocation (assume we'll need ellipsis)
  const screens = [];
  let wordIndex = 0;

  // Reserve space for the maximum possible decorative elements
  const ellipsisLength = 3; // "..."

  while (wordIndex < allWords.length) {
    const screen = ["", "", "", ""];
    const screenIndex = screens.length;
    const isFirstScreen = screenIndex === 0;

    // Fill lines in this screen with reserved space
    for (
      let lineIndex = 0;
      lineIndex < 4 && wordIndex < allWords.length;
      lineIndex++
    ) {
      let availableSpace = maxCharacters;
      let currentLine = "";

      // Reserve space for leading ellipsis on first line of continuation screens
      if (lineIndex === 0 && !isFirstScreen) {
        availableSpace -= ellipsisLength;
        currentLine = "...";
      }

      // Reserve space for trailing ellipsis on the last line if this might not be the final screen
      const isLastLine = lineIndex === 3;
      if (isLastLine) {
        availableSpace -= ellipsisLength;
      }

      // Fill remaining space with words
      let isFirstWordOnLine = currentLine === "" || currentLine === "...";
      while (wordIndex < allWords.length) {
        let word = allWords[wordIndex];

        // Remove leading dash if it's the first word on a new line (not the very first line of the string)
        if (
          isFirstWordOnLine &&
          word === "-" &&
          (lineIndex > 0 || !isFirstScreen)
        ) {
          wordIndex++; // Skip the dash
          continue;
        }

        const separator = isFirstWordOnLine ? "" : " ";
        const testLine = `${currentLine}${separator}${word}`;

        if (testLine.length <= availableSpace) {
          currentLine = testLine;
          wordIndex++;
          isFirstWordOnLine = false;
        } else {
          // Word doesn't fit in available space
          // If this is an empty line and the word is too long even for the full line,
          // we need to split the word with a hyphen to avoid infinite loop
          if (isFirstWordOnLine && word.length > maxCharacters - 1) {
            // Word is too long for any line - split it
            const splitIndex = maxCharacters - 1; // Leave room for hyphen
            const firstPart = word.slice(0, splitIndex) + "-";
            const secondPart = word.slice(splitIndex);

            // Replace current word with second part
            allWords[wordIndex] = secondPart;

            // Add first part to current line
            currentLine = currentLine
              ? currentLine + " " + firstPart
              : firstPart;
            // Don't increment wordIndex - we'll process the second part next time
            break;
          } else {
            break; // Word doesn't fit but will fit on next line
          }
        }
      }

      // Remove trailing dash if it's the last character of the line
      let finalLine = currentLine.trim();
      if (finalLine.endsWith(" -")) {
        finalLine = finalLine.slice(0, -2).trim();
      } else if (finalLine === "-") {
        finalLine = "";
      }

      screen[lineIndex] = finalLine;

      // If we've used all words, break
      if (wordIndex >= allWords.length) break;
    }

    screens.push(screen);
  }

  // PHASE 2: Add trailing ellipsis only where they fit without displacing content
  if (screens.length > 1) {
    for (let screenIndex = 0; screenIndex < screens.length; screenIndex++) {
      const screen = screens[screenIndex];
      const isNotLastScreen = screenIndex < screens.length - 1;

      // Find the last non-empty line
      let lastNonEmptyIndex = 3;
      while (lastNonEmptyIndex >= 0 && !screen[lastNonEmptyIndex].trim()) {
        lastNonEmptyIndex--;
      }

      if (lastNonEmptyIndex >= 0 && isNotLastScreen) {
        const originalLine = screen[lastNonEmptyIndex];
        const finalLine = originalLine.trim();

        // Add trailing ellipsis if not the last screen
        const withEllipsis = `${finalLine}...`;
        if (withEllipsis.length <= maxCharacters) {
          screen[lastNonEmptyIndex] = withEllipsis;
        }
      }
    }
  }

  // VERIFICATION: Ensure all words are preserved (excluding intentionally removed dashes)
  // Note: We compare against originalWords, not the modified allWords array
  const finalText = screens
    .map((screen) =>
      screen
        .join(" ")
        .replace(/\.\.\./g, "") // Remove ellipsis
        .replace(/\s+/g, " ")
        .trim()
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const finalWords = finalText.split(" ").filter((word) => word.trim());

  // For verification, join split words back together by removing hyphens added during splitting
  // This accounts for words that were split due to length constraints
  const finalTextRejoined = finalText.replace(/-\s+/g, "");
  const originalTextRejoined = originalWords.join(" ");

  // Basic verification - just check that the rejoined text is similar in length
  // We allow some difference due to intentionally removed standalone dashes
  const lengthDiff = Math.abs(
    finalTextRejoined.length - originalTextRejoined.length
  );

  if (lengthDiff > originalTextRejoined.length * 0.02) {
    // Allow 2% difference
    console.error("SIGNIFICANT TEXT LENGTH MISMATCH!");
    console.error("Original length:", originalTextRejoined.length);
    console.error("Final length:", finalTextRejoined.length);
    console.error("Difference:", lengthDiff);
  }

  return screens;
}
