#!/usr/bin/env node

import { formatStringsToScreens } from "./formatStringsToScreens.js";
import fs from "fs";
import path from "path";

/**
 * Process a short story and convert it to screen format
 * Usage: node processStory.js [story-file] [options]
 * Options:
 *   --max-chars <number>  Maximum characters per line (default: 50)
 *   --max-strings <number>  Maximum number of strings to process (default: unlimited)
 *   --output <file>  Output file path (default: stdout)
 *   --batch  Process all .txt files in input/ folder
 *   --input-dir <dir>  Input directory (default: input/)
 *   --output-dir <dir>  Output directory (default: output/)
 */

function printUsage() {
  console.log(`
Usage: node processStory.js [story-file] [options]

Options:
  --max-chars <number>    Maximum characters per line (default: 20)
  --max-strings <number>  Maximum number of strings to process (default: unlimited)
  --output <file>         Output file path (default: stdout)
  --format <format>       Output format: 'json' or 'c' (default: c)
  --batch                 Process all .txt files in input/ folder
  --input-dir <dir>       Input directory (default: input/)
  --output-dir <dir>      Output directory (default: output/)
  --help                  Show this help message

Examples:
  node processStory.js story.txt                    # Looks in input/ folder
  node processStory.js story.txt --max-chars 40
  node processStory.js story.txt --output screens.h
  node processStory.js story.txt --format json --output data.json
  node processStory.js story.txt --max-chars 60 --max-strings 10
  node processStory.js input/story.txt              # Explicit path
  node processStory.js --batch
  node processStory.js --batch --max-chars 40 --output-dir results/
`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    maxChars: 20,
    maxStrings: null,
    outputFile: null,
    storyFile: null,
    batch: false,
    inputDir: "input/",
    outputDir: "output/",
    format: "c"
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
        printUsage();
        process.exit(0);
        break;
      case "--max-chars":
        options.maxChars = parseInt(args[++i]);
        if (isNaN(options.maxChars) || options.maxChars <= 0) {
          console.error("Error: --max-chars must be a positive number");
          process.exit(1);
        }
        break;
      case "--max-strings":
        options.maxStrings = parseInt(args[++i]);
        if (isNaN(options.maxStrings) || options.maxStrings <= 0) {
          console.error("Error: --max-strings must be a positive number");
          process.exit(1);
        }
        break;
      case "--output":
        options.outputFile = args[++i];
        break;
      case "--batch":
        options.batch = true;
        break;
      case "--input-dir":
        options.inputDir = args[++i];
        if (!options.inputDir.endsWith("/")) {
          options.inputDir += "/";
        }
        break;
      case "--output-dir":
        options.outputDir = args[++i];
        if (!options.outputDir.endsWith("/")) {
          options.outputDir += "/";
        }
        break;
      case "--format":
        options.format = args[++i];
        if (!["json", "c"].includes(options.format)) {
          console.error("Error: --format must be 'json' or 'c'");
          process.exit(1);
        }
        break;
      default:
        if (!arg.startsWith("--") && !options.storyFile) {
          // If no path is specified, assume it's in the input folder
          if (!arg.includes("/") && !arg.includes("\\")) {
            options.storyFile = path.join(options.inputDir, arg);
          } else {
            options.storyFile = arg;
          }
        } else {
          console.error(`Error: Unknown argument ${arg}`);
          printUsage();
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

function readStoryFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File '${filePath}' not found`);
      process.exit(1);
    }

    const content = fs.readFileSync(filePath, "utf8");
    return content;
  } catch (error) {
    console.error(`Error reading file '${filePath}':`, error.message);
    process.exit(1);
  }
}

function readStoryFromStdin() {
  return new Promise((resolve, reject) => {
    let input = "";

    process.stdin.setEncoding("utf8");

    process.stdin.on("readable", () => {
      const chunk = process.stdin.read();
      if (chunk !== null) {
        input += chunk;
      }
    });

    process.stdin.on("end", () => {
      resolve(input);
    });

    process.stdin.on("error", (error) => {
      reject(error);
    });
  });
}

function getStoryFiles(inputDir) {
  try {
    if (!fs.existsSync(inputDir)) {
      console.error(`Error: Input directory '${inputDir}' not found`);
      process.exit(1);
    }

    const files = fs.readdirSync(inputDir);
    const storyFiles = files
      .filter((file) => file.toLowerCase().endsWith(".txt"))
      .map((file) => path.join(inputDir, file));

    if (storyFiles.length === 0) {
      console.error(`Error: No .txt files found in '${inputDir}'`);
      process.exit(1);
    }

    return storyFiles;
  } catch (error) {
    console.error(
      `Error reading input directory '${inputDir}':`,
      error.message
    );
    process.exit(1);
  }
}

function ensureOutputDir(outputDir) {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (error) {
    console.error(
      `Error creating output directory '${outputDir}':`,
      error.message
    );
    process.exit(1);
  }
}

function splitStoryIntoStrings(story) {
  // Split the story into paragraphs, then into sentences
  const paragraphs = story.split(/\n\s*\n/).filter((p) => p.trim());
  const strings = [];

  for (const paragraph of paragraphs) {
    // Split paragraph into sentences while preserving punctuation
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Add sentences to strings array
    strings.push(...sentences);
  }

  return strings;
}

function formatScreensOutput(screens, format = "json") {
  if (format === "c") {
    return formatAsCHeader(screens);
  }

  // Format as array of objects with the specific structure requested
  const formattedScreens = screens.map((screen) => ({
    line1: screen.c[0] || "",
    line2: screen.c[1] || "",
    line3: screen.c[2] || "",
    line4: screen.c[3] || "",
    duration: screen.s
  }));

  return JSON.stringify(formattedScreens, null, 2);
}

function formatAsCHeader(screens) {
  let output = `#ifndef DATA_H
#define DATA_H

typedef struct {
  const char* line1;
  const char* line2;
  const char* line3;
  const char* line4;
  int duration; // in seconds
} PageData;

const PageData PAGES[] = {
`;

  screens.forEach((screen, index) => {
    const line1 = escapeCString(screen.c[0] || "");
    const line2 = escapeCString(screen.c[1] || "");
    const line3 = escapeCString(screen.c[2] || "");
    const line4 = escapeCString(screen.c[3] || "");
    const duration = screen.s;

    output += `  {
    "${line1}",
    "${line2}",
    "${line3}",
    "${line4}",
    ${duration}
  }`;

    // Add comma if not the last item
    if (index < screens.length - 1) {
      output += ",";
    }
    output += "\n";
  });

  output += `};

const int TOTAL_PAGES = sizeof(PAGES) / sizeof(PageData);

#endif // DATA_H
`;

  return output;
}

function escapeCString(str) {
  return str
    .replace(/\\/g, "\\\\") // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes
    .replace(/\n/g, "\\n") // Escape newlines
    .replace(/\r/g, "\\r") // Escape carriage returns
    .replace(/\t/g, "\\t"); // Escape tabs
}

function displayScreensPreview(screens, storyName = "Story") {
  console.log(`\n📖 ${storyName} processed into ${screens.length} screen(s)\n`);
  console.log(
    `Total display time: ${screens.reduce(
      (total, screen) => total + screen.s,
      0
    )} seconds\n`
  );

  screens.forEach((screen, index) => {
    console.log(`--- Screen ${index + 1} (${screen.s}s) ---`);
    screen.c.forEach((line, lineIndex) => {
      if (line.trim()) {
        console.log(`Line ${lineIndex + 1}: "${line}"`);
      }
    });
    console.log("");
  });
}

async function processSingleStory(storyContent, options, storyName = "Story") {
  // Split story into strings (sentences)
  const storyStrings = splitStoryIntoStrings(storyContent);

  if (storyStrings.length === 0) {
    console.error(`Error: No valid sentences found in ${storyName}`);
    return null;
  }

  console.log(
    `Processing ${storyStrings.length} sentences from ${storyName}...`
  );
  console.log(`Max characters per line: ${options.maxChars}`);
  if (options.maxStrings) {
    console.log(`Max strings to process: ${options.maxStrings}`);
  }

  // Process the story using the formatStringsToScreens function
  const screens = formatStringsToScreens(
    storyStrings,
    options.maxChars,
    options.maxStrings
  );

  return screens;
}

async function main() {
  const options = parseArguments();

  // Handle batch processing
  if (options.batch) {
    console.log(`🔄 Batch processing stories from ${options.inputDir}...`);

    // Ensure output directory exists
    ensureOutputDir(options.outputDir);

    // Get all story files
    const storyFiles = getStoryFiles(options.inputDir);
    console.log(`Found ${storyFiles.length} story file(s) to process\n`);

    let processedCount = 0;
    let errorCount = 0;

    for (const storyFile of storyFiles) {
      try {
        const storyName = path.basename(storyFile, ".txt");
        console.log(`\n📚 Processing: ${storyName}`);

        // Read story content
        const storyContent = readStoryFromFile(storyFile);

        if (!storyContent.trim()) {
          console.error(`⚠️  Skipping ${storyName}: No content found`);
          errorCount++;
          continue;
        }

        // Process the story
        const screens = await processSingleStory(
          storyContent,
          options,
          storyName
        );

        if (!screens) {
          errorCount++;
          continue;
        }

        // Save to output file
        const extension = options.format === "c" ? ".h" : ".json";
        const outputFile = path.join(
          options.outputDir,
          `${storyName}-screens${extension}`
        );
        const output = formatScreensOutput(screens, options.format);
        fs.writeFileSync(outputFile, output, "utf8");

        console.log(
          `✅ ${storyName} processed: ${screens.length} screens, saved to ${outputFile}`
        );
        processedCount++;
      } catch (error) {
        console.error(
          `❌ Error processing ${path.basename(storyFile)}:`,
          error.message
        );
        errorCount++;
      }
    }

    console.log(`\n🎉 Batch processing complete!`);
    console.log(`✅ Successfully processed: ${processedCount} stories`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} stories`);
    }
    console.log(`📁 Output saved to: ${options.outputDir}`);
    return;
  }

  // Handle single story processing
  let storyContent;

  if (options.storyFile) {
    // Read from file
    storyContent = readStoryFromFile(options.storyFile);
  } else {
    // Read from stdin
    console.log("Reading story from stdin... (Press Ctrl+D when done)");
    try {
      storyContent = await readStoryFromStdin();
    } catch (error) {
      console.error("Error reading from stdin:", error.message);
      process.exit(1);
    }
  }

  if (!storyContent.trim()) {
    console.error("Error: No story content provided");
    process.exit(1);
  }

  // Process the story
  const storyName = options.storyFile
    ? path.basename(options.storyFile, ".txt")
    : "Story";
  const screens = await processSingleStory(storyContent, options, storyName);

  if (!screens) {
    process.exit(1);
  }

  // Output the results
  if (options.outputFile) {
    const output = formatScreensOutput(screens, options.format);
    fs.writeFileSync(options.outputFile, output, "utf8");
    console.log(`\n✅ Screens saved to: ${options.outputFile}`);
  } else {
    // Auto-save to output folder and show preview
    ensureOutputDir(options.outputDir);
    const extension = options.format === "c" ? ".h" : ".json";
    const outputFile = path.join(
      options.outputDir,
      `${storyName}-screens${extension}`
    );
    const output = formatScreensOutput(screens, options.format);
    fs.writeFileSync(outputFile, output, "utf8");

    displayScreensPreview(screens, storyName);
    console.log(`\n✅ Screens saved to: ${outputFile}`);
    console.log(`\n--- Full ${options.format.toUpperCase()} Output ---`);
    console.log(output);
  }
}

// Handle errors gracefully
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
