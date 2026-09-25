# Custom Operating System Security Module

A browser-based, TypeScript-implemented operating system simulation with an integrated security management layer. The project models core OS subsystems — process scheduling, memory management, interrupts, device drivers, and disk I/O — and extends them with a dedicated security manager for access control and system protection.

## Course Origin

2025 Browser-based Operating System in TypeScript

This is Alan's Operating Systems class initial project. See https://www.labouseur.com/courses/os/ for details. It was originally developed by Alan and then enhanced by Bob Nisco and Rebecca Murphy over the years. Fork this (or clone, but fork is probably better in case Alan changes anything about the initial project) into your own private repository. Or download it as a ZIP file. Then add Alan (userid Labouseur) as a collaborator.

## Overview

This project simulates a single-user operating system that runs entirely in the browser, using an HTML5 canvas as the "hardware" display and a virtual console/shell for user interaction. On top of the classic OS architecture (kernel, scheduler, dispatcher, memory manager, disk), this build adds a **Security Manager** responsible for enforcing access policies, validating operations, and protecting system resources from unauthorized commands — reflecting a security-intensive extension of a traditional OS project.

## Features

- **Process management** — process control blocks, a ready queue, and a scheduler/dispatcher pair for context switching between processes
- **Memory management** — allocation, tracking, and protection of simulated memory segments
- **Interrupt-driven execution** — a central interrupt queue and handler routing hardware/software interrupts to the kernel
- **Disk simulation** — a virtual file system with disk I/O and a disk-state display
- **Device drivers** — a generic driver base with a concrete keyboard driver implementation
- **Interactive shell** — a command-line shell supporting built-in and user-defined commands
- **Security layer** — a dedicated manager enforcing permissions, validating commands/processes, and guarding sensitive operations
- **Canvas-based console** — text rendering and console I/O drawn directly to an HTML canvas

## Project Structure

```
Operating Systems/
└── source/
    └── os/
        ├── canvastext.ts          # Low-level text rendering helpers for the canvas display
        ├── console.ts             # Virtual console: input buffering, output, canvas drawing
        ├── deviceDriver.ts        # Base/abstract device driver class
        ├── deviceDriverKeyboard.ts# Keyboard driver — captures and queues keystrokes
        ├── disk.ts                # Virtual disk storage and file system operations
        ├── diskdisplay.ts         # Renders disk/file system state to the UI
        ├── dispatcher.ts          # Context switching between processes
        ├── interrupt.ts           # Interrupt object definitions and the interrupt queue
        ├── kernel.ts              # OS kernel: boot sequence, interrupt handling, core OS loop
        ├── memorymanager.ts       # Memory allocation, deallocation, and protection
        ├── pcb.ts                 # Process Control Block definition
        ├── queue.ts               # Generic queue data structure used across subsystems
        ├── scheduler.ts           # CPU scheduling algorithm(s) and ready-queue management
        ├── securitymanager.ts     # Access control, permission checks, and system protection
        ├── shell.ts               # Shell core: command parsing and execution loop
        ├── shellCommand.ts        # Shell command definitions/registry
        └── userCommand.ts         # User-issued command handling and validation
```

## Architecture

At a high level, control flows as follows:

1. **Boot** — `kernel.ts` initializes core services (memory manager, scheduler, device drivers) and starts the interrupt-driven OS loop.
2. **Input** — `deviceDriverKeyboard.ts` captures keystrokes and raises interrupts, which are placed on the queue defined in `interrupt.ts`.
3. **Interrupt handling** — `kernel.ts` pulls interrupts off the queue each cycle and routes them to the appropriate handler (keyboard input, disk operation, process request, etc.).
4. **Shell & commands** — `shell.ts` reads console input via `console.ts`, parses it against the command set in `shellCommand.ts`/`userCommand.ts`, and executes the result.
5. **Process lifecycle** — new processes are represented as `pcb.ts` objects, placed on a `queue.ts`-based ready queue, and cycled through the CPU by `scheduler.ts` and `dispatcher.ts`.
6. **Memory** — `memorymanager.ts` allocates and tracks memory for each process and enforces boundaries between them.
7. **Security** — `securitymanager.ts` intercepts sensitive operations (privileged commands, memory access, disk access) and validates them against defined permissions before they're allowed to proceed.
8. **Disk & display** — `disk.ts` handles simulated file storage; `diskdisplay.ts` and `canvastext.ts` render live system state to the canvas UI.

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Browser (HTML5 Canvas for display/UI)
- **Compilation:** TypeScript compiler (`tsc`) — transpiles to JavaScript for browser execution

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- TypeScript (`npm install -g typescript`, or as a project dependency)

### Setup

```bash
git clone https://github.com/<your-org>/Custom-Operating-System-Security-Module.git
cd Custom-Operating-System-Security-Module/Operating Systems

# Install dependencies
npm install

# Compile TypeScript to JavaScript
tsc
```

### Running

Open the project's `index.html` in a browser (or serve the directory with a local static server) to boot the simulated OS in the canvas console.

```bash
# Example using a simple static server
npx serve .
```

## Usage

Once booted, interact with the OS through the on-screen shell. Logging in is necessary to access other commands:

- `login <username> <password>` — login with username and password (admin login is username: king, password: fitsum)
- `help` — lists all commands and their functionalities
- `useradd <username> <password>` — create a user with a custom username and password
- `log` — shows you user login/logout and creation/deletion logs
- `logout` — logs you out of current account
- `load` — validate and load a user program
- `run <pid>` — run a loaded process
- `ps` — list active processes
