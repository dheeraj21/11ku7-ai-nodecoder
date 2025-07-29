# 11ku7-ai-nodecoder

A Shell-based AI coding assistant for generating code, web apps, creating, editing & querying codebases using Gemini, Openai, Openai Compatible, Grok & Anthropic APIs.

**Version :  1.0.9**

**What's new :**

- **This project from current version 1.0.9 is distributed with packaged binaries files supporting Linux-x64, Linux-arm64 and macos-x64**

- **This project now requires community key to unlock, driven by contribution to support development.**

- **added new providers Openai, Grok, Anthropic, also improved Openai-Compatible providers with support for openrouter by default.**

- **added image understanding through vision models, images can be attached with local paths covering entire scope of program.**

- **improved editdir mode on major areas including file parsing, error handling, local version control tags.**

- **improved save conversation feature.**

- **added token count functionality for every response supporting all providers, with input, output and total token count, summary of tokens in session is saved conversation at end.**

- **improved env file handling for api keys, self env generation with placeholder, ask api key at start only mechanism implemented.**

- **exclusion of saved chat conversations files for editdir, askdir mode context.**

- **Added Guide mode, which act as a brain of the program also performs action of transferring queries to specific modes.**

- **Added theme options, improved ui elements.**

- **Console output ui rendering issues solved through piping output to log file.**


**Official Repository** : https://github.com/dheeraj21/11ku7-ai-nodecoder

## Software Requirements :

Node.js 18+

**OS Supported:** Linux, Windows through WSL, MacOS, Termux (Android)

**Device Support:** state of the art performance on touch screen devices like Android mobile with Termux App (Linux-arm64) tested with ubuntu distro, raspberry pi support (Linux-arm64)


## Features

#### Guide of program
- **Guide Mode**: Acts as the program's intelligent brain.


#### Coding & Web Apps
- **Code Mode**: Generate and edit code snippets in various languages.
- **Webapp Mode**: Create and edit single-file HTML web apps with Tailwind CSS and JavaScript.

#### Creating Codebases, Refactoring Codebases, Querying codebases
- **dir Mode**: Create Entire Codebases with Multiple files with AI-driven plans using dir mode.
- **EditDir Mode**: Modify Entire Codebases with multiple files in a directory with AI-driven plans.
- **AskDir Mode**: Querying project codebases without editing.

#### Shell Commands
- **Shell Mode**: Run shell commands using natural language queries.

#### Analysis Tools
- **Digest Mode**: Turn entire Codebases/Directory with Multiple files into a single text file.

#### User Interface
- **Interactive UI**: Terminal interface with file tree, chat, and syntax highlighting.

#### Speciality
- **Persistent Chat**: Stores conversations in markdown for unlimited output length.


## Installation
```bash
npm install -g 11ku7-ai-nodecoder
```
OR

```bash
sudo npm install -g 11ku7-ai-nodecoder
```

and finally run with command:

```bash
nodecoder
```

OR

```bash
sudo nodecoder
```

**OR**

### Clone the repository
```bash
git clone https://github.com/dheeraj21/11ku7-ai-nodecoder.git
```

### Change directory:
```bash
cd 11ku7-ai-nodecoder
```

### Give Permissions
```bash
chmod +x run.sh
```
and 

```bash
chmod +x 11ku7-ai-nodecoder-linux-x64
```
```bash
chmod +x 11ku7-ai-nodecoder-linux-arm64
```
```bash
chmod +x 11ku7-ai-nodecoder-macos-x64
```

### Start the application:
```bash
nodecoder
```


### Commands

- **/copy**: Copy code blocks from the last AI response to clipboard or save to temp-clipboard.txt.

- **/clear**: Clear the chat area and reset contexts.

- **/exit**: Exit the application, deleting temporary chat file.

- **/help**: Display commands and key bindings.

- **/model**: Switch AI provider or model.

- **/guide**: Acts as the program's intelligent brain

- **/code**: Toggle code-only mode for generating code snippets.

- **/webapp**: Toggle webapp mode for creating HTML web apps.

- **/shell**: Toggle shell mode for generating and executing bash commands.

- **/save** <filename>: Save code blocks from the last AI response to a file.

- **/editcode <filename>**: Load a file for code modification.

- **/askcode <filename>**: Load a file to ask questions about its code.

- **/savecon**: Save the chat conversation to a markdown file.

- **/digest [path]**: Toggle digest mode or analyze a directory/file (e.g., /digest ./my_project).

- **/loadcon <filename>**: Load a saved chat conversation from a markdown file.

- **/dir**: Toggle dir mode for creating multifile codebase

- **/editdir <path>**: Load a directory for AI-driven file modifications.

- **/askdir <path>**: Load a directory to query its contents.

- **/desc**: Show detailed descriptions of modes, commands, and key bindings.

### Key Bindings

- **Esc**: Switch focus to the folder tree for navigation.

- **i**: Focus the single-line input box for queries or commands.

- **c**: Focus the chat area for scrolling conversation history.

- **s**: Focus the save conversation button (Yes/No).

- **m**: Focus the multiline input box for complex queries or error pasting.

- **q or Ctrl+C**: Exit the application.

- **Up/k (in chat)**: Scroll chat area up.

- **Down/j (in chat)**: Scroll chat area down.

- **Enter (in tree)**: Expand/collapse folders or toggle file content display.


### Navigation Notes

- Use key bindings for UI navigation (e.g., Esc for tree, i for input).

- Mouse is for scrolling chat or tree; avoid clicking UI elements while input is active to prevent double input issues.

- Use m to access the multiline input box for pasting errors or long queries (e.g., via Ctrl+Shift+V and right-click).

- All queries combine single-line and multiline inputs, submitted via the main input box.


### License

- This project is licensed under the **MIT License**. See the `LICENSE` file for details.




  

  
