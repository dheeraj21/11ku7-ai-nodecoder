#!/usr/bin/env node
//editdir mode now supports version control added revert, forward, list version options and env file creation at start of program with placeholder if not found, ask for api key if not found, added logo.
//11ku7-ai-nodecoder (version 1.0.7) (latest iteration == 18V1) 
require('dotenv').config();
const blessed = require('neo-blessed');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const hljs = require('highlight.js');
const { marked } = require('marked');
const { markedTerminal } = require('marked-terminal');
const clipboardy = require('clipboardy');
const { execSync, exec } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Initialize Google GenerativeAI or OpenAI based on provider
let genAI = null;
let openAI = null;

// Custom theme for highlight.js 
const customTheme = {
  'hljs': '#d4d4d4',
  'hljs-keyword': '#8ab4f8',
  'hljs-string': '#f4b8a2',
  'hljs-number': '#b7d8b7',
  'hljs-comment': '#6b7280',
  'hljs-function': '#a5b4fc',
};

// Apply custom theme to highlight.js
hljs.configure({ languages: ['javascript', 'python', 'bash', 'html'] });
marked.use(
  markedTerminal({
    highlight: (code, lang) => {
      const lines = code.split('\n');
      const numberedLines = lines.map((line, i) => `${(i + 1).toString().padStart(3, ' ')} | ${line}`);
      const codeWithNumbers = numberedLines.join('\n');
      const highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(codeWithNumbers, { language: lang }).value
        : hljs.highlightAuto(codeWithNumbers).value;
      return `{gray-fg}[${lang || 'text'}]{/}\n` + highlighted.replace(
        /<span class="([^"]+)">([^<]+)<\/span>/g,
        (match, className, text) => `{${customTheme[className] || '#d4d4d4'}-fg}${text}{/}`
      );
    },
  })
);

// Configure marked with highlight.js
marked.setOptions({
  highlight: function (code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch (e) {
      // Silently handle unsupported languages by returning plain code
      return code;
    }
  },
});

// Create terminal screen
const screen = blessed.screen({
  smartCSR: true,
  title: '11ku7-ai-nodecoder (version 1.0.7)',
  fullUnicode: false,
  autoPadding: true,
});

// Provider selection list
const providerList = blessed.list({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-3',
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', selected: { bg: '#6b7280', fg: '#ffffff' } },
  keys: true,
  mouse: true,
  tags: true,
  items: ['{blue-fg}Gemini{/}', '{blue-fg}OpenAI Compatible{/}'],
  scrollable: true,
  scrollbar: { ch: ' ', style: { bg: '#6b7280' } },
  padding: { left: 1, right: 1, top: 1, bottom: 1 },
});

// Model selection list
const modelList = blessed.list({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%-3',
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', selected: { bg: '#6b7280', fg: '#ffffff' } },
  keys: true,
  mouse: true,
  tags: true,
  items: ['{gray-fg}Fetching available models...{/}'],
  scrollable: true,
  scrollbar: { ch: ' ', style: { bg: '#6b7280' } },
  padding: { left: 1, right: 1, top: 1, bottom: 1 },
  hidden: true,
});

// Instruction text below the lists
const providerInstruction = blessed.text({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{gray-fg}Use arrow keys to select a provider, then press Enter.{/}',
  tags: true,
  style: { fg: '#d4d4d4', bg: 'black' },
});

const modelInstruction = blessed.text({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  content: '{gray-fg}Use arrow keys to select a model, then press Enter.{/}',
  tags: true,
  style: { fg: '#d4d4d4', bg: 'black' },
  hidden: true,
});

// Input form for OpenAI base URL
const openAIBaseURLForm = blessed.form({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  border: { type: 'line', fg: '#6b7280' },
  style: { bg: 'black' },
  hidden: true,
});

const openAIBaseURLLabel = blessed.text({
  parent: openAIBaseURLForm,
  top: 0,
  left: 1,
  content: '{gray-fg}Enter OpenAI Base URL: {/}',
  tags: true,
});

const openAIBaseURLInput = blessed.textbox({
  parent: openAIBaseURLForm,
  top: 0,
  left: 30,
  width: '100%-32',
  height: 1,
  inputOnFocus: true,
  style: { fg: '#d4d4d4', bg: 'black' },
  value: 'https://openrouter.ai/api/v1', // Placeholder value
});

// Input form for OpenAI model name
const openAIModelForm = blessed.form({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  border: { type: 'line', fg: '#6b7280' },
  style: { bg: 'black' },
  hidden: true,
});

const openAIModelLabel = blessed.text({
  parent: openAIModelForm,
  top: 0,
  left: 1,
  content: '{gray-fg}Enter OpenAI Comp. model name: {/}',
  tags: true,
});

const openAIModelInput = blessed.textbox({
  parent: openAIModelForm,
  top: 0,
  left: 35,
  width: '100%-37',
  height: 1,
  inputOnFocus: true,
  style: { fg: '#d4d4d4', bg: 'black' },
});

// Input form (Full width at top)
const inputForm = blessed.form({
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  border: { type: 'line', fg: '#6b7280' },
  style: { bg: 'black', focus: { border: { fg: '#8ab4f8' } } },
  hidden: true,
});

const inputLabel = blessed.text({
  parent: inputForm,
  top: 0,
  left: 1,
  content: '{gray-fg}> {/}',
  tags: true,
});

const inputBox = blessed.textbox({
  parent: inputForm,
  top: 0,
  left: 4,
  width: '100%-6',
  height: 1,
  inputOnFocus: true,
  style: { fg: '#d4d4d4', bg: 'black' },
});


// Sidebar for folder structure tree (Interactive list)
const treeBox = blessed.list({
  top: 3,
  left: 0,
  width: '30%',
  height: '100%-13',
  bottom: 8,
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', selected: { bg: '#6b7280', fg: '#ffffff' }, focus: { border: { fg: '#8ab4f8' } } },
  keys: true,
  mouse: true,
  tags: true,
  items: [],
  scrollable: true,
  scrollbar: { ch: ' ', style: { bg: '#6b7280' } },
  padding: { left: 1, right: 1, top: 0, bottom: 0 },
  hidden: true,
});

// Chat area (Parallel to tree)
const chatBox = blessed.box({
  top: 3,
  left: '30%',
  width: '70%',
  height: '100%-7',
  content: '',
  tags: true,
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', focus: { border: { fg: '#8ab4f8' } } },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: { ch: ' ', style: { bg: '#6b7280' } },
  mouse: true,
  keys: true,
  padding: { left: 1, right: 1, top: 1, bottom: 1 },
  hidden: true,
});

// Status bar (Full width at bottom, 4 lines)
const statusBar = blessed.text({
  bottom: 0,
  left: 0,
  width: '100%',
  height: 4,
  content: `{green-fg}11ku7-ai-nodecoder (version 1.0.7){/}\ncwd: ${process.cwd()}\n/help for help, mode: none`,
  tags: true,
  style: { fg: '#d4d4d4', bg: 'black' },
  hidden: true,
});

// Append elements to screen
screen.append(providerList);
screen.append(providerInstruction);
screen.append(modelList);
screen.append(modelInstruction);
screen.append(openAIBaseURLForm);
screen.append(openAIModelForm);
screen.append(inputForm);
screen.append(treeBox);
screen.append(chatBox);
screen.append(statusBar);


// Configuration for digest mode
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_DIRECTORY_DEPTH = 20;
const MAX_FILES = 10_000;
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const TMP_BASE_PATH = path.join(os.tmpdir(), 'gitingest');
const DEFAULT_IGNORE_PATTERNS = new Set([
  '*.pyc', '*.pyo', '*.pyd', '__pycache__', '.pytest_cache', '.coverage', '.tox', '.nox', '.mypy_cache', '.ruff_cache', '.hypothesis', 'poetry.lock', 'Pipfile.lock',
  'node_modules', 'bower_components', 'package-lock.json', 'yarn.lock', '.npm', '.yarn', '.pnpm-store', 'bun.lock', 'bun.lockb',
  '*.class', '*.jar', '*.war', '*.ear', '*.nar', '.gradle/', 'build/', '.settings/', '.classpath', 'gradle-app.setting', '*.gradle',
  '.project',
  '*.o', '*.obj', '*.dll', '*.dylib', '*.exe', '*.lib', '*.out', '*.a', '*.pdb',
  '.build/', '*.xcodeproj/', '*.xcworkspace/', '*.pbxuser', '*.mode1v3', '*.mode2v3', '*.perspectivev3', '*.xcuserstate', 'xcuserdata/', '.swiftpm/',
  '*.gem', '.bundle/', 'vendor/bundle', 'Gemfile.lock', '.ruby-version', '.ruby-gemset', '.rvmrc',
  'Cargo.lock', '**/*.rs.bk',
  'target/',
  'pkg/',
  'obj/',
  '*.suo', '*.user', '*.userosscache', '*.sln.docstates', 'packages/', '*.nupkg',
  'bin/',
  '.git', '.svn', '.hg', '.gitignore', '.gitattributes', '.gitmodules',
  '*.svg', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.pdf', '*.mov', '*.mp4', '*.mp3', '*.wav',
  'venv', '.venv', 'env', '.env', 'virtualenv',
  '.idea', '.vscode', '.vs', '*.swo', '*.swn', '.settings', '*.sublime-*',
  '*.log', '*.bak', '*.swp', '*.tmp', '*.temp', '.cache', '.sass-cache', '.eslintcache', '.DS_Store', 'Thumbs.db', 'desktop.ini',
  'build', 'dist', 'out', '*.egg-info', '*.egg', '*.whl', '*.so',
  'site-packages', '.docusaurus', '.next', '.nuxt',
  '*.min.js', '*.min.css',
  '*.map',
  '.terraform', '*.tfstate*',
  'vendor/',
]);


const commands = {
  '/help': 'Show this help message',

  '/model': 'Change the current model',

  '/code': 'Toggle code-only generation mode',
  '/webapp': 'Toggle webapp-only generation mode',
  '/save <filename>': 'Save all code blocks from the last AI response to a file',
  '/copy': 'Copy/save all code blocks from the last AI response to the clipboard/File',
  '/editcode <filename>': 'Load code from a file for modification (code/webapp modes)',
  '/askcode <filename>': 'Load code from a file to ask questions about it',

  '/shell': 'Toggle shell command mode',

  '/dir': 'Toggle directory command planning mode',
  '/editdir <path>': 'Load a directory for modification, edit specific files based on query',
  '/askdir <path>': 'Load a directory to ask questions about its contents',


  '/savecon': 'Save the entire chat conversation to a markdown file',
  '/loadcon <filename>': 'Load a saved chat conversation from a markdown file',
  '/desc': 'Describe each mode and command in detailed paragraphs covering purpose, usage, and functionality',
  '/clear': 'Clear the chat',

  '/digest': 'Toggle digest mode or process a path (e.g., /digest ./my_project)',

  '/exit': 'Exit the application',
};

// Key bindings
const keyBindings = {
  'Esc': 'Disable input focus (switch to tree navigation)',
  'i': 'Re-enable input focus',
  'c': 'Focus chat area for scrolling',
  's': 'Focus save conversation button',
  'm': 'Focus multiline input box',
  'q or Ctrl+C': 'Exit the application',
  'Up/k (in chat)': 'Scroll chat up',
  'Down/j (in chat)': 'Scroll chat down',
  'Enter (in tree)': 'Toggle folder expand/collapse',
};

// Store state
let lastCodeBlocks = [];
let currentModel = null;
let currentProvider = null;
let availableModels = [];
let codeOnlyMode = false;
let webappOnlyMode = false;
let dirMode = false;
let shellMode = false;
let shellCommandPrompted = false;
let loadedCodeContext = '';
let askCodeContext = '';
let currentWorkingDir = process.cwd();
let folderState = {};
let isShellPromptActive = false;
let digestMode = false;
let digestContext = '';
let isDigestPromptActive = false;
let isConversationLoaded = false;
let editDirMode = false;
let editDirContext = ''; // Store the digest content for editing
let editDirPath = ''; // Store the directory path being edited
let askDirMode = false; // New mode for askdir
let askDirContext = ''; // New context for askdir
let editDirModified = false;
const tempChatFile = path.join(currentWorkingDir, '.temp-chat.md');

// Initialize temporary chat file
async function initializeTempChatFile() {
  await fs.writeFile(tempChatFile, '# Chat Conversation\n\n');
}


async function editDirectory(dirPath) {
  try {
    const fullPath = path.resolve(currentWorkingDir, dirPath);
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    // Scan directory using existing scanDirectory function
    const node = await scanDirectory(fullPath);
    if (!node) {
      throw new Error('No files found in directory');
    }

    // Extract file contents as plain string
    const files = extractFilesContent(node);
    let context = '';
    for (const file of files) {
      if (file.content && file.content !== '[Non-text file]') {
        context += `File: ${file.path}\n${file.content}\n\n`;
      }
    }

    if (!context.trim()) {
      throw new Error('No valid text files found in directory');
    }

    // Check for existing versions and save initial state if none exist
    const versionsDir = path.join(currentWorkingDir, '.versions');
    const versionInfoPath = path.join(versionsDir, `editdir_${dirPath}_versionInfo.json`);
    let versionInfo = { currentVersion: -1, totalVersions: 0 };
    try {
      versionInfo = JSON.parse(await fs.readFile(versionInfoPath, 'utf8'));
    } catch {
      // No version info exists, save initial state as version 0
      await fs.mkdir(versionsDir, { recursive: true });
      const version0 = files.map(file => ({ path: file.path, content: file.content }));
      const version0Path = path.join(versionsDir, `editdir_${dirPath}_v0.json`);
      await fs.writeFile(version0Path, JSON.stringify({ timestamp: new Date().toISOString(), files: version0 }));
      versionInfo = { currentVersion: 0, totalVersions: 1 };
      await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
      appendMessage('ai', `{green-fg}Initial state saved as version 0 for ${dirPath}.{/}`, false);
    }

    editDirContext = context;
    editDirPath = dirPath;
    editDirMode = true;
    codeOnlyMode = false;
    webappOnlyMode = false;
    dirMode = false;
    shellMode = false;
    digestMode = false;
    appendMessage('ai', `{green-fg}Directory ${dirPath} loaded for editing. File contents loaded into context. Version control active (current version: ${versionInfo.currentVersion}).{/}`, false);

    // If more than one version exists, show version control options
    if (versionInfo.totalVersions > 1) {
      let versionAction = '';
      while (versionAction !== 'c') {
        appendMessage('ai', `{yellow-fg}Version control options: [r]evert, [f]orward, [l]ist versions, [c]ontinue (default):{/}`, false);
        inputBox.clearValue();
        inputBox.setValue('');
        inputBox.focus();
        screen.render();

        // Clear existing submit listeners
        inputBox.removeAllListeners('submit');

        versionAction = await new Promise((resolve) => {
          const actionHandler = (response) => {
            inputBox.removeListener('submit', actionHandler);
            resolve(response.trim().toLowerCase());
          };
          inputBox.once('submit', actionHandler);
        });

        if (versionAction === 'r') {
          // Revert to previous version
          if (versionInfo.currentVersion <= 0) {
            appendMessage('ai', `{red-fg}No previous version available to revert to.{/}`, false);
          } else {
            const prevVersion = versionInfo.currentVersion - 1;
            const prevVersionPath = path.join(versionsDir, `editdir_${dirPath}_v${prevVersion}.json`);
            const prevVersionData = JSON.parse(await fs.readFile(prevVersionPath, 'utf8'));
            let newContext = editDirContext;
            for (const file of prevVersionData.files) {
              const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
              await fs.writeFile(fullPath, file.content);
              const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
              const newContent = `File: ${file.path}\n${file.content}\n\n`;
              if (newContext.match(regex)) {
                newContext = newContext.replace(regex, newContent);
              } else {
                newContext += newContent;
              }
            }
            editDirContext = newContext;
            versionInfo.currentVersion = prevVersion;
            await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
            appendMessage('ai', `{green-fg}Reverted to version ${prevVersion}.{/}`, false);
            await updateTreeBox();
          }
        } else if (versionAction === 'f') {
          // Move to next version
          if (versionInfo.currentVersion >= versionInfo.totalVersions - 1) {
            appendMessage('ai', `{red-fg}No next version available to move forward to.{/}`, false);
          } else {
            const nextVersion = versionInfo.currentVersion + 1;
            const nextVersionPath = path.join(versionsDir, `editdir_${dirPath}_v${nextVersion}.json`);
            const nextVersionData = JSON.parse(await fs.readFile(nextVersionPath, 'utf8'));
            let newContext = editDirContext;
            for (const file of nextVersionData.files) {
              const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
              await fs.writeFile(fullPath, file.content);
              const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
              const newContent = `File: ${file.path}\n${file.content}\n\n`;
              if (newContext.match(regex)) {
                newContext = newContext.replace(regex, newContent);
              } else {
                newContext += newContent;
              }
            }
            editDirContext = newContext;
            versionInfo.currentVersion = nextVersion;
            await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
            appendMessage('ai', `{green-fg}Moved forward to version ${nextVersion}.{/}`, false);
            await updateTreeBox();
          }
        } else if (versionAction === 'l') {
          // List all versions
          let versionList = '';
          for (let i = 0; i < versionInfo.totalVersions; i++) {
            const versionPath = path.join(versionsDir, `editdir_${dirPath}_v${i}.json`);
            const versionData = JSON.parse(await fs.readFile(versionPath, 'utf8'));
            versionList += `Version ${i} (Created: ${versionData.timestamp})\n`;
          }
          appendMessage('ai', `{gray-fg}Available versions:\n${versionList}{/}`, false);
        } else if (versionAction === 'c') {
          // Continue with current version
          appendMessage('ai', `{green-fg}Continuing with current version ${versionInfo.currentVersion}.{/}`, false);
        } else {
          // Invalid input, treat as continue
          appendMessage('ai', `{gray-fg}Invalid option, continuing with current version ${versionInfo.currentVersion}.{/}`, false);
          versionAction = 'c';
        }
      }

      // Re-attach the main submit handler after exiting the loop
      inputBox.removeAllListeners('submit');
      inputBox.on('submit', handleInputSubmission);
    }

    // Generate project overview
    const overviewPrompt = `You are a project analyst. Below is the content of files in a project directory "${dirPath}":\n\n${editDirContext}\n\nProvide a concise overview of the project, summarizing its purpose, main components, and technologies used, based on the file contents. Present the overview as a single paragraph in markdown format, avoiding lists or code blocks.`;
    let buffer = '';
    const spinnerFrames = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;
    chatBox.insertBottom(`{gray-fg}Generating project overview ${spinnerFrames[spinnerIndex]}{/}`);
    let lastLineIndex = chatBox.getLines().length - 1;
    const spinnerInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      chatBox.setLine(lastLineIndex, `{gray-fg}Generating project overview ${spinnerFrames[spinnerIndex]}{/}`);
      screen.render();
    }, 100);

    if (currentProvider === 'Gemini') {
      const result = await currentModel.generateContentStream(overviewPrompt);
      for await (const chunk of result.stream) {
        buffer += chunk.text();
      }
    } else if (currentProvider === 'OpenAI') {
      const stream = await openAI.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'system', content: overviewPrompt }],
        stream: true,
      });
      for await (const chunk of stream) {
        buffer += chunk.choices[0]?.delta?.content || '';
      }
    }

    clearInterval(spinnerInterval);
    chatBox.deleteLine(lastLineIndex);
    const markedBuffer = marked(buffer);
    chatBox.insertBottom(markedBuffer);
    chatBox.setScrollPerc(100);
    screen.render();
    await fs.appendFile(tempChatFile, `## AI\nProject Overview for "${dirPath}":\n${buffer}\n\n`);

    updateStatusBar();
  } catch (error) {
    appendMessage('ai', `{red-fg}Error loading directory: ${error.message}{/}`, false);
    editDirContext = '';
    editDirMode = false;
  }
}


