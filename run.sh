#!/bin/bash

# Get the global npm modules directory and construct the package path
NPM_GLOBAL=$(npm root -g 2>/dev/null)
if [ -z "$NPM_GLOBAL" ]; then
    echo "Error: Failed to determine npm global modules directory"
    exit 1
fi
SCRIPT_DIR="$NPM_GLOBAL/11ku7-ai-nodecoder"

# Change to the package directory
cd "$SCRIPT_DIR" || {
    echo "Error: Failed to change to directory $SCRIPT_DIR"
    exit 1
}

# Binary base name
BINARY_BASE="11ku7-ai-nodecoder"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

# Debug: Print OS, architecture, and directory
echo "OS: $OS, Architecture: $ARCH"
echo "Current directory: $(pwd)"
echo "Looking for binary: $BINARY_BASE-*"
ls -l

# Determine the correct binary based on OS and architecture
if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        BINARY="${BINARY_BASE}-linux-x64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        BINARY="${BINARY_BASE}-linux-arm64"
    else
        echo "Error: Unsupported architecture: $ARCH"
        exit 1
    fi
elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "arm64" ]; then
        BINARY="${BINARY_BASE}-macos-x64"
    else
        echo "Error: Unsupported architecture: $ARCH"
        exit 1
    fi
else
    echo "Error: Unsupported OS: $OS"
    exit 1
fi

# Check if the binary exists
if [ ! -f "$BINARY" ]; then
    echo "Error: Binary '$BINARY' not found in $(pwd)!"
    exit 1
fi

# Set execute permissions
chmod +x "$BINARY" 2>/dev/null || {
    echo "Warning: Failed to set execute permissions on $BINARY"
}

# Run the binary
./"$BINARY"
