# Plexrr
![Plexrr](images/plexrr.png)

Plex Library Sync Utility

## Overview

The **Plexrr** Plex Library Sync Utility is a Node.js tool designed to help Plex users browse each other's libraries and selectively download individual movies or TV shows to a remote library. This allows seamless sharing without completely merging libraries or affecting metadata.

## Features

- 📂 **Browse Plex Libraries** – Query available libraries on your Plex server.
- 🔍 **Search & Select Media** – Choose specific movies or TV shows to sync.
- ⬇️ **Direct Downloads** – Uses Plex's native HTTP(s) download functionality for efficient transfers.
- 🔐 **Secure Authentication** – Uses Plex API for library access and downloads.
- 🎮 **Transfer Speed Control** – Built-in throttling mechanism to limit bandwidth usage during downloads.

## How It Works

1. Connects to a Plex server using your **Plex token**.
2. Lists available **libraries** (Movies, TV Shows, etc.).
3. Allows the user to **select a movie/TV show/music** to sync.
4. Initiates a direct HTTP(s) download from the Plex server.
5. Saves the media file to the specified local destination.
6. Optionally throttles download speed to maintain network stability.

## Configuration

### Environment Variables

Create a `.env` file with the following settings:

```env
PLEX_SERVER=http://your-plex-server:32400
PLEX_TOKEN=your-plex-token
LOCAL_PATH=/path/to/local/media
TRANSFER_SPEED_LIMIT=1  # Optional: Limit transfer speed in MB/s, leave blank for unthrottled
```

## Transfer Speed Control

The TRANSFER_SPEED_LIMIT setting allows you to cap the bandwidth used during file transfers:

- Set in megabytes per second (MB/s)
- Leave empty or remove for unlimited transfer speed
- Helps prevent network saturation during large transfers

## Installation

### Prerequisites

- **Node.js (16+)**
- **Plex Server** with API access

### Setup

1. **Clone the repository:**

   ```sh
   git clone https://github.com/your-repo/plexrr.git
   cd plexrr
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment variables:**
   - Update the script with your **Plex Server URL** and **Plex Token**.

## Usage

Run the script using:

```sh
npm run start
```

Follow the prompts to select a library and media file for syncing.

## Next Steps

🚀 **Enhancements in Progress:**

- **Batch Sync** – Select multiple files for transfer at once.
- **Multi-Plex Support** – Allow syncing between different Plex servers.
- **Web UI** – Build a web-based interface for easier use.

## Contributing

We welcome contributions! Feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the **MIT License**.

---
💡 _Questions or suggestions? Let us know!_

## Notes

- [Finding an authentication token (X-Plex-Token)](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)