async function askDirectory(dirPath) {
  try {
    const fullPath = path.resolve(currentWorkingDir, dirPath);
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory');
    }

    // Scan directory using existing scanDirectory function
    const node = await scanDirectory(fullPath);
    if (!node) {
      throw new Error('No files found in directory');
    }

    // Extract file contents as plain string
    const files = extractFilesContent(node);
    let context = '';
    for (const file of files) {
      if (file.content && file.content !== '[Non-text file]') {
        context += `File: ${file.path}\n${file.content}\n\n`;
      }
    }

    if (!context.trim()) {
      throw new Error('No valid text files found in directory');
    }

    askDirContext = context;
    askDirPath = dirPath;
    askDirMode = true;
    codeOnlyMode = false;
    webappOnlyMode = false;
    dirMode = false;
    shellMode = false;
    digestMode = false;
    editDirMode = false;
    appendMessage('ai', `{green-fg}Directory ${dirPath} loaded for querying. File contents loaded into context.{/}`, false);

    // Generate project overview
    const overviewPrompt = `You are a project analyst with a friendly, conversational tone. Below is the content of files in a project directory "${dirPath}":\n\n${askDirContext}\n\nProvide a concise overview of the project, summarizing its purpose, main components, and technologies used, based on the file contents. Use a conversational style, starting with phrases like "This project is..." or "We're looking at..." to engage the user, and maintain a clear, approachable tone throughout. Present the overview as a single paragraph in markdown format, avoiding lists or code blocks.`;
    let buffer = '';
    const spinnerFrames = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;
    chatBox.insertBottom(`{gray-fg}Generating project overview ${spinnerFrames[spinnerIndex]}{/}`);
    let lastLineIndex = chatBox.getLines().length - 1;
    const spinnerInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      chatBox.setLine(lastLineIndex, `{gray-fg}Generating project overview ${spinnerFrames[spinnerIndex]}{/}`);
      screen.render();
    }, 100);

    if (currentProvider === 'Gemini') {
      const result = await currentModel.generateContentStream(overviewPrompt);
      for await (const chunk of result.stream) {
        buffer += chunk.text();
      }
    } else if (currentProvider === 'OpenAI') {
      const stream = await openAI.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'system', content: overviewPrompt }],
        stream: true,
      });
      for await (const chunk of stream) {
        buffer += chunk.choices[0]?.delta?.content || '';
      }
    }

    clearInterval(spinnerInterval);
    chatBox.deleteLine(lastLineIndex);
    const markedBuffer = marked(buffer);
    chatBox.insertBottom(markedBuffer);
    chatBox.setScrollPerc(100);
    screen.render();
    await fs.appendFile(tempChatFile, `## AI\nProject Overview for "${dirPath}":\n${buffer}\n\n`);

    updateStatusBar();
  } catch (error) {
    appendMessage('ai', `{red-fg}Error loading directory: ${error.message}{/}`, false);
    askDirContext = '';
    askDirMode = false;
  }
}



// Digest mode functions
async function isTextFile(filePath) {
  try {
    const chunk = await fs.readFile(filePath, { encoding: null, flag: 'r' });
    return !chunk.includes(Buffer.from([0x00, 0x01, 0x02, 0x03]));
  } catch {
    return false;
  }
}

async function readFileContent(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    try {
      const content = await fs.readFile(filePath, 'latin1');
      return content;
    } catch {
      return `Error reading file: ${error.message}`;
    }
  }
}

function shouldExclude(filePath, basePath, ignorePatterns) {
  const relativePath = path.relative(basePath, filePath).replace(/\\/g, '/');
  for (const pattern of ignorePatterns) {
    if (pattern && fnmatch(relativePath, pattern)) {
      return true;
    }
  }
  return false;
}

function fnmatch(name, pattern) {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\+/g, '\\+');
  return new RegExp(`^${regexPattern}$`).test(name);
}

async function scanDirectory(dirPath, depth = 0, seenPaths = new Set(), stats = { totalFiles: 0, totalSize: 0 }) {
  if (depth > MAX_DIRECTORY_DEPTH) {
    appendMessage('ai', `{yellow-fg}Skipping deep directory: ${dirPath} (max depth ${MAX_DIRECTORY_DEPTH} reached){/}`, false);
    return null;
  }
  if (stats.totalFiles >= MAX_FILES) {
    appendMessage('ai', `{yellow-fg}Skipping further processing: maximum file limit (${MAX_FILES}) reached{/}`, false);
    return null;
  }
  if (stats.totalSize >= MAX_TOTAL_SIZE_BYTES) {
    appendMessage('ai', `{yellow-fg}Skipping further processing: maximum total size (${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB) reached{/}`, false);
    return null;
  }

  const realPath = path.resolve(dirPath);
  if (seenPaths.has(realPath)) {
    appendMessage('ai', `{yellow-fg}Skipping already visited path: ${dirPath}{/}`, false);
    return null;
  }
  seenPaths.add(realPath);

  const result = {
    name: path.basename(dirPath),
    type: 'directory',
    size: 0,
    children: [],
    fileCount: 0,
    dirCount: 0,
    path: dirPath,
  };

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (shouldExclude(fullPath, dirPath, DEFAULT_IGNORE_PATTERNS)) {
        continue;
      }

      if (item.isFile()) {
        const stats = await fs.stat(fullPath);
        const fileSize = stats.size;
        if (stats.totalSize + fileSize > MAX_TOTAL_SIZE_BYTES) {
          appendMessage('ai', `{yellow-fg}Skipping file ${fullPath}: would exceed total size limit{/}`, false);
          continue;
        }
        stats.totalFiles += 1;
        stats.totalSize += fileSize;
        if (stats.totalFiles > MAX_FILES) {
          appendMessage('ai', `{yellow-fg}Maximum file limit (${MAX_FILES}) reached{/}`, false);
          break;
        }

        const isText = await isTextFile(fullPath);
        const content = isText ? await readFileContent(fullPath) : '[Non-text file]';
        const child = {
          name: item.name,
          type: 'file',
          size: fileSize,
          content,
          path: fullPath,
        };
        result.children.push(child);
        result.size += fileSize;
        result.fileCount += 1;
      } else if (item.isDirectory()) {
        const subdir = await scanDirectory(fullPath, depth + 1, seenPaths, stats);
        if (subdir && subdir.fileCount > 0) {
          result.children.push(subdir);
          result.size += subdir.size;
          result.fileCount += subdir.fileCount;
          result.dirCount += 1 + subdir.dirCount;
        }
      }
    }

    result.children.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      if (a.name.toLowerCase() === 'readme.md') return -1;
      if (b.name.toLowerCase() === 'readme.md') return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  } catch (error) {
    appendMessage('ai', `{red-fg}Error scanning directory ${dirPath}: ${error.message}{/}`, false);
    return null;
  }
}

function createTreeStructure(node, prefix = '', isLast = true) {
  let tree = '';
  const currentPrefix = isLast ? '└── ' : '├── ';
  const name = node.type === 'directory' ? `${node.name}/` : node.name;
  tree += prefix + currentPrefix + name + '\n';

  if (node.type === 'directory') {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      tree += createTreeStructure(children[i], newPrefix, i === children.length - 1);
    }
  }
  return tree;
}

function extractFilesContent(node, files = []) {
  if (node.type === 'file' && node.content !== '[Non-text file]') {
    if (node.size <= MAX_FILE_SIZE) {
      const relativePath = path.relative(currentWorkingDir, node.path).replace(/\\/g, '/');
      files.push({
        path: relativePath,
        content: node.content,
        size: node.size,
      });
    }
  } else if (node.type === 'directory') {
    for (const child of node.children) {
      extractFilesContent(child, files);
    }
  }
  return files;
}

function createFileContentString(files) {
  let output = '';
  const separator = '='.repeat(48) + '\n';
  for (const file of files) {
    if (!file.content) continue;
    output += separator;
    output += `File: ${file.path}\n`;
    output += separator;
    output += `${file.content}\n\n`;
  }
  return output;
}

async function cloneRepo(url, localPath) {
  try {
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    execSync(`git clone --recurse-submodules --depth=1 --single-branch ${url} ${localPath}`, { stdio: 'ignore' });
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

async function ingestPath(sourcePath, outputFile = 'digest_output.txt') {
  let targetPath = sourcePath;
  let tempDir = null;

  try {
    // Check if source is a URL
    if (sourcePath.match(/^(https?:\/\/|git@)/)) {
      tempDir = path.join(TMP_BASE_PATH, `repo-${Date.now()}`);
      await cloneRepo(sourcePath, tempDir);
      targetPath = tempDir;
    }

    const fullPath = path.resolve(currentWorkingDir, targetPath);
    const stats = await fs.stat(fullPath);

    let summary = '';
    let tree = '';
    let content = '';

    if (stats.isFile()) {
      const fileSize = stats.size;
      if (fileSize > MAX_FILE_SIZE) {
        content = '[Content ignored: file too large]';
      } else {
        const isText = await isTextFile(fullPath);
        content = isText ? await readFileContent(fullPath) : '[Non-text file]';
      }
      const relativePath = path.relative(currentWorkingDir, fullPath).replace(/\\/g, '/');
      summary = `File: ${path.basename(fullPath)}\nSize: ${fileSize} bytes\nLines: ${content.split('\n').length}`;
      tree = `Directory structure:\n└── ${path.basename(fullPath)}`;
      content = `File: ${relativePath}\n${'='.repeat(48)}\n${content}\n`;
    } else if (stats.isDirectory()) {
      const node = await scanDirectory(fullPath);
      if (!node) {
        throw new Error('No files found in directory');
      }
      const files = extractFilesContent(node);
      summary = `Files analyzed: ${node.fileCount}`;
      tree = `Directory structure:\n${createTreeStructure(node)}`;
      content = createFileContentString(files);
    } else {
      throw new Error('Invalid path: not a file or directory');
    }

    const outputPath = path.join(currentWorkingDir, outputFile);
    await fs.writeFile(outputPath, `${tree}\n${content}`);
    digestContext = content;
    await updateTreeBox();
    return { summary, tree, content };
  } catch (error) {
    throw error;
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// Function to process digest input
async function processDigestInput(input) {
  const [sourcePath, outputFile] = input.trim().split(' ').filter(Boolean);
  try {
    appendMessage('ai', `{gray-fg}Processing ${sourcePath}...{/}`, false);
    const { summary, tree, content } = await ingestPath(sourcePath, outputFile || 'digest_output.txt');
    appendMessage('ai', `{green-fg}Digest complete: ${summary}{/}`, false);
    appendMessage('ai', `Directory structure:\n${tree}`, false);
    appendMessage('ai', `Content preview (first 5000 chars):\n${content.slice(0, 5000)}${content.length > 5000 ? '...' : ''}`, false);
    appendMessage('ai', `{green-fg}Saved to ${outputFile || 'digest_output.txt'}{/}`, false);
  } catch (error) {
    appendMessage('ai', `{red-fg}Error processing digest: ${error.message}{/}`, false);
  }
}



// Function to build folder structure tree
async function buildFolderTree(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  let items = [`${path.basename(dir)}`];
  folderState[path.basename(dir)] = folderState[path.basename(dir)] || true;

  async function addChildren(parentPath, prefix = '', relativePath = '') {
    const children = await fs.readdir(parentPath, { withFileTypes: true });
    children.sort((a, b) => (a.isDirectory() ? -1 : b.isDirectory() ? 1 : a.name.localeCompare(b.name)));
    for (let i = 0; i < children.length; i++) {
      const file = children[i];
      const fullPath = path.join(parentPath, file.name);
      const relPath = relativePath ? path.join(relativePath, file.name) : file.name;
      const isLast = i === children.length - 1;
      const linePrefix = prefix + (isLast ? '└── ' : '├── ');
      if (file.isDirectory()) {
        const expanded = folderState[fullPath] || false;
        items.push(`${linePrefix}${expanded ? '-' : '+'} ${relPath}`);
        if (expanded) {
          await addChildren(fullPath, prefix + (isLast ? '    ' : '│   '), relPath);
        }
      } else {
        items.push(`${linePrefix}${relPath}`);
      }
    }
  }

  if (folderState[path.basename(dir)]) {
    await addChildren(dir);
  }
  return items;
}

// Function to update tree box
async function updateTreeBox() {
  const treeItems = await buildFolderTree(currentWorkingDir);
  treeBox.setItems(treeItems.map(item => `{gray-fg}${item}{/}`));
  treeBox.select(0); // Reset selection to avoid out-of-bounds errors
  screen.render();
}

// Store state (add new state variable for tracking displayed file content)
let displayedFileContent = null; // Track currently displayed file { path, content }

// Function to toggle folder state or show/hide file content
async function toggleFolder(index) {
  const item = treeBox.getItem(index).content.replace(/{gray-fg}|{\/}/g, '');
  const match = item.match(/^(.*)([+-])\s(.+)$/);
  const isFolder = match && (match[2] === '+' || match[2] === '-');
  const name = match ? match[3] : item.replace(/^[│\s├└─]*\s*/, '').trim(); // Extract full relative path
  const fullPath = path.join(currentWorkingDir, name);

  try {
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory() && match) {
      // Toggle folder expansion
      folderState[fullPath] = !folderState[fullPath];
      await updateTreeBox();
    } else if (stats.isFile()) {
      // Prepend file name to existing input content
      const currentInput = inputBox.getValue().trim();
      inputBox.setValue(currentInput ? `${currentInput} ${name}` : name);
      inputBox.focus();
      screen.render();

      if (displayedFileContent && displayedFileContent.path === fullPath) {
        // Hide file content
        displayedFileContent = null;
        chatBox.setContent(`{gray-fg}Chat with ${currentProvider} (${currentModel.model || currentModel})\nType a query or command above.{/}`);
        appendMessage('ai', `{gray-fg}File content hidden: ${name}{/}`, false);
      } else {
        // Show file content
        const content = await fs.readFile(fullPath, 'utf8');
        const lang = path.extname(fullPath).slice(1) || 'text';
        displayedFileContent = { path: fullPath, content };
        appendMessage('ai', `{gray-fg}File: ${name}{/}\n\`\`\`${lang}\n${content}\n\`\`\``, false);
      }
    }
  } catch (error) {
    appendMessage('ai', `{red-fg}Error accessing ${name}: ${error.message}{/}`, false);
  }
}

// Function to update status bar with current mode
function updateStatusBar() {
  let activeMode = 'none';
  if (codeOnlyMode) activeMode = 'code';
  else if (webappOnlyMode) activeMode = 'webapp';
  else if (dirMode) activeMode = 'dir';
  else if (shellMode) activeMode = 'shell';
  else if (digestMode) activeMode = 'digest';
  else if (editDirMode) activeMode = 'editdir';
  else if (askDirMode) activeMode = 'askdir';
  statusBar.setContent(
    `{green-fg}11ku7-ai-nodecoder (version 1.0.7){/}\n` +
    `{gray-fg}cwd: ${currentWorkingDir}\n/help for help, mode: ${activeMode}\n` +
    `{#1E90FF-fg}Researched {/}{#1E90FF-fg}& {/}{#1E90FF-fg}developed {/}{#1E90FF-fg}in {/}{#FF9933-fg}In{/}{#FFFFFF-fg}di{/}{#138808-fg}a {/}`
  );
  screen.render();
}

// Function to append messages to chat box and temporary file
async function appendMessage(role, message, includePrefix = true) {
  const prefix = role === 'user' ? '{yellow-fg}You:{/} ' : (includePrefix ? '{blue-fg}AI:{/} ' : '');
  chatBox.insertBottom(`${prefix}${message}\n`);
  chatBox.setScrollPerc(100);
  screen.render();

  // Update temporary chat file
  let markdownContent = '';
  if (role === 'user') {
    markdownContent = `## User\n${message}\n\n`;
  } else if (includePrefix) {
    markdownContent = `## AI\n${message}\n\n`;
  } else {
    markdownContent = `${message}\n\n`;
  }
  await fs.appendFile(tempChatFile, markdownContent);
}


// Function to extract code blocks from content
function extractCodeBlocks(content) {
  const codeBlocks = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentLang = 'text';
  let currentCode = [];

  for (const line of lines) {
    if (line.match(/^```(\w+)?$/)) {
      if (inCodeBlock) {
        if (currentCode.length > 0) {
          codeBlocks.push({ lang: currentLang, code: currentCode.join('\n') });
        }
        currentCode = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        currentLang = line.match(/^```(\w+)/)?.[1] || 'text';
      }
      continue;
    }
    if (inCodeBlock && line !== '') {
      currentCode.push(line);
    }
  }

  if (inCodeBlock && currentCode.length > 0) {
    codeBlocks.push({ lang: currentLang, code: currentCode.join('\n') });
  }

  return codeBlocks;
}


// Function to extract code blocks from the latest AI response in temp file
// Function to extract code blocks from the latest AI response in temp file
async function extractCodeBlocksFromTempFile() {
  lastCodeBlocks = [];
  const content = await fs.readFile(tempChatFile, 'utf8');
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentLang = 'text';
  let currentCode = [];
  let capturing = false;

  // Find the last "## User" to start capturing from the next "## AI"
  let lastUserIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === '## User') {
      lastUserIndex = i;
      break;
    }
  }

  for (let i = lastUserIndex + 1; i < lines.length; i++) {
    const line = lines[i]; // Don’t trim to preserve indentation
    if (line === '## AI' && !capturing) {
      capturing = true;
      continue;
    }

    if (!capturing) continue;

    if (line.match(/^```(\w+)?$/)) {
      if (inCodeBlock) {
        if (currentCode.length > 0) {
          lastCodeBlocks.push({ lang: currentLang, code: currentCode.join('\n') });
        }
        currentCode = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        currentLang = line.match(/^```(\w+)/)?.[1] || 'text';
      }
      continue;
    }

    if (inCodeBlock && line !== '') {
      currentCode.push(line);
    }
  }

  if (inCodeBlock && currentCode.length > 0) {
    lastCodeBlocks.push({ lang: currentLang, code: currentCode.join('\n') });
  }

  if (lastCodeBlocks.length > 0 && (codeOnlyMode || webappOnlyMode || isConversationLoaded)) {
    loadedCodeContext = lastCodeBlocks[lastCodeBlocks.length - 1].code;
  }

  return lastCodeBlocks;
}

// Function to save all code blocks to a file
async function saveToFile(filename) {
  await extractCodeBlocksFromTempFile();
  if (lastCodeBlocks.length === 0) {
    appendMessage('ai', '{red-fg}No code to save.{/}', false);
    return;
  }
  try {
    let combinedCode = lastCodeBlocks.map(block => block.code).join('\n\n');
    await fs.writeFile(path.join(currentWorkingDir, filename), combinedCode);
    appendMessage('ai', `{green-fg}Code saved to ${filename} successfully.{/}`, false);
    await updateTreeBox();
  } catch (error) {
    appendMessage('ai', `{red-fg}Error saving file: ${error.message}{/}`, false);
  }
}

