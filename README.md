# Plexrr

Plex Library Sync Utility

## Overview

The **Plexrr** Plex Library Sync Utility is a Node.js tool designed to help multiple Plex users browse each other's libraries and selectively sync individual movies or TV shows to a remote library. This allows seamless sharing without completely merging libraries or affecting metadata.

## Features

- 📂 **Browse Plex Libraries** – Query available libraries on your Plex server.
- 🔍 **Search & Select Media** – Choose specific movies or TV shows to sync.
- 🔄 **File Transfer** – Uses SFTP (via SSH) to copy selected media files to a remote server.
- 🔐 **Secure Authentication** – Uses Plex API for library access and SSH for file transfers.

## How It Works

1. Connects to a Plex server using your **Plex token**.
2. Lists available **libraries** (Movies, TV Shows, etc.).
3. Allows the user to **select a movie/TV show** to sync.
4. Extracts the **file path** of the selected media.
5. Transfers the file to a **remote server** via **SFTP**.

## Installation

### Prerequisites

- **Node.js (16+)**
- **Plex Server** with API access
- **SSH access** to a remote server (for file transfers)

### Setup

1. **Clone the repository:**

   ```sh
   git clone https://github.com/your-repo/plex-sync.git
   cd plex-sync
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment variables:**
   - Update the script with your **Plex Server URL** and **Plex Token**.
   - Provide **SSH credentials** for the remote server.

## Usage

Run the script using:

```sh
node plex-sync.js
```

Follow the prompts to select a library and media file for syncing.

## Next Steps

🚀 **Enhancements in Progress:**

- **Metadata Syncing** – Sync watched status & metadata.
- **Multi-Plex Support** – Allow syncing between different Plex servers.
- **Web UI** – Build a web-based interface for easier use.
- **Batch Sync** – Select multiple files for transfer at once.

## Contributing

We welcome contributions! Feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the **MIT License**.

---
💡 _Questions or suggestions? Let us know!_
