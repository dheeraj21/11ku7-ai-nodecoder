# 11ku7-ai-nodecoder

A Shell-based AI coding assistant for generating code, web apps, creating, refactoring & querying codebases using Google Generative AI or OpenAI Compatible APIs.

**Version :  1.0.0**

**Official Repository** : https://github.com/dheeraj21/11ku7-ai-nodecoder

## Software Requirements :

Node.js 18+

**OS Supported:** Linux, Windows through WSL, Termux (Android)

## Features

#### Coding & Web Apps
- **Code Mode**: Generate and edit code snippets in various languages.
- **Webapp Mode**: Create and edit single-file HTML web apps with Tailwind CSS and JavaScript.

#### Creating Codebases, Refactoring Codebases, Querying codebases
- **Shell Mode**: Create Entire Codebases with Multiple files with AI-driven plans using shell mode.
- **EditDir Mode**: Modify Entire Codebases with multiple files in a directory with AI-driven plans.
- **AskDir Mode**: Querying project codebases without editing.

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
once installed set up api keys in a .env file in current directory with:

```bash
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
```
and finally run with command:

```bash
nodecoder
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

### Install dependencies:
```bash
npm install
```

### Set up api keys in a .env file:
```bash
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
```

### Start the application:
```bash
node index.js
```

### Getting Started

- **Select a provider** : (Gemini or OpenAI Compatible) and then select model if gemini or enter base url and model name for OpenAI Compatible Provider.

- **Use commands** : (e.g., /code, /shell) or queries to interact with the AI.


### Commands

- **/copy**: Copy code blocks from the last AI response to clipboard or save to temp-clipboard.txt.

- **/clear**: Clear the chat area and reset contexts.

- **/exit**: Exit the application, deleting temporary chat file.

- **/help**: Display commands and key bindings.

- **/model**: Switch AI provider or model.

- **/code**: Toggle code-only mode for generating code snippets.

- **/webapp**: Toggle webapp mode for creating HTML web apps.

- **/shell**: Toggle shell mode for generating and executing bash commands as well as creating multifile projects

- **/save** <filename>: Save code blocks from the last AI response to a file.

- **/editcode <filename>**: Load a file for code modification.

- **/askcode <filename>**: Load a file to ask questions about its code.

- **/savecon**: Save the chat conversation to a markdown file.

- **/digest [path]**: Toggle digest mode or analyze a directory/file (e.g., /digest ./my_project).

- **/loadcon <filename>**: Load a saved chat conversation from a markdown file.

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


### References

- **ReAct: Synergizing Reasoning And Acting in Language Models** [here](https://arxiv.org/pdf/2210.03629) 

- **cyclotruc/gitingest** [here](https://github.com/cyclotruc/gitingest)

  

  