// Function to save the entire chat conversation to a markdown file
async function saveConversation() {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `chat-conversation-${timestamp}.md`;
    const fullPath = path.join(currentWorkingDir, filename);

    const chatContent = await fs.readFile(tempChatFile, 'utf8');
    await fs.writeFile(fullPath, chatContent);
    appendMessage('ai', `{green-fg}Conversation saved to ${filename} successfully.{/}`, false);
    await updateTreeBox();
  } catch (error) {
    appendMessage('ai', `{red-fg}Error saving conversation: ${error.message}{/}`, false);
  }
}


// Function to load a saved conversation from a markdown file
async function loadConversation(filename) {
  try {
    const fullPath = path.join(currentWorkingDir, filename);
    const stats = await fs.stat(fullPath);
    if (!stats.isFile() || !filename.endsWith('.md')) {
      appendMessage('ai', `{red-fg}Error: ${filename} is not a valid markdown file.{/}`, false);
      return;
    }

    const content = await fs.readFile(fullPath, 'utf8');
    const lines = content.split('\n');

    // Clear current chat state
    chatBox.setContent('');
    lastCodeBlocks = [];
    loadedCodeContext = '';
    askCodeContext = '';
    isConversationLoaded = true;
    await initializeTempChatFile();

    // Parse the conversation
    let currentRole = null;
    let currentMessage = [];
    let lastAIMessage = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === '## User') {
        if (currentRole) {
          const messageText = currentMessage.join('\n');
          await appendMessage(currentRole, messageText, currentRole === 'ai');
          if (currentRole === 'ai') lastAIMessage = currentMessage;
        }
        currentRole = 'user';
        currentMessage = [];
      } else if (line === '## AI') {
        if (currentRole) {
          const messageText = currentMessage.join('\n');
          await appendMessage(currentRole, messageText, currentRole === 'ai');
          if (currentRole === 'ai') lastAIMessage = currentMessage;
        }
        currentRole = 'ai';
        currentMessage = [];
      } else if (line.trim() || currentRole) {
        currentMessage.push(line);
      }
    }

    // Append the last message
    if (currentRole) {
      const messageText = currentMessage.join('\n');
      await appendMessage(currentRole, messageText, currentRole === 'ai');
      if (currentRole === 'ai') lastAIMessage = currentMessage;
    }

    // Extract code from the last AI message
    const lastAIMessageText = lastAIMessage.join('\n');
    const codeBlocks = extractCodeBlocks(lastAIMessageText);
    if (codeBlocks.length > 0) {
      loadedCodeContext = codeBlocks[codeBlocks.length - 1].code;
      appendMessage('ai', `{gray-fg}Loaded code context from conversation:\n\`\`\`\n${loadedCodeContext}\n\`\`\`{/}`, false);
    }

    appendMessage('ai', `{green-fg}Conversation loaded from ${filename} successfully.{/}`, false);
    await updateTreeBox();
  } catch (error) {
    appendMessage('ai', `{red-fg}Error loading conversation: ${error.message}{/}`, false);
    isConversationLoaded = false;
  }
}

// Function to load code for editing
async function editCode(filename) {
  try {
    const content = await fs.readFile(path.join(currentWorkingDir, filename), 'utf8');
    loadedCodeContext = content.trim();
    appendMessage('ai', `{green-fg}Code loaded for editing from ${filename} successfully.{/}`, false);
    appendMessage('ai', `Loaded code:\n${loadedCodeContext}`, false);
  } catch (error) {
    appendMessage('ai', `{red-fg}Error loading file: ${error.message}{/}`, false);
    loadedCodeContext = '';
  }
}

// Function to load code for asking questions
async function askCode(filename) {
  try {
    const content = await fs.readFile(path.join(currentWorkingDir, filename), 'utf8');
    askCodeContext = content.trim();
    appendMessage('ai', `{green-fg}Code loaded for questioning from ${filename} successfully.{/}`, false);
    appendMessage('ai', `Loaded code:\n${askCodeContext}`, false);
  } catch (error) {
    appendMessage('ai', `{red-fg}Error loading file: ${error.message}{/}`, false);
    askCodeContext = '';
  }
}

// Function to execute shell command with user consent and update CWD
async function executeShellCommand(command) {
  // Ensure inputBox listeners are cleared at the start
  inputBox.removeAllListeners('submit');

  // Reset execution log for new command set
  shellCommandsExecutionLog = [];

  // Parse the command string into individual commands, preserving cat > filename << 'EOF' ... EOF blocks
  const commands = [];
  const lines = command.split('\n');
  let currentCommand = [];
  let inCatBlock = false;
  let catDelimiter = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.match(/^cat > .+ << ['"](EOF|DELIMITER)['"]$/)) {
      if (currentCommand.length > 0) {
        commands.push(currentCommand.join('\n'));
        currentCommand = [];
      }
      inCatBlock = true;
      catDelimiter = trimmedLine.match(/^cat > .+ << ['"]([^'"]+)['"]$/)[1];
      currentCommand.push(line);
    } else if (inCatBlock && trimmedLine === catDelimiter) {
      currentCommand.push(line);
      commands.push(currentCommand.join('\n'));
      currentCommand = [];
      inCatBlock = false;
      catDelimiter = null;
    } else {
      if (inCatBlock) {
        currentCommand.push(line);
      } else {
        commands.push(line);
      }
    }
  }

  if (currentCommand.length > 0) {
    commands.push(currentCommand.join('\n'));
  }

  if (commands.length === 0) {
    appendMessage('ai', '{gray-fg}No valid commands to execute.{/}', false);
    isShellPromptActive = false;
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
    inputBox.on('submit', handleInputSubmission);
    return;
  }

  let allSuccessful = true;

  for (const cmd of commands) {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) continue;

    appendMessage('ai', `{yellow-fg}Execute this command? (y/n): ${trimmedCmd}{/}`, false);
    inputBox.clearValue();
    inputBox.setValue('');
    inputBox.focus();
    isShellPromptActive = true;
    screen.render();

    const consent = await new Promise((resolve) => {
      const shellPromptHandler = (response) => {
        inputBox.removeListener('submit', shellPromptHandler);
        resolve(response.trim().toLowerCase());
      };
      inputBox.once('submit', shellPromptHandler);
    });

    isShellPromptActive = false; // Reset flag immediately after consent

    if (consent !== 'y') {
      appendMessage('ai', `{gray-fg}Command execution cancelled.{/}`, false);
      shellCommandsExecutionLog.push({
        command: trimmedCmd,
        success: false,
        stdout: '',
        stderr: '',
        error: 'Cancelled by user'
      });
      allSuccessful = false;
      continue;
    }

    let executionResult = { command: trimmedCmd, success: false, stdout: '', stderr: '', error: '' };

    if (trimmedCmd.startsWith('cd ')) {
      const newDir = trimmedCmd.substring(3).trim();
      const validation = await validateDirectoryPath(newDir);
      if (!validation.valid) {
        executionResult.error = validation.error;
        appendMessage('ai', `{red-fg}Error: ${executionResult.error}{/}`, false);
        shellCommandsExecutionLog.push(executionResult);
        allSuccessful = false;
      } else {
        try {
          process.chdir(validation.fullPath);
          currentWorkingDir = process.cwd();
          executionResult.success = true;
          appendMessage('ai', `{green-fg}Changed directory to ${currentWorkingDir}{/}`, false);
          shellCommandsExecutionLog.push(executionResult);
        } catch (error) {
          executionResult.error = `Error changing directory: ${error.message}`;
          appendMessage('ai', `{red-fg}${executionResult.error}{/}`, false);
          shellCommandsExecutionLog.push(executionResult);
          allSuccessful = false;
        }
      }
    } else {
      appendMessage('ai', `{gray-fg}Executing: ${trimmedCmd}{/}`, false);
      screen.render();

      try {
        // Special handling for cat commands creating tailwind.config.js
        let execOptions = { cwd: currentWorkingDir, encoding: 'utf8', timeout: 30000 };
        let commandToExecute = trimmedCmd;

        if (trimmedCmd.startsWith('cat > tailwind.config.js <<')) {
          // Write the file directly using fs.promises to avoid hanging
          const match = trimmedCmd.match(/^cat > tailwind\.config\.js << ['"]([^'"]+)['"]([\s\S]*?)\n\1$/m);
          if (match) {
            const content = match[2].trim();
            const filePath = path.join(currentWorkingDir, 'tailwind.config.js');
            try {
              await fs.writeFile(filePath, content);
              executionResult.success = true;
              executionResult.stdout = `Created tailwind.config.js at ${filePath}`;
              appendMessage('ai', `{green-fg}${executionResult.stdout}{/}`, false);
              appendMessage('ai', `{green-fg}Command executed successfully.{/}`, false);
            } catch (writeError) {
              throw new Error(`Failed to write tailwind.config.js: ${writeError.message}`);
            }
          } else {
            throw new Error('Invalid tailwind.config.js command format: unable to parse heredoc content');
          }
        } else {
          // Execute other commands with exec
          const { stdout, stderr } = await new Promise((resolve, reject) => {
            const child = exec(commandToExecute, execOptions);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
              stdout += data;
            });

            child.stderr.on('data', (data) => {
              stderr += data;
            });

            child.on('close', (code) => {
              if (code === 0) {
                resolve({ stdout, stderr });
              } else {
                reject(new Error(`Command exited with code ${code}`));
              }
            });

            child.on('error', (error) => {
              reject(error);
            });
          });

          executionResult.success = true;
          executionResult.stdout = stdout;
          executionResult.stderr = stderr;

          if (stdout) {
            appendMessage('ai', `{green-fg}Command output:{/}\n${stdout}`, false);
          }
          if (stderr) {
            appendMessage('ai', `{yellow-fg}Command warnings/errors:{/}\n${stderr}`, false);
          }
          appendMessage('ai', `{green-fg}Command executed successfully.{/}`, false);
        }

        shellCommandsExecutionLog.push(executionResult);
      } catch (error) {
        executionResult.error = error.message;
        executionResult.stderr = error.stderr || '';
        appendMessage('ai', `{red-fg}Error executing command: ${error.message}{/}`, false);
        if (error.stderr) {
          appendMessage('ai', `{red-fg}${error.stderr}{/}`, false);
        }
        shellCommandsExecutionLog.push(executionResult);
        allSuccessful = false;
      }
    }

    // Update UI after each command
    currentWorkingDir = process.cwd();
    updateStatusBar();
    await updateTreeBox();
    screen.render();
  }

  // Ensure final state is set correctly
  isShellPromptActive = false;
  inputBox.removeAllListeners('submit');

  // Display execution summary
  if (allSuccessful) {
    appendMessage('ai', `{green-fg}All commands executed successfully. Execution log available in shellCommandsExecutionLog.{/}`, false);
  } else {
    appendMessage('ai', `{yellow-fg}Some commands failed or were cancelled. Check execution log in shellCommandsExecutionLog for details:{/}`, false);
    let logSummary = shellCommandsExecutionLog.map(entry => {
      return `Command: ${entry.command}\nStatus: ${entry.success ? 'Success' : 'Failed'}\n` +
             (entry.stdout ? `Output: ${entry.stdout}\n` : '') +
             (entry.stderr ? `Warnings/Errors: ${entry.stderr}\n` : '') +
             (entry.error ? `Error: ${entry.error}\n` : '');
    }).join('\n---\n');
    appendMessage('ai', logSummary, false);
  }

  // Reset input box and reattach main handler
  inputBox.clearValue();
  inputBox.focus();
  screen.render();
  inputBox.on('submit', handleInputSubmission);
}


// Dedicated buffer for shell mode command generation
let shellCommandsBuffer = '';

// Log for shell command execution results
let shellCommandsExecutionLog = [];

