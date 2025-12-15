module TSOS {
    export class MemoryManager {
        private pidCounter: number;
        private partitionSize: number = PARTITION_SIZE;
        private readonly pcbTable: Map<number, PCB>;
        private partitionMap: boolean[];

        constructor(partitionSize: number = PARTITION_SIZE) {
            this.pidCounter = 0;
            this.partitionSize = partitionSize;
            this.pcbTable = new Map<number, PCB>();
            const numPartitions = Math.floor(MEMORY_SIZE / this.partitionSize);
            this.partitionMap = Array(numPartitions).fill(false);
        }



        private givePartition(): number {
            for (let i = 0; i < this.partitionMap.length; i++) {
                if (!this.partitionMap[i]) {
                    this.partitionMap[i] = true;
                    return i;
                }
            }
            throw new Error("No partitions available.");
        }
        // Makes sure index is valid before marking it as available.
        private takePartition(index: number): void {
            if (index >= 0 && index < this.partitionMap.length) {
                this.partitionMap[index] = false;
            }
        }


        // Returns the created PID.
        public loadProgram(hexBytes: string[]): number {
            this.cleanupTerminated();

            const sanitized = this.sanitizeProgram(hexBytes);
            if (sanitized.length === 0) {
                throw new Error("MemoryManager has no program bytes provided.");
            }
            if (sanitized.length > this.partitionSize) {
                throw new Error(
                    `MemoryManager program size ${sanitized.length} exceeds available memory ${this.partitionSize}.`
                );
            }

            const pid = this.pidCounter++;
            let partitionIndex: number;
            let base: number;
            let limit: number;
            let pcb: PCB;

            // Try to allocate a partition in memory
            try {
                partitionIndex = this.givePartition();
                base = partitionIndex * this.partitionSize;
                limit = base + this.partitionSize - 1;

                // Write the program into its assigned partition
                for (let i = 0; i < sanitized.length; i++) {
                    _Memory.writeDirect(base + i, sanitized[i]);
                }

                // Create PCB for program in memory
                pcb = new PCB(pid, base, limit, 0, 0, 0, 0, 0, "Resident");
                _Kernel.krnTrace(`Process ${pid} loaded into memory at base ${base.toString(16)}`);
            } catch (err) {
                _Kernel.krnTrace(`No memory available, loading process ${pid} to disk`);

                // Write directly to disk
                const tsb = _Disk.writeSwap(pid, sanitized);

                // Create PCB for program on disk
                pcb = new PCB(pid, 0, 0, 0, 0, 0, 0, 0, "Resident", 0, 0, undefined, "Hard Drive", 0, 0, tsb, true);
                _Kernel.krnTrace(`Process ${pid} loaded to disk at TSB ${tsb[0]},${tsb[1]},${tsb[2]}`);
                if (_DiskDisplay) _DiskDisplay.refresh();
            }

            this.pcbTable.set(pid, pcb);
            _ResidentList.push(pcb);
            this.refreshGlobalList();
            return pid;
        }

        public getPCB(pid: number): PCB | undefined {
            return this.pcbTable.get(pid);
        }

        public getLoadedPrograms(): PCB[] {
            return Array.from(this.pcbTable.values());
        }

        public markTerminated(pid: number): void {
            const pcb = this.pcbTable.get(pid);
            if (pcb) {
                pcb.state = "Terminated";
            }

            this.refreshGlobalList();
        }


        public cleanupTerminated(): void {
            for (const [pid, pcb] of this.pcbTable.entries()) {
                if (pcb.state === "Terminated") {
                    // Only free a partition if the process was in memory (not on disk)
                    if (!pcb.isOnDisk && typeof pcb.base === "number" && pcb.base >= 0) {
                        const partitionIndex = Math.floor(pcb.base / this.partitionSize);
                        if (partitionIndex >= 0 && partitionIndex < this.partitionMap.length) {
                            this.takePartition(partitionIndex);
                            _Kernel.krnTrace(`Freed partition ${partitionIndex} from terminated PID ${pid}`);
                        }
                    }
                }
            }
            this.refreshGlobalList();
        }


        public reset(): void {
            this.pcbTable.clear();
            const numPartitions = Math.floor(MEMORY_SIZE / this.partitionSize);
            this.partitionMap = Array(numPartitions).fill(false);
            this.refreshGlobalList();
        }

        private sanitizeProgram(hexBytes: string[]): string[] {
            const cleaned: string[] = [];

            for (const rawByte of hexBytes) {
                const trimmed = rawByte.trim();
                if (trimmed.length === 0) {
                    continue;
                }

                if (!/^[0-9A-Fa-f]{2}$/.test(trimmed)) {
                    throw new Error(`MemoryManager.loadProgram: invalid byte '${trimmed}'. Use two hexadecimal characters per byte.`);
                }

                cleaned.push(trimmed.toUpperCase());
            }

            return cleaned;
        }

        private refreshGlobalList(): void {
            _PCBList = Array.from(this.pcbTable.values());
        }

        // Swap-out - Move a process from memory to disk
        public swapOut(pid: number): boolean {
            const pcb = this.pcbTable.get(pid);
            if (!pcb || pcb.isOnDisk) {
                return false;
            }

            try {
                // Ensure base/limit are valid
                if (typeof pcb.base !== "number" || typeof pcb.limit !== "number" || pcb.base < 0 || pcb.limit >= _Memory.size) {
                    throw new Error(`Invalid PCB memory range: ${pcb.base}–${pcb.limit}`);
                }

                // Read the process data from memory safely
                const processData: string[] = [];
                for (let i = pcb.base; i <= pcb.limit && i < _Memory.size; i++) {
                    processData.push(_Memory.readDirect(i));
                }

                // Write to disk and get TSB location
                const tsb = _Disk.writeSwap(pid, processData);

                pcb.swapTSB = tsb;
                pcb.isOnDisk = true;
                pcb.location = "Hard Drive";

                // Keep old base/limit for clearing memory
                const oldBase = pcb.base;
                const oldLimit = pcb.limit;

                // Free the partition
                const partitionIndex = Math.floor(oldBase / this.partitionSize);
                this.takePartition(partitionIndex);

                for (let i = oldBase; i <= oldLimit && i < _Memory.size; i++) {
                    _Memory.writeDirect(i, "00");
                }

                pcb.base = 0;
                pcb.limit = 0;
                pcb.segment = -1;

                _Kernel.krnTrace(`Process ${pid} swapped out to disk at TSB ${tsb[0]},${tsb[1]},${tsb[2]}`);
                if (_DiskDisplay) _DiskDisplay.refresh();
                return true;
            } catch (err) {
                _Kernel.krnTrace(`Failed to swap out process ${pid}: ${err}`);
                return false;
            }
        }

        // Swap-in - Move a process from disk to memory
        public swapIn(pid: number): boolean {
            const pcb = this.pcbTable.get(pid);
            if (!pcb || !pcb.isOnDisk || !pcb.swapTSB) {
                return false;
            }

            try {
                // Allocate a partition
                const partitionIndex = this.givePartition();
                const newBase = partitionIndex * this.partitionSize;
                const newLimit = newBase + this.partitionSize - 1;

                const [t, s, b] = pcb.swapTSB;
                const result = _Disk.readSwap(t, s, b);
                const processData = result.bytes;
                const chain = result.chain;

                // Write to memory (up to partition size)
                for (let i = 0; i < processData.length && i < this.partitionSize; i++) {
                    _Memory.writeDirect(newBase + i, processData[i]);
                }
                // If partition larger than data, pad remainder with 00
                for (let i = processData.length; i < this.partitionSize; i++) {
                    _Memory.writeDirect(newBase + i, "00");
                }

                // Update PCB
                pcb.base = newBase;
                pcb.limit = newLimit;
                pcb.segment = partitionIndex;
                pcb.isOnDisk = false;
                pcb.location = "Memory";

                // Free the swap blocks (clear them too)
                for (const [ct, cs, cb] of chain) {
                    _Disk.freeBlock(ct, cs, cb);
                    _Disk.setBlock(ct, cs, cb, "".padEnd(_Disk.hexBlockSize, "0"));
                }

                pcb.swapTSB = null;

                _Kernel.krnTrace(`Process ${pid} swapped in to memory at base ${newBase.toString(16)}`);
                if (_DiskDisplay) _DiskDisplay.refresh();
                return true;
            } catch (err) {
                _Kernel.krnTrace(`Failed to swapped in process ${pid}: ${err}`);
                return false;
            }
        }



        // Find first ready process in memory to swap
        public findProcessToSwap(): number | null {
            for (const [pid, pcb] of this.pcbTable.entries()) {
                if (pcb === _CurrentPCB) {
                    continue;
                }

                if (!pcb.isOnDisk && pcb.state !== "Terminated") {
                    return pid;
                }
            }
            return null;
        }
    }
}
// Lots of the logic is built on my own MMU from computer org and arch 
// Hall of Fame Projects: MarshMan, LuchiOS, and LegOS

// When I tried integrating swapping, I got a lot of memory access violations. Asked AI why and it told me
// my memoryaccessor was enforcing bounds  for my writedirect and readdirect which caused swapping to fail.

// Used reference from LegOS, chaOS, and MarshOS in designing my swapping.
// Used AI for to help fix my find process command as it was not handling terminated pcbs properly.
