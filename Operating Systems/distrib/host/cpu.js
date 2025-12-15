/* ------------
     CPU.ts

     Routines for the host CPU simulation, NOT for the OS itself.
     In this manner, it's A LITTLE BIT like a hypervisor,
     in that the Document environment inside a browser is the "bare metal" (so to speak) for which we write code
     that hosts our client OS. But that analogy only goes so far, and the lines are blurred, because we are using
     TypeScript/JavaScript in both the host and client environments.

     This code references page numbers in the text book:
     Operating System Concepts 8th edition by Silberschatz, Galvin, and Gagne.  ISBN 978-0-470-12872-5
     ------------ */
var TSOS;
(function (TSOS) {
    class Cpu {
        PC = 0;
        Acc = 0;
        Xreg = 0;
        Yreg = 0;
        Zflag = 0;
        instructionReg = "00";
        isExecuting = false;
        baseReg = 0;
        limitReg = 0;
        init() {
            this.PC = 0;
            this.Acc = 0;
            this.Xreg = 0;
            this.Yreg = 0;
            this.Zflag = 0;
            this.instructionReg = "00";
            this.isExecuting = false;
        }
        cycle() {
            if (!this.isExecuting || !_CurrentPCB)
                return;
            try {
                // Trace for debugging
                _Kernel.krnTrace(`CPU cycle started for PID ${_CurrentPCB.pid}`);
                // Fetch instruction
                const physAddr = _CurrentPCB.base + this.PC;
                this.instructionReg = _MemoryAccessor.read(physAddr);
                _Kernel.krnTrace(`Fetched opcode ${this.instructionReg} at 0x${physAddr.toString(16)}`);
                // Decode & Execute
                this.decodeAndExecute();
                _Scheduler.tick();
                // Sync CPU state back to PCB
                this.syncToPCB();
                _Kernel.krnTrace(`Cycle complete for PID ${_CurrentPCB.pid}`);
            }
            catch (err) {
                // Send trap to kernel
                _Kernel.krnTrapError(`CPU Exception: ${err.message}`);
            }
        }
        decodeAndExecute() {
            const op = this.instructionReg;
            switch (op) {
                case "A9":
                    this.ldaConst();
                    break;
                case "AD":
                    this.ldaMem();
                    break;
                case "8D":
                    this.staMem();
                    break;
                case "6D":
                    this.adcMem();
                    break;
                case "A2":
                    this.ldxConst();
                    break;
                case "AE":
                    this.ldxMem();
                    break;
                case "A0":
                    this.ldyConst();
                    break;
                case "AC":
                    this.ldyMem();
                    break;
                case "EA":
                    this.nop();
                    break;
                case "00":
                    this.brk();
                    break;
                case "EC":
                    this.cpx();
                    break;
                case "D0":
                    this.bne();
                    break;
                case "EE":
                    this.inc();
                    break;
                case "FF":
                    this.sys();
                    break;
                default:
                    this.isExecuting = false;
                    _Kernel.krnTrapError(`Invalid opcode ${op} at PC=${this.PC}`);
            }
        }
        // -------------------- INSTRUCTION IMPLEMENTATIONS --------------------
        ldaConst() {
            const value = this.fetchByte(1);
            this.Acc = value;
            this.PC += 2;
            this.PC &= 0xFF;
        }
        ldaMem() {
            const addr = this.getAddress();
            this.Acc = _MemoryAccessor.readByte(addr);
            this.PC += 3;
            this.PC &= 0xFF;
        }
        staMem() {
            const addr = this.getAddress();
            _MemoryAccessor.write(addr, this.Acc.toString(16).padStart(2, "0").toUpperCase());
            this.PC += 3;
            this.PC &= 0xFF;
        }
        adcMem() {
            const addr = this.getAddress();
            const val = _MemoryAccessor.readByte(addr);
            this.Acc = (this.Acc + val) & 0xFF; // keep 8-bit
            this.PC += 3;
            this.PC &= 0xFF;
        }
        ldxConst() {
            const val = this.fetchByte(1);
            this.Xreg = val;
            this.PC += 2;
            this.PC &= 0xFF;
        }
        ldxMem() {
            const addr = this.getAddress();
            this.Xreg = _MemoryAccessor.readByte(addr);
            this.PC += 3;
            this.PC &= 0xFF;
        }
        ldyConst() {
            const val = this.fetchByte(1);
            this.Yreg = val;
            this.PC += 2;
            this.PC &= 0xFF;
        }
        ldyMem() {
            const addr = this.getAddress();
            this.Yreg = _MemoryAccessor.readByte(addr);
            this.PC += 3;
            this.PC &= 0xFF;
        }
        nop() {
            this.PC++;
            this.PC &= 0xFF;
        }
        brk() {
            this.isExecuting = false;
            if (_CurrentPCB) {
                _CurrentPCB.state = "Terminated";
                _MemoryManager.markTerminated(_CurrentPCB.pid);
                _StdOut.putText(`Program ${_CurrentPCB.pid} finished.`);
            }
            _StdOut.advanceLine();
            _KernelInterruptQueue.enqueue(new TSOS.Interrupt(CONTEXT_SWITCH_IRQ, []));
        }
        cpx() {
            const addr = this.getAddress();
            const val = _MemoryAccessor.readByte(addr);
            this.Zflag = (this.Xreg === val) ? 1 : 0;
            this.PC += 3;
            this.PC &= 0xFF;
        }
        bne() {
            let offset = this.fetchByte(1);
            if (offset > 0x7F) {
                offset = offset - 0x100; // treat as signed byte
            }
            if (this.Zflag === 0) {
                this.PC = (this.PC + 2 + offset) & 0xFF;
            }
            else {
                this.PC = (this.PC + 2) & 0xFF;
            }
        }
        inc() {
            const addr = this.getAddress();
            const val = (_MemoryAccessor.readByte(addr) + 1) & 0xFF;
            _MemoryAccessor.write(addr, val.toString(16).padStart(2, "0").toUpperCase());
            this.PC += 3;
            this.PC &= 0xFF;
        }
        sys() {
            if (this.Xreg === 1) {
                _StdOut.putText(this.Yreg.toString());
            }
            else if (this.Xreg === 2) {
                let output = "";
                let ptr = _CurrentPCB.base + this.Yreg;
                const limit = _CurrentPCB.base + PARTITION_SIZE - 1;
                let char = _MemoryAccessor.read(ptr);
                while (char !== "00" && ptr <= limit) {
                    output += String.fromCharCode(parseInt(char, 16));
                    ptr++;
                    char = _MemoryAccessor.read(ptr);
                }
                _StdOut.putText(output);
            }
            this.PC++;
            this.PC &= 0xFF;
        }
        // UTILITY FUNCTIONS
        // Compute the physical memory address 
        getAddress() {
            if (!_CurrentPCB) {
                throw new Error("No PCB is currently running.");
            }
            const low = this.fetchByte(1);
            const high = this.fetchByte(2);
            const logical = ((high << 8) | low) & 0xFFFF;
            const offset = logical % PARTITION_SIZE;
            return _CurrentPCB.base + offset;
        }
        // Get a byte from memory relative to PC
        fetchByte(offset) {
            if (!_CurrentPCB) {
                throw new Error("No PCB is currently running.");
            }
            const logicalPc = (this.PC + offset) & 0xFF;
            const address = _CurrentPCB.base + logicalPc;
            return _MemoryAccessor.readByte(address);
        }
        syncToPCB() {
            if (!_CurrentPCB)
                return;
            _CurrentPCB.pc = this.PC;
            _CurrentPCB.acc = this.Acc;
            _CurrentPCB.xReg = this.Xreg;
            _CurrentPCB.yReg = this.Yreg;
            _CurrentPCB.zFlag = this.Zflag;
            _CurrentPCB.base = this.baseReg;
            _CurrentPCB.limit = this.limitReg;
        }
        loadFromPCB(pcb) {
            this.PC = pcb.pc;
            this.Acc = pcb.acc;
            this.Xreg = pcb.xReg;
            this.Yreg = pcb.yReg;
            this.Zflag = pcb.zFlag;
            this.baseReg = pcb.base;
            this.limitReg = pcb.limit;
            this.instructionReg = "00"; // IR is cleared; will be fetched on next cycle
            this.isExecuting = true;
            _CurrentPCB = pcb; // make sure the global reference is set
        }
    }
    TSOS.Cpu = Cpu;
})(TSOS || (TSOS = {}));
// Similar to memory and memoryaccessor, used my computer org and arch project as reference for implementation
// Overall logic is the same, just a difference in implementation
// Used AI(chatgpt and copilot) to debug and adjust some OP commands that
// were producing memory access violations
//# sourceMappingURL=cpu.js.map