// Add this function to validate directory existence
async function validateDirectoryPath(dirPath) {
  try {
    // Normalize and resolve the path relative to currentWorkingDir
    const fullPath = path.resolve(currentWorkingDir, dirPath.replace(/^["']|["']$/g, '').trim());
    const stats = await fs.stat(fullPath);
    if (!stats.isDirectory()) {
      return { valid: false, error: `Path is not a directory: ${fullPath}` };
    }
    return { valid: true, fullPath };
  } catch (error) {
    return { valid: false, error: `Directory does not exist or error validating: ${error.message}` };
  }
}

async function proposeDirPlan(query, latestPlan = '') {
  try {
    let plan = latestPlan;
    let buffer = '';
    let lastRenderedLength = 0;

    if (!plan) {
      const planPrompt = `You are a software project planner with a friendly, conversational tone. The user has requested a shell command sequence for: "${query}". Propose a high-level plan to accomplish this task, outlining the steps or commands needed (e.g., creating directories, installing dependencies, updating files). Use a conversational style, starting with phrases like "Let's set up..." or "We'll start by..." to engage the user, and maintain a clear, approachable tone throughout. Do not include actual shell commands or code blocks. Present the plan as a single, concise paragraph in markdown format, avoiding lists or bullet points. Ensure the plan aligns with the user's requirements. You may use Tailwind CSS via CDN (e.g., <script src="https://cdn.tailwindcss.com"></script>) for styling, but explicitly avoid generating or referencing tailwind.config.js or any Tailwind-related configuration files. Use plain CSS or Bootstrap as alternatives if configuration is needed.`;

      const spinnerFrames = ['|', '/', '-', '\\'];
      let spinnerIndex = 0;
      chatBox.insertBottom(`{gray-fg}Generating plan ${spinnerFrames[spinnerIndex]}{/}`);
      let lastLineIndex = chatBox.getLines().length - 1;
      const spinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(lastLineIndex, `{gray-fg}Generating plan ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(planPrompt);
        for await (const chunk of result.stream) {
          buffer += chunk.text();
          if (buffer.length > lastRenderedLength) {
            clearInterval(spinnerInterval);
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: planPrompt }, { role: 'user', content: query }],
          stream: true,
        });
        for await (const chunk of stream) {
          buffer += chunk.choices[0]?.delta?.content || '';
          if (buffer.length > lastRenderedLength) {
            clearInterval(spinnerInterval);
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      }

      clearInterval(spinnerInterval);
      if (buffer.length > lastRenderedLength) {
        const remainingContent = buffer.slice(lastRenderedLength);
        const markedRemainingContent = marked(remainingContent);
        chatBox.deleteLine(lastLineIndex);
        chatBox.insertBottom(markedRemainingContent);
        chatBox.setScrollPerc(100);
        screen.render();
        lastLineIndex = chatBox.getLines().length - 1;
      } else {
        chatBox.deleteLine(lastLineIndex);
      }

      plan = buffer;
    }

    // Prompt user for execution choice
    appendMessage('ai', `{green-fg}Proposed Plan for "${query}":{/}\n${plan}\n{yellow-fg}Execute this plan? [a]uto, [s]tep-by-step, [c]ancel:{/}`, false);
    await fs.appendFile(tempChatFile, `## AI\nProposed Plan for "${query}":\n${plan}\n\n`);

    inputBox.removeAllListeners('submit');

    const choice = await new Promise((resolve) => {
      const choiceHandler = (response) => {
        inputBox.removeListener('submit', choiceHandler);
        resolve(response.trim().toLowerCase());
      };
      inputBox.once('submit', choiceHandler);
    });

    if (choice === 'a' || choice === 's') {
      const commandPrompt = `You are a shell command generator. The user has approved the following plan for: "${query}":\n\n${plan}\n\nGenerate a sequence of shell commands to accomplish the task described in the plan. For directory creation, use 'mkdir -p'. For file creation, use only the 'cat > filename << 'EOF' ... EOF' syntax. Do not use 'echo' or other commands for file writing. Ensure the code content within 'EOF' blocks is syntactically correct and executable as-is, without adding escape characters (e.g., no backslashes before backticks, quotes, or other special characters in JavaScript code, such as template literals like \`\`App \${isDarkMode ? 'dark-mode' : ''}\`\`). The user will handle any necessary escaping manually. You may use Tailwind CSS via CDN (e.g., <script src="https://cdn.tailwindcss.com"></script>) for styling, but explicitly avoid generating or referencing tailwind.config.js or any Tailwind-related configuration files. Use plain CSS or Bootstrap as alternatives if configuration is needed. Output all commands in a single markdown code block with 'bash' syntax highlighting, separating each command with a newline.`;

      const spinnerFrames = ['|', '/', '-', '\\'];
      let spinnerIndex = 0;
      chatBox.insertBottom(`{gray-fg}Generating commands ${spinnerFrames[spinnerIndex]}{/}`);
      let lastLineIndex = chatBox.getLines().length - 1;
      const cmdSpinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(lastLineIndex, `{gray-fg}Generating commands ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      buffer = '';

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContent(commandPrompt);
        buffer = result.response.text();
      } else if (currentProvider === 'OpenAI') {
        const response = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: commandPrompt }, { role: 'user', content: query }],
          stream: false,
        });
        buffer = response.choices[0].message.content;
      }

      clearInterval(cmdSpinnerInterval);
      chatBox.deleteLine(lastLineIndex);

      const codeBlockMatch = buffer.match(/```bash\n([\s\S]*?)\n```/);
      const commands = codeBlockMatch ? codeBlockMatch[1].trim() : buffer;
      if (commands) {
        appendMessage('ai', `{green-fg}Generated commands for "${query}":{/}\n\`\`\`bash\n${commands}\n\`\`\``, false);
        await executeShellCommand(commands, choice === 'a');
      } else {
        appendMessage('ai', `{red-fg}No commands generated for "${query}".{/}`, false);
      }
    } else {
      appendMessage('ai', `{gray-fg}Please describe what needs to change in the proposed plan:{/}`, false);
      inputBox.clearValue();
      inputBox.setValue('');
      inputBox.focus();
      screen.render();

      inputBox.removeAllListeners('submit');

      const modification = await new Promise((resolve) => {
        const modificationHandler = (response) => {
          inputBox.removeListener('submit', modificationHandler);
          resolve(response.trim());
        };
        inputBox.once('submit', modificationHandler);
      });

      appendMessage('user', modification, false);
      await fs.appendFile(tempChatFile, `## User\n${modification}\n\n`);

      inputBox.clearValue();
      inputBox.focus();
      screen.render();

      const revisedPrompt = `You are a software project planner with a friendly, conversational tone. The user has requested a shell command sequence for: "${query}". The current plan is: "${plan}". The user has provided the following modification to the plan: "${modification}". Revise the current plan to incorporate the modification, ensuring the revised plan aligns with the user's requirements and the modification. Use a conversational style, starting with phrases like "Let's set up..." or "We'll start by..." to engage the user, and maintain a clear, approachable tone throughout. Do not include actual shell commands or code blocks. Present the revised plan as a single, concise paragraph in markdown format, avoiding lists or bullet points. You may use Tailwind CSS via CDN (e.g., <script src="https://cdn.tailwindcss.com"></script>) for styling, but explicitly avoid generating or referencing tailwind.config.js or any Tailwind-related configuration files. Use plain CSS or Bootstrap as alternatives if configuration is needed.`;
      buffer = '';
      lastRenderedLength = 0;

      const spinnerFrames = ['|', '/', '-', '\\'];
      let spinnerIndex = 0;
      chatBox.insertBottom(`{gray-fg}Generating revised plan ${spinnerFrames[spinnerIndex]}{/}`);
      let lastLineIndex = chatBox.getLines().length - 1;
      const newSpinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(lastLineIndex, `{gray-fg}Generating revised plan ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(revisedPrompt);
        for await (const chunk of result.stream) {
          buffer += chunk.text();
          if (buffer.length > lastRenderedLength) {
            clearInterval(newSpinnerInterval);
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: revisedPrompt }, { role: 'user', content: modification }],
          stream: true,
        });
        for await (const chunk of stream) {
          buffer += chunk.choices[0]?.delta?.content || '';
          if (buffer.length > lastRenderedLength) {
            clearInterval(newSpinnerInterval);
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      }

      clearInterval(newSpinnerInterval);
      if (buffer.length > lastRenderedLength) {
        const remainingContent = buffer.slice(lastRenderedLength);
        const markedRemainingContent = marked(remainingContent);
        chatBox.deleteLine(lastLineIndex);
        chatBox.insertBottom(markedRemainingContent);
        chatBox.setScrollPerc(100);
        screen.render();
      } else {
        chatBox.deleteLine(lastLineIndex);
      }

      await proposeDirPlan(query, buffer);
    }

    inputBox.removeAllListeners('submit');
    inputBox.on('submit', handleInputSubmission);
  } catch (error) {
    appendMessage('ai', `{red-fg}Error generating plan: ${error.message}{/}`, false);
  }
}


async function proposeShell(query) {
  try {
    const commandPrompt = `You are a shell command generator. The user has requested: "${query}". Generate a sequence of shell commands to accomplish the task without any reasoning or observation. For directory creation, use 'mkdir -p'. For file creation, use only the 'cat > filename << 'EOF' ... EOF' syntax. Do not use 'echo' or other commands for file writing. Ensure the code content within 'EOF' blocks is syntactically correct and executable as-is, without adding escape characters (e.g., no backslashes before backticks, quotes, or other special characters in JavaScript code, such as template literals like \`\`App \${isDarkMode ? 'dark-mode' : ''}\`\`). The user will handle any necessary escaping manually. You may use Tailwind CSS via CDN (e.g., <script src="https://cdn.tailwindcss.com"></script>) for styling, but explicitly avoid generating or referencing tailwind.config.js or any Tailwind-related configuration files. Use plain CSS or Bootstrap as alternatives if configuration is needed. Output all commands in a single markdown code block with 'bash' syntax highlighting, separating each command with a newline.`;

    const spinnerFrames = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;
    chatBox.insertBottom(`{gray-fg}Generating commands ${spinnerFrames[spinnerIndex]}{/}`);
    let lastLineIndex = chatBox.getLines().length - 1;
    const spinnerInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      chatBox.setLine(lastLineIndex, `{gray-fg}Generating commands ${spinnerFrames[spinnerIndex]}{/}`);
      screen.render();
    }, 100);

    let buffer = '';

    if (currentProvider === 'Gemini') {
      const result = await currentModel.generateContent(commandPrompt);
      buffer = result.response.text();
    } else if (currentProvider === 'OpenAI') {
      const response = await openAI.chat.completions.create({
        model: currentModel,
        messages: [{ role: 'system', content: commandPrompt }, { role: 'user', content: query }],
        stream: false,
      });
      buffer = response.choices[0].message.content;
    }

    clearInterval(spinnerInterval);
    chatBox.deleteLine(lastLineIndex);

    // Extract commands from markdown code block
    const codeBlockMatch = buffer.match(/```bash\n([\s\S]*?)\n```/);
    const commands = codeBlockMatch ? codeBlockMatch[1].trim() : buffer;
    if (commands) {
      appendMessage('ai', `{green-fg}Generated commands for "${query}":{/}\n\`\`\`bash\n${commands}\n\`\`\``, false);
      await executeShellCommand(commands);
    } else {
      appendMessage('ai', `{red-fg}No commands generated for "${query}".{/}`, false);
    }
  } catch (error) {
    appendMessage('ai', `{red-fg}Error generating commands: ${error.message}{/}`, false);
  }
}




async function executeShellCommand(command, autoExecute = false) {
  // Ensure inputBox listeners are cleared at the start
  inputBox.removeAllListeners('submit');

  // Reset execution log for new command set
  shellCommandsExecutionLog = [];

  // Parse the command string into individual commands, preserving cat > filename << 'EOF' ... EOF blocks
  const commands = [];
  const lines = command.split('\n');
  let currentCommand = [];
  let inCatBlock = false;
  let catDelimiter = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.match(/^cat > .+ << ['"](EOF|DELIMITER)['"]$/)) {
      if (currentCommand.length > 0) {
        commands.push(currentCommand.join('\n'));
        currentCommand = [];
      }
      inCatBlock = true;
      catDelimiter = trimmedLine.match(/^cat > .+ << ['"]([^'"]+)['"]$/)[1];
      currentCommand.push(line);
    } else if (inCatBlock && trimmedLine === catDelimiter) {
      currentCommand.push(line);
      commands.push(currentCommand.join('\n'));
      currentCommand = [];
      inCatBlock = false;
      catDelimiter = null;
    } else {
      if (inCatBlock) {
        currentCommand.push(line);
      } else {
        commands.push(line);
      }
    }
  }

  if (currentCommand.length > 0) {
    commands.push(currentCommand.join('\n'));
  }

  if (commands.length === 0) {
    appendMessage('ai', '{gray-fg}No valid commands to execute.{/}', false);
    isShellPromptActive = false;
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
    inputBox.on('submit', handleInputSubmission);
    return;
  }

  let allSuccessful = true;

  // Utility function to add a delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const cmd of commands) {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) continue;

    // Generate a narrative message based on the command
    let narrative = '';
    if (trimmedCmd.startsWith('cd ')) {
      narrative = `Ok, let's change to the directory using \`${trimmedCmd}\`...`;
    } else if (trimmedCmd.startsWith('mkdir ')) {
      narrative = `Alright, let's create the directory with \`${trimmedCmd}\`...`;
    } else if (trimmedCmd.startsWith('cat >')) {
      narrative = `Now, let's create or update the file with \`${trimmedCmd.split('<<')[0].trim()}\`...`;
    } else if (trimmedCmd.startsWith('npm ') || trimmedCmd.startsWith('yarn ') || trimmedCmd.startsWith('pnpm ')) {
      narrative = `Time to install dependencies using \`${trimmedCmd}\`...`;
    } else {
      narrative = `Let's execute this command: \`${trimmedCmd}\`...`;
    }

    // Display narrative message
    appendMessage('ai', `{gray-fg}${narrative}{/}`, false);
    screen.render();
    await delay(100); // Brief delay for visibility

    let executionResult = { command: trimmedCmd, success: false, stdout: '', stderr: '', error: '' };

    if (!autoExecute) {
      // Step-by-step mode: prompt for consent
      appendMessage('ai', `{yellow-fg}Execute this command? (y/n): ${trimmedCmd}{/}`, false);
      inputBox.clearValue();
      inputBox.setValue('');
      inputBox.focus();
      isShellPromptActive = true;
      screen.render();

      const consent = await new Promise((resolve) => {
        const shellPromptHandler = (response) => {
          inputBox.removeListener('submit', shellPromptHandler);
          resolve(response.trim().toLowerCase());
        };
        inputBox.once('submit', shellPromptHandler);
      });

      isShellPromptActive = false;

      if (consent !== 'y') {
        appendMessage('ai', `{gray-fg}Command execution cancelled.{/}`, false);
        executionResult = {
          command: trimmedCmd,
          success: false,
          stdout: '',
          stderr: '',
          error: 'Cancelled by user'
        };
        shellCommandsExecutionLog.push(executionResult);
        allSuccessful = false;
        continue;
      }
    }

    // Execute the command
    if (trimmedCmd.startsWith('cd ')) {
      const newDir = trimmedCmd.substring(3).trim();
      const validation = await validateDirectoryPath(newDir);
      if (!validation.valid) {
        executionResult.error = validation.error;
        appendMessage('ai', `{red-fg}Error: ${executionResult.error}{/}`, false);
        shellCommandsExecutionLog.push(executionResult);
        allSuccessful = false;
      } else {
        try {
          process.chdir(validation.fullPath);
          currentWorkingDir = process.cwd();
          executionResult.success = true;
          appendMessage('ai', `{green-fg}Changed directory to ${currentWorkingDir}{/}`, false);
          shellCommandsExecutionLog.push(executionResult);
        } catch (error) {
          executionResult.error = `Error changing directory: ${error.message}`;
          appendMessage('ai', `{red-fg}${executionResult.error}{/}`, false);
          shellCommandsExecutionLog.push(executionResult);
          allSuccessful = false;
        }
      }
    } else {
      appendMessage('ai', `{gray-fg}Executing: ${trimmedCmd}{/}`, false);
      screen.render();

      try {
        let execOptions = { cwd: currentWorkingDir, encoding: 'utf8', timeout: 30000 };
        let commandToExecute = trimmedCmd;

        if (trimmedCmd.startsWith('cat > tailwind.config.js <<')) {
          const match = trimmedCmd.match(/^cat > tailwind\.config\.js << ['"]([^'"]+)['"]([\s\S]*?)\n\1$/m);
          if (match) {
            const content = match[2].trim();
            const filePath = path.join(currentWorkingDir, 'tailwind.config.js');
            try {
              await fs.writeFile(filePath, content);
              executionResult.success = true;
              executionResult.stdout = `Created tailwind.config.js at ${filePath}`;
              appendMessage('ai', `{green-fg}${executionResult.stdout}{/}`, false);
              appendMessage('ai', `{green-fg}Command executed successfully.{/}`, false);
            } catch (writeError) {
              throw new Error(`Failed to write tailwind.config.js: ${writeError.message}`);
            }
          } else {
            throw new Error('Invalid tailwind.config.js command format: unable to parse heredoc content');
          }
        } else {
          const { stdout, stderr } = await new Promise((resolve, reject) => {
            const child = exec(commandToExecute, execOptions);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
              stdout += data;
            });

            child.stderr.on('data', (data) => {
              stderr += data;
            });

            child.on('close', (code) => {
              if (code === 0) {
                resolve({ stdout, stderr });
              } else {
                reject(new Error(`Command exited with code ${code}`));
              }
            });

            child.on('error', (error) => {
              reject(error);
            });
          });

          executionResult.success = true;
          executionResult.stdout = stdout;
          executionResult.stderr = stderr;

          if (stdout) {
            appendMessage('ai', `{green-fg}Command output:{/}\n${stdout}`, false);
          }
          if (stderr) {
            appendMessage('ai', `{yellow-fg}Command warnings/errors:{/}\n${stderr}`, false);
          }
          appendMessage('ai', `{green-fg}Command executed successfully.{/}`, false);
        }

        shellCommandsExecutionLog.push(executionResult);
      } catch (error) {
        executionResult.error = error.message;
        executionResult.stderr = error.stderr || '';
        appendMessage('ai', `{red-fg}Error executing command: ${error.message}{/}`, false);
        if (error.stderr) {
          appendMessage('ai', `{red-fg}${error.stderr}{/}`, false);
        }
        shellCommandsExecutionLog.push(executionResult);
        allSuccessful = false;
      }
    }

    currentWorkingDir = process.cwd();
    updateStatusBar();
    await updateTreeBox();
    screen.render();
  }

  isShellPromptActive = false;
  inputBox.removeAllListeners('submit');

  if (allSuccessful) {
    appendMessage('ai', `{green-fg}All commands executed successfully. Execution log available in shellCommandsExecutionLog.{/}`, false);
  } else {
    appendMessage('ai', `{yellow-fg}Some commands failed or were cancelled. Check execution log in shellCommandsExecutionLog for details:{/}`, false);
    let logSummary = shellCommandsExecutionLog.map(entry => {
      return `Command: ${entry.command}\nStatus: ${entry.success ? 'Success' : 'Failed'}\n` +
             (entry.stdout ? `Output: ${entry.stdout}\n` : '') +
             (entry.stderr ? `Warnings/Errors: ${entry.stderr}\n` : '') +
             (entry.error ? `Error: ${entry.error}\n` : '');
    }).join('\n---\n');
    appendMessage('ai', logSummary, false);
  }

  inputBox.clearValue();
  inputBox.focus();
  screen.render();
  inputBox.on('submit', handleInputSubmission);
}


// Function to show available commands and key bindings
function showHelp() {
  const note = `**Important Note:** Navigate the UI using keyboard key bindings (e.g., Esc to focus the folder tree, i for input, c for chat area, s for save button, m for multiline input). Use the mouse only for scrolling the chat area or tree; avoid clicking UI elements to select them while the input box is active. Clicking UI elements without first disabling input focus (via Esc) may cause double character input issues. After pressing Esc, mouse clicks can be used safely to interact with UI elements like the folder tree or save button. Always prioritize key bindings for selection and navigation to ensure a smooth experience. To paste content in multiline input box including error pasting can be done with ctrl+shift+v and right click, multiline input box is used for typing and pasting multiple line content, all queries will be submitted only with the main input combining the content of multiline input.`;

  appendMessage('ai', `{bold}{yellow-fg}${note}{/}\n`, false);
  const commandText = '{bold}{gray-fg}Commands:{/}\n' +
    Object.entries(commands)
      .map(([cmd, desc]) => `  {blue-fg}${cmd}{/} - ${desc}`)
      .join('\n');
  const keyBindingText = '{bold}{gray-fg}Key Bindings:{/}\n' +
    Object.entries(keyBindings)
      .map(([key, desc]) => `  {blue-fg}${key}{/} - ${desc}`)
      .join('\n');
  appendMessage('ai', `${commandText}\n\n${keyBindingText}`, false);
}

// Function to copy all code blocks to clipboard
async function copyCodeToClipboard() {
  await extractCodeBlocksFromTempFile();
  if (lastCodeBlocks.length === 0) {
    appendMessage('ai', '{red-fg}No code to copy.{/}', false);
    return;
  }

  let combinedCode = lastCodeBlocks.map(block => block.code).join('\n\n');
  const isTermux = process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux');

  if (isTermux) {
    try {
      // Check if termux-clipboard-set is available
      execSync('command -v termux-clipboard-set', { stdio: 'ignore' });
      // Write to a temp file and pipe to termux-clipboard-set
      const tempFile = path.join(currentWorkingDir, `.temp-clipboard-${Date.now()}.txt`);
      await fs.writeFile(tempFile, combinedCode);
      execSync(`cat "${tempFile}" | termux-clipboard-set`, { stdio: 'pipe' });
      appendMessage('ai', '{green-fg}Code copied to Termux clipboard.{/}', false);
      await fs.unlink(tempFile).catch(() => {});
    } catch (error) {
      let errorMessage = `{red-fg}Failed to copy to Termux clipboard: ${error.message}. `;
      if (error.message.includes('command -v termux-clipboard-set')) {
        errorMessage += 'Ensure Termux:API is installed (pkg install termux-api) and the Termux:API app is installed from the Play Store. ';
      }
      errorMessage += 'Saved to temp-clipboard.txt instead.{/}';
      appendMessage('ai', errorMessage, false);
      await fs.writeFile(path.join(currentWorkingDir, 'temp-clipboard.txt'), combinedCode);
    }
  } else {
    appendMessage('ai', '{yellow-fg}Clipboard not supported on this platform. Saved to temp-clipboard.txt.{/}', false);
    await fs.writeFile(path.join(currentWorkingDir, 'temp-clipboard.txt'), combinedCode);
  }
}

// Function to fetch and display available Gemini models
async function setupGeminiModelSelection(callback) {
  try {
    if (availableModels.length === 0) {
      const response = await axios.get('https://generativelanguage.googleapis.com/v1beta/models', {
        params: { key: process.env.GEMINI_API_KEY },
      });

      availableModels = response.data.models
        .filter(model => model.supportedGenerationMethods.includes('generateContent'))
        .map(model => model.name.split('/')[1]);
    }

    if (availableModels.length === 0) {
      modelList.setItems(['{red-fg}No models available. Check Gemini API key or network.{/}']);
      screen.render();
      return;
    }

    modelList.setItems(availableModels.map(m => `{blue-fg}${m}{/}`));
    modelInstruction.setContent('{gray-fg}Use arrow keys to select a model, then press Enter.{/}');
    providerList.hide();
    providerInstruction.hide();
    openAIBaseURLForm.hide();
    openAIModelForm.hide();
    saveConButton.hide(); // Hide save conversation button
    modelList.show();
    modelInstruction.show();
    modelList.focus();
    screen.render();

    modelList.removeAllListeners('select');
    modelList.on('select', (item, index) => {
      const selectedModel = availableModels[index];
      callback(selectedModel);
      modelList.removeAllListeners('select');
    });
  } catch (error) {
    modelList.setItems([`{red-fg}Error fetching models: ${error.message}{/}`]);
    screen.render();
  }
}

// Function to prompt for OpenAI base URL and model name
function promptOpenAIModel(callback) {
  providerList.hide();
  providerInstruction.hide();
  modelList.hide();
  modelInstruction.hide();
  openAIModelForm.hide();
  saveConButton.hide(); // Hide save conversation button
  openAIBaseURLForm.show();
  openAIBaseURLInput.setValue('https://openrouter.ai/api/v1'); // Reset to placeholder
  openAIBaseURLInput.focus();
  screen.render();

  openAIBaseURLInput.removeAllListeners('submit');
  openAIBaseURLInput.on('submit', (baseURL) => {
    baseURL = baseURL.trim();
    if (!baseURL) {
      appendMessage('ai', '{red-fg}Please enter a valid base URL.{/}', false);
      openAIBaseURLInput.focus();
      screen.render();
      return;
    }

    openAIBaseURLForm.hide();
    openAIModelForm.show();
    saveConButton.hide(); // Hide save conversation button
    openAIModelInput.clearValue();
    openAIModelInput.focus();
    screen.render();

    openAIModelInput.removeAllListeners('submit');
    openAIModelInput.on('submit', (modelName) => {
      if (!modelName.trim()) {
        appendMessage('ai', '{red-fg}Please enter a valid model name.{/}', false);
        openAIModelInput.focus();
        screen.render();
        return;
      }
      callback(modelName.trim(), baseURL);
      openAIModelInput.removeAllListeners('submit');
    });
  });
}



// Function to prompt for API key using a password-style input
async function promptAPIKey(provider) {
  const displayProvider = provider === 'OpenAI' ? 'OpenAI Compatible' : provider;
  const apiKeyForm = blessed.form({
    top: 0,
    left: 0,
    width: '100%',
    height: 1, // Single-line input without border
    style: { bg: 'black' },
  });

  const apiKeyLabel = blessed.text({
    parent: apiKeyForm,
    top: 0,
    left: 1,
    content: `{gray-fg}Enter ${displayProvider} API Key (Ctrl+Shift+V/right-click to paste, Enter to skip): {/}`,
    tags: true,
  });

  const apiKeyInput = blessed.textbox({
    parent: apiKeyForm,
    top: 0,
    left: `Enter ${displayProvider} API Key (Ctrl+Shift+V/right-click to paste, Enter to skip): `.length + 3,
    width: '100%-2',
    height: 1,
    inputOnFocus: true,
    censor: true, // Mask input as asterisks
    style: { fg: '#d4d4d4', bg: 'black' },
  });

  screen.append(apiKeyForm);
  providerList.hide();
  providerInstruction.hide();
  modelList.hide();
  modelInstruction.hide();
  openAIBaseURLForm.hide();
  openAIModelForm.hide();
  saveConButton.hide();
  multiLineInputBox.hide();
  apiKeyInput.focus();
  screen.render();

  return new Promise((resolve) => {
    apiKeyInput.removeAllListeners('submit');
    apiKeyInput.on('submit', async (apiKey) => {
      apiKey = apiKey.trim();
      apiKeyForm.hide();
      screen.remove(apiKeyForm);

      if (!apiKey) {
        // User skipped input by pressing Enter
        resolve(false); // Indicate skip
        return;
      }

      try {
        // Read existing .env file
        let envContent = '';
        try {
          envContent = await fs.readFile(path.join(process.cwd(), '.env'), 'utf8');
        } catch {
          envContent = '';
        }

        // Update or add the API key for the selected provider
        let updatedEnv = '';
        if (provider === 'Gemini') {
          if (envContent.includes('GEMINI_API_KEY=')) {
            updatedEnv = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY="${apiKey}"`);
          } else {
            updatedEnv = envContent + (envContent ? '\n' : '') + `GEMINI_API_KEY="${apiKey}"`;
          }
        } else if (provider === 'OpenAI') {
          if (envContent.includes('OPENAI_API_KEY=')) {
            updatedEnv = envContent.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY="${apiKey}"`);
          } else {
            updatedEnv = envContent + (envContent ? '\n' : '') + `OPENAI_API_KEY="${apiKey}"`;
          }
        }

        // Write updated .env file
        await fs.writeFile(path.join(process.cwd(), '.env'), updatedEnv);

        // Immediately clear dotenv cache and reload environment variables
        delete require.cache[require.resolve('dotenv')];
        require('dotenv').config();

        // Update in-memory environment variable
        process.env[provider === 'Gemini' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY'] = apiKey;

        resolve(true); // Indicate key was provided
      } catch (error) {
        appendMessage('ai', `{red-fg}Error saving API key: ${error.message}{/}`, false);
        resolve(false); // Treat error as skip to return to provider menu
      }
    });
  });
}






// Function to initialize the chat assistant
async function initializeChatAssistant(provider, modelName, baseURL = null) {
  currentProvider = provider;

  // Reload .env file to ensure latest API keys
  delete require.cache[require.resolve('dotenv')];
  require('dotenv').config();

  if (provider === 'Gemini') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    currentModel = genAI.getGenerativeModel({ model: modelName });
  } else if (provider === 'OpenAI') {
    openAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: baseURL,
    });
    currentModel = modelName;
  }

  providerList.hide();
  providerInstruction.hide();
  modelList.hide();
  modelInstruction.hide();
  openAIBaseURLForm.hide();
  openAIModelForm.hide();
  inputForm.show();
  chatBox.show();
  treeBox.show();
  statusBar.show();
  saveConButton.show();
  multiLineInputBox.show();
  chatBox.setContent(`{gray-fg}Chat started with ${provider} (${modelName})\nType a query or command above.{/}`);
  await initializeTempChatFile();
  await fs.appendFile(tempChatFile, `## ${provider} (${modelName})\nChat started with ${provider}\nType a query or command above.\n\n`);
  updateStatusBar();
  await updateTreeBox();
  inputBox.focus();
  screen.render();
}

