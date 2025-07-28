#!/bin/bash

# Binary base name
BINARY_BASE="11ku7-ai-nodecoder"

# Detect OS and architecture
OS=$(uname -s)
ARCH=$(uname -m)

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
    echo "Error: Binary '$BINARY' not found!"
    exit 1
fi

# Set execute permissions
chmod +x "$BINARY"

# Run the binary
./"$BINARY"