// Function to change the provider/model mid-chat
function changeModel() {
  setupProviderSelection();
}

// Function to setup provider selection
async function setupProviderSelection() {
  // Check if .env file exists, create with placeholders if missing
  const envPath = path.join(process.cwd(), '.env');
  try {
    await fs.access(envPath);
  } catch {
    await fs.writeFile(envPath, 'GEMINI_API_KEY="your_gemini_api_key"\nOPENAI_API_KEY="your_openai_api_key"\n');
  }

  // Load environment variables
  require('dotenv').config();

  // Create ASCII logo screen
  const logoBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    content: `{green-fg}

               ██╗ ██╗██╗  ██╗██╗   ██╗███████╗     █████╗ ██╗
              ███║███║██║ ██╔╝██║   ██║╚════██║    ██╔══██╗██║
              ╚██║╚██║█████╔╝ ██║   ██║    ██╔╝    ███████║██║
               ██║ ██║██╔═██╗ ██║   ██║   ██╔╝     ██╔══██║██║
               ██║ ██║██║  ██╗╚██████╔╝   ██║      ██║  ██║██║
               ╚═╝ ╚═╝╚═╝  ╚═╝ ╚═════╝    ╚═╝      ╚═╝  ╚═╝╚═╝

  ███╗   ██╗ ██████╗ ██████╗ ███████╗ ██████╗ ██████╗ ██████╗ ███████╗██████╗
  ████╗  ██║██╔═══██╗██╔══██╗██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗
  ██╔██╗ ██║██║   ██║██║  ██║█████╗  ██║     ██║   ██║██║  ██║█████╗  ██████╔╝
  ██║╚██╗██║██║   ██║██║  ██║██╔══╝  ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗
  ██║ ╚████║╚██████╔╝██████╔╝███████╗╚██████╗╚██████╔╝██████╔╝███████╗██║  ██║
  ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝
{/}
{gray-fg}   \n\nPress Enter to continue...{/}`,
    tags: true,
    style: { bg: 'black' },
  });

  screen.append(logoBox);
  logoBox.focus();
  screen.render();

  // Wait for Enter key
  logoBox.key(['enter'], () => {
    screen.remove(logoBox);
    showProviderSelection();
  });

  function showProviderSelection() {
    availableModels = [];
    providerList.setItems(['{blue-fg}Gemini{/}', '{blue-fg}OpenAI Compatible{/}']);
    providerInstruction.setContent('{gray-fg}Use arrow keys to select a provider, then press Enter.{/}');
    inputForm.hide();
    chatBox.hide();
    treeBox.hide();
    statusBar.hide();
    modelList.hide();
    modelInstruction.hide();
    openAIBaseURLForm.hide();
    openAIModelForm.hide();
    saveConButton.hide();
    multiLineInputBox.hide();
    providerList.show();
    providerInstruction.show();
    providerList.focus();
    screen.render();

    providerList.removeAllListeners('select');
    providerList.on('select', async (item, index) => {
      const selectedProvider = index === 0 ? 'Gemini' : 'OpenAI';
      
      // Reload .env file to ensure latest API keys
      delete require.cache[require.resolve('dotenv')];
      require('dotenv').config();

      // Check API key for selected provider
      const apiKey = selectedProvider === 'Gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
      const isInvalidKey = !apiKey || apiKey === `your_${selectedProvider.toLowerCase()}_api_key` || apiKey === '';

      if (selectedProvider === 'Gemini') {
        if (isInvalidKey) {
          const keyProvided = await promptAPIKey(selectedProvider);
          if (!keyProvided) {
            // User skipped or error, return to provider selection
            setupProviderSelection();
            return;
          }
        }
        setupGeminiModelSelection((selectedModel) => {
          initializeChatAssistant('Gemini', selectedModel);
          appendMessage('ai', `{green-fg}Provider changed to Gemini (${selectedModel}) successfully, continue chatting.{/}`, false);
        });
      } else {
        promptOpenAIModel(async (modelName, baseURL) => {
          // Prompt for API key after base URL and model name
          if (isInvalidKey) {
            const keyProvided = await promptAPIKey('OpenAI');
            if (!keyProvided) {
              // User skipped or error, return to provider selection
              setupProviderSelection();
              return;
            }
          }
          initializeChatAssistant('OpenAI', modelName, baseURL);
          appendMessage('ai', `{green-fg}Provider changed to OpenAI Compatible (${modelName}) successfully, continue chatting.{/}`, false);
        });
      }
      providerList.removeAllListeners('select');
    });
  }
}


// Handle AI response (Gemini or OpenAI)
async function getAIResponse(query) {
  if (!currentModel) return;

  // Initialize spinner
  const spinnerFrames = ['|', '/', '-', '\\'];
  let spinnerIndex = 0;
  chatBox.insertBottom(`{gray-fg}Processing ${spinnerFrames[spinnerIndex]}{/}`);
  let lastLineIndex = chatBox.getLines().length - 1;
  const spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    chatBox.setLine(lastLineIndex, `{gray-fg}Processing ${spinnerFrames[spinnerIndex]}{/}`);
    screen.render();
  }, 100);

  try {
    if (dirMode) {
      clearInterval(spinnerInterval);
      chatBox.deleteLine(lastLineIndex);
      await proposeDirPlan(query);
      return;
    }

    if (shellMode) {
      clearInterval(spinnerInterval);
      chatBox.deleteLine(lastLineIndex);
      await proposeShell(query);
      return;
    }

    if (editDirMode && editDirContext) {
      clearInterval(spinnerInterval);
      chatBox.deleteLine(lastLineIndex);
      await proposeEditDirPlan(query, editDirPath);
      return;
    }

    let systemPrompt = '';
    if (codeOnlyMode) {
      systemPrompt = loadedCodeContext
        ? `You are a code generator. Below is the existing code that you must include in your response exactly as-is, unless the user explicitly instructs you to modify, add to, remove from, or replace it:\n\n\`\`\`\n${loadedCodeContext}\n\`\`\`\n\nBased on the user's query, append or modify the code as requested without any reasoning or observation. Provide the full updated code in a markdown code block with the appropriate language syntax highlighting (e.g., \`\`\`python).`
        : "You are a code generator. When a user asks for code, generate the code directly without any reasoning or observation. Provide the code in a markdown code block with the appropriate language syntax highlighting.";
    } else if (webappOnlyMode) {
      systemPrompt = loadedCodeContext
        ? `You are a web app generator. Below is the existing web app HTML code that you must include in your response exactly as-is, unless the user explicitly instructs you to modify, add to, remove from, or replace it:\n\n\`\`\`html\n${loadedCodeContext}\n\`\`\`\n\nBased on the user's query, append or modify the code as requested without any reasoning or observation. Generate a single HTML file with all JavaScript embedded within a <script> tag inside the <body>. Use Tailwind CSS classes for styling directly in the HTML. Do not include separate CSS code. Include the Tailwind CSS CDN script tag in the HTML <head> section: <script src="https://cdn.tailwindcss.com"></script>. Provide the full updated code in a single markdown code block with \`\`\`html syntax highlighting.`
        : "You are a web app generator. When a user asks for a web app, generate the code directly without any reasoning or observation. Generate a single HTML file with all JavaScript embedded within a <script> tag inside the <body>. Use Tailwind CSS classes for styling directly in the HTML. Do not include separate CSS code. Include the Tailwind CSS CDN script tag in the HTML <head> section: <script src=\"https://cdn.tailwindcss.com\"></script>. Provide the full code in a single markdown code block with \`\`\`html syntax highlighting.";
    } else if (digestMode && digestContext) {
      systemPrompt = `You are a project analyst. Below is the digested content of a project, including directory structure and code files:\n\n${digestContext}\n\nUse this context to answer the user's query about the project. Provide detailed and relevant responses based on the digested content.`;
    } else if (askCodeContext) {
      systemPrompt = `You are a code analyst. Below is the code loaded for questioning. Do not modify it unless explicitly asked; instead, answer questions about it based on the user's query:\n\n\`\`\`\n${askCodeContext}\n\`\`\`\n\n`;
    } else if (isConversationLoaded && loadedCodeContext) {
      systemPrompt = `You are a code generator continuing a previous conversation. Below is the existing code from the loaded conversation that you must include in your response exactly as-is, unless the user explicitly instructs you to modify, add to, remove from, or replace it:\n\n\`\`\`\n${loadedCodeContext}\n\`\`\`\n\nBased on the user's query, append or modify the code as requested without any reasoning or observation. Provide the full updated code in a markdown code block with the appropriate language syntax highlighting (e.g., \`\`\`python).`;
    } else if (askDirMode && askDirContext) {
      systemPrompt = `You are a code analyst with a friendly, conversational tone. Below is the content of files in a project directory "${askDirPath}":\n\n${askDirContext}\n\nAnswer the user's query about the codebase, providing detailed and relevant responses based on the file contents. Use a conversational style, starting with phrases like "Let's dive into..." or "Looking at the codebase..." to engage the user, and maintain a clear, approachable tone throughout (e.g., "To run the project, you'll first need to install dependencies with npm install, then start the server with npm start..."). Do not use markdown code blocks for commands, code snippets, or examples; instead, embed them directly in the conversational text. Do not modify the code unless explicitly asked. Ensure all responses are in plain markdown paragraphs without code blocks.`;
    }
    const fullQuery = systemPrompt ? `${systemPrompt}\n\n${query}` : query;

    let buffer = '';
    let lastRenderedLength = 0;
    const MIN_RENDER_LENGTH = 500; // Increased to buffer larger chunks
    const SENTENCE_DELIMITERS = /[.!?]\s+/; // Sentence-ending punctuation followed by space
    const CHAT_WIDTH = Math.floor(screen.width * 0.7 - 10); // Approximate chatBox width (70% of screen minus padding/borders)

    // Function to wrap text to fit chatBox width
    function wrapText(text, width) {
      const words = text.split(' ');
      let lines = [];
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + word).length <= width) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.join('\n');
    }

    if (currentProvider === 'Gemini') {
      const result = await currentModel.generateContentStream(fullQuery).catch(err => {
        clearInterval(spinnerInterval);
        chatBox.deleteLine(lastLineIndex);
        throw new Error(`Stream initiation failed: ${err.message}`);
      });

      let accumulatedContent = '';
      for await (const chunk of result.stream) {
        try {
          accumulatedContent += chunk.text();
          // Check if accumulated content contains a sentence boundary or is long enough
          if (accumulatedContent.match(SENTENCE_DELIMITERS) || accumulatedContent.length >= MIN_RENDER_LENGTH) {
            // Normalize content: collapse spaces, remove soft breaks
            let normalizedContent = accumulatedContent
              .replace(/\s{2,}\n/g, '\n') // Remove markdown soft breaks
              .replace(/\s*[?!]\s*(?=\w)/g, ' ') // Remove stray ? or ! followed by a word
              .replace(/\s+/g, ' ') // Collapse multiple spaces/tabs to single space
              .replace(/(\S)\n(\S)/g, '$1 $2') // Remove single newlines between words
              .replace(/\n+/g, '\n') // Collapse multiple newlines to single newline
              .trim();
            // Preserve markdown code blocks and newlines for formatting
            if (normalizedContent.includes('```')) {
              normalizedContent = accumulatedContent; // Revert to raw content to preserve code block formatting
            } else {
              // Wrap text to fit chatBox width for non-code content
              normalizedContent = wrapText(normalizedContent, CHAT_WIDTH);
            }
            buffer += normalizedContent;
            if (buffer.length > lastRenderedLength) {
              clearInterval(spinnerInterval); // Stop spinner when rendering starts
              const newContent = buffer.slice(lastRenderedLength);
              const markedNewContent = marked(newContent);
              chatBox.deleteLine(lastLineIndex);
              chatBox.insertBottom(markedNewContent);
              chatBox.setScrollPerc(100);
              screen.render();
              lastRenderedLength = buffer.length;
              lastLineIndex = chatBox.getLines().length - 1;
            }
            accumulatedContent = ''; // Reset accumulated content
          }
        } catch (chunkError) {
          clearInterval(spinnerInterval);
          chatBox.deleteLine(lastLineIndex);
          appendMessage('ai', `{red-fg}Error processing stream chunk: ${chunkError.message}{/}`, false);
          return;
        }
      }
      // Process any remaining accumulated content
      if (accumulatedContent) {
        let normalizedContent = accumulatedContent
          .replace(/\s{2,}\n/g, '\n')
          .replace(/\s*[?!]\s*(?=\w)/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/(\S)\n(\S)/g, '$1 $2')
          .replace(/\n+/g, '\n')
          .trim();
        if (normalizedContent.includes('```')) {
          normalizedContent = accumulatedContent; // Preserve code block formatting
        } else {
          normalizedContent = wrapText(normalizedContent, CHAT_WIDTH);
        }
        buffer += normalizedContent;
        if (buffer.length > lastRenderedLength) {
          clearInterval(spinnerInterval);
          const newContent = buffer.slice(lastRenderedLength);
          const markedNewContent = marked(newContent);
          chatBox.deleteLine(lastLineIndex);
          chatBox.insertBottom(markedNewContent);
          chatBox.setScrollPerc(100);
          screen.render();
          lastRenderedLength = buffer.length;
          lastLineIndex = chatBox.getLines().length - 1;
        }
      }
    } else if (currentProvider === 'OpenAI') {
      const stream = await openAI.chat.completions.create({
        model: currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        stream: true,
      }).catch(err => {
        clearInterval(spinnerInterval);
        chatBox.deleteLine(lastLineIndex);
        throw new Error(`Stream initiation failed: ${err.message}`);
      });

      let accumulatedContent = '';
      for await (const chunk of stream) {
        try {
          const content = chunk.choices[0]?.delta?.content || '';
          accumulatedContent += content;
          // Check if accumulated content contains a sentence boundary or is long enough
          if (accumulatedContent.match(SENTENCE_DELIMITERS) || accumulatedContent.length >= MIN_RENDER_LENGTH) {
            // Normalize content: collapse spaces, remove soft breaks
            let normalizedContent = accumulatedContent
              .replace(/\s{2,}\n/g, '\n') // Remove markdown soft breaks
              .replace(/\s*[?!]\s*(?=\w)/g, ' ') // Remove stray ? or ! followed by a word
              .replace(/\s+/g, ' ') // Collapse multiple spaces/tabs to single space
              .replace(/(\S)\n(\S)/g, '$1 $2') // Remove single newlines between words
              .replace(/\n+/g, '\n') // Collapse multiple newlines to single newline
              .trim();
            // Preserve markdown code blocks and newlines for formatting
            if (normalizedContent.includes('```')) {
              normalizedContent = accumulatedContent; // Revert to raw content to preserve code block formatting
            } else {
              // Wrap text to fit chatBox width for non-code content
              normalizedContent = wrapText(normalizedContent, CHAT_WIDTH);
            }
            buffer += normalizedContent;
            if (buffer.length > lastRenderedLength) {
              clearInterval(spinnerInterval); // Stop spinner when rendering starts
              const newContent = buffer.slice(lastRenderedLength);
              const markedNewContent = marked(newContent);
              chatBox.deleteLine(lastLineIndex);
              chatBox.insertBottom(markedNewContent);
              chatBox.setScrollPerc(100);
              screen.render();
              lastRenderedLength = buffer.length;
              lastLineIndex = chatBox.getLines().length - 1;
            }
            accumulatedContent = ''; // Reset accumulated content
          }
        } catch (chunkError) {
          clearInterval(spinnerInterval);
          chatBox.deleteLine(lastLineIndex);
          appendMessage('ai', `{red-fg}Error processing stream chunk: ${chunkError.message}{/}`, false);
          return;
        }
      }
      // Process any remaining accumulated content
      if (accumulatedContent) {
        let normalizedContent = accumulatedContent
          .replace(/\s{2,}\n/g, '\n')
          .replace(/\s*[?!]\s*(?=\w)/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/(\S)\n(\S)/g, '$1 $2')
          .replace(/\n+/g, '\n')
          .trim();
        if (normalizedContent.includes('```')) {
          normalizedContent = accumulatedContent; // Preserve code block formatting
        } else {
          normalizedContent = wrapText(normalizedContent, CHAT_WIDTH);
        }
        buffer += normalizedContent;
        if (buffer.length > lastRenderedLength) {
          clearInterval(spinnerInterval);
          const newContent = buffer.slice(lastRenderedLength);
          const markedNewContent = marked(newContent);
          chatBox.deleteLine(lastLineIndex);
          chatBox.insertBottom(markedNewContent);
          chatBox.setScrollPerc(100);
          screen.render();
          lastRenderedLength = buffer.length;
          lastLineIndex = chatBox.getLines().length - 1;
        }
      }
    }

    clearInterval(spinnerInterval); // Stop spinner for final rendering or no content
    if (buffer.length > lastRenderedLength) {
      let remainingContent = buffer.slice(lastRenderedLength);
      let normalizedContent = remainingContent
        .replace(/\s{2,}\n/g, '\n')
        .replace(/\s*[?!]\s*(?=\w)/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(\S)\n(\S)/g, '$1 $2')
        .replace(/\n+/g, '\n')
        .trim();
      if (!normalizedContent.includes('```')) {
        normalizedContent = wrapText(normalizedContent, CHAT_WIDTH);
      }
      const markedBuffer = marked(normalizedContent);
      chatBox.deleteLine(lastLineIndex);
      chatBox.insertBottom(markedBuffer);
      chatBox.setScrollPerc(100);
      screen.render();
    } else {
      chatBox.deleteLine(lastLineIndex); // Remove spinner if no content
    }

    // Append to temp file only
    await fs.appendFile(tempChatFile, `## AI\n${buffer}\n\n`);
  } catch (error) {
    clearInterval(spinnerInterval);
    chatBox.deleteLine(lastLineIndex);
    appendMessage('ai', `{red-fg}Error: ${error.message} (API issue, please try again){/}`, false);
  }
}


function describeModesAndCommands() {
  const note = `**Important Note:** Navigate the UI using keyboard key bindings (e.g., Esc to focus the folder tree, i for input, c for chat area, s for save button, m for multiline input). Use the mouse only for scrolling the chat area or tree; avoid clicking UI elements to select them while the input box is active. Clicking UI elements without first disabling input focus (via Esc) may cause double character input issues. After pressing Esc, mouse clicks can be used safely to interact with UI elements like the folder tree or save button. Always prioritize key bindings for selection and navigation to ensure a smooth experience.To paste content in multiline input box including error pasting can be done with ctrl+shift+v and right click, multiline input box is used for typing and pasting multiple line content, all queries will be submitted only with the main input combining the content of multiline input.`;

  const modeDescriptions = {
    'Code Mode': `Code mode, toggled with /code, is a streamlined environment for generating and editing code snippets in various programming languages without explanatory text, ideal for developers crafting scripts or prototypes. When enabled, the AI produces code in markdown code blocks (e.g., \`\`\`python) based on the user's query, leveraging the current provider (Gemini or OpenAI) for syntactically correct output. If a file is loaded via /editcode, the existing code is included in the AI prompt and preserved unless explicitly modified, supporting iterative development. The mode disables webapp, dir, digest, editdir, askdir, and shell modes to focus on code generation. A key feature is its integration with the temporary chat file (.temp-chat.md), which stores all AI responses, including code blocks, without length limitations imposed by memory buffers. This ensures unlimited generation length, as LLM outputs are appended to the file in real-time, accessible for /copy or /save actions. Use /code to toggle it on/off, and query specific code tasks (e.g., "write a Python function"). The output is stored in lastCodeBlocks for further processing, and the status bar reflects 'code' mode, making it a robust tool for coding workflows.`,
    'Webapp Mode': `Webapp mode, activated with /webapp, is tailored for rapid prototyping of single-file HTML web applications, embedding JavaScript in a <script> tag and styling with Tailwind CSS classes, all delivered in a \`\`\`html code block. It automatically includes the Tailwind CSS CDN in the <head>, ensuring standalone functionality. When active, it disables code, dir, digest, editdir, askdir, and shell modes to focus on web development. If code is loaded via /editcode, it’s treated as the base HTML, preserved unless modified, enabling iterative UI enhancements. The mode leverages the temporary chat file (.temp-chat.md) to store all AI-generated web app code, capturing unlimited output lengths from the LLM without buffer constraints. This file logs responses in real-time, ensuring no loss of complex or lengthy HTML structures, which can be retrieved for /copy or /save. Toggle with /webapp, and use queries to specify UI features (e.g., "create a login page"). The AI uses the selected model to produce responsive, styled web apps, with the status bar showing 'webapp' mode, making it ideal for front-end prototyping.`,
    'Dir Mode': `Dir mode, toggled with /dir, is a powerful feature for automating system tasks by generating and executing bash command sequences, ideal for setting up software projects (e.g., initializing a Node.js app or Python environment). Activated via /dir, it disables code, webapp, digest, editdir, askdir, and shell modes, updating the status bar to 'dir' mode. The AI proposes a conversational high-level plan (e.g., "Let's set up a Node.js backend with Express...") using the current provider (Gemini or OpenAI), displayed as a markdown paragraph. Users approve ([a]uto, [s]tep-by-step, [c]ancel) or request modifications, which the AI incorporates into a revised plan recursively. Approved plans trigger command generation, with each command requiring user consent (y/n) in step-by-step mode or executing automatically in auto mode. Commands like 'cd' update the current working directory, while others (e.g., 'npm install') execute with stdout and stderr (e.g., npm warnings) captured in the chat area, preventing leakage to the input box. The temporary chat file (.temp-chat.md) logs all plans, commands, and outputs in real-time, supporting unlimited LLM output lengths for complex sequences. Executed commands update the folder tree dynamically, reflecting filesystem changes. Users toggle the mode off with /dir, and the AI ensures commands are executable in sequence, making Dir Mode ideal for project automation and system management.`,
    'Shell Mode': `Shell mode, toggled with /shell, is designed for direct generation and execution of bash shell commands without plan proposals, allowing users to input any command request regardless of complexity (e.g., "create a directory and initialize a git repository"). Activated via /shell, it disables code, webapp, dir, digest, editdir, and askdir modes, updating the status bar to 'shell' mode. The AI generates executable bash commands in a \`\`\`bash block using the current provider (Gemini or OpenAI), employing 'mkdir -p' for directories and 'cat > file << 'EOF' for file creation, ensuring syntactically correct scripts without escape characters. Each command requires user consent (y/n) before execution, with outputs (stdout/stderr, e.g., npm warnings) displayed in the chat area. The temporary chat file (.temp-chat.md) logs all generated commands and outputs in real-time, supporting unlimited LLM output lengths. Executed commands update the folder tree, reflecting filesystem changes. Toggle off with /shell, and use queries to specify any shell task (e.g., "install Node.js dependencies"). This mode is ideal for quick, unrestricted shell command execution, leveraging the AI for precise automation.`,
    'Digest Mode': `Digest mode, controlled via /digest, analyzes a project directory or file by scanning its structure and content, producing a detailed summary and file contents in a digest_output.txt file. Use /digest <path> to process a local path or git URL, or /digest on/off to toggle the mode. When active, queries use the digested content as context, ideal for understanding large codebases or repositories. It respects ignore patterns (e.g., node_modules) and limits (e.g., 10MB files, 500MB total). The mode disables other modes and displays directory trees and file previews in the chat area, updating the tree view. It’s implemented using recursive directory scanning and supports temporary cloning for remote repos.`,
    'EditDir Mode': `EditDir mode, activated with /editdir <path>, enables AI-driven batch modifications across a directory’s text files, perfect for refactoring, adding features, or updating multiple files (e.g., "add error handling to all Python files"). Initiated by specifying a directory path, it scans the directory asynchronously, loading text file contents into editDirContext, disables other modes, and updates the status bar to 'editdir' mode. The AI generates a conversational project overview (e.g., "This project is a Node.js app with Express...") and responds to user queries by proposing a high-level plan in a markdown paragraph, outlining specific file changes (e.g., "Let's update main.py to add try-catch blocks..."). Users approve (y), reject (N), or cancel the plan, or request modifications, which the AI incorporates recursively. Approved plans prompt the AI to generate updated file contents in \`\`\` blocks labeled with file paths (e.g., File: src/main.py), using the current provider (Gemini or OpenAI). Each file change requires user consent (y/n) before writing to the filesystem, ensuring precision. Modified files are logged in the temporary chat file (.temp-chat.md), capturing unlimited LLM outputs for complex edits, and the folder tree updates to reflect changes. If the directory is modified, an updated project overview is generated automatically. Users can query further changes or exit the mode, with editDirContext preserving the latest file states. This mode leverages async file operations and is ideal for large-scale codebase maintenance.`,
    'AskDir Mode': `AskDir mode, started with /askdir <path>, loads a directory’s text files into askDirContext for answering questions about the codebase without modifying files, making it ideal for code reviews, debugging, or understanding project structure. Activated by specifying a directory path, it uses async scanning to load file contents, disables other modes, and updates the status bar to 'askdir' mode. The AI generates a conversational project overview (e.g., "We're looking at a Python project with Flask...") and responds to queries like "explain main.py" or "how do I run this project?" in plain markdown paragraphs with a friendly tone, embedding commands or code snippets directly in the text (e.g., "To run it, use npm install then npm start"). Responses are context-aware, leveraging askDirContext and the current provider (Gemini or OpenAI). The temporary chat file (.temp-chat.md) stores all responses, supporting unlimited LLM output lengths for detailed explanations. The folder tree updates for navigation, allowing users to select files (via Enter) to append paths to the input box for specific queries. Users can continue asking questions or exit the mode, with no filesystem changes. This mode is perfect for in-depth codebase analysis and leverages async directory scanning for accuracy.`
  };

  const commandDescriptions = {
    '/copy': `The /copy command extracts all code blocks from the latest AI response and attempts to copy them to the system clipboard, or saves them to temp-clipboard.txt if clipboard access fails (e.g., non-Termux environments). In Termux, it uses termux-clipboard-set, requiring Termux:API. This command is useful for quickly transferring generated code to other applications or files. It reads the temporary chat file (.temp-chat.md) to find the last AI response, extracts code using regex-based parsing, and combines blocks with newlines. Execute /copy after an AI response containing code (e.g., from code or webapp mode) to use it. The chat area confirms success or failure, and no arguments are needed.`,
    '/clear': `The /clear command resets the chat interface, clearing the chat area, code blocks, and loaded contexts (e.g., loadedCodeContext, askCodeContext). It reinitializes the temporary chat file (.temp-chat.md) and sets the chat area to a default message indicating the current provider and model. This is useful for starting a fresh conversation without exiting the application. It preserves the current provider/model and directory state but resets modes like digest or conversation loading. Simply type /clear to execute, and the chat area will confirm the action. No arguments are required, and it works in any mode.`,
    '/exit': `The /exit command terminates the application, deleting the temporary chat file (.temp-chat.md) to clean up. It’s used to gracefully close the program, ensuring no residual files remain. Executing /exit triggers process.exit(0), stopping all operations. Type /exit in the input box to use it; no arguments are needed. The command is available in any mode and doesn’t affect the filesystem beyond removing the temp file. It’s implemented with a try-catch to handle file deletion errors silently, ensuring a smooth exit.`,
    '/help': `The /help command displays a concise list of all available commands and key bindings in the chat area, formatted with blue command names and descriptions. It’s designed to provide quick reference for users unfamiliar with the interface’s functionality. The command iterates through the commands and keyBindings objects, using blessed’s tag syntax for styling, and outputs via appendMessage. Type /help to view the list, with no arguments required. It works in any mode and doesn’t alter state, making it a safe way to explore the interface’s capabilities without side effects.`,
    '/model': `The /model command allows switching the AI provider or model mid-conversation, returning the user to the provider selection screen (Gemini or OpenAI Compatible). For Gemini, it fetches available models via the Google Generative AI API; for OpenAI, it prompts for a base URL and model name. This is useful for testing different models or APIs without restarting. Type /model to initiate, hiding the chat interface and showing the selection UI. The command resets the chat state but preserves the working directory, and the new provider/model is confirmed in the chat area upon selection.`,
    '/code': `The /code command toggles code-only mode, enabling or disabling it while turning off webapp, dir, and digest modes. When active, the AI generates code snippets in markdown code blocks without explanations, ideal for rapid coding tasks. If code is loaded via /editcode, it’s included in the AI prompt for modification. Type /code to toggle; no arguments are needed. The chat area confirms the mode change, and the status bar updates to reflect 'code' mode. The AI uses the current provider to generate code, storing output in lastCodeBlocks for /copy or /save. This mode streamlines code-focused workflows.`,
    '/webapp': `The /webapp command toggles webapp-only mode, enabling or disabling it while deactivating code, dir, and digest modes. When active, the AI generates single-file HTML web apps with Tailwind CSS and embedded JavaScript, output in \`\`\`html blocks. It’s designed for quick web prototyping, including the Tailwind CDN automatically. use /webapp to toggle, with no arguments. If code is loaded via /editcode, it’s treated as HTML for edits. The chat area confirms the mode switch, and the status bar shows 'webapp' mode. Outputs are saved for /copy or /save, leveraging the AI provider for responsive designs.`,
    '/save': `The /save <filename> command saves all code blocks from the latest AI response to a specified file in the current working directory. It’s useful for persisting generated code (e.g., from code or webapp mode) to the filesystem. The command reads the temporary chat file, extracts code blocks, and writes them to the file, updating the tree view. Type /save myfile.js, replacing 'myfile.js' with your filename. If no code exists, an error is shown in the chat area. The command works in any mode and confirms success or failure, ensuring the file is accessible for further edits.`,
    '/dir': `The /dir command toggles dir mode, enabling or disabling it while deactivating code, webapp, digest, editdir, askdir, and shell modes. In this mode, the AI proposes high-level plans for bash command sequences for tasks like project setup, prompting for user approval ([a]uto, [s]tep-by-step, [c]ancel) before generating commands. Commands require consent (y/n) in step-by-step mode or execute automatically in auto mode. Outputs, including npm warnings/errors, are shown in the chat area. Type /dir to toggle; no arguments needed. The status bar updates to 'dir' mode, and executed commands update the directory and tree view. This mode is ideal for structured project automation, using the AI provider to ensure executable command sequences.`,
    '/shell': `The /shell command toggles shell mode, enabling or disabling it while deactivating code, webapp, dir, digest, editdir, and askdir modes. In this mode, the AI generates bash commands in \`\`\`bash blocks for any user-specified task (e.g., "create a directory and initialize a git repository") without proposing a plan, ideal for quick command execution. Commands are generated using 'mkdir -p' for directories and 'cat > file << 'EOF' for file creation, with user consent (y/n) required before execution. Outputs (stdout/stderr) are shown in the chat area, and the temporary chat file (.temp-chat.md) logs all commands and outputs. Type /shell to toggle; no arguments needed. The status bar updates to 'shell' mode, and the folder tree reflects filesystem changes. This mode leverages the AI provider for direct, unrestricted shell automation.`,
    '/editcode': `The /editcode <filename> command loads a file’s content into loadedCodeContext for modification in code or webapp mode. The AI includes the loaded code in its prompt, preserving it unless the user requests changes, making it ideal for iterative code editing. Type /editcode myfile.js, specifying the file path. The file’s content is displayed in the chat area, and subsequent queries modify it (e.g., "add a function"). The command works in any mode, updates the tree view, and confirms success or failure. It’s implemented with async file reading and supports any text file in the working directory.`,
    '/askcode': `The /askcode <filename> command loads a file’s content into askCodeContext for answering questions without modification, perfect for code analysis or debugging. The AI uses the file as context to respond to queries like "explain this function." Type /askcode myfile.js with the file path. The content is shown in the chat area, and queries are answered using the current AI provider. The command works in any mode, doesn’t alter the file, and confirms loading success or failure. It uses async file reading and updates the tree view for navigation.`,
    '/savecon': `The /savecon command saves the entire chat conversation to a markdown file named chat-conversation-<timestamp>.md in the working directory. It’s useful for archiving discussions, including user queries and AI responses, for later review or sharing. The command reads the temporary chat file (.temp-chat.md) and writes it to the new file, updating the tree view. Type /savecon with no arguments to execute. The chat area confirms the save, and the file is formatted with ## User and ## AI headers. It works in any mode and doesn’t affect the current session.`,
    '/digest': `The /digest command manages digest mode, which analyzes project directories or files. Use /digest <path> to process a local path or git URL, generating a directory tree and file contents in digest_output.txt, or /digest on/off to toggle the mode. When active, queries use the digested content as context for project analysis. The command supports limits (e.g., 10MB files) and ignore patterns, displaying results in the chat area. It’s ideal for understanding codebases, cloning remote repos temporarily if needed. The tree view updates, and the mode disables other modes for focused analysis.`,
    '/loadcon': `The /loadcon <filename> command loads a saved markdown conversation file (e.g., from /savecon) into the chat area, restoring user and AI messages. It’s useful for resuming past sessions or reviewing archived chats. Type /loadcon chat-conversation-2025-04-14T12-00-00.md with the filename. The command clears the current chat, reinitializes the temp file, and extracts the last code block for code/webapp mode context. It confirms success or failure in the chat area, updates the tree view, and works in any mode without altering the filesystem beyond the temp file.`,
    '/editdir': `The /editdir <path> command initiates EditDir mode, loading a directory’s text files into editDirContext for AI-driven batch modifications, ideal for refactoring, adding features, or updating multiple files (e.g., "add error handling to all Python files"). Activated by specifying a directory path, it scans the directory asynchronously, disables other modes, and updates the status bar to 'editdir' mode. If multiple versions exist in the .versions folder (more than version 0), it prompts version control options ([r]evert to previous version, [f]orward to next version, [l]ist versions, [c]ontinue) at the start, allowing users to navigate version history before editing; this prompt loops until [c] is selected. If no .versions folder exists or only version 0 is present, it saves the initial state as version 0 and skips the prompt. The AI generates a conversational project overview (e.g., "This project is a Node.js app with Express...") and responds to queries by proposing a high-level plan in a markdown paragraph, outlining file changes (e.g., "Let's update main.py to add try-catch blocks..."). Users approve (y), reject (N), or cancel the plan, or request modifications, which the AI incorporates recursively. Approved plans trigger updated file contents in \`\`\` blocks labeled with file paths, requiring user consent (y/n) before writing to the filesystem. After applying changes, version control options reappear to allow users to revert, forward, or list changes, until the user selects ‘c’ to continue. Modified files are saved as a new version, reverting context in editDirContext, logged in the temporary chat file (.temp-chat.md) for unlimited LLM outputs, and the folder tree view updates to reflect changes. If changes fail to apply correctly, users can revert to the previous version. Version history persists across sessions, allowing for navigation through changes made in previous edits (e.g., after days). The editDir mode uses asynchronous file operations and the current provider (Gemini or OpenAI) for precise, reliable, and traceable code updates, making it a powerful tool for large-scale codebase management and iterative development tasks.`,
    '/askdir': `The /askdir command starts askDir mode, loading a directory’s text files into askDirContext for answering questions without edits. It’s ideal for analyzing project structure or debugging, with queries like multiline queries answered using "what does main.py do?". Type /askdir ./my_project to load the directory. The chat area displays the loaded context and responses, with no filesystem changes. The mode disables other modes, uses the AI provider for detailed answers, and updates the tree view. It leverages async directory scanning for accurate content loading.`,
    '/desc': `The /desc command provides detailed paragraph descriptions of all modes, commands, and key bindings, covering their purpose, usage, and functionality. It’s designed to help users understand the interface’s capabilities in depth, displaying each description in the chat area. Type /desc with no arguments to execute. The command iterates through modes (code, webapp, dir, mode descriptions), the commands object, and key bindings, using predefined descriptions. It works in any mode, doesn’t alter state, and formats output with blessed tags for readability, serving as a comprehensive guide to the application’s features.`
  };

  const keyBindingDescriptions = {
    'Esc': `The Esc key shifts focus to the folder tree (treeBox), enabling navigation of the filesystem using arrow keys and Enter. It’s designed to allow users to quickly switch from input or chat areas to explore or interact with files and directories. Press Esc while focused on the input box or chat area to activate tree navigation. In the tree, users can expand/collapse folders or view file contents by pressing Enter on a file, which also appends the file path to the input box. This key binding enhances workflow efficiency by providing seamless access to the project directory without using commands.`,
    'i': `The i key refocuses the single-line input box (inputBox), allowing users to resume typing queries or commands. It’s useful when navigating other UI elements (e.g., tree or chat area) and needing to return to input mode quickly. Press i from any focused element (treeBox, chatBox, saveConButton) to activate the input box. The input box supports command entry (e.g., /save) or AI queries, and pressing Enter submits the input for processing. This key binding ensures rapid access to the primary interaction point, streamlining user input in the terminal UI.`,
    'c': `The c key shifts focus to the chat area (chatBox), enabling scrolling through conversation history using arrow keys (Up/k, Down/j). It’s designed for reviewing past messages, AI responses, or code outputs without altering the input focus. Press c from any UI element to focus the chat area. While focused, the chat area supports mouse and keyboard scrolling, and clicking reverts focus. This key binding is ideal for users needing to inspect long responses or navigate conversation context, maintaining the chat’s readability within the blessed terminal interface.`,
    's': `The s key focuses the save conversation button (saveConButton), a graphical yes/no list below the folder tree. It allows users to save the current chat session to a markdown file by selecting ‘Yes’ or cancel with ‘No’ using arrow keys and Enter. Press s from any UI element to activate the button. The save action triggers the saveConversation function, creating a file like chat-conversation-<timestamp>.md. This key binding provides a quick, graphical alternative to the /savecon command, enhancing usability for saving chats without typing.`,
    'm': `The m key focuses the multiline input box (multiLineInputBox), located above the save conversation button, designed for entering complex or lengthy inputs, such as detailed AI queries or error stack traces. pensioneers. It is particularly powerful for pasting errors (e.g., npm errors, Python tracebacks) directly into the box, which can then be submitted as a query to the AI for troubleshooting solutions (e.g., "fix this error: <pasted traceback>"). Press m from any UI element to activate the box, which supports multiple lines and combines with the single-line input box upon submission with Enter. The AI processes the input using the current provider, and responses are synced with the server in real-time sync, ensuring seamless performance. This mode enhances debugging workflows by allowing users to leverage the AI’s problem-solving capabilities with minimal effort, making it ideal for resolving runtime or build issues.`,
    'q or Ctrl+C': `The q or Ctrl+C key binding exits the application, deleting the temporary chat file (.temp-chat.md) to clean up. It’s designed for quick termination, equivalent to the /exit command, ensuring no residual files remain. Press q or Ctrl+C from any UI element to trigger process.exit(0). The binding is registered on the screen object, making it globally accessible, and uses a try-catch to handle file deletion errors silently. This key binding provides a standard terminal shortcut for exiting, maintaining consistency with command-line conventions.`,
    'Up/k (in chat)': `The Up or k key, when the chat area (chatBox) is focused, scrolls the conversation history upward by one line. It’s designed to navigate through previous messages, AI responses, or code blocks, especially in long conversations. Focus the chat area with c, then press Up or k to scroll up. The chat area uses blessed’s scrollable box, ensuring smooth navigation, and the binding works with mouse scrolling. This key binding enhances usability for reviewing earlier parts of the chat, maintaining context without leaving the UI.`,
    'Down/j (in chat)': `The Down or j key, when the chat area (chatBox) is focused, scrolls the conversation history downward by one line. It’s used to move through recent messages or AI outputs in the chat area, complementing the Up/k binding. Focus the chat area with c, then Down or j to scroll down. The binding leverages the blessed’s scrollable box for seamless navigation, supporting mouse scrolling as well. This key binding ensures users can easily access the latest or intermediate chat content, improving interaction with the conversation history.`,
    'Enter (in tree)': `The Enter key, when the folder tree (treeBox) is focused, toggles folder expansion/collapse or displays/hides file content. For directories, it expands (shows subitems) or collapses them, updating the tree view; for files, it appends the file path to the input box and toggles displaying the file’s content in the chat area. Focus the tree with Esc, navigate with arrow keys, and press Enter on a folder or file. The binding uses the toggleFolder function, which updates folderState and the tree UI. This key binding simplifies filesystem interaction, enabling quick file access and navigation.`
  }

  // Display note
  appendMessage('ai', `{bold}${note}{/}\n`, false);

  // Display mode descriptions
  appendMessage('ai', '{bold}{gray-fg}Modes:{/}', false);
  for (const [mode, line] of Object.entries(modeDescriptions)) {
    appendMessage('ai', `{blue-fg}${mode}:{/}\n${line}\n`, false);
  }

  // Display command descriptions
  appendMessage('ai', '{bold}{gray-fg}Commands:{/}', false);
  for (const [key, line] of Object.entries(commandDescriptions)) {
    appendMessage('ai', `{blue-fg}${key}:{/}\n${line}\n`, false);
  }

  // Display key binding descriptions
  appendMessage('ai', '{bold}{gray-fg}Key Bindings:{/}', false);
  for (const [key, line] of Object.entries(keyBindingDescriptions)) {
    appendMessage('ai', `{blue-fg}${key}:{/}\n${line}\n`, false);
  }

  // Display temporary chat file description
  appendMessage('ai', '{bold}{gray-fg}Temporary Chat File (.temp-chat.md):{/}', false);
  appendMessage('ai', `The temporary chat file (.temp-chat.md), stored in the current working directory, is a critical component of the application, acting as a persistent log for all user queries, AI responses, plans, code blocks, and command outputs across all modes (code, webapp, dir, digest, editDir, askDir, shell). Initialized with initializeTempChatFile, it starts as a markdown file with a header and is appended to in real-time using appendMessage, ensuring no data loss even for lengthy LLM outputs that exceed memory buffer limits. This enables unlimited generation length, a key feature for handling complex responses like large codebases, detailed plans, or verbose shell command outputs (e.g., npm install logs). The file uses a structured format with ## User and ## AI headers to delineate interactions, making it human-readable and suitable for archiving via /savecon, which copies it to a timestamped file (e.g., chat-conversation-2025-04-14T12-00-00.md). In Dir Mode, it logs high-level plans, generated commands, and execution outputs (stdout/stderr), preserving automation workflows. In Shell Mode, it logs directly generated commands and their outputs, supporting unrestricted shell tasks. In EditDir Mode, it stores project overviews, proposed file changes, and user consents, ensuring traceability for batch edits. AskDir Mode logs conversational responses and project analyses, supporting in-depth codebase queries. The /loadcon command reloads a saved conversation, restoring code contexts for iterative development, while /clear reinitializes the file to start fresh. The file is deleted on exit (/exit or q/Ctrl+C) to clean up, using try-catch for error handling. Its async file operations (via fs.promises) ensure non-blocking performance, and integration with extractCodeBlocksFromTempFile allows /copy and /save to retrieve the latest code blocks accurately. This makes the temporary chat file a robust backbone for persistent, unlimited-length interactions and session management across the application’s features.`, false);
}


// Handle user input with commands
async function handleInputSubmission(text) {
  // Combine single-line input with multiline input
  const singleLineInput = text.trim();
  const multiLineInput = multiLineInputBox.getValue().trim();
  const combinedInput = multiLineInput ? `${singleLineInput}\n${multiLineInput}` : singleLineInput;

  if (!combinedInput) return;

  if (isShellPromptActive) {
    return;
  }

  // Handle digest prompt
  if (isDigestPromptActive) {
    isDigestPromptActive = false;
    await processDigestInput(combinedInput);
    inputBox.clearValue();
    multiLineInputBox.clearValue(); // Clear multiline input
    inputBox.focus();
    screen.render();
    return;
  }

  if (combinedInput.startsWith('/')) {
    const [command, ...args] = combinedInput.split(' ');
    switch (command.toLowerCase()) {
      case '/copy':
        copyCodeToClipboard();
        break;
      case '/clear':
        if (currentModel) {
          const modelName = currentProvider === 'Gemini' ? currentModel.model : currentModel;
          chatBox.setContent(`{gray-fg}Chat cleared with ${currentProvider} (${modelName})\nType a query or command above.{/}`);
          lastCodeBlocks = [];
          loadedCodeContext = '';
          askCodeContext = '';
          digestContext = '';
          isConversationLoaded = false;
          await initializeTempChatFile();
          appendMessage('ai', '{green-fg}Chat cleared.{/}', false);
        }
        break;
      case '/exit':
        await fs.unlink(tempChatFile).catch(() => {});
        process.exit(0);
        break;
      case '/help':
        showHelp();
        break;
      case '/model':
        changeModel();
        return;
      case '/code':
        codeOnlyMode = !codeOnlyMode;
        webappOnlyMode = false;
        dirMode = false;
        digestMode = false;
        editDirMode = false;
        askDirMode = false;
        shellMode = false;
        appendMessage('ai', `{green-fg}Code-only mode ${codeOnlyMode ? 'enabled' : 'disabled'}. Webapp, dir, digest, editdir, askdir, and shell modes disabled.{/}`, buffer);
        updateStatusBar();
        break;
      case '/webapp':
        webappOnlyMode = !webappOnlyMode;
        codeOnlyMode = false;
        dirMode = false;
        digestMode = false;
        editDirMode = false;
        askDirMode = false;
        shellMode = false;
        appendMessage('ai', `{green-fg}Webapp-only mode ${webappOnlyMode ? 'enabled' : 'disabled'}. Code, dir, digest, editdir, askdir, and shell modes disabled.{/}`, false);
        updateStatusBar();
        break;
      case '/dir':
        dirMode = !dirMode;
        codeOnlyMode = false;
        webappOnlyMode = false;
        digestMode = false;
        editDirMode = false;
        askDirMode = false;
        shellMode = false;
        appendMessage('ai', `{green-fg}Dir mode ${dirMode ? 'enabled' : 'disabled'}. Code, webapp, digest, editdir, askdir, and shell modes disabled.{/}`, false);
        updateStatusBar();
        break;
      case '/shell':
        shellMode = !shellMode;
        codeOnlyMode = false;
        webappOnlyMode = false;
        dirMode = false;
        digestMode = false;
        editDirMode = false;
        askDirMode = false;
        appendMessage('ai', `{green-fg}Shell mode ${shellMode ? 'enabled' : 'disabled'}. Code, webapp, dir, digest, editdir, and askdir modes disabled.{/}`, false);
        updateStatusBar();
        break;
      case '/digest':
        const digestArg = args.join(' ').trim();
        if (digestArg === 'on') {
          digestMode = true;
          codeOnlyMode = false;
          webappOnlyMode = false;
          dirMode = false;
          editDirMode = false;
          askDirMode = false;
          shellMode = false;
          appendMessage('ai', '{green-fg}Digest mode enabled. Other modes disabled.{/}', false);
          updateStatusBar();
        } else if (digestArg === 'off') {
          digestMode = false;
          digestContext = '';
          appendMessage('ai', '{green-fg}Digest mode disabled.{/}', false);
          updateStatusBar();
        } else if (digestArg) {
          await processDigestInput(digestArg);
        } else {
          appendMessage('ai', '{gray-fg}Enter folder path or URL:{/}', false);
          isDigestPromptActive = true;
          inputBox.clearValue();
          multiLineInputBox.clearValue(); // Clear multiline input
          inputBox.focus();
          screen.render();
          return;
        }
        break;
      case '/save':
        const saveFilename = args.join(' ').trim();
        if (!saveFilename) {
          appendMessage('ai', '{red-fg}Please provide a filename (e.g., /save myfile.js).{/}', false);
        } else {
          saveToFile(saveFilename);
        }
        break;
      case '/editcode':
        const editFilename = args.join(' ').trim();
        if (!editFilename) {
          appendMessage('ai', '{red-fg}Please provide a filename (e.g., /editcode myfile.js).{/}', false);
        } else {
          editCode(editFilename);
        }
        break;
      case '/askcode':
        const askFilename = args.join(' ').trim();
        if (!askFilename) {
          appendMessage('ai', '{red-fg}Please provide a filename (e.g., /askcode myfile.js).{/}', false);
        } else {
          askCode(askFilename);
        }
        break;
      case '/savecon':
        saveConversation();
        break;
      case '/loadcon':
        const loadFilename = args.join(' ').trim();
        if (!loadFilename) {
          appendMessage('ai', '{red-fg}Please provide a filename (e.g., /loadcon chat-conversation-2025-04-14T12-00-00.md).{/}', false);
        } else {
          await loadConversation(loadFilename);
        }
        break;
      case '/editdir':
        const editDirPath = args.join(' ').trim();
        if (!editDirPath) {
          appendMessage('ai', '{red-fg}Please provide a directory path (e.g., /editdir ./my_project).{/}', false);
        } else {
          await editDirectory(editDirPath);
        }
        break;
      case '/askdir':
        const askDirPath = args.join(' ').trim();
        if (!askDirPath) {
          appendMessage('ai', '{red-fg}Please provide a directory path (e.g., /askdir ./my_project).{/}', false);
        } else {
          await askDirectory(askDirPath);
        }
        break;
      case '/desc':
        describeModesAndCommands();
        break;
      default:
        appendMessage('ai', `{red-fg}Unknown command: ${command}. Type /help for commands.{/}`, false);
    }
  } else {
    appendMessage('user', combinedInput);
    lastCodeBlocks = [];
    getAIResponse(combinedInput);
  }

  inputBox.clearValue();
  multiLineInputBox.clearValue(); // Clear multiline input after submission
  inputBox.focus();
  screen.render();
}


async function proposeEditDirPlan(query, dirPath, latestPlan = '') {
  try {
    // Initialize spinner for plan generation
    const spinnerFrames = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;

    // Check if directory was modified and show overview if needed
    if (editDirModified) {
      const overviewPrompt = `You are a project analyst. Below is the updated content of files in a project directory "${dirPath}":\n\n${editDirContext}\n\nProvide a concise overview of the project, summarizing its purpose, main components, and technologies used, based on the updated file contents. Present the overview as a single paragraph in markdown format, avoiding lists or code blocks.`;
      let overviewBuffer = '';
      chatBox.insertBottom(`{gray-fg}Generating updated project overview ${spinnerFrames[spinnerIndex]}{/}`);
      let overviewLineIndex = chatBox.getLines().length - 1;
      const overviewSpinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(overviewLineIndex, `{gray-fg}Generating updated project overview ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(overviewPrompt);
        for await (const chunk of result.stream) {
          overviewBuffer += chunk.text();
        }
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: overviewPrompt }],
          stream: true,
        });
        for await (const chunk of stream) {
          overviewBuffer += chunk.choices[0]?.delta?.content || '';
        }
      }

      clearInterval(overviewSpinnerInterval);
      chatBox.deleteLine(overviewLineIndex);
      const markedOverview = marked(overviewBuffer);
      chatBox.insertBottom(markedOverview);
      chatBox.setScrollPerc(100);
      screen.render();
      await fs.appendFile(tempChatFile, `## AI\nUpdated Project Overview for "${dirPath}":\n${overviewBuffer}\n\n`);
    }

    chatBox.insertBottom(`{gray-fg}Generating plan ${spinnerFrames[spinnerIndex]}{/}`);
    let lastLineIndex = chatBox.getLines().length - 1;
    const spinnerInterval = setInterval(() => {
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
      chatBox.setLine(lastLineIndex, `{gray-fg}Generating plan ${spinnerFrames[spinnerIndex]}{/}`);
      screen.render();
    }, 100);

    // Generate high-level plan as a paragraph
    let plan = latestPlan;
    let buffer = '';
    let lastRenderedLength = 0;

    if (!plan) {
      // Generate initial plan if no previous plan exists
      const planPrompt = `You are a software project planner with a friendly, conversational tone. The user has requested modifications to the directory "${dirPath}": "${query}". Propose a detailed, high-level plan to accomplish this task, focusing on the files to be modified and the changes needed (e.g., updating backend logic, adding frontend components, refactoring code). Use a conversational style, starting with phrases like "Let's update..." or "We'll modify..." to engage the user, and maintain a clear, approachable tone throughout (e.g., "Let's tweak the main.py file to add error handling, then update the frontend React components..."). Do not include shell commands or low-level implementation details. Present the plan as a single, concise paragraph in markdown format, avoiding numbered lists or bullet points. Ensure the plan aligns with the user's requirements.`;
      
      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(planPrompt);
        for await (const chunk of result.stream) {
          buffer += chunk.text();
          if (buffer.length > lastRenderedLength) {
            clearInterval(spinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
        plan = buffer;
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: planPrompt }, { role: 'user', content: query }],
          stream: true,
        });
        for await (const chunk of stream) {
          buffer += chunk.choices[0]?.delta?.content || '';
          if (buffer.length > lastRenderedLength) {
            clearInterval(spinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
        plan = buffer;
      }
    }

    clearInterval(spinnerInterval);
    if (buffer.length > lastRenderedLength) {
      const remainingContent = buffer.slice(lastRenderedLength);
      const markedRemainingContent = marked(remainingContent);
      chatBox.deleteLine(lastLineIndex);
      chatBox.insertBottom(markedRemainingContent);
      chatBox.setScrollPerc(100);
      screen.render();
      lastLineIndex = chatBox.getLines().length - 1;
    } else {
      chatBox.deleteLine(lastLineIndex);
    }

    // Display the proposed plan
    appendMessage('ai', `{green-fg}Proposed Plan for modifying "${dirPath}" based on "${query}":{/}\n${plan}\n{yellow-fg}Approve this plan? (y/N/cancel):{/}`, false);
    await fs.appendFile(tempChatFile, `## AI\nProposed Plan for modifying "${dirPath}" based on "${query}":\n${plan}\n\n`);

    // Clear existing submit listeners
    inputBox.removeAllListeners('submit');

    const consent = await new Promise((resolve) => {
      const consentHandler = (response) => {
        inputBox.removeListener('submit', consentHandler);
        resolve(response.trim().toLowerCase());
      };
      inputBox.once('submit', consentHandler);
    });

    if (consent === 'y') {
      // Plan approved, generate modified file contents based on the approved plan
      chatBox.insertBottom(`{gray-fg}Generating modified file contents ${spinnerFrames[spinnerIndex]}{/}`);
      lastLineIndex = chatBox.getLines().length - 1;
      const cmdSpinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(lastLineIndex, `{gray-fg}Generating modified file contents ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      const commandPrompt = `You are a code editor for a project directory "${dirPath}". Below is the content of files in the directory:\n\n${editDirContext}\n\nThe user has approved the following plan for the modification: "${query}":\n\n${plan}\n\nBased on the approved plan, identify which files need to be modified and provide the updated content for each. For each affected file, provide the updated content in a markdown code block with the file path above it (e.g., File: path/to/file.py). Do not include unchanged files. Ensure each file's content is in a code block with the appropriate language (e.g., \`\`\`python). Output only the modified files, like:\n\nFile: path/to/file.py\n\`\`\`python\n# Updated content\n\`\`\`\n\nEnsure the modifications are executable and align with the plan.`;
      buffer = '';
      lastRenderedLength = 0;

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(commandPrompt);
        for await (const chunk of result.stream) {
          buffer += chunk.text();
          if (buffer.length > lastRenderedLength) {
            clearInterval(cmdSpinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: commandPrompt }, { role: 'user', content: query }],
          stream: true,
        });
        for await (const chunk of stream) {
          buffer += chunk.choices[0]?.delta?.content || '';
          if (buffer.length > lastRenderedLength) {
            clearInterval(cmdSpinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      }

      clearInterval(cmdSpinnerInterval);
      chatBox.deleteLine(lastLineIndex);

      // Parse modified files from AI response
      const modifiedFiles = [];
      const sections = buffer.split('File:').filter(section => section.trim());
      for (const section of sections) {
        const lines = section.trim().split('\n');
        const filePath = lines[0].trim();
        const codeBlockStart = lines.findIndex(line => line.match(/^```(\w+)?$/));
        const codeBlockEnd = lines.findIndex(line => line === '```' && lines.indexOf(line) > codeBlockStart);
        let content = '';
        if (codeBlockStart !== -1 && codeBlockEnd !== -1) {
          content = lines.slice(codeBlockStart + 1, codeBlockEnd).join('\n').trim();
        }
        if (filePath && content) {
          modifiedFiles.push({ path: filePath, content });
        }
      }

      // Ask for consent to apply changes, displaying message below the changes
      if (modifiedFiles.length > 0) {
        chatBox.insertBottom(marked(buffer));
        chatBox.insertBottom(`{yellow-fg}Apply these proposed changes? (y/n):{/}`);
        chatBox.setScrollPerc(100);
        screen.render();
        await fs.appendFile(tempChatFile, `## AI\n${buffer}\nApply these proposed changes? (y/n):\n\n`);
        inputBox.clearValue();
        inputBox.setValue('');
        
        // Clear existing submit listeners
        inputBox.removeAllListeners('submit');
        
        inputBox.focus();
        screen.render();

        const fileConsent = await new Promise((resolve) => {
          const consentHandler = (response) => {
            inputBox.removeListener('submit', consentHandler);
            resolve(response.trim().toLowerCase());
          };
          inputBox.once('submit', consentHandler);
        });

        // Re-attach the main submit handler immediately after consent
        inputBox.removeAllListeners('submit');
        inputBox.on('submit', handleInputSubmission);

        if (fileConsent !== 'y') {
          appendMessage('ai', `{gray-fg}Changes cancelled.{/}`, false);
          inputBox.clearValue();
          inputBox.focus();
          screen.render();
          return;
        }

        // Load version info
        const versionsDir = path.join(currentWorkingDir, '.versions');
        const versionInfoPath = path.join(versionsDir, `editdir_${dirPath}_versionInfo.json`);
        let versionInfo = JSON.parse(await fs.readFile(versionInfoPath, 'utf8'));

        // Update editDirContext and write to filesystem
        let updatedContext = editDirContext;
        for (const file of modifiedFiles) {
          const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
          const newContent = `File: ${file.path}\n${file.content}\n\n`;
          if (updatedContext.match(regex)) {
            updatedContext = updatedContext.replace(regex, newContent);
          } else {
            updatedContext += newContent;
          }
        }

        try {
          for (const file of modifiedFiles) {
            const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, file.content);
          }

          // Save the new version
          const newVersion = versionInfo.totalVersions;
          const versionPath = path.join(versionsDir, `editdir_${dirPath}_v${newVersion}.json`);
          await fs.writeFile(versionPath, JSON.stringify({ timestamp: new Date().toISOString(), files: modifiedFiles }));
          versionInfo.currentVersion = newVersion;
          versionInfo.totalVersions = newVersion + 1;
          await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));

          editDirContext = updatedContext;
          editDirModified = true; // Mark directory as modified

          // Update tree and notify user
          await updateTreeBox();
          appendMessage('ai', `{green-fg}Directory modified. ${modifiedFiles.length} file(s) updated. Saved as version ${newVersion}.{/}`, false);
          appendMessage('ai', `Modified files:\n${modifiedFiles.length > 0 ? modifiedFiles.map(f => f.path).join('\n') : 'None'}`, false);
          if (modifiedFiles.length > 0) {
            let modifiedPreview = '';
            for (const file of modifiedFiles) {
              const lang = path.extname(file.path).slice(1) || 'text';
              modifiedPreview += `File: ${file.path}\n\`\`\`${lang}\n${file.content.slice(0, 5000)}${file.content.length > 5000 ? '...' : ''}\n\`\`\`\n\n`;
            }
            appendMessage('ai', `Modified files preview:\n${modifiedPreview}`, false);
          }

          // Prompt user for version control actions in a loop until 'c' is selected
          let versionAction = '';
          while (versionAction !== 'c') {
            appendMessage('ai', `{yellow-fg}Version control options: [r]evert, [f]orward, [l]ist versions, [c]ontinue (default):{/}`, false);
            inputBox.clearValue();
            inputBox.setValue('');
            inputBox.focus();
            screen.render();

            // Clear existing submit listeners
            inputBox.removeAllListeners('submit');

            versionAction = await new Promise((resolve) => {
              const actionHandler = (response) => {
                inputBox.removeListener('submit', actionHandler);
                resolve(response.trim().toLowerCase());
              };
              inputBox.once('submit', actionHandler);
            });

            if (versionAction === 'r') {
              // Revert to previous version
              if (versionInfo.currentVersion <= 0) {
                appendMessage('ai', `{red-fg}No previous version available to revert to.{/}`, false);
              } else {
                const prevVersion = versionInfo.currentVersion - 1;
                const prevVersionPath = path.join(versionsDir, `editdir_${dirPath}_v${prevVersion}.json`);
                const prevVersionData = JSON.parse(await fs.readFile(prevVersionPath, 'utf8'));
                let newContext = editDirContext;
                for (const file of prevVersionData.files) {
                  const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
                  await fs.writeFile(fullPath, file.content);
                  const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
                  const newContent = `File: ${file.path}\n${file.content}\n\n`;
                  if (newContext.match(regex)) {
                    newContext = newContext.replace(regex, newContent);
                  } else {
                    newContext += newContent;
                  }
                }
                editDirContext = newContext;
                versionInfo.currentVersion = prevVersion;
                await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
                appendMessage('ai', `{green-fg}Reverted to version ${prevVersion}.{/}`, false);
                await updateTreeBox();
              }
            } else if (versionAction === 'f') {
              // Move to next version
              if (versionInfo.currentVersion >= versionInfo.totalVersions - 1) {
                appendMessage('ai', `{red-fg}No next version available to move forward to.{/}`, false);
              } else {
                const nextVersion = versionInfo.currentVersion + 1;
                const nextVersionPath = path.join(versionsDir, `editdir_${dirPath}_v${nextVersion}.json`);
                const nextVersionData = JSON.parse(await fs.readFile(nextVersionPath, 'utf8'));
                let newContext = editDirContext;
                for (const file of nextVersionData.files) {
                  const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
                  await fs.writeFile(fullPath, file.content);
                  const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
                  const newContent = `File: ${file.path}\n${file.content}\n\n`;
                  if (newContext.match(regex)) {
                    newContext = newContext.replace(regex, newContent);
                  } else {
                    newContext += newContent;
                  }
                }
                editDirContext = newContext;
                versionInfo.currentVersion = nextVersion;
                await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
                appendMessage('ai', `{green-fg}Moved forward to version ${nextVersion}.{/}`, false);
                await updateTreeBox();
              }
            } else if (versionAction === 'l') {
              // List all versions
              let versionList = '';
              for (let i = 0; i < versionInfo.totalVersions; i++) {
                const versionPath = path.join(versionsDir, `editdir_${dirPath}_v${i}.json`);
                const versionData = JSON.parse(await fs.readFile(versionPath, 'utf8'));
                versionList += `Version ${i} (Created: ${versionData.timestamp})\n`;
              }
              appendMessage('ai', `{gray-fg}Available versions:\n${versionList}{/}`, false);
            } else if (versionAction === 'c') {
              // Continue with current changes
              appendMessage('ai', `{green-fg}Continuing with current changes (version ${versionInfo.currentVersion}).{/}`, false);
            } else {
              // Invalid input, treat as continue
              appendMessage('ai', `{gray-fg}Invalid option, continuing with current changes (version ${versionInfo.currentVersion}).{/}`, false);
              versionAction = 'c';
            }
          }

          // Re-attach the main submit handler after exiting the loop
          inputBox.removeAllListeners('submit');
          inputBox.on('submit', handleInputSubmission);

        } catch (error) {
          appendMessage('ai', `{red-fg}Error applying changes: ${error.message}{/}`, false);
          appendMessage('ai', `{yellow-fg}Do you want to revert to the previous version? (y/n):{/}`, false);
          inputBox.clearValue();
          inputBox.setValue('');
          inputBox.focus();
          screen.render();

          // Clear existing submit listeners
          inputBox.removeAllListeners('submit');

          const revertConsent = await new Promise((resolve) => {
            const revertHandler = (response) => {
              inputBox.removeListener('submit', revertHandler);
              resolve(response.trim().toLowerCase());
            };
            inputBox.once('submit', revertHandler);
          });

          // Re-attach the main submit handler
          inputBox.removeAllListeners('submit');
          inputBox.on('submit', handleInputSubmission);

          if (revertConsent === 'y') {
            if (versionInfo.currentVersion <= 0) {
              appendMessage('ai', `{red-fg}No previous version available to revert to.{/}`, false);
            } else {
              const prevVersion = versionInfo.currentVersion - 1;
              const prevVersionPath = path.join(versionsDir, `editdir_${dirPath}_v${prevVersion}.json`);
              const prevVersionData = JSON.parse(await fs.readFile(prevVersionPath, 'utf8'));
              let newContext = editDirContext;
              for (const file of prevVersionData.files) {
                const fullPath = path.join(currentWorkingDir, editDirPath, file.path);
                await fs.writeFile(fullPath, file.content);
                const regex = new RegExp(`File: ${file.path}\\n[\\s\\S]*?\\n\\n(?=File: |$)`, 'g');
                const newContent = `File: ${file.path}\n${file.content}\n\n`;
                if (newContext.match(regex)) {
                  newContext = newContext.replace(regex, newContent);
                } else {
                  newContext += newContent;
                }
              }
              editDirContext = newContext;
              versionInfo.currentVersion = prevVersion;
              await fs.writeFile(versionInfoPath, JSON.stringify(versionInfo));
              appendMessage('ai', `{green-fg}Reverted to version ${prevVersion} due to error.{/}`, false);
              await updateTreeBox();
            }
          } else {
            appendMessage('ai', `{gray-fg}No revert performed. Current changes retained.{/}`, false);
          }
        }
      } else {
        appendMessage('ai', `{gray-fg}No files need modification for the request.{/}`, false);
      }
    } else if (consent === 'cancel') {
      // Cancel the modification
      appendMessage('ai', `{gray-fg}Directory modification cancelled.{/}`, false);
      inputBox.clearValue();
      inputBox.focus();
      screen.render();
    } else {
      // Plan not approved, ask for modifications
      appendMessage('ai', `{gray-fg}Please describe what needs to change in the proposed plan:{/}`, false);
      inputBox.clearValue();
      inputBox.setValue('');
      inputBox.focus();
      screen.render();

      // Clear existing submit listeners
      inputBox.removeAllListeners('submit');

      const modification = await new Promise((resolve) => {
        const modificationHandler = (response) => {
          inputBox.removeListener('submit', modificationHandler);
          resolve(response.trim());
        };
        inputBox.once('submit', modificationHandler);
      });

      // Display the user's modification in the chat area
      appendMessage('user', modification, false);
      await fs.appendFile(tempChatFile, `## User\n${modification}\n\n`);

      // Clear the input box after submitting the modification
      inputBox.clearValue();
      inputBox.focus();
      screen.render();

      // Generate a revised plan
      const revisedPrompt = `You are a software project planner with a friendly, conversational tone. The user has requested modifications to the directory "${dirPath}": "${query}". The current plan is: "${plan}". The user has provided the following modification: "${modification}". Revise the current plan to fully incorporate the user's modification, prioritizing the modification over any conflicting elements in the original request or current plan. Explicitly exclude any components contradicted by the modification (e.g., if the user says "use Flask instead of Django," replace all references to Django with Flask and adjust related dependencies). Use a conversational style, starting with phrases like "Let's update..." or "We'll tweak..." to engage the user, and maintain a clear, approachable tone throughout (e.g., "Let's swap in Flask for Django and set up the Python backend..."). Ensure the revised plan aligns with the original request where it does not conflict with the modification. Present the revised plan as a single, concise paragraph in markdown format, avoiding numbered lists or bullet points. Do not include shell commands or low-level implementation details. Ensure the revised plan is cohesive and directly reflects the user's modification.`;
      buffer = '';
      lastRenderedLength = 0;

      chatBox.insertBottom(`{gray-fg}Generating revised plan ${spinnerFrames[spinnerIndex]}{/}`);
      lastLineIndex = chatBox.getLines().length - 1;
      const newSpinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
        chatBox.setLine(lastLineIndex, `{gray-fg}Generating revised plan ${spinnerFrames[spinnerIndex]}{/}`);
        screen.render();
      }, 100);

      if (currentProvider === 'Gemini') {
        const result = await currentModel.generateContentStream(revisedPrompt);
        for await (const chunk of result.stream) {
          buffer += chunk.text();
          if (buffer.length > lastRenderedLength) {
            clearInterval(newSpinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      } else if (currentProvider === 'OpenAI') {
        const stream = await openAI.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'system', content: revisedPrompt }, { role: 'user', content: modification }],
          stream: true,
        });
        for await (const chunk of stream) {
          buffer += chunk.choices[0]?.delta?.content || '';
          if (buffer.length > lastRenderedLength) {
            clearInterval(newSpinnerInterval); // Stop spinner when rendering starts
            const newContent = buffer.slice(lastRenderedLength);
            const markedNewContent = marked(newContent);
            chatBox.deleteLine(lastLineIndex);
            chatBox.insertBottom(markedNewContent);
            chatBox.setScrollPerc(100);
            screen.render();
            lastRenderedLength = buffer.length;
            lastLineIndex = chatBox.getLines().length - 1;
          }
        }
      }

      clearInterval(newSpinnerInterval);
      if (buffer.length > lastRenderedLength) {
        const remainingContent = buffer.slice(lastRenderedLength);
        const markedRemainingContent = marked(remainingContent);
        chatBox.deleteLine(lastLineIndex);
        chatBox.insertBottom(markedRemainingContent);
        chatBox.setScrollPerc(100);
        screen.render();
      } else {
        chatBox.deleteLine(lastLineIndex);
      }
      latestPlan = buffer; // Update the latest plan with the revised plan

      // Recursively propose the revised plan, passing the updated latestPlan
      await proposeEditDirPlan(query, dirPath, latestPlan);
    }

    // Re-attach the main submit handler
    inputBox.removeAllListeners('submit');
    inputBox.on('submit', handleInputSubmission);
  } catch (error) {
    clearInterval(spinnerInterval);
    chatBox.deleteLine(lastLineIndex);
    appendMessage('ai', `{red-fg}Error generating plan: ${error.message}{/}`, false);
    inputBox.clearValue();
    inputBox.focus();
    screen.render();
    inputBox.on('submit', handleInputSubmission);
  }
}


// Save conversation button (Graphical yes/no list below tree)
const saveConButton = blessed.list({
  bottom: 4,
  left: 0,
  width: '30%',
  height: 3,
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', selected: { bg: '#6b7280', fg: '#ffffff' }, focus: { border: { fg: '#8ab4f8' } } },
  keys: true,
  mouse: true,
  tags: true,
  items: ['{blue-fg}Save Conversation (Yes){/}', '{blue-fg}Cancel (No){/}'],
  padding: { left: 1, right: 1 },
  hidden: true
});

// Multiline input box above save conversation button
const multiLineInputBox = blessed.textarea({
  bottom: 7, // Positioned above saveConButton (4 + 3 = 7)
  left: 0,
  width: '30%',
  height: 6, // Double the height of saveConButton (3 * 2 = 6)
  border: { type: 'line', fg: '#6b7280' },
  style: { fg: '#d4d4d4', bg: 'black', focus: { border: { fg: '#8ab4f8' } } },
  keys: true,
  mouse: true,
  inputOnFocus: true,
  padding: { left: 1, right: 1, top: 1, bottom: 1 },
  hidden: true, // Start hidden, shown when chat is active
});

// Label for multiline input box
const multiLineInputLabel = blessed.text({
  parent: multiLineInputBox,
  top: -1, // Positioned just above the textarea
  left: 1,
  content: '{gray-fg}M-Input>{/}',
  tags: true,
  style: { fg: '#d4d4d4', bg: 'black' },
});

// Append saveConButton to screen
screen.append(saveConButton);

screen.append(multiLineInputBox);

// Save conversation button handler
saveConButton.on('select', (item, index) => {
  if (index === 0) {
    saveConversation();
  } else {
    appendMessage('ai', '{gray-fg}Save conversation cancelled.{/}', false);
  }
  saveConButton.focus();
  screen.render();
});

// Adjust treeBox height to accommodate saveConButton
treeBox.height = '100%-13'; // Reduced from '100%-7' to make space for button



// Register persistent input handler
inputBox.on('submit', handleInputSubmission);

// Key bindings
screen.key(['q', 'C-c'], async () => {
  await fs.unlink(tempChatFile).catch(() => {});
  process.exit(0);
});
screen.key(['escape'], () => {
  treeBox.focus();
  screen.render();
});
screen.key(['i'], () => {
  inputBox.focus();
  screen.render();
});
screen.key(['c'], () => {
  chatBox.focus();
  screen.render();
});
screen.key(['s'], () => {
  saveConButton.focus();
  screen.render();
});
screen.key(['m'], () => {
  multiLineInputBox.focus();
  screen.render();
});
screen.key(['C-c'], () => copyCodeToClipboard());
chatBox.key(['up', 'k'], () => {
  chatBox.scroll(-1);
  screen.render();
});
chatBox.key(['down', 'j'], () => {
  chatBox.scroll(1);
  screen.render();
});

// Tree box interactivity
treeBox.key('enter', () => {
  const selectedIndex = treeBox.selected;
  toggleFolder(selectedIndex);
});
treeBox.on('click', () => treeBox.focus());
chatBox.on('click', () => chatBox.focus());

// Fix double input issue by ensuring single focus handler
inputBox.removeAllListeners('click');
inputBox.on('click', () => {
  inputBox.focus();
  screen.render();
});
inputBox.removeAllListeners('focus');
inputBox.on('focus', () => {
  inputBox.readInput(() => {});
});

// Handle screen resize
screen.on('resize', () => {
  chatBox.height = '100%-7';
  treeBox.height = '100%-13';
  saveConButton.bottom = 4;
  saveConButton.width = '30%';
  multiLineInputBox.bottom = 7;
  multiLineInputBox.width = '30%';
  screen.render();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  appendMessage('ai', `{red-fg}Unhandled error: ${reason.message || reason} (Program continues running){/}`, false);
});

// Start the initial provider selection process
setupProviderSelection();

// Initial focus on providerList
providerList.focus();
screen.render();